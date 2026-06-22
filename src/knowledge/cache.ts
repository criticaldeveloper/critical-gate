import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  FileGraph,
  HistoryIndex,
  KnowledgeCacheKey,
  PatternIndex,
  SolutionIndex
} from "./types.js";

export const KNOWLEDGE_CACHE_SCHEMA_VERSION = 1;
export const KNOWLEDGE_CACHE_DIR = ".critical-gate/cache";

export interface KnowledgeCache {
  get: (key: KnowledgeCacheKey) => KnowledgeCacheEntry | undefined;
  set: (key: KnowledgeCacheKey, value: KnowledgeCacheEntry) => void;
}

export interface KnowledgeCacheEntry {
  graph?: FileGraph;
  history?: HistoryIndex;
  patterns?: PatternIndex;
  solutions?: SolutionIndex;
}

export interface KnowledgeCacheKeyOptions {
  root: string;
  baseRef?: string;
  headRef?: string;
  runner: {
    execFile: (file: string, args: string[], options?: { cwd?: string }) => string;
    readFile?: (path: string) => string;
  };
}

export function createMemoryKnowledgeCache(): KnowledgeCache {
  const entries = new Map<string, KnowledgeCacheEntry>();

  return {
    get: (key) => entries.get(serializeKnowledgeCacheKey(key)),
    set: (key, value) => {
      entries.set(serializeKnowledgeCacheKey(key), value);
    }
  };
}

export function createFileKnowledgeCache(root: string): KnowledgeCache {
  const cacheRoot = getKnowledgeCacheRoot(root);

  return {
    get: (key) => {
      const path = getCachePath(cacheRoot, key);

      if (!existsSync(path)) {
        return undefined;
      }

      try {
        return JSON.parse(readFileSync(path, "utf8")) as KnowledgeCacheEntry;
      } catch {
        return undefined;
      }
    },
    set: (key, value) => {
      mkdirSync(cacheRoot, { recursive: true });
      writeFileSync(getCachePath(cacheRoot, key), JSON.stringify(value), "utf8");
    }
  };
}

export function getKnowledgeCacheRoot(root: string): string {
  return join(tmpdir(), "critical-gate", hashString(root), "cache");
}

export function buildKnowledgeCacheKey(options: KnowledgeCacheKeyOptions): KnowledgeCacheKey {
  return {
    schemaVersion: KNOWLEDGE_CACHE_SCHEMA_VERSION,
    root: options.root,
    baseRef: options.baseRef,
    headRef: options.headRef,
    fingerprints: {
      packageJson: hashOptionalFile(options, "package.json"),
      packageLock: hashOptionalFile(options, "package-lock.json"),
      pnpmLock: hashOptionalFile(options, "pnpm-lock.yaml"),
      yarnLock: hashOptionalFile(options, "yarn.lock"),
      bunLock: hashOptionalFile(options, "bun.lock") ?? hashOptionalFile(options, "bun.lockb"),
      tsconfig: hashOptionalFile(options, "tsconfig.json"),
      trackedSources: hashString(
        getOptionalGitOutput(
          options.runner,
          ["ls-files", "-s", "--", "src", "packages", "lib", "tests"],
          options.root
        ) ?? ""
      )
    }
  };
}

export function serializeKnowledgeCacheKey(key: KnowledgeCacheKey): string {
  return JSON.stringify({
    schemaVersion: key.schemaVersion,
    root: key.root,
    baseRef: key.baseRef,
    headRef: key.headRef,
    fingerprints: Object.fromEntries(
      Object.entries(key.fingerprints).sort(([left], [right]) => left.localeCompare(right))
    )
  });
}

function getCachePath(cacheRoot: string, key: KnowledgeCacheKey): string {
  return join(cacheRoot, `${hashString(serializeKnowledgeCacheKey(key))}.json`);
}

function hashOptionalFile(options: KnowledgeCacheKeyOptions, path: string): string {
  try {
    return hashString(options.runner.readFile?.(join(options.root, path)) ?? "");
  } catch {
    return "";
  }
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getOptionalGitOutput(
  runner: KnowledgeCacheKeyOptions["runner"],
  args: string[],
  cwd: string
): string | undefined {
  try {
    const output = runner.execFile("git", args, { cwd }).trim();
    return output.length > 0 ? output : undefined;
  } catch {
    return undefined;
  }
}

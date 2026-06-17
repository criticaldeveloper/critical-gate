import { join } from "node:path";

import type { UtilityEntry, UtilityIndex } from "../schema/index.js";

export interface UtilityIndexRunner {
  execFile: (file: string, args: string[], options?: { cwd?: string }) => string;
  readFile?: (path: string) => string;
}

export interface BuildUtilityIndexOptions {
  root: string;
  runner: UtilityIndexRunner;
}

const utilityPathPattern = /(^|\/)(utils?|helpers?|lib|shared)\//i;
const sourcePathPattern = /\.(?:[cm]?[jt]sx?)$/;
const exportDeclarationPattern =
  /^\s*export\s+(?:async\s+)?(?:declare\s+)?(?:function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
const namedExportPattern = /^\s*export\s*\{([^}]+)\}/gm;

export function buildUtilityIndex(options: BuildUtilityIndexOptions): UtilityIndex {
  const files = getTrackedUtilityFiles(options);

  return {
    utilities: files
      .map((path) => toUtilityEntry(path, options))
      .filter((entry): entry is UtilityEntry => entry !== undefined)
      .sort((left, right) => left.path.localeCompare(right.path))
  };
}

export function extractExportedNames(sourceText: string): string[] {
  const names = new Set<string>();

  for (const match of sourceText.matchAll(exportDeclarationPattern)) {
    const name = match[1];
    if (name !== undefined) {
      names.add(name);
    }
  }

  for (const match of sourceText.matchAll(namedExportPattern)) {
    const exportedNames = match[1] ?? "";
    for (const rawName of exportedNames.split(",")) {
      const name = rawName
        .trim()
        .split(/\s+as\s+/i)[0]
        ?.trim();
      if (name !== undefined && name.length > 0) {
        names.add(name);
      }
    }
  }

  return [...names].sort();
}

function getTrackedUtilityFiles(options: BuildUtilityIndexOptions): string[] {
  try {
    return options.runner
      .execFile("git", ["ls-files"], { cwd: options.root })
      .split(/\r?\n/)
      .map((path) => path.trim())
      .filter((path) => sourcePathPattern.test(path))
      .filter((path) => utilityPathPattern.test(path));
  } catch {
    return [];
  }
}

function toUtilityEntry(path: string, options: BuildUtilityIndexOptions): UtilityEntry | undefined {
  const sourceText = options.runner.readFile?.(join(options.root, path)) ?? "";
  const exportedNames = extractExportedNames(sourceText);

  if (exportedNames.length === 0) {
    return undefined;
  }

  return {
    path,
    exportedNames
  };
}

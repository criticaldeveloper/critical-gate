import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { DiffFile } from "../schema/index.js";

import { buildRepositoryProfile, buildUtilityIndex } from "../repository/index.js";
import { classifyPath, detectLanguage } from "./path-classifier.js";
import { parseUnifiedDiff } from "./parse-unified-diff.js";

export interface GitCommandRunner {
  execFile: (file: string, args: string[], options?: { cwd?: string }) => string;
  readFile?: (path: string) => string;
}

export interface ReadGitDiffOptions {
  baseRef?: string;
  cwd?: string;
  runner?: GitCommandRunner;
}

export interface GitDiffResult {
  root: string;
  baseRef?: string;
  headRef?: string;
  files: DiffFile[];
  repositoryProfile?: ReturnType<typeof buildRepositoryProfile>;
  utilityIndex?: ReturnType<typeof buildUtilityIndex>;
}

const defaultRunner: GitCommandRunner = {
  execFile: (file, args, options) =>
    execFileSync(file, args, {
      cwd: options?.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }),
  readFile: (path) => readFileSync(path, "utf8")
};

export function readGitDiff(options: ReadGitDiffOptions = {}): GitDiffResult {
  const runner = options.runner ?? defaultRunner;
  const root = runner
    .execFile("git", ["rev-parse", "--show-toplevel"], {
      cwd: options.cwd
    })
    .trim();
  const baseRef = options.baseRef;
  const headRef = getOptionalGitOutput(runner, ["rev-parse", "--abbrev-ref", "HEAD"], root);
  const diffArgs = getDiffArgs(baseRef);
  const diffText = runner.execFile("git", diffArgs, { cwd: root });
  const trackedFiles = parseUnifiedDiff(diffText);
  const untrackedFiles = baseRef === undefined ? readUntrackedFiles(root, runner) : [];
  const repositoryProfile = buildRepositoryProfile({ root, runner });
  const utilityIndex = buildUtilityIndex({ root, runner });

  return {
    root,
    baseRef,
    headRef,
    files: [...trackedFiles, ...untrackedFiles],
    repositoryProfile,
    utilityIndex
  };
}

function getDiffArgs(baseRef: string | undefined): string[] {
  if (baseRef === undefined) {
    return ["diff", "--no-ext-diff", "--no-color", "HEAD", "--"];
  }

  return ["diff", "--no-ext-diff", "--no-color", `${baseRef}...HEAD`, "--"];
}

function readUntrackedFiles(root: string, runner: GitCommandRunner): DiffFile[] {
  const output = getOptionalGitOutput(runner, ["ls-files", "--others", "--exclude-standard"], root);

  if (output === undefined) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((path) => path.trim())
    .filter((path) => path.length > 0)
    .map((path) => {
      const content = runner.readFile?.(join(root, path)) ?? "";
      const additions = countLines(content);

      return {
        path,
        status: "added",
        role: classifyPath(path),
        additions,
        deletions: 0,
        newPath: path,
        language: detectLanguage(path),
        hunks: []
      };
    });
}

function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  return content.endsWith("\n") ? content.split(/\r?\n/).length - 1 : content.split(/\r?\n/).length;
}

function getOptionalGitOutput(
  runner: GitCommandRunner,
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

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { KnowledgeProvider } from "../knowledge/index.js";
import type { DiffFile, RepositoryProfile, UtilityIndex } from "../schema/index.js";

import { createLazyKnowledgeProvider } from "../knowledge/index.js";
import { classifyPath, detectLanguage } from "./path-classifier.js";
import { parseUnifiedDiff } from "./parse-unified-diff.js";

export const GIT_MAX_BUFFER_BYTES = 50 * 1024 * 1024;

export interface GitCommandRunner {
  execFile: (file: string, args: string[], options?: { cwd?: string }) => string;
  readFile?: (path: string) => string;
}

export interface ReadGitDiffOptions {
  baseRef?: string;
  cwd?: string;
  staged?: boolean;
  runner?: GitCommandRunner;
}

export interface GitDiffResult {
  root: string;
  baseRef?: string;
  headRef?: string;
  files: DiffFile[];
  knowledge?: KnowledgeProvider;
  repositoryProfile?: RepositoryProfile;
  utilityIndex?: UtilityIndex;
}

type ExecFile = typeof execFileSync;

export function createGitCommandRunner(execFile: ExecFile = execFileSync): GitCommandRunner {
  return {
    execFile: (file, args, options) => {
      try {
        return execFile(file, args, {
          cwd: options?.cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          maxBuffer: GIT_MAX_BUFFER_BYTES
        }) as string;
      } catch (error) {
        throw toGitCommandError(error, file, args);
      }
    },
    readFile: (path) => readFileSync(path, "utf8")
  };
}

const defaultRunner = createGitCommandRunner();

function toGitCommandError(error: unknown, file: string, args: string[]): Error {
  if (isNodeError(error) && error.code === "ENOBUFS") {
    const limitMb = GIT_MAX_BUFFER_BYTES / 1024 / 1024;

    return new Error(
      `Git command exceeded Critical Gate's ${limitMb} MiB output limit: ${file} ${args.join(" ")}. ` +
        "Large generated artifacts can produce oversized diffs; narrow the analyzed range or normalize generated-file churn before rerunning.",
      { cause: error }
    );
  }

  return error instanceof Error ? error : new Error(String(error));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export function readGitDiff(options: ReadGitDiffOptions = {}): GitDiffResult {
  const runner = options.runner ?? defaultRunner;
  const root = runner
    .execFile("git", ["rev-parse", "--show-toplevel"], {
      cwd: options.cwd
    })
    .trim();
  const baseRef = options.baseRef;
  const headRef = getOptionalGitOutput(runner, ["rev-parse", "--abbrev-ref", "HEAD"], root);
  const diffArgs = getDiffArgs(baseRef, options.staged === true);
  const diffText = runner.execFile("git", diffArgs, { cwd: root });
  const trackedFiles = parseUnifiedDiff(diffText).filter(
    (file) => !isInternalCriticalGatePath(file.path)
  );
  const untrackedFiles =
    baseRef === undefined && options.staged !== true ? readUntrackedFiles(root, runner) : [];

  return {
    root,
    baseRef,
    headRef,
    files: [...trackedFiles, ...untrackedFiles],
    knowledge: createLazyKnowledgeProvider({ root, runner, baseRef, headRef })
  };
}

function getDiffArgs(baseRef: string | undefined, staged: boolean): string[] {
  if (staged) {
    return ["diff", "--cached", "--no-ext-diff", "--no-color", "--"];
  }

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
    .filter((path) => !isInternalCriticalGatePath(path))
    .map((path) => {
      const content = runner.readFile?.(join(root, path)) ?? "";
      const additions = countLines(content);
      const lines = toAddedDiffLines(content);

      return {
        path,
        status: "added",
        role: classifyPath(path),
        additions,
        deletions: 0,
        newPath: path,
        language: detectLanguage(path),
        hunks:
          lines.length === 0
            ? []
            : [
                {
                  oldStart: 0,
                  oldLines: 0,
                  newStart: 1,
                  newLines: lines.length,
                  lines
                }
              ]
      };
    });
}

function isInternalCriticalGatePath(path: string): boolean {
  return path.replaceAll("\\", "/").startsWith(".critical-gate/cache/");
}

function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  return content.endsWith("\n") ? content.split(/\r?\n/).length - 1 : content.split(/\r?\n/).length;
}

function toAddedDiffLines(content: string): DiffFile["hunks"][number]["lines"] {
  if (content.length === 0) {
    return [];
  }

  const rawLines = content.endsWith("\n")
    ? content.split(/\r?\n/).slice(0, -1)
    : content.split(/\r?\n/);

  return rawLines.map((line, index) => ({
    kind: "add",
    content: line,
    newLineNumber: index + 1
  }));
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

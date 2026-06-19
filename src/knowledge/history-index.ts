import type { RepositoryCoChange, RepositoryProfile } from "../schema/index.js";
import { buildNormalChangePatterns } from "./normal-change-model.js";
import type { CompanionRule, HistoryIndex } from "./types.js";

export interface HistoryCommandRunner {
  execFile: (file: string, args: string[], options?: { cwd?: string }) => string;
}

export interface BuildHistoryIndexOptions {
  root: string;
  runner: HistoryCommandRunner;
  maxCommits?: number;
  minConfidenceCommitCount?: number;
  minCompanionSupport?: number;
  minCompanionConfidence?: number;
}

export function createEmptyHistoryIndex(): HistoryIndex {
  return {
    coChanges: [],
    companionRules: [],
    normalPatterns: []
  };
}

export function buildHistoryIndex(options: BuildHistoryIndexOptions): HistoryIndex {
  const maxCommits = options.maxCommits ?? 200;
  const minConfidenceCommitCount = options.minConfidenceCommitCount ?? 20;
  const minCompanionSupport = options.minCompanionSupport ?? 2;
  const minCompanionConfidence = options.minCompanionConfidence ?? 0.4;
  const logOutput = getOptionalGitOutput(
    options.runner,
    ["log", `--max-count=${maxCommits}`, "--name-only", "--pretty=format:__COMMIT__"],
    options.root
  );

  if (logOutput === undefined) {
    return {
      profile: {
        commitCount: 0,
        minConfidenceCommitCount,
        coChanges: []
      },
      coChanges: [],
      companionRules: [],
      normalPatterns: []
    };
  }

  const commits = parseNameOnlyLog(logOutput);
  const coChangeMap = new Map<string, Map<string, number>>();
  const changeCounts = new Map<string, number>();

  for (const commit of commits) {
    const files = [...new Set(commit)].sort();

    for (const file of files) {
      changeCounts.set(file, (changeCounts.get(file) ?? 0) + 1);
      const related = coChangeMap.get(file) ?? new Map<string, number>();

      for (const other of files) {
        if (other === file) {
          continue;
        }

        related.set(other, (related.get(other) ?? 0) + 1);
      }

      coChangeMap.set(file, related);
    }
  }

  const coChanges = [...coChangeMap.entries()]
    .map(([path, related]) => toCoChange(path, changeCounts.get(path) ?? 0, related))
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    profile: {
      commitCount: commits.length,
      minConfidenceCommitCount,
      coChanges
    },
    coChanges,
    companionRules: toCompanionRules(coChanges, minCompanionSupport, minCompanionConfidence),
    normalPatterns: buildNormalChangePatterns(coChanges, {
      minSupport: minCompanionSupport,
      minConfidence: minCompanionConfidence
    })
  };
}

export function buildRepositoryProfileFromHistoryIndex(index: HistoryIndex): RepositoryProfile {
  return (
    index.profile ?? {
      commitCount: 0,
      minConfidenceCommitCount: 20,
      coChanges: index.coChanges
    }
  );
}

export function parseNameOnlyLog(logOutput: string): string[][] {
  const commits: string[][] = [];
  let currentCommit: string[] = [];

  for (const rawLine of logOutput.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line === "__COMMIT__") {
      if (currentCommit.length > 0) {
        commits.push(currentCommit);
      }
      currentCommit = [];
      continue;
    }

    if (line.length > 0) {
      currentCommit.push(line);
    }
  }

  if (currentCommit.length > 0) {
    commits.push(currentCommit);
  }

  return commits;
}

function toCoChange(path: string, count: number, related: Map<string, number>): RepositoryCoChange {
  return {
    path,
    count,
    relatedPaths: [...related.entries()]
      .map(([relatedPath, relatedCount]) => ({
        path: relatedPath,
        count: relatedCount
      }))
      .sort((left, right) => right.count - left.count || left.path.localeCompare(right.path))
      .slice(0, 10)
  };
}

function toCompanionRules(
  coChanges: RepositoryCoChange[],
  minSupport: number,
  minConfidence: number
): CompanionRule[] {
  return coChanges
    .flatMap((coChange) =>
      coChange.relatedPaths.map((related) => ({
        sourcePath: coChange.path,
        expectedPath: related.path,
        support: related.count,
        confidence: coChange.count > 0 ? related.count / coChange.count : 0
      }))
    )
    .filter((rule) => rule.support >= minSupport && rule.confidence >= minConfidence)
    .sort(
      (left, right) =>
        left.sourcePath.localeCompare(right.sourcePath) ||
        right.confidence - left.confidence ||
        left.expectedPath.localeCompare(right.expectedPath)
    );
}

function getOptionalGitOutput(
  runner: HistoryCommandRunner,
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

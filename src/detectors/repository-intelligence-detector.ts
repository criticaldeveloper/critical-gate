import type { DiffFile, Finding, RepositoryProfile } from "../schema/index.js";
import type { HistoryIndex, NormalChangePattern } from "../knowledge/index.js";

import type { Detector } from "./types.js";

export const repositoryIntelligenceDetector: Detector = {
  name: "repository-intelligence",
  run: ({ diff, context }) => {
    const history = context?.knowledge?.getHistoryIndex();
    const profile = context?.repositoryProfile ?? history?.profile;

    if (profile === undefined || profile.commitCount < profile.minConfidenceCommitCount) {
      return [];
    }

    const changedPaths = diff.files.map((file) => file.path);

    if (changedPaths.length < 2) {
      return [];
    }

    return diff.files
      .filter((file) => isHistoricallyUnrelated(file, changedPaths, profile))
      .map((file) => toFinding(file, changedPaths, profile, history));
  }
};

function isHistoricallyUnrelated(
  file: DiffFile,
  changedPaths: string[],
  profile: RepositoryProfile
): boolean {
  const coChange = profile.coChanges.find((entry) => entry.path === file.path);

  if (coChange === undefined || coChange.count === 0) {
    return false;
  }

  const relatedChangedPaths = coChange.relatedPaths.filter((related) =>
    changedPaths.includes(related.path)
  );

  return relatedChangedPaths.length === 0;
}

function toFinding(
  file: DiffFile,
  changedPaths: string[],
  profile: RepositoryProfile,
  history: HistoryIndex | undefined
): Finding {
  const coChange = profile.coChanges.find((entry) => entry.path === file.path);
  const topRelated = coChange?.relatedPaths.slice(0, 3).map((related) => related.path) ?? [];
  const normalPatterns = getNormalPatternsForPath(file.path, history?.normalPatterns ?? []);

  return {
    id: `repository-intelligence:${file.path}`,
    detector: "repository-intelligence",
    severity: "medium",
    confidence: 0.72,
    title: "Unusual historical change pattern",
    message: `${file.path} changed with files it has not historically changed with in this repository.`,
    evidence: [
      {
        kind: "history",
        path: file.path,
        message: `No historical co-change match among: ${changedPaths.join(", ")}.`,
        data: {
          commitCount: profile.commitCount,
          fileChangeCount: coChange?.count ?? 0,
          historicallyRelatedPaths: topRelated,
          normalPatterns: normalPatterns.map((pattern) => ({
            kind: pattern.kind,
            relatedPath: pattern.relatedPath,
            support: pattern.support,
            confidence: pattern.confidence
          }))
        }
      }
    ],
    repair:
      "Confirm this cross-area change belongs in the current task, or split unrelated edits into a separate task.",
    tags: ["scope"]
  };
}

function getNormalPatternsForPath(
  path: string,
  normalPatterns: NormalChangePattern[]
): NormalChangePattern[] {
  return normalPatterns
    .filter((pattern) => pattern.sourcePath === path || pattern.relatedPath === path)
    .slice(0, 5);
}

import type { DiffFile, Finding, RepositoryProfile } from "../schema/index.js";
import type { HistoryIndex, NormalChangePattern } from "../knowledge/index.js";

import type { Detector } from "./types.js";
import { isContentPostReciprocalMetadataChange } from "./content-metadata-change.js";

export const repositoryIntelligenceDetector: Detector = {
  name: "repository-intelligence",
  run: ({ task, diff, context }) => {
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
      .filter(
        (file) =>
          isHistoricallyUnrelated(file, changedPaths, profile) &&
          !isExplicitFocusedUiPresentationChange(file, diff.files, task.text) &&
          !isContentPostReciprocalMetadataChange(diff.files, task.text)
      )
      .map((file) => toFinding(file, changedPaths, profile, history));
  }
};

const focusedUiPresentationTaskPattern =
  /\b(?:style|styles|styling|visual|redesign|polish|spacing|sizing|grid|layout|align|masonry|card|cards|cta|arrow|icon|indicator|vinyl|animation|animated|mobile|css|scss|typography|display|view|mode)\b/i;
const uiPresentationPathPattern =
  /(^|\/)(components?|views?|pages?|screens?|styles?|theme|themes|scripts?)\/|\.astro$|\.(?:css|scss|sass|less)$/i;
const visualAssetPathPattern = /(^|\/)(public|assets?)\/.+\.(?:png|jpe?g|webp|gif|svg|avif)$/i;
const genericPathTokens = new Set([
  "component",
  "components",
  "view",
  "views",
  "page",
  "pages",
  "screen",
  "screens",
  "style",
  "styles",
  "script",
  "scripts",
  "src"
]);

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

function isExplicitFocusedUiPresentationChange(
  file: DiffFile,
  files: DiffFile[],
  taskText: string
): boolean {
  if (
    files.length === 0 ||
    files.length > 6 ||
    !focusedUiPresentationTaskPattern.test(taskText) ||
    !files.every(isUiPresentationOrAssetChange)
  ) {
    return false;
  }

  return getPathIntentTokens(file.path).some((token) => taskMentionsToken(taskText, token));
}

function isUiPresentationOrAssetChange(file: DiffFile): boolean {
  return (
    file.status !== "deleted" &&
    (file.role === "source" || file.role === "unknown") &&
    (uiPresentationPathPattern.test(file.path) || visualAssetPathPattern.test(file.path))
  );
}

function getPathIntentTokens(path: string): string[] {
  const fileName = path
    .split("/")
    .at(-1)
    ?.replace(/\.[^.]+$/u, "");

  if (fileName === undefined) {
    return [];
  }

  const tokens = fileName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 3)
    .filter((token) => !genericPathTokens.has(token));

  return [...new Set(tokens)];
}

function taskMentionsToken(taskText: string, token: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(token)}([^a-z0-9]|$)`, "i").test(taskText);
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

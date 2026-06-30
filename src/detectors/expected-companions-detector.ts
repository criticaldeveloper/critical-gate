import { frameworkPacks, matchesPathPattern } from "../frameworks/index.js";
import type { CompanionRule, NormalChangePattern } from "../knowledge/index.js";
import type { DiffFile, Finding } from "../schema/index.js";
import {
  isExplicitPackageUpgradeDiff,
  isManifestOrLockfilePath
} from "./package-upgrade-intent.js";
import type { Detector } from "./types.js";

const maxHistoryFindingsPerSource = 3;
const maxFrameworkFindingsPerSource = 2;
const maxFocusedUiPresentationFiles = 12;
const minimumHistoryCommitCount = 20;
const minimumCompanionSupport = 3;
const stylePathPattern = /\.(?:css|scss|sass|less|styl)$/i;
const componentPathPattern = /\.(?:astro|vue|svelte|[jt]sx)$/i;
const structuralLinePattern =
  /^\s*(?:import\s|export\s|interface\s+Props\b|type\s+Props\b|const\s+\{\s*[^}]+\s*\}\s*=\s*Astro\.props\b)/;
const companionRelevantDataPattern =
  /\bdata-(?:frame|scroll|release|artist|hero|outro|cursor|sequence)-[a-z0-9-]+/gi;

export const expectedCompanionsDetector: Detector = {
  name: "expected-companions",
  run: ({ task, diff, context }) => {
    const history = context?.knowledge?.getHistoryIndex();

    const changedPaths = new Set(diff.files.map((file) => file.path));
    const packageUpgradeDiff = isExplicitPackageUpgradeDiff(task.text, diff.files);
    const historyFindings =
      history === undefined || !hasMatureHistory(history.profile?.commitCount)
        ? []
        : getCappedHistoryFindings(
            history.companionRules.filter(
              (rule) =>
                changedPaths.has(rule.sourcePath) &&
                !changedPaths.has(rule.expectedPath) &&
                isStrongCompanionRule(rule) &&
                !isLowRelevanceCompanionChange(
                  rule.sourcePath,
                  diff.files,
                  task.text,
                  packageUpgradeDiff
                )
            ),
            history.normalPatterns ?? []
          );
    const frameworkFindings = getFrameworkFindings(
      diff.files,
      context?.frameworkPacks ?? [],
      task.text
    );
    const packageFinding = detectMissingLockfile(diff.files);

    return packageFinding === undefined
      ? [...historyFindings, ...frameworkFindings]
      : [...historyFindings, ...frameworkFindings, packageFinding];
  }
};

function getFrameworkFindings(
  files: DiffFile[],
  activePackIds: string[],
  taskText: string
): Finding[] {
  if (activePackIds.length === 0) {
    return [];
  }

  const changedPaths = files.map((file) => file.path);
  const findingsBySource = new Map<string, Finding[]>();

  for (const pack of frameworkPacks.filter((candidate) => activePackIds.includes(candidate.id))) {
    for (const rule of pack.companionRules) {
      const matchingSources = files.filter(
        (file) =>
          file.role === "source" &&
          file.status !== "deleted" &&
          matchesPathPattern(rule.whenChanged, file.path) &&
          !isLowRelevanceFrameworkChange(file, files, taskText)
      );

      if (
        matchingSources.length === 0 ||
        rule.expectAny.some((pattern) =>
          changedPaths.some((path) => matchesPathPattern(pattern, path))
        )
      ) {
        continue;
      }

      for (const source of matchingSources) {
        findingsBySource.set(source.path, [
          ...(findingsBySource.get(source.path) ?? []),
          toFrameworkFinding(source, pack.label, rule)
        ]);
      }
    }
  }

  return [...findingsBySource.values()].flatMap((findings) =>
    findings.slice(0, maxFrameworkFindingsPerSource)
  );
}

function hasMatureHistory(commitCount: number | undefined): boolean {
  return commitCount === undefined || commitCount >= minimumHistoryCommitCount;
}

function isStrongCompanionRule(rule: CompanionRule): boolean {
  return rule.support >= minimumCompanionSupport;
}

function isLowRelevanceCompanionChange(
  path: string,
  files: DiffFile[],
  taskText: string,
  packageUpgradeDiff: boolean
): boolean {
  return (
    (packageUpgradeDiff && isManifestOrLockfilePath(path)) ||
    isTrivialStylesheetChange(path, files) ||
    isTinySelfContainedComponentChange(path, files) ||
    isFocusedUiPresentationChange(path, files, taskText)
  );
}

function isLowRelevanceFrameworkChange(
  file: DiffFile,
  files: DiffFile[],
  taskText: string
): boolean {
  return (
    isTinySelfContainedComponentChange(file.path, files) ||
    isSelfContainedAddedComponent(file) ||
    isSelfContainedComponentWiringChange(file, files) ||
    isSelfContainedAstroStyleChange(file) ||
    isFocusedUiPresentationChange(file.path, files, taskText)
  );
}

function isTinySelfContainedComponentChange(path: string, files: DiffFile[]): boolean {
  if (!componentPathPattern.test(path) || files.length !== 1) {
    return false;
  }

  const file = files.find((candidate) => candidate.path === path);

  if (file === undefined || file.status !== "modified") {
    return false;
  }

  const churn = file.additions + file.deletions;

  if (churn === 0 || churn > 6) {
    return false;
  }

  return !hasCompanionRelevantLine(file);
}

function isSelfContainedAddedComponent(file: DiffFile): boolean {
  return (
    file.status === "added" &&
    /\.(?:astro|vue|svelte)$/.test(file.path) &&
    (file.hunks.length === 0 || hasAddedLine(file, /<style\b/i))
  );
}

function isSelfContainedComponentWiringChange(file: DiffFile, files: DiffFile[]): boolean {
  if (!/\.astro$/i.test(file.path) || file.status !== "modified") {
    return false;
  }

  const addedComponentNames = getAddedSelfContainedComponentNames(files);

  if (addedComponentNames.length === 0) {
    return false;
  }

  const churn = file.additions + file.deletions;

  if (churn === 0 || churn > 8) {
    return false;
  }

  const changedLines = file.hunks
    .flatMap((hunk) => hunk.lines)
    .filter((line) => line.kind === "add" || line.kind === "delete");

  return changedLines.every((line) =>
    addedComponentNames.some((componentName) => line.content.includes(componentName))
  );
}

function isSelfContainedAstroStyleChange(file: DiffFile): boolean {
  return /\.astro$/i.test(file.path) && file.status === "modified" && hasAstroStyleSignal(file);
}

function getAddedSelfContainedComponentNames(files: DiffFile[]): string[] {
  return files
    .filter(isSelfContainedAddedComponent)
    .map((file) =>
      file.path
        .split("/")
        .at(-1)
        ?.replace(/\.[^.]+$/, "")
    )
    .filter((name): name is string => name !== undefined && name.length > 0);
}

function hasCompanionRelevantLine(file: DiffFile): boolean {
  const changedLines = file.hunks
    .flatMap((hunk) => hunk.lines)
    .filter((line) => line.kind === "add" || line.kind === "delete");

  if (changedLines.some((line) => structuralLinePattern.test(line.content))) {
    return true;
  }

  const addedDataHooks = new Set(
    changedLines
      .filter((line) => line.kind === "add")
      .flatMap((line) => extractRelevantDataHooks(line.content))
  );
  const deletedDataHooks = new Set(
    changedLines
      .filter((line) => line.kind === "delete")
      .flatMap((line) => extractRelevantDataHooks(line.content))
  );

  return !setsEqual(addedDataHooks, deletedDataHooks);
}

function hasAddedLine(file: DiffFile, pattern: RegExp): boolean {
  return file.hunks
    .flatMap((hunk) => hunk.lines)
    .some((line) => line.kind === "add" && pattern.test(line.content));
}

function hasAstroStyleSignal(file: DiffFile): boolean {
  return file.hunks
    .flatMap((hunk) => hunk.lines)
    .some(
      (line) =>
        (line.kind === "add" || line.kind === "delete") &&
        (/<\/?style\b/i.test(line.content) || isStyleValueLine(line.content))
    );
}

function extractRelevantDataHooks(content: string): string[] {
  return content.match(companionRelevantDataPattern)?.map((hook) => hook.toLowerCase()) ?? [];
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  return [...left].every((entry) => right.has(entry));
}

function isTrivialStylesheetChange(path: string, files: DiffFile[]): boolean {
  if (!stylePathPattern.test(path)) {
    return false;
  }

  const file = files.find((candidate) => candidate.path === path);

  if (file === undefined || file.status === "deleted") {
    return false;
  }

  const churn = file.additions + file.deletions;

  if (churn > 4) {
    return false;
  }

  const changedLines = file.hunks.flatMap((hunk) =>
    hunk.lines.filter((line) => line.kind === "add" || line.kind === "delete")
  );

  if (changedLines.length === 0) {
    return churn <= 2;
  }

  return changedLines.every((line) => isStyleValueLine(line.content));
}

function isFocusedUiPresentationChange(path: string, files: DiffFile[], taskText: string): boolean {
  const file = files.find((candidate) => candidate.path === path);

  if (file === undefined || file.status === "deleted") {
    return false;
  }

  if (!isFocusedUiPresentationTask(taskText) || !isUiPresentationDiff(files)) {
    return false;
  }

  if (stylePathPattern.test(path)) {
    return file.additions + file.deletions <= 120;
  }

  if (componentPathPattern.test(path)) {
    return !hasCompanionRelevantLine(file);
  }

  return false;
}

function isFocusedUiPresentationTask(taskText: string): boolean {
  const normalized = taskText.toLowerCase();

  return (
    /\b(?:style|styles|styling|visual|redesign|polish|spacing|sizing|grid|layout|align|masonry|card|cards|cta|arrow|icon|indicator|vinyl|animation|animated|mobile|responsive|css|scss|typography|drop cap|flicker|hero|title|overflow|section|sections|navigator|navigation|background|clip|clipping|video|youtube|seo|metadata|favicon)\b/.test(
      normalized
    ) || /\b(?:default|display|view|mode|list view|grid view)\b/.test(normalized)
  );
}

function isUiPresentationDiff(files: DiffFile[]): boolean {
  if (files.length === 0 || files.length > maxFocusedUiPresentationFiles) {
    return false;
  }

  return files.every(
    (file) =>
      file.status !== "deleted" &&
      (file.status !== "added" || isStaticVisualAssetPath(file.path)) &&
      (stylePathPattern.test(file.path) ||
        componentPathPattern.test(file.path) ||
        /^src\/scripts\/[^/]+\.[jt]s$/i.test(file.path) ||
        isStaticVisualAssetPath(file.path))
  );
}

function isStaticVisualAssetPath(path: string): boolean {
  return /^public\/.+\.(?:png|jpe?g|webp|gif|svg|avif|ico|webmanifest)$/i.test(path);
}

function isStyleValueLine(content: string): boolean {
  const trimmed = content.trim();

  if (trimmed.length === 0 || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
    return true;
  }

  return (
    /^\$?[-A-Za-z0-9_]+\s*:\s*[^;{}]+;?$/.test(trimmed) ||
    /^--[-A-Za-z0-9_]+\s*:\s*[^;{}]+;?$/.test(trimmed) ||
    /^[^{]+{\s*(?:--)?[-A-Za-z0-9_]+\s*:\s*[^;{}]+;?\s*}$/.test(trimmed)
  );
}

function toFrameworkFinding(
  file: DiffFile,
  frameworkLabel: string,
  rule: {
    id: string;
    expectAny: string[];
    reason: string;
  }
): Finding {
  return {
    id: `expected-companions:framework:${rule.id}:${file.path}`,
    detector: "expected-companions",
    severity: "medium",
    confidence: 0.72,
    title: "Expected framework companion missing",
    message: `${file.path} changed without an expected ${frameworkLabel} support file.`,
    evidence: [
      {
        kind: "file",
        path: file.path,
        message: rule.reason,
        data: {
          expectedAny: rule.expectAny,
          framework: frameworkLabel,
          rule: rule.id
        }
      }
    ],
    repair: `Add one of ${rule.expectAny.join(", ")}, or document why this ${frameworkLabel} change does not need a support file.`,
    tags: ["scope"]
  };
}

function getCappedHistoryFindings(
  rules: CompanionRule[],
  normalPatterns: NormalChangePattern[]
): Finding[] {
  const grouped = new Map<string, CompanionRule[]>();

  for (const rule of rules) {
    grouped.set(rule.sourcePath, [...(grouped.get(rule.sourcePath) ?? []), rule]);
  }

  return [...grouped.values()].flatMap((sourceRules) =>
    [...sourceRules]
      .sort((left, right) => {
        const confidenceDelta = right.confidence - left.confidence;

        if (confidenceDelta !== 0) {
          return confidenceDelta;
        }

        return right.support - left.support;
      })
      .slice(0, maxHistoryFindingsPerSource)
      .map((rule) => toHistoryFinding(rule, findNormalPattern(rule, normalPatterns)))
  );
}

function detectMissingLockfile(files: DiffFile[]): Finding | undefined {
  const changedPaths = new Set(files.map((file) => file.path));
  const changedPackage = files.find(
    (file) => file.path === "package.json" || file.path.endsWith("/package.json")
  );

  if (
    changedPackage === undefined ||
    [...changedPaths].some((path) =>
      /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lock|bun\.lockb)$/.test(path)
    )
  ) {
    return undefined;
  }

  return {
    id: `expected-companions:${changedPackage.path}:lockfile`,
    detector: "expected-companions",
    severity: "medium",
    confidence: 0.86,
    title: "Expected companion lockfile missing",
    message: `${changedPackage.path} changed without a corresponding package lockfile change.`,
    evidence: [
      {
        kind: "file",
        path: changedPackage.path,
        message: "Package manifest changed but no lockfile changed in this diff."
      }
    ],
    repair:
      "Update the matching lockfile, or document why the manifest-only change is intentional.",
    tags: ["dependency"]
  };
}

function toHistoryFinding(
  rule: CompanionRule,
  normalPattern: NormalChangePattern | undefined
): Finding {
  const relationship =
    normalPattern === undefined ? "historically paired companion" : normalPattern.kind;

  return {
    id: `expected-companions:${rule.sourcePath}:${rule.expectedPath}`,
    detector: "expected-companions",
    severity: "medium",
    confidence: Math.min(0.92, 0.55 + rule.confidence * 0.35),
    title: "Expected companion file missing",
    message: `${rule.sourcePath} changed without ${relationship} companion ${rule.expectedPath}.`,
    evidence: [
      {
        kind: "history",
        path: rule.sourcePath,
        message: `${rule.expectedPath} has historically changed with ${rule.sourcePath}.`,
        data: {
          expectedPath: rule.expectedPath,
          support: rule.support,
          confidence: rule.confidence,
          normalPattern: normalPattern?.kind
        }
      }
    ],
    repair: `Update ${rule.expectedPath}, or document why this change does not need its usual companion.`,
    tags: ["scope"]
  };
}

function findNormalPattern(
  rule: CompanionRule,
  normalPatterns: NormalChangePattern[]
): NormalChangePattern | undefined {
  return normalPatterns.find(
    (pattern) => pattern.sourcePath === rule.sourcePath && pattern.relatedPath === rule.expectedPath
  );
}

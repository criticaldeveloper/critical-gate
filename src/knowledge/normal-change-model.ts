import type { RepositoryCoChange } from "../schema/index.js";
import type { NormalChangePattern, NormalChangePatternKind } from "./types.js";

export function buildNormalChangePatterns(
  coChanges: RepositoryCoChange[],
  options: { minSupport?: number; minConfidence?: number } = {}
): NormalChangePattern[] {
  const minSupport = options.minSupport ?? 2;
  const minConfidence = options.minConfidence ?? 0.4;

  return coChanges
    .flatMap((coChange) =>
      coChange.relatedPaths.map((related) => ({
        kind: classifyNormalChangePattern(coChange.path, related.path),
        sourcePath: coChange.path,
        relatedPath: related.path,
        support: related.count,
        confidence: coChange.count > 0 ? related.count / coChange.count : 0
      }))
    )
    .filter((pattern) => pattern.kind !== "unknown")
    .filter((pattern) => pattern.support >= minSupport && pattern.confidence >= minConfidence)
    .sort(
      (left, right) =>
        left.sourcePath.localeCompare(right.sourcePath) ||
        kindRank(left.kind) - kindRank(right.kind) ||
        right.confidence - left.confidence ||
        left.relatedPath.localeCompare(right.relatedPath)
    );
}

export function classifyNormalChangePattern(
  sourcePath: string,
  relatedPath: string
): NormalChangePatternKind {
  if (isSourceTestPair(sourcePath, relatedPath)) {
    return "source-test";
  }

  if (isComponentStoryPair(sourcePath, relatedPath)) {
    return "component-story";
  }

  if (isTranslationUiPair(sourcePath, relatedPath)) {
    return "translation-ui";
  }

  if (isConfigDocsPair(sourcePath, relatedPath)) {
    return "config-docs";
  }

  if (isPackageLockfilePair(sourcePath, relatedPath)) {
    return "package-lockfile";
  }

  if (isSourceDocsPair(sourcePath, relatedPath)) {
    return "source-docs";
  }

  return "unknown";
}

function isSourceTestPair(left: string, right: string): boolean {
  return (
    (isSourcePath(left) && isTestPath(right) && shareStem(left, right)) ||
    (isTestPath(left) && isSourcePath(right) && shareStem(left, right))
  );
}

function isComponentStoryPair(left: string, right: string): boolean {
  return (
    ((isComponentPath(left) && isStoryPath(right)) ||
      (isStoryPath(left) && isComponentPath(right))) &&
    shareStem(left, right)
  );
}

function isTranslationUiPair(left: string, right: string): boolean {
  return (
    (isUiSourcePath(left) && isTranslationPath(right)) ||
    (isTranslationPath(left) && isUiSourcePath(right))
  );
}

function isConfigDocsPair(left: string, right: string): boolean {
  return (isConfigPath(left) && isDocsPath(right)) || (isDocsPath(left) && isConfigPath(right));
}

function isPackageLockfilePair(left: string, right: string): boolean {
  return (
    (isPackageManifest(left) && isPackageLockfile(right)) ||
    (isPackageLockfile(left) && isPackageManifest(right))
  );
}

function isSourceDocsPair(left: string, right: string): boolean {
  return (
    (isSourcePath(left) && isDocsPath(right) && shareStem(left, right)) ||
    (isDocsPath(left) && isSourcePath(right) && shareStem(left, right))
  );
}

function isSourcePath(path: string): boolean {
  return /\.(c|m)?[jt]sx?$/.test(path) && !isTestPath(path) && !isStoryPath(path);
}

function isUiSourcePath(path: string): boolean {
  return isSourcePath(path) && /\.(tsx|jsx)$/.test(path);
}

function isComponentPath(path: string): boolean {
  return isUiSourcePath(path) && /(^|\/)[A-Z][^/]*\.[jt]sx$/.test(path);
}

function isTestPath(path: string): boolean {
  return /(^|\/)(__tests__|tests?)\//.test(path) || /\.(spec|test)\.[cm]?[jt]sx?$/.test(path);
}

function isStoryPath(path: string): boolean {
  return /\.stories\.[cm]?[jt]sx?$/.test(path);
}

function isTranslationPath(path: string): boolean {
  return /(^|\/)(locales?|i18n|messages)\//.test(path) && /\.(json|ya?ml)$/.test(path);
}

function isConfigPath(path: string): boolean {
  return (
    /(^|\/)(tsconfig|vite\.config|webpack\.config|rollup\.config|eslint\.config|prettier\.config)/.test(
      path
    ) || /(^|\/)\.github\/workflows\//.test(path)
  );
}

function isDocsPath(path: string): boolean {
  return /(^|\/)(docs|adr|changelog)\//i.test(path) || /\.(md|mdx)$/i.test(path);
}

function isPackageManifest(path: string): boolean {
  return /(^|\/)package\.json$/.test(path);
}

function isPackageLockfile(path: string): boolean {
  return /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lock|bun\.lockb)$/.test(path);
}

function shareStem(left: string, right: string): boolean {
  const leftStem = getComparableStem(left);
  const rightStem = getComparableStem(right);

  return (
    leftStem.length > 0 &&
    rightStem.length > 0 &&
    (leftStem === rightStem || leftStem.includes(rightStem) || rightStem.includes(leftStem))
  );
}

function getComparableStem(path: string): string {
  return path
    .split(/[\\/]/)
    .at(-1)!
    .replace(/\.(stories|spec|test)\.[^.]+$/, "")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function kindRank(kind: NormalChangePatternKind): number {
  return [
    "source-test",
    "component-story",
    "translation-ui",
    "config-docs",
    "package-lockfile",
    "source-docs",
    "unknown"
  ].indexOf(kind);
}

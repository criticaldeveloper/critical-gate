import { analyzeTaskIntent } from "../intent/index.js";
import type { DiffFile, Finding, RepositoryTokenIndex } from "../schema/index.js";

import type { Detector } from "./types.js";

const broadTaskTerms = ["repo", "all", "setup", "scaffold", "architecture", "refactor"];
const configTaskTerms = [
  "build",
  "ci",
  "config",
  "configuration",
  "github action",
  "github actions",
  "lint",
  "test runner",
  "workflow"
];
const manifestTaskTerms = [
  "dependency",
  "dependencies",
  "engine",
  "engines",
  "extension",
  "manifest",
  "marketplace",
  "metadata",
  "node",
  "package",
  "publish",
  "publisher",
  "pnpm",
  "runtime"
];
const dependencyLinePattern = /^\s*"([^"]+)":\s*"([^"]+)"/;
const dependencySectionPattern =
  /^\s*"(dependencies|devDependencies|peerDependencies|optionalDependencies)":\s*\{/;

export const scopeDetector: Detector = {
  name: "scope",
  run: ({ task, diff, context }) => {
    const analysis = analyzeTaskIntent(task);

    if (analysis.complexity !== "small" || isBroadTask(task.text)) {
      return [];
    }

    return diff.files
      .filter((file) =>
        isUnexpectedForSmallTask(
          file,
          diff.files,
          analysis.keywords,
          task.text,
          context?.repositoryTokenIndex
        )
      )
      .map((file) => toFinding(file, analysis.keywords, context?.repositoryTokenIndex));
  }
};

function isBroadTask(taskText: string): boolean {
  const normalizedTask = taskText.toLowerCase();
  return broadTaskTerms.some((term) => normalizedTask.includes(term));
}

function isUnexpectedForSmallTask(
  file: DiffFile,
  files: DiffFile[],
  keywords: string[],
  taskText: string,
  tokenIndex?: RepositoryTokenIndex
): boolean {
  if (file.role === "docs" || file.role === "test") {
    return false;
  }

  if (file.role === "manifest" && isPackageVersionOnlyChange(file)) {
    return false;
  }

  if (file.role === "manifest" && isAlignedDependencyRemoval(file, taskText)) {
    return false;
  }

  if (file.role === "lockfile" && hasAlignedDependencyRemovalManifest(files, taskText)) {
    return false;
  }

  if (isRoleAlignedConfigOrManifestChange(file, taskText, keywords)) {
    return false;
  }

  if (file.role === "config" || file.role === "manifest" || file.role === "lockfile") {
    return true;
  }

  if (file.role !== "source") {
    return false;
  }

  if (file.status === "deleted" && !isDeletionAcknowledged(file, taskText, keywords)) {
    return true;
  }

  return keywords.length > 0 && !hasFileKeywordAlignment(file, keywords, tokenIndex);
}

function hasAlignedDependencyRemovalManifest(files: DiffFile[], taskText: string): boolean {
  return files.some(
    (file) => file.role === "manifest" && isAlignedDependencyRemoval(file, taskText)
  );
}

function hasPathKeywordAlignment(path: string, keywords: string[]): boolean {
  const normalizedPath = path.toLowerCase();
  return keywords.some((keyword) => normalizedPath.includes(keyword));
}

function hasFileKeywordAlignment(
  file: DiffFile,
  keywords: string[],
  tokenIndex?: RepositoryTokenIndex
): boolean {
  return (
    hasPathKeywordAlignment(file.path, keywords) ||
    getTokenKeywordMatches(file.path, keywords, tokenIndex).length > 0
  );
}

function isRoleAlignedConfigOrManifestChange(
  file: DiffFile,
  taskText: string,
  keywords: string[]
): boolean {
  if (file.role === "config") {
    if (hasConfigProhibition(taskText)) {
      return false;
    }

    return (
      hasAnyTaskTerm(taskText, configTaskTerms) || hasPathKeywordAlignment(file.path, keywords)
    );
  }

  if (file.role === "manifest" || file.role === "lockfile") {
    return hasAnyTaskTerm(taskText, manifestTaskTerms);
  }

  return false;
}

function hasAnyTaskTerm(taskText: string, terms: string[]): boolean {
  const normalizedTask = taskText.toLowerCase();
  return terms.some((term) => normalizedTask.includes(term));
}

function hasConfigProhibition(taskText: string): boolean {
  return /\b(?:without|no|avoid|do not|don't|dont|must not|never)\s+(?:(?:touching|changing|editing|modify|modifying)\s+)?(?:config|configuration|settings|runtime|node|tooling)\b/i.test(
    taskText
  );
}

function isDeletionAcknowledged(file: DiffFile, taskText: string, keywords: string[]): boolean {
  return (
    hasAnyTaskTerm(taskText, ["delete", "deleted", "remove", "removed", "drop", "cleanup"]) &&
    hasPathKeywordAlignment(file.path, keywords)
  );
}

function isPackageVersionOnlyChange(file: DiffFile): boolean {
  if (file.path !== "package.json" && !file.path.endsWith("/package.json")) {
    return false;
  }

  const changedLines = file.hunks
    .flatMap((hunk) => hunk.lines)
    .filter((line) => line.kind === "add" || line.kind === "delete");

  return (
    changedLines.length > 0 &&
    changedLines.every((line) => /^\s*"version":\s*"[^"]+"\s*,?\s*$/.test(line.content))
  );
}

function isAlignedDependencyRemoval(file: DiffFile, taskText: string): boolean {
  if (file.path !== "package.json" && !file.path.endsWith("/package.json")) {
    return false;
  }

  const beforeDependencies = extractChangedDependencyNames(file, "before");
  const afterDependencies = extractChangedDependencyNames(file, "after");
  const removedDependencies = [...beforeDependencies].filter(
    (name) => !afterDependencies.has(name)
  );
  const addedDependencies = [...afterDependencies].filter((name) => !beforeDependencies.has(name));

  return (
    removedDependencies.length > 0 &&
    addedDependencies.length === 0 &&
    removedDependencies.some((dependency) => taskMentionsDependency(taskText, dependency))
  );
}

function extractChangedDependencyNames(file: DiffFile, side: "before" | "after"): Set<string> {
  const dependencies = new Set<string>();

  for (const hunk of file.hunks) {
    let inDependencySection = false;

    for (const line of hunk.lines) {
      if (!belongsToManifestSide(line.kind, side)) {
        continue;
      }

      if (dependencySectionPattern.test(line.content)) {
        inDependencySection = true;
        continue;
      }

      if (line.kind === "context" && line.content.trim() === "}") {
        inDependencySection = false;
        continue;
      }

      if (!inDependencySection) {
        continue;
      }

      const dependency = dependencyLinePattern.exec(line.content)?.[1];

      if (dependency !== undefined) {
        dependencies.add(dependency);
      }
    }
  }

  return dependencies;
}

function belongsToManifestSide(kind: "add" | "delete" | "context", side: "before" | "after") {
  return kind === "context" || (side === "before" ? kind === "delete" : kind === "add");
}

function taskMentionsDependency(taskText: string, dependencyName: string): boolean {
  const normalizedTask = normalizeDependencyText(taskText);
  const normalizedDependency = normalizeDependencyText(dependencyName);

  return (
    normalizedTask.includes(normalizedDependency) ||
    normalizedDependency
      .split(" ")
      .filter((part) => part.length > 2)
      .every((part) => normalizedTask.includes(part))
  );
}

function normalizeDependencyText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[@/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toFinding(file: DiffFile, keywords: string[], tokenIndex?: RepositoryTokenIndex): Finding {
  const firstChangedLine = file.hunks
    .flatMap((hunk) => hunk.lines)
    .find((line) => line.kind === "add" || line.kind === "delete");
  const lineNumber = firstChangedLine?.newLineNumber ?? firstChangedLine?.oldLineNumber;
  const tokenMatches = getTokenKeywordMatches(file.path, keywords, tokenIndex);

  return {
    id: `scope:${file.path}`,
    detector: "scope",
    severity: file.role === "source" && file.status !== "deleted" ? "medium" : "high",
    confidence: file.role === "source" && file.status !== "deleted" ? 0.7 : 0.84,
    title:
      file.status === "deleted"
        ? "Unexpected file deleted for small task"
        : "Unexpected file changed for small task",
    message: `${file.path} ${file.status === "deleted" ? "was deleted" : "changed"} during a small task but does not align with expected scope.`,
    evidence: [
      {
        kind: "file",
        path: file.path,
        startLine: lineNumber,
        endLine: lineNumber,
        message: `Changed file role: ${file.role}. Task keywords: ${keywords.join(", ") || "none"}.`,
        data: {
          role: file.role,
          additions: file.additions,
          deletions: file.deletions,
          keywords,
          tokenMatches
        }
      }
    ],
    repair:
      "Remove unrelated edits or split them into a separate task with explicit justification.",
    tags: ["scope"]
  };
}

function getTokenKeywordMatches(
  path: string,
  keywords: string[],
  tokenIndex?: RepositoryTokenIndex
): Array<{ token: string; source: string; raw: string }> {
  const fileTokens = tokenIndex?.files.find((file) => file.path === path)?.tokens ?? [];
  const keywordSet = new Set(keywords.map((keyword) => keyword.toLowerCase()));

  return fileTokens
    .filter((token) => keywordSet.has(token.value))
    .map((token) => ({
      token: token.value,
      source: token.source,
      raw: token.raw
    }));
}

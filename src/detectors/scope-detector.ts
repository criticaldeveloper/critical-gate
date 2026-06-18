import { analyzeTaskIntent } from "../intent/index.js";
import type { DiffFile, Finding } from "../schema/index.js";

import type { Detector } from "./types.js";

const broadTaskTerms = ["repo", "project", "all", "setup", "scaffold", "architecture", "refactor"];
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
  "manifest",
  "node",
  "package",
  "pnpm",
  "runtime"
];
const releaseTaskPattern =
  /(?:^|\b)(?:v?\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?|release|version|bump|publish)(?:\b|$)/i;

export const scopeDetector: Detector = {
  name: "scope",
  run: ({ task, diff }) => {
    const analysis = analyzeTaskIntent(task);

    if (analysis.complexity !== "small" || isBroadTask(task.text)) {
      return [];
    }

    return diff.files
      .filter((file) => isUnexpectedForSmallTask(file, analysis.keywords, task.text))
      .map((file) => toFinding(file, analysis.keywords));
  }
};

function isBroadTask(taskText: string): boolean {
  const normalizedTask = taskText.toLowerCase();
  return broadTaskTerms.some((term) => normalizedTask.includes(term));
}

function isUnexpectedForSmallTask(file: DiffFile, keywords: string[], taskText: string): boolean {
  if (file.role === "docs" || file.role === "test") {
    return false;
  }

  if (file.role === "manifest" && isVersionOnlyReleaseManifestChange(file, taskText)) {
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

  return keywords.length > 0 && !hasPathKeywordAlignment(file.path, keywords);
}

function hasPathKeywordAlignment(path: string, keywords: string[]): boolean {
  const normalizedPath = path.toLowerCase();
  return keywords.some((keyword) => normalizedPath.includes(keyword));
}

function isRoleAlignedConfigOrManifestChange(
  file: DiffFile,
  taskText: string,
  keywords: string[]
): boolean {
  if (file.role === "config") {
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

function isVersionOnlyReleaseManifestChange(file: DiffFile, taskText: string): boolean {
  return isReleaseTask(taskText) && isPackageVersionOnlyChange(file);
}

function isReleaseTask(taskText: string): boolean {
  return releaseTaskPattern.test(taskText);
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

function toFinding(file: DiffFile, keywords: string[]): Finding {
  const firstChangedLine = file.hunks
    .flatMap((hunk) => hunk.lines)
    .find((line) => line.kind === "add" || line.kind === "delete");
  const lineNumber = firstChangedLine?.newLineNumber ?? firstChangedLine?.oldLineNumber;

  return {
    id: `scope:${file.path}`,
    detector: "scope",
    severity: file.role === "source" ? "medium" : "high",
    confidence: file.role === "source" ? 0.7 : 0.84,
    title: "Unexpected file changed for small task",
    message: `${file.path} changed during a small task but does not align with expected scope.`,
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
          keywords
        }
      }
    ],
    repair:
      "Remove unrelated edits or split them into a separate task with explicit justification.",
    tags: ["scope"]
  };
}

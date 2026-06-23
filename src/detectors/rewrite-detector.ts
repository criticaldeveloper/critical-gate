import { analyzeTaskIntent, getTaskIntentQualityWarnings } from "../intent/index.js";
import type { DiffFile, Finding, FindingSeverity } from "../schema/index.js";

import type { Detector } from "./types.js";

const minimumRewriteChurn = 80;
const minimumBalancedSide = 30;
const minimumBalanceRatio = 0.55;
const focusedUiPresentationTaskPattern =
  /\b(?:style|styles|styling|visual|redesign|polish|spacing|sizing|grid|layout|align|masonry|card|cards|cta|arrow|icon|indicator|vinyl|animation|animated|mobile|css|scss|typography|display|view|mode)\b/i;
const uiSourcePathPattern =
  /(^|\/)(components?|views?|pages?|screens?|styles?|theme|themes)\/|\.astro$|\.(?:css|scss|sass|less)$/i;
const structuralLinePattern =
  /^\s*(?:import\s|export\s|interface\s+Props\b|type\s+Props\b|const\s+\{\s*[^}]+\s*\}\s*=\s*Astro\.props\b)/;
const companionRelevantDataPattern =
  /\bdata-(?:frame|scroll|release|artist|hero|outro|cursor|sequence)-[a-z0-9-]+/i;

export const rewriteDetector: Detector = {
  name: "rewrite",
  run: ({ task, diff }) => {
    const analysis = analyzeTaskIntent(task);

    if (analysis.complexity === "large") {
      return [];
    }

    return diff.files
      .filter(isRewriteCandidate)
      .map((file) => toFinding(file, getRewriteSeverity(file, task, analysis.complexity)));
  }
};

function getRewriteSeverity(
  file: DiffFile,
  task: Parameters<Detector["run"]>[0]["task"],
  complexity: ReturnType<typeof analyzeTaskIntent>["complexity"]
): FindingSeverity {
  if (isFocusedUiPresentationRewrite(file, task.text)) {
    return "medium";
  }

  return complexity === "small" || hasWeakIntentBoundary(task) ? "high" : "medium";
}

function hasWeakIntentBoundary(task: Parameters<Detector["run"]>[0]["task"]): boolean {
  return getTaskIntentQualityWarnings(task).some(
    (warning) => warning.code === "vague-task" || warning.code === "generic-only"
  );
}

function isRewriteCandidate(file: DiffFile): boolean {
  if (!isRewriteEligibleFile(file) || file.status === "added" || file.status === "deleted") {
    return false;
  }

  const smallerSide = Math.min(file.additions, file.deletions);
  const largerSide = Math.max(file.additions, file.deletions);
  const churn = file.additions + file.deletions;

  return (
    churn >= minimumRewriteChurn &&
    smallerSide >= minimumBalancedSide &&
    smallerSide / largerSide >= minimumBalanceRatio
  );
}

function isRewriteEligibleFile(file: DiffFile): boolean {
  if (file.role === "test" || file.role === "docs" || file.role === "generated") {
    return false;
  }

  return file.role === "source" || isSourceLikePath(file.path);
}

function isFocusedUiPresentationRewrite(file: DiffFile, taskText: string): boolean {
  if (!focusedUiPresentationTaskPattern.test(taskText) || !uiSourcePathPattern.test(file.path)) {
    return false;
  }

  return !file.hunks
    .flatMap((hunk) => hunk.lines)
    .some(
      (line) =>
        (line.kind === "add" || line.kind === "delete") &&
        (structuralLinePattern.test(line.content) ||
          companionRelevantDataPattern.test(line.content))
    );
}

function isSourceLikePath(path: string): boolean {
  return /\.(?:[cm]?[jt]sx?|astro|vue|svelte|css|scss|sass|less)$/i.test(path);
}

function toFinding(file: DiffFile, severity: FindingSeverity): Finding {
  const firstChangedLine = file.hunks
    .flatMap((hunk) => hunk.lines)
    .find((line) => line.kind === "add" || line.kind === "delete");
  const lineNumber = firstChangedLine?.newLineNumber ?? firstChangedLine?.oldLineNumber;
  const churn = file.additions + file.deletions;
  const rewriteRatio = Math.round(
    (Math.min(file.additions, file.deletions) / Math.max(file.additions, file.deletions)) * 100
  );

  return {
    id: `rewrite:${file.path}`,
    detector: "rewrite",
    severity,
    confidence: severity === "high" ? 0.86 : 0.76,
    title: "Large balanced rewrite detected",
    message: `${file.path} has ${churn} changed lines with balanced additions and deletions, which looks like a rewrite.`,
    evidence: [
      {
        kind: "metric",
        path: file.path,
        startLine: lineNumber,
        endLine: lineNumber,
        message: `Additions: ${file.additions}, deletions: ${file.deletions}, rewrite balance: ${rewriteRatio}%.`,
        data: {
          additions: file.additions,
          deletions: file.deletions,
          churn,
          rewriteRatio
        }
      }
    ],
    repair:
      "Reduce the change to targeted edits, or split the rewrite into an explicit refactor task with tests and review notes.",
    tags: ["rewrite"]
  };
}

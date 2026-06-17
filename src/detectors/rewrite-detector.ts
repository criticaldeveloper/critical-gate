import { analyzeTaskIntent } from "../intent/index.js";
import type { DiffFile, Finding, FindingSeverity } from "../schema/index.js";

import type { Detector } from "./types.js";

const minimumRewriteChurn = 80;
const minimumBalancedSide = 30;
const minimumBalanceRatio = 0.55;

export const rewriteDetector: Detector = {
  name: "rewrite",
  run: ({ task, diff }) => {
    const analysis = analyzeTaskIntent(task);

    if (analysis.complexity === "large") {
      return [];
    }

    return diff.files
      .filter(isRewriteCandidate)
      .map((file) => toFinding(file, analysis.complexity === "small" ? "high" : "medium"));
  }
};

function isRewriteCandidate(file: DiffFile): boolean {
  if (file.role !== "source" || file.status === "added" || file.status === "deleted") {
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

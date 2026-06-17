import type { DiffFile, TaskIntent } from "../schema/index.js";

export type TaskComplexity = "small" | "medium" | "large";

const smallTaskTerms = [
  "fix",
  "bug",
  "rename",
  "typo",
  "copy",
  "validation",
  "message",
  "label",
  "small"
];

const largeTaskTerms = [
  "refactor",
  "rewrite",
  "migrate",
  "detector",
  "feature",
  "architecture",
  "redesign",
  "implement project",
  "new feature",
  "multi",
  "all"
];

const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "this",
  "that",
  "add",
  "fix",
  "update",
  "change",
  "implement",
  "new",
  "task",
  "issue"
]);

export interface TaskAnalysis {
  complexity: TaskComplexity;
  keywords: string[];
}

export interface DiffMetrics {
  changedFiles: number;
  additions: number;
  deletions: number;
  churn: number;
}

export function analyzeTaskIntent(task: TaskIntent): TaskAnalysis {
  const normalizedText = task.text.toLowerCase();

  return {
    complexity: estimateTaskComplexity(normalizedText),
    keywords: extractTaskKeywords(normalizedText)
  };
}

export function estimateTaskComplexity(normalizedTaskText: string): TaskComplexity {
  if (largeTaskTerms.some((term) => normalizedTaskText.includes(term))) {
    return "large";
  }

  const words = normalizedTaskText.split(/\s+/).filter(Boolean);

  if (words.length <= 8 || smallTaskTerms.some((term) => normalizedTaskText.includes(term))) {
    return "small";
  }

  return "medium";
}

export function extractTaskKeywords(normalizedTaskText: string): string[] {
  return [...new Set(normalizedTaskText.match(/[a-z0-9]+/g) ?? [])]
    .filter((word) => word.length >= 3)
    .filter((word) => !stopWords.has(word));
}

export function getDiffMetrics(files: DiffFile[]): DiffMetrics {
  const additions = files.reduce((total, file) => total + file.additions, 0);
  const deletions = files.reduce((total, file) => total + file.deletions, 0);

  return {
    changedFiles: files.length,
    additions,
    deletions,
    churn: additions + deletions
  };
}

export function calculateDiffCostScore(task: TaskIntent, files: DiffFile[]): number {
  const analysis = analyzeTaskIntent(task);
  const metrics = getDiffMetrics(files);
  const complexityMultiplier = getComplexityMultiplier(analysis.complexity);
  const fileScore = Math.min(40, metrics.changedFiles * 5 * complexityMultiplier);
  const churnScore = Math.min(35, Math.ceil(metrics.churn / 20) * 5 * complexityMultiplier);
  const roleScore = Math.min(25, getUnexpectedRoleCount(analysis.complexity, files) * 8);

  return Math.min(100, Math.round(fileScore + churnScore + roleScore));
}

function getComplexityMultiplier(complexity: TaskComplexity): number {
  switch (complexity) {
    case "small":
      return 1.4;
    case "medium":
      return 1;
    case "large":
      return 0.65;
  }
}

function getUnexpectedRoleCount(complexity: TaskComplexity, files: DiffFile[]): number {
  if (complexity !== "small") {
    return 0;
  }

  return files.filter(
    (file) => file.role === "config" || file.role === "manifest" || file.role === "lockfile"
  ).length;
}

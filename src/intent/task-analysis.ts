import type { DiffFile, TaskIntent } from "../schema/index.js";
import { buildIntentModel } from "./intent-model.js";
import { estimateTaskComplexity, extractTaskKeywords, type TaskComplexity } from "./intent-core.js";

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
  const model = buildIntentModel(task);

  return {
    complexity: model.complexity,
    keywords: model.targetTokens
  };
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

export { estimateTaskComplexity, extractTaskKeywords };
export type { TaskComplexity };

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

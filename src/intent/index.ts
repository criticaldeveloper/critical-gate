export {
  analyzeTaskIntent,
  calculateDiffCostScore,
  estimateTaskComplexity,
  extractTaskKeywords,
  getDiffMetrics,
  type DiffMetrics,
  type TaskAnalysis,
  type TaskComplexity
} from "./task-analysis.js";
export { analyzeTaskIntentQuality, getTaskIntentQualityWarnings } from "./task-intent-quality.js";
export {
  buildIntentModel,
  mapChangeClassToIntentCategory,
  type ChangeClass,
  type IntentCoverageCategory,
  type IntentModel,
  type IntentVerb,
  type TargetArea
} from "./intent-model.js";
export {
  classifyObservedDiffActions,
  summarizeIntentVerification,
  type ObservedChangeClassEvidence,
  type ObservedDiffActions
} from "./observed-actions.js";
export { calculateScopeExpansionScore } from "./scope-expansion-score.js";
export { calculateDiffCoherenceScore } from "./diff-coherence-score.js";

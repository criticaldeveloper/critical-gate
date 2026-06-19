import type {
  TaskIntent,
  TaskIntentQualitySummary,
  TaskIntentQualityWarning
} from "../schema/index.js";
import { buildIntentModel } from "./intent-model.js";

const vaguePhrases = [
  "fix bug",
  "fix bugs",
  "fix issue",
  "fix issues",
  "fix stuff",
  "update code",
  "improve code",
  "improve project",
  "make changes",
  "misc changes",
  "cleanup",
  "wip"
];

const genericTokens = new Set([
  "bug",
  "bugs",
  "code",
  "issue",
  "issues",
  "project",
  "stuff",
  "thing",
  "things",
  "change",
  "changes",
  "update",
  "fix",
  "improve"
]);

export function analyzeTaskIntentQuality(task: TaskIntent): TaskIntentQualitySummary {
  const warnings = getTaskIntentQualityWarnings(task);

  return {
    score: Math.max(0, 100 - warnings.reduce((total, warning) => total + warning.penalty, 0)),
    warnings
  };
}

export function getTaskIntentQualityWarnings(task: TaskIntent): TaskIntentQualityWarning[] {
  const text = normalizeText(task.text);
  const tokens = text.split(" ").filter(Boolean);
  const model = buildIntentModel(task);
  const warnings: TaskIntentQualityWarning[] = [];

  if (tokens.length < 3) {
    warnings.push({
      code: "too-short",
      message: "Task intent is too short to define a useful diff boundary.",
      suggestion: "Name the affected feature or file area and the expected outcome.",
      penalty: 25
    });
  }

  const matchedPhrase = vaguePhrases.find((phrase) => text === phrase || text.includes(phrase));

  if (matchedPhrase !== undefined) {
    warnings.push({
      code: "vague-task",
      message: `Task intent uses vague wording: "${matchedPhrase}".`,
      suggestion:
        "Replace generic wording with the concrete behavior, component, or bug being changed.",
      penalty: 30
    });
  }

  if (model.targetTokens.length === 0) {
    warnings.push({
      code: "missing-target",
      message: "Task intent does not name a clear target area.",
      suggestion:
        "Mention the feature, module, file family, user flow, or public API being changed.",
      penalty: 25
    });
  }

  if (tokens.length > 0 && tokens.every((token) => genericTokens.has(token))) {
    warnings.push({
      code: "generic-only",
      message: "Task intent only contains generic maintenance words.",
      suggestion:
        "Add repository-specific nouns such as signup form, CLI report, VS Code panel, or package workflow.",
      penalty: 25
    });
  }

  return dedupeWarnings(warnings);
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ");
}

function dedupeWarnings(warnings: TaskIntentQualityWarning[]): TaskIntentQualityWarning[] {
  const seen = new Set<string>();
  const deduped: TaskIntentQualityWarning[] = [];

  for (const warning of warnings) {
    if (seen.has(warning.code)) {
      continue;
    }

    seen.add(warning.code);
    deduped.push(warning);
  }

  return deduped;
}

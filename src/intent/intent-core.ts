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

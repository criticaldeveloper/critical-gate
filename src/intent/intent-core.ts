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
  "fixed",
  "new",
  "project",
  "repo",
  "task",
  "issue",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "de",
  "del",
  "para",
  "con",
  "desde",
  "este",
  "esta",
  "que",
  "y",
  "añadir",
  "agregar",
  "arreglar",
  "arregla",
  "corregir",
  "corrige",
  "actualizar",
  "actualiza",
  "cambiar",
  "cambia",
  "implementar",
  "implementa",
  "nuevo",
  "nueva",
  "proyecto",
  "repositorio",
  "tarea",
  "problema"
]);

const keywordAliases: Record<string, string[]> = {
  css: ["style", "styles", "stylesheet", "stylesheets", "scss"],
  font: ["fonts", "typography", "type", "text", "style", "styles", "css", "scss"],
  fonts: ["font", "typography", "type", "text", "style", "styles", "css", "scss"],
  scss: ["style", "styles", "stylesheet", "stylesheets", "css"],
  style: ["styles", "stylesheet", "stylesheets", "css", "scss"],
  styles: ["style", "stylesheet", "stylesheets", "css", "scss"],
  text: ["typography", "font", "fonts"],
  type: ["typography", "font", "fonts"],
  typography: ["font", "fonts", "type", "text", "style", "styles", "css", "scss"],
  weight: ["font", "fonts", "typography"]
};

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
  const keywords = [...new Set(tokenizeTaskText(normalizedTaskText))]
    .filter((word) => word.length >= 3)
    .filter((word) => !stopWords.has(word));

  return [...new Set(keywords.flatMap((keyword) => [keyword, ...(keywordAliases[keyword] ?? [])]))];
}

export function normalizeTaskText(value: string): string {
  return value.normalize("NFC").trim().toLocaleLowerCase("und");
}

export function tokenizeTaskText(value: string): string[] {
  return normalizeTaskText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

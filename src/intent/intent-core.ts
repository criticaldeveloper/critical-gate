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

const actionPatterns = [
  /\b(?:add|create|introduce|implement|a\u00f1adir|agregar|crear|implementar)\b/iu,
  /\b(?:fix|fixed|bugfix|repair|resolve|correct|arreglar|arregla|corregir|corrige|resolver|resuelve)\b/iu,
  /\b(?:remove|delete|drop|eliminar|borrar)\b/iu,
  /\b(?:rename|renombrar)\b/iu,
  /\b(?:update|change|adjust|improve|actualizar|actualiza|cambiar|cambia|ajustar|ajusta|mejorar|mejora)\b/iu,
  /\b(?:refactor|rewrite|restructure|refactorizar|reescribir|reestructurar)\b/iu,
  /\b(?:migrate|migration|migrar|migraci\u00f3n)\b/iu,
  /\b(?:bump|upgrade|actualizar\s+versi\u00f3n)\b/iu,
  /\b(?:wire|connect|integrate|conectar|integrar)\b/iu,
  /\b(?:document|documentar|documenta)\b/iu,
  /\b(?:release|publish|tag|publicar|publica|etiquetar|etiqueta)\b/iu
];

const implementationActionPattern =
  /\b(?:add|create|introduce|implement|a\u00f1adir|agregar|crear|implementar)\b/iu;
const implementationTargetPattern =
  /\b(?:component|detector|feature|integration|package|page|service|system|workflow|componente|funcionalidad|integraci\u00f3n|paquete|p\u00e1gina|servicio|sistema|flujo)\b/iu;
const coordinationPattern = /\b(?:and|also|plus|as\s+well\s+as|y|adem\u00e1s)\b/iu;

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
  const text = normalizeTaskText(normalizedTaskText);

  if (largeTaskTerms.some((term) => hasPhrase(text, term))) {
    return "large";
  }

  const segmentCount = countTaskSegments(text);
  const listItemCount = text
    .split(/\r?\n/u)
    .filter((line) => /^\s*(?:[-*]|\d+[.)])\s+/u.test(line)).length;
  const actionCount = actionPatterns.filter((pattern) => pattern.test(text)).length;
  const pathCount =
    text.match(/(?:[\w.-]+\/)+(?:\*\*|[\w.*-]+\.[\w.-]+)|[\w.-]+\.[\w.-]+/gu)?.length ?? 0;
  const commaCount = text.match(/,/gu)?.length ?? 0;

  if (segmentCount >= 3 || listItemCount >= 3 || actionCount >= 3) {
    return "large";
  }

  if (
    segmentCount >= 2 ||
    listItemCount >= 2 ||
    actionCount >= 2 ||
    coordinationPattern.test(text) ||
    pathCount >= 2 ||
    commaCount >= 2 ||
    (implementationActionPattern.test(text) && implementationTargetPattern.test(text))
  ) {
    return "medium";
  }

  if (actionCount === 1 || smallTaskTerms.some((term) => hasPhrase(text, term))) {
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

function countTaskSegments(value: string): number {
  return value
    .split(/(?:\r?\n|[!?;]+\s*|\.\s+)/u)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
}

function hasPhrase(value: string, phrase: string): boolean {
  return new RegExp(
    "(^|[^\\p{L}\\p{N}])" + escapeRegExp(phrase) + "([^\\p{L}\\p{N}]|$)",
    "iu"
  ).test(value);
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^$(){}|[\]\\]/g, "\\$&");
}

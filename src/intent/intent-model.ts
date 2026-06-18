import type { TaskIntent } from "../schema/index.js";
import { estimateTaskComplexity, extractTaskKeywords, type TaskComplexity } from "./intent-core.js";

export type IntentVerb =
  | "add"
  | "fix"
  | "remove"
  | "rename"
  | "update"
  | "refactor"
  | "migrate"
  | "bump"
  | "wire"
  | "instrument";

export type ChangeClass =
  | "ui"
  | "tests"
  | "config"
  | "dependency"
  | "api-surface"
  | "docs"
  | "ci"
  | "i18n"
  | "telemetry"
  | "build"
  | "data-model"
  | "source";

export interface TargetArea {
  token: string;
  kind: "path" | "domain" | "symbol";
}

export interface IntentModel {
  complexity: TaskComplexity;
  verbs: IntentVerb[];
  targetTokens: string[];
  allowedChangeClasses: ChangeClass[];
  forbiddenChangeClasses: ChangeClass[];
  targetAreas: TargetArea[];
}

const verbAliases: Array<{ verb: IntentVerb; terms: string[] }> = [
  { verb: "add", terms: ["add", "create", "introduce", "implement"] },
  { verb: "fix", terms: ["fix", "bugfix", "repair", "resolve"] },
  { verb: "remove", terms: ["remove", "delete", "drop"] },
  { verb: "rename", terms: ["rename"] },
  { verb: "update", terms: ["update", "change", "adjust", "improve"] },
  { verb: "refactor", terms: ["refactor", "rewrite", "restructure"] },
  { verb: "migrate", terms: ["migrate", "migration"] },
  { verb: "bump", terms: ["bump", "upgrade"] },
  { verb: "wire", terms: ["wire", "connect", "integrate"] },
  { verb: "instrument", terms: ["instrument", "telemetry", "analytics", "tracking"] }
];

const classTerms: Array<{ changeClass: ChangeClass; terms: string[] }> = [
  { changeClass: "ui", terms: ["ui", "view", "component", "button", "style", "css", "theme"] },
  { changeClass: "tests", terms: ["test", "tests", "spec", "coverage"] },
  { changeClass: "config", terms: ["config", "configuration", "settings"] },
  { changeClass: "dependency", terms: ["dependency", "dependencies", "package", "library"] },
  { changeClass: "api-surface", terms: ["api", "export", "public", "contract"] },
  { changeClass: "docs", terms: ["doc", "docs", "document", "documentation", "readme"] },
  { changeClass: "ci", terms: ["ci", "workflow", "github", "action"] },
  { changeClass: "i18n", terms: ["i18n", "locale", "translation"] },
  { changeClass: "telemetry", terms: ["telemetry", "analytics", "tracking"] },
  { changeClass: "build", terms: ["build", "bundle", "compile"] },
  { changeClass: "data-model", terms: ["schema", "model", "database", "migration"] }
];

const highRiskClasses: ChangeClass[] = ["config", "dependency", "api-surface", "ci", "build"];

export function buildIntentModel(task: TaskIntent): IntentModel {
  const normalizedText = task.text.toLowerCase();
  const targetTokens = extractTaskKeywords(normalizedText);
  const allowedChangeClasses = inferAllowedChangeClasses(normalizedText);

  return {
    complexity: estimateTaskComplexity(normalizedText),
    verbs: inferIntentVerbs(normalizedText),
    targetTokens,
    allowedChangeClasses,
    forbiddenChangeClasses: highRiskClasses.filter(
      (changeClass) => !allowedChangeClasses.includes(changeClass)
    ),
    targetAreas: targetTokens.map((token) => ({
      token,
      kind: token.includes("/") ? "path" : "domain"
    }))
  };
}

function inferIntentVerbs(normalizedText: string): IntentVerb[] {
  return verbAliases
    .filter((entry) => entry.terms.some((term) => hasTerm(normalizedText, term)))
    .map((entry) => entry.verb);
}

function inferAllowedChangeClasses(normalizedText: string): ChangeClass[] {
  const classes = new Set<ChangeClass>(["source"]);

  for (const entry of classTerms) {
    if (entry.terms.some((term) => hasTerm(normalizedText, term))) {
      classes.add(entry.changeClass);
    }
  }

  if (hasTerm(normalizedText, "release") || hasTerm(normalizedText, "version")) {
    classes.add("docs");
    classes.add("dependency");
  }

  return [...classes].sort();
}

function hasTerm(normalizedText: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, "i").test(normalizedText);
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

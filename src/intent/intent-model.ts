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

export type IntentCoverageCategory =
  | "source-behavior"
  | "test-coverage"
  | "docs"
  | "config-tooling"
  | "dependency"
  | "public-api"
  | "ui-content";

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
  expectedCategories: IntentCoverageCategory[];
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
  {
    changeClass: "ui",
    terms: [
      "ui",
      "view",
      "views",
      "component",
      "components",
      "section",
      "sections",
      "page",
      "pages",
      "screen",
      "screens",
      "site",
      "website",
      "render",
      "display",
      "show",
      "gallery",
      "portfolio",
      "works",
      "button",
      "style",
      "styles",
      "css",
      "scss",
      "font",
      "fonts",
      "typography",
      "theme"
    ]
  },
  { changeClass: "tests", terms: ["test", "tests", "spec", "coverage"] },
  { changeClass: "config", terms: ["config", "configuration", "settings"] },
  { changeClass: "dependency", terms: ["dependency", "dependencies", "package", "library"] },
  { changeClass: "api-surface", terms: ["api", "export", "public", "contract"] },
  { changeClass: "docs", terms: ["doc", "docs", "document", "documentation", "readme"] },
  { changeClass: "ci", terms: ["ci", "workflow", "github", "action"] },
  { changeClass: "i18n", terms: ["i18n", "locale", "translation"] },
  { changeClass: "telemetry", terms: ["telemetry", "analytics", "tracking"] },
  { changeClass: "build", terms: ["build", "bundle", "compile"] },
  { changeClass: "data-model", terms: ["schema", "model", "database", "migration"] },
  { changeClass: "source", terms: ["source", "behavior", "implementation"] }
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
    expectedCategories: inferExpectedCategories(normalizedText, allowedChangeClasses),
    targetAreas: targetTokens.map((token) => ({
      token,
      kind: token.includes("/") ? "path" : "domain"
    }))
  };
}

export function mapChangeClassToIntentCategory(changeClass: ChangeClass): IntentCoverageCategory {
  if (changeClass === "tests") {
    return "test-coverage";
  }

  if (changeClass === "docs") {
    return "docs";
  }

  if (changeClass === "config" || changeClass === "ci" || changeClass === "build") {
    return "config-tooling";
  }

  if (changeClass === "dependency") {
    return "dependency";
  }

  if (changeClass === "api-surface") {
    return "public-api";
  }

  if (changeClass === "ui" || changeClass === "i18n") {
    return "ui-content";
  }

  return "source-behavior";
}

function inferIntentVerbs(normalizedText: string): IntentVerb[] {
  return verbAliases
    .filter((entry) => entry.terms.some((term) => hasTerm(normalizedText, term)))
    .map((entry) => entry.verb);
}

function inferAllowedChangeClasses(normalizedText: string): ChangeClass[] {
  const classes = new Set<ChangeClass>();

  for (const entry of classTerms) {
    if (entry.terms.some((term) => hasTerm(normalizedText, term))) {
      classes.add(entry.changeClass);
    }
  }

  if (isReleaseManagementIntent(normalizedText)) {
    classes.add("docs");
    classes.add("dependency");
  }

  if (classes.size === 0 || hasCodeBearingClass(classes)) {
    classes.add("source");
  }

  return [...classes].sort();
}

function inferExpectedCategories(
  normalizedText: string,
  allowedChangeClasses: ChangeClass[]
): IntentCoverageCategory[] {
  const categories = new Set<IntentCoverageCategory>();

  for (const changeClass of allowedChangeClasses) {
    if (changeClass === "source" && !mentionsCodeWork(normalizedText)) {
      continue;
    }

    if (
      changeClass === "docs" &&
      isReleaseManagementIntent(normalizedText) &&
      !mentionsDocsWork(normalizedText)
    ) {
      continue;
    }

    categories.add(mapChangeClassToIntentCategory(changeClass));
  }

  if (categories.size === 0) {
    categories.add("source-behavior");
  }

  return [...categories].sort();
}

function isReleaseManagementIntent(normalizedText: string): boolean {
  return (
    hasTerm(normalizedText, "version") ||
    (hasTerm(normalizedText, "release") &&
      /\b(?:bump|publish|prepare|cut|tag|changelog|notes|version)\b/i.test(normalizedText))
  );
}

function hasCodeBearingClass(classes: Set<ChangeClass>): boolean {
  return ["api-surface", "data-model", "i18n", "telemetry", "ui"].some((changeClass) =>
    classes.has(changeClass as ChangeClass)
  );
}

function mentionsCodeWork(normalizedText: string): boolean {
  return (
    /\b(?:fix|bugfix|repair|resolve|add|create|introduce|implement|build|wire|connect|integrate|update|change|adjust|improve|refactor|rewrite|migrate)\b/i.test(
      normalizedText
    ) ||
    classTerms.some(
      (entry) =>
        entry.changeClass === "ui" && entry.terms.some((term) => hasTerm(normalizedText, term))
    )
  );
}

function mentionsDocsWork(normalizedText: string): boolean {
  return ["doc", "docs", "document", "documentation", "readme", "changelog", "release note"].some(
    (term) => hasTerm(normalizedText, term)
  );
}

function hasTerm(normalizedText: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, "i").test(normalizedText);
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

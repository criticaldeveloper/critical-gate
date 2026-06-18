import type { DiffFile, DiffLine } from "../schema/index.js";
import type { IntentVerificationSummary, TaskIntent } from "../schema/index.js";
import { buildIntentModel, type ChangeClass } from "./intent-model.js";

export interface ObservedChangeClassEvidence {
  changeClass: ChangeClass;
  path: string;
  reason: string;
  lineNumber?: number;
  symbol?: string;
}

export interface ObservedDiffActions {
  classes: ChangeClass[];
  evidence: ObservedChangeClassEvidence[];
}

const workflowPathPattern = /(^|\/)\.github\/workflows\//;
const buildConfigPathPattern =
  /(^|\/)(tsconfig[^/]*\.json|vite\.config\.[cm]?[jt]s|webpack\.config\.[cm]?[jt]s|rollup\.config\.[cm]?[jt]s|esbuild\.config\.[cm]?[jt]s)$/;
const uiPathPattern = /(^|\/)(components?|views?|pages?|screens?|styles?|theme|themes)\//i;
const dataModelPathPattern = /(^|\/)(schemas?|models?|migrations?|entities)\//i;
const exportDeclarationPattern =
  /^\s*export\s+(?:async\s+)?(?:declare\s+)?(?:function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/;
const namedExportPattern = /^\s*export\s*\{([^}]+)\}/;
const defaultExportPattern = /^\s*export\s+default\s+/;

export function classifyObservedDiffActions(files: DiffFile[]): ObservedDiffActions {
  const evidence = files.flatMap(classifyFileActions);

  return {
    classes: [...new Set(evidence.map((entry) => entry.changeClass))].sort(),
    evidence
  };
}

export function summarizeIntentVerification(
  task: TaskIntent,
  files: DiffFile[]
): IntentVerificationSummary {
  const intent = buildIntentModel(task);
  const observed = classifyObservedDiffActions(files);
  const unexpectedClasses = observed.classes.filter(
    (changeClass) => !intent.allowedChangeClasses.includes(changeClass)
  );
  const matchedClasses = observed.classes.filter((changeClass) =>
    intent.allowedChangeClasses.includes(changeClass)
  );

  return {
    requestedClasses: intent.allowedChangeClasses,
    observedClasses: observed.classes,
    unexpectedClasses,
    coverage: getCoverage(observed.classes, unexpectedClasses, matchedClasses),
    explanationCodes: [
      ...matchedClasses.map((changeClass) => `matched:${changeClass}`),
      ...unexpectedClasses.map((changeClass) => `unexpected:${changeClass}`)
    ]
  };
}

function getCoverage(
  observedClasses: ChangeClass[],
  unexpectedClasses: ChangeClass[],
  matchedClasses: ChangeClass[]
): IntentVerificationSummary["coverage"] {
  if (observedClasses.length === 0 || matchedClasses.length === 0) {
    return "none";
  }

  if (unexpectedClasses.length === 0) {
    return "matched";
  }

  return "partial";
}

function classifyFileActions(file: DiffFile): ObservedChangeClassEvidence[] {
  const evidence: ObservedChangeClassEvidence[] = [];

  if (file.role === "source") {
    evidence.push(toEvidence("source", file, "Source file changed."));
  }

  if (file.role === "test") {
    evidence.push(toEvidence("tests", file, "Test file changed."));
  }

  if (file.role === "docs") {
    evidence.push(toEvidence("docs", file, "Documentation file changed."));
  }

  if (file.role === "manifest" || file.role === "lockfile") {
    evidence.push(toEvidence("dependency", file, "Package manifest or lockfile changed."));
  }

  if (file.role === "config") {
    evidence.push(toEvidence("config", file, "Configuration file changed."));
  }

  if (workflowPathPattern.test(file.path)) {
    evidence.push(toEvidence("ci", file, "GitHub workflow changed."));
  }

  if (buildConfigPathPattern.test(file.path)) {
    evidence.push(toEvidence("build", file, "Build or compiler configuration changed."));
  }

  if (uiPathPattern.test(file.path) || /\.(css|scss|sass|less)$/.test(file.path)) {
    evidence.push(toEvidence("ui", file, "UI or styling file changed."));
  }

  if (dataModelPathPattern.test(file.path)) {
    evidence.push(toEvidence("data-model", file, "Data model or schema file changed."));
  }

  evidence.push(...extractPublicExportEvidence(file));

  return dedupeEvidence(evidence);
}

function extractPublicExportEvidence(file: DiffFile): ObservedChangeClassEvidence[] {
  if (file.role !== "source" || !/\.[cm]?[jt]sx?$/.test(file.path)) {
    return [];
  }

  return file.hunks.flatMap((hunk) =>
    hunk.lines.flatMap((line) => {
      if (line.kind !== "add" && line.kind !== "delete") {
        return [];
      }

      const symbol = getExportSymbol(line);

      if (symbol === undefined) {
        return [];
      }

      return [
        {
          changeClass: "api-surface" as const,
          path: file.path,
          lineNumber: line.kind === "add" ? line.newLineNumber : line.oldLineNumber,
          symbol,
          reason: "Public export changed."
        }
      ];
    })
  );
}

function getExportSymbol(line: DiffLine): string | undefined {
  const declaredExport = exportDeclarationPattern.exec(line.content);

  if (declaredExport !== null) {
    return declaredExport[1];
  }

  const namedExport = namedExportPattern.exec(line.content);

  if (namedExport !== null) {
    return namedExport[1]?.split(",")[0]?.trim();
  }

  if (defaultExportPattern.test(line.content)) {
    return "default";
  }

  return undefined;
}

function toEvidence(
  changeClass: ChangeClass,
  file: DiffFile,
  reason: string
): ObservedChangeClassEvidence {
  return {
    changeClass,
    path: file.path,
    reason
  };
}

function dedupeEvidence(evidence: ObservedChangeClassEvidence[]): ObservedChangeClassEvidence[] {
  const seen = new Set<string>();

  return evidence.filter((entry) => {
    const key = `${entry.changeClass}:${entry.path}:${entry.lineNumber ?? ""}:${entry.symbol ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

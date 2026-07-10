import {
  buildIntentModel,
  classifyObservedDiffActions,
  mapChangeClassToIntentCategory,
  type ChangeClass,
  type IntentCoverageCategory
} from "../intent/index.js";
import type { Finding, FindingEvidence } from "../schema/index.js";
import type { Detector } from "./types.js";

export const intentVerificationDetector: Detector = {
  name: "intent-verification",
  maturity: "experimental",
  run: ({ task, diff }) => {
    const intent = buildIntentModel(task);
    const observed = classifyObservedDiffActions(diff.files);
    const observedCategories = [...new Set(observed.classes.map(mapChangeClassToIntentCategory))];
    const unexpectedClasses = observed.classes
      .filter((changeClass) => !intent.allowedChangeClasses.includes(changeClass))
      .filter(isReportableIntentMismatch);
    const missingCategories = intent.expectedCategories
      .filter((category) => !observedCategories.includes(category))
      .filter(isReportableMissingCategory);

    return [
      ...unexpectedClasses.map((changeClass) =>
        toFinding(changeClass, intent.allowedChangeClasses, observed.evidence)
      ),
      ...missingCategories.map((category) => toMissingCategoryFinding(category, task.text)),
      ...detectIntentUndercoverage(task.text, diff.files)
    ];
  }
};

const implementationVerbPattern =
  /\b(?:add|create|introduce|implement|build|wire|render|display|show)\b/i;
const uiFeatureTermPattern =
  /\b(?:ui|view|views|component|components|section|sections|page|pages|screen|screens|site|website|gallery|portfolio|works|feature)\b/i;
const styleTaskTermPattern =
  /\b(?:style|styles|styled|css|scss|sass|less|typography|font|fonts|color|colors|spacing|theme|themes)\b/i;
const stylePathPattern = /\.(?:css|scss|sass|less|styl)$/i;

function isReportableIntentMismatch(changeClass: ChangeClass): boolean {
  return changeClass === "ci" || changeClass === "source";
}

function isReportableMissingCategory(category: IntentCoverageCategory): boolean {
  return category !== "source-behavior" && category !== "ui-content";
}

function detectIntentUndercoverage(taskText: string, files: GateResultDiffFile[]): Finding[] {
  if (!requiresVisibleUiImplementation(taskText) || !isOnlyTrivialStylesheetValueChange(files)) {
    return [];
  }

  return [toUndercoverageFinding(taskText, files)];
}

type GateResultDiffFile = Parameters<Detector["run"]>[0]["diff"]["files"][number];

function requiresVisibleUiImplementation(taskText: string): boolean {
  return (
    implementationVerbPattern.test(taskText) &&
    uiFeatureTermPattern.test(taskText) &&
    !styleTaskTermPattern.test(taskText)
  );
}

function isOnlyTrivialStylesheetValueChange(files: GateResultDiffFile[]): boolean {
  return (
    files.length > 0 &&
    files.every(
      (file) =>
        stylePathPattern.test(file.path) &&
        file.status !== "deleted" &&
        isTrivialStylesheetValueChange(file)
    )
  );
}

function isTrivialStylesheetValueChange(file: GateResultDiffFile): boolean {
  const churn = file.additions + file.deletions;

  if (churn === 0 || churn > 8) {
    return false;
  }

  const changedLines = file.hunks.flatMap((hunk) =>
    hunk.lines.filter((line) => line.kind === "add" || line.kind === "delete")
  );

  return changedLines.length > 0 && changedLines.every((line) => isStyleValueLine(line.content));
}

function isStyleValueLine(content: string): boolean {
  const trimmed = content.trim();

  if (trimmed.length === 0 || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
    return true;
  }

  return (
    /^\$?[-A-Za-z0-9_]+\s*:\s*[^;{}]+;?$/.test(trimmed) ||
    /^--[-A-Za-z0-9_]+\s*:\s*[^;{}]+;?$/.test(trimmed) ||
    /^[^{]+{\s*(?:--)?[-A-Za-z0-9_]+\s*:\s*[^;{}]+;?\s*}$/.test(trimmed)
  );
}

function toUndercoverageFinding(taskText: string, files: GateResultDiffFile[]): Finding {
  return {
    id: "intent-coverage:ui-implementation-not-observed",
    detector: "intent-coverage",
    severity: "high",
    confidence: 0.88,
    title: "Requested UI implementation not observed",
    message:
      "The task asks for visible UI implementation work, but the diff only changes trivial stylesheet values.",
    evidence: files.map(
      (file): FindingEvidence => ({
        kind: "file",
        path: file.path,
        message: `${file.path} only contains small stylesheet value edits.`,
        data: {
          additions: file.additions,
          deletions: file.deletions,
          task: taskText
        }
      })
    ),
    repair:
      "Add the requested UI/page/component changes, or revise the task intent if this diff is only a style adjustment.",
    tags: ["scope"]
  };
}

function toFinding(
  changeClass: ChangeClass,
  allowedClasses: ChangeClass[],
  allEvidence: ReturnType<typeof classifyObservedDiffActions>["evidence"]
): Finding {
  const evidence = allEvidence
    .filter((entry) => entry.changeClass === changeClass)
    .map(
      (entry): FindingEvidence => ({
        kind: entry.symbol === undefined ? "file" : "symbol",
        path: entry.path,
        startLine: entry.lineNumber,
        endLine: entry.lineNumber,
        symbol: entry.symbol,
        message: entry.reason,
        data: {
          observedClass: changeClass,
          allowedClasses
        }
      })
    );

  return {
    id: `intent-verification:unexpected-${changeClass}`,
    detector: "intent-verification",
    severity: "medium",
    confidence: 0.82,
    title: `Unexpected ${changeClass} change for task intent`,
    message: `The diff includes ${changeClass} changes, but the task intent only allows: ${allowedClasses.join(", ")}.`,
    evidence,
    repair:
      "Remove the unrelated change, split it into a separate task, or update the task intent with explicit justification.",
    tags: ["scope"]
  };
}

function toMissingCategoryFinding(category: IntentCoverageCategory, taskText: string): Finding {
  return {
    id: `intent-verification:missing-${category}`,
    detector: "intent-verification",
    severity: "medium",
    confidence: category === "test-coverage" ? 0.72 : 0.8,
    title: `Expected ${category} change not observed`,
    message: `The task intent asks for ${category} work, but the diff does not include that category.`,
    evidence: [
      {
        kind: "metric",
        message: `Requested category: ${category}.`,
        data: {
          requestedCategory: category,
          task: taskText
        }
      }
    ],
    repair:
      "Add the requested category of work, or update the task intent if the current diff is intentionally narrower.",
    tags: ["scope"]
  };
}

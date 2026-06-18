import {
  buildIntentModel,
  classifyObservedDiffActions,
  type ChangeClass
} from "../intent/index.js";
import type { Finding, FindingEvidence } from "../schema/index.js";
import type { Detector } from "./types.js";

export const intentVerificationDetector: Detector = {
  name: "intent-verification",
  run: ({ task, diff }) => {
    const intent = buildIntentModel(task);
    const observed = classifyObservedDiffActions(diff.files);
    const unexpectedClasses = observed.classes
      .filter((changeClass) => !intent.allowedChangeClasses.includes(changeClass))
      .filter(isReportableIntentMismatch);

    return unexpectedClasses.map((changeClass) =>
      toFinding(changeClass, intent.allowedChangeClasses, observed.evidence)
    );
  }
};

function isReportableIntentMismatch(changeClass: ChangeClass): boolean {
  return changeClass === "ci" || changeClass === "source";
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

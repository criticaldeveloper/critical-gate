import type { Finding, GateResult, TaskIntent } from "../schema/index.js";

import { calculateDiffCostScore, calculateScopeExpansionScore } from "../intent/index.js";
import { apiSurfaceDetector } from "./api-surface-detector.js";
import { blastRadiusDetector } from "./blast-radius-detector.js";
import { configChangeDetector } from "./config-change-detector.js";
import { dependencyDetector } from "./dependency-detector.js";
import { existingSolutionDetector } from "./existing-solution-detector.js";
import { expectedCompanionsDetector } from "./expected-companions-detector.js";
import { intentVerificationDetector } from "./intent-verification-detector.js";
import { patternViolationDetector } from "./pattern-violation-detector.js";
import { rewriteDetector } from "./rewrite-detector.js";
import { repositoryIntelligenceDetector } from "./repository-intelligence-detector.js";
import { secretPathDetector } from "./secret-path-detector.js";
import { scopeDetector } from "./scope-detector.js";
import { testWeakeningDetector } from "./test-weakening-detector.js";
import { utilityReinventionDetector } from "./utility-reinvention-detector.js";
import type { Detector, DetectorRepoContext } from "./types.js";

export interface FindingDecisionPolicy {
  observationDetectors?: string[];
  blockingDetectors?: string[];
}

const defaultObservationDetectors = [
  "intent-verification",
  "blast-radius",
  "existing-solution",
  "pattern-violation",
  "expected-companions"
];

const defaultDetectors: Detector[] = [
  dependencyDetector,
  testWeakeningDetector,
  configChangeDetector,
  secretPathDetector,
  apiSurfaceDetector,
  intentVerificationDetector,
  blastRadiusDetector,
  scopeDetector,
  rewriteDetector,
  repositoryIntelligenceDetector,
  expectedCompanionsDetector,
  utilityReinventionDetector,
  existingSolutionDetector,
  patternViolationDetector
];

export function runDetectors(
  task: TaskIntent,
  diff: GateResult["diff"],
  context?: DetectorRepoContext,
  detectors = defaultDetectors
): Finding[] {
  return dedupeFindings(detectors.flatMap((detector) => detector.run({ task, diff, context })));
}

export function summarizeFindings(
  findings: Finding[],
  task?: TaskIntent,
  diff?: GateResult["diff"],
  policy: FindingDecisionPolicy = {}
): GateResult["summary"] {
  const blockerCount = countSeverity(findings, "blocker");
  const highCount = countSeverity(findings, "high");
  const blockingFindings = findings.filter((finding) => isBlockingFinding(finding, policy));

  return {
    decision: blockingFindings.length > 0 ? "fail" : "pass",
    findingCount: findings.length,
    blockerCount,
    highCount,
    mediumCount: countSeverity(findings, "medium"),
    lowCount: countSeverity(findings, "low"),
    infoCount: countSeverity(findings, "info"),
    diffCostScore:
      task !== undefined && diff !== undefined ? calculateDiffCostScore(task, diff.files) : 0,
    scopeExpansionScore:
      task !== undefined && diff !== undefined
        ? calculateScopeExpansionScore(task, diff.files, findings)
        : undefined
  };
}

function isBlockingFinding(finding: Finding, policy: FindingDecisionPolicy): boolean {
  if (finding.severity !== "blocker" && finding.severity !== "high") {
    return false;
  }

  if (policy.blockingDetectors?.includes(finding.detector) === true) {
    return true;
  }

  const observationDetectors = policy.observationDetectors ?? defaultObservationDetectors;

  return !observationDetectors.includes(finding.detector);
}

function countSeverity(findings: Finding[], severity: Finding["severity"]): number {
  return findings.filter((finding) => finding.severity === severity).length;
}

function dedupeFindings(findings: Finding[]): Finding[] {
  const blastRadiusPaths = new Set(
    findings
      .filter((finding) => finding.detector === "blast-radius")
      .flatMap((finding) => finding.evidence.map((evidence) => evidence.path))
      .filter((path): path is string => path !== undefined)
  );
  const expectedCompanionSourcePaths = new Set(
    findings
      .filter((finding) => finding.detector === "expected-companions")
      .flatMap((finding) => finding.evidence.map((evidence) => evidence.path))
      .filter((path): path is string => path !== undefined)
  );

  if (blastRadiusPaths.size === 0 && expectedCompanionSourcePaths.size === 0) {
    return findings;
  }

  return findings.filter((finding) => {
    if (
      finding.detector === "repository-intelligence" &&
      finding.evidence.some(
        (evidence) => evidence.path !== undefined && expectedCompanionSourcePaths.has(evidence.path)
      )
    ) {
      return false;
    }

    if (finding.detector !== "scope" || finding.severity !== "medium") {
      return true;
    }

    return !finding.evidence.some(
      (evidence) => evidence.path !== undefined && blastRadiusPaths.has(evidence.path)
    );
  });
}

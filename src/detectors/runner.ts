import type {
  DetectorMaturity,
  DetectorRunSummary,
  Finding,
  GateResult,
  TaskIntent
} from "../schema/index.js";

import {
  calculateDiffCoherenceScore,
  calculateDiffCostScore,
  calculateScopeExpansionScore
} from "../intent/index.js";
import { apiSurfaceDetector } from "./api-surface-detector.js";
import { blastRadiusDetector } from "./blast-radius-detector.js";
import { calibrateFindingConfidence } from "./confidence-calibration.js";
import { configChangeDetector } from "./config-change-detector.js";
import { dependencyDetector } from "./dependency-detector.js";
import { existingSolutionDetector } from "./existing-solution-detector.js";
import { expectedCompanionsDetector } from "./expected-companions-detector.js";
import { intentVerificationDetector } from "./intent-verification-detector.js";
import { patternViolationDetector } from "./pattern-violation-detector.js";
import { rewriteDetector } from "./rewrite-detector.js";
import { repositoryIntelligenceDetector } from "./repository-intelligence-detector.js";
import { enrichFindingWithReasonChain } from "./reason-chain.js";
import { enrichFindingWithRepairContract } from "./repair-contract.js";
import { secretPathDetector } from "./secret-path-detector.js";
import { scopeDetector } from "./scope-detector.js";
import { testWeakeningDetector } from "./test-weakening-detector.js";
import { utilityReinventionDetector } from "./utility-reinvention-detector.js";
import type { Detector, DetectorRepoContext } from "./types.js";

export interface FindingDecisionPolicy {
  observationDetectors?: string[];
  blockingDetectors?: string[];
  failOn?: "blocker" | "high" | "medium";
  acceptedFindingIds?: string[];
  detectorRuns?: DetectorRunSummary[];
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

const detectorMaturityByName = new Map([
  ...defaultDetectors.map(
    (detector) => [detector.name, detector.maturity ?? "experimental"] as const
  ),
  ["intent-coverage", "review"] as const
]);

export function runDetectors(
  task: TaskIntent,
  diff: GateResult["diff"],
  context?: DetectorRepoContext,
  detectors = defaultDetectors
): Finding[] {
  return runDetectorsWithStatuses(task, diff, context, detectors).findings;
}

export function runDetectorsWithStatuses(
  task: TaskIntent,
  diff: GateResult["diff"],
  context?: DetectorRepoContext,
  detectors = defaultDetectors
): { findings: Finding[]; detectorRuns: DetectorRunSummary[] } {
  const detectorResults = detectors.map((detector) =>
    runSingleDetector(detector, task, diff, context)
  );
  const findings = dedupeFindings(detectorResults.flatMap((result) => result.findings))
    .map(enrichFindingWithEvidenceStrength)
    .map(enrichFindingWithReasonChain)
    .map((finding) => enrichFindingWithRepairContract(finding, diff.files));
  const findingCountsByDetector = countFindingsByDetector(findings);
  const detectorRuns = detectorResults.map(({ detector, status }) => {
    if (
      status.status === "errored" ||
      status.status === "skipped" ||
      status.status === "insufficient-context" ||
      status.status === "timed-out"
    ) {
      return status;
    }

    const findingCount = findingCountsByDetector.get(detector.name) ?? 0;

    return {
      ...status,
      status: findingCount > 0 ? "findings" : "passed",
      findingCount
    } satisfies DetectorRunSummary;
  });

  return { findings, detectorRuns };
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
    confidenceCalibration: summarizeConfidenceCalibration(findings, policy),
    policyApplied: summarizePolicyApplied(findings, policy),
    detectorRuns: policy.detectorRuns,
    diffCostScore:
      task !== undefined && diff !== undefined ? calculateDiffCostScore(task, diff.files) : 0,
    scopeExpansionScore:
      task !== undefined && diff !== undefined
        ? calculateScopeExpansionScore(task, diff.files, findings)
        : undefined,
    diffCoherenceScore:
      task !== undefined && diff !== undefined
        ? calculateDiffCoherenceScore(task, diff.files, findings)
        : undefined
  };
}

function runSingleDetector(
  detector: Detector,
  task: TaskIntent,
  diff: GateResult["diff"],
  context?: DetectorRepoContext
): { detector: Detector; findings: Finding[]; status: DetectorRunSummary } {
  const startedAt = Date.now();

  try {
    const detectorContext = { task, diff, context };
    const findings = detector.run(detectorContext);
    const statusOverride = detector.getStatus?.(detectorContext, findings);
    const durationMs = Math.max(0, Date.now() - startedAt);

    return {
      detector,
      findings,
      status: {
        detector: detector.name,
        status: statusOverride?.status ?? (findings.length > 0 ? "findings" : "passed"),
        durationMs,
        findingCount: findings.length,
        maturity: detector.maturity ?? getDetectorMaturity(detector.name),
        filesInspected: diff.files.length,
        reason: statusOverride?.reason
      }
    };
  } catch (error) {
    const durationMs = Math.max(0, Date.now() - startedAt);

    return {
      detector,
      findings: [],
      status: {
        detector: detector.name,
        status: "errored",
        durationMs,
        findingCount: 0,
        maturity: detector.maturity ?? getDetectorMaturity(detector.name),
        filesInspected: diff.files.length,
        reason: error instanceof Error ? error.message : "Unknown detector error"
      }
    };
  }
}

function countFindingsByDetector(findings: Finding[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const finding of findings) {
    counts.set(finding.detector, (counts.get(finding.detector) ?? 0) + 1);
  }

  return counts;
}

function enrichFindingWithEvidenceStrength(finding: Finding): Finding {
  return {
    ...finding,
    evidenceStrength: finding.evidenceStrength ?? finding.confidence
  };
}

function summarizePolicyApplied(
  findings: Finding[],
  policy: FindingDecisionPolicy
): NonNullable<GateResult["summary"]["policyApplied"]> {
  const failOn = policy.failOn ?? "high";
  const observationDetectors = policy.observationDetectors ?? defaultObservationDetectors;
  const blockingDetectors = policy.blockingDetectors ?? [];
  const detectorIds = [
    ...new Set([
      ...defaultDetectors.map((detector) => detector.name),
      ...findings.map((finding) => finding.detector)
    ])
  ].sort();

  return {
    failOn,
    observationDetectors,
    blockingDetectors,
    detectorMaturity: detectorIds.map((detector) => ({
      detector,
      maturity: getDetectorMaturity(detector),
      defaultMode: observationDetectors.includes(detector) ? "observation" : "blocking"
    })),
    acceptedFindingIds: policy.acceptedFindingIds ?? [],
    blockingFindingIds: findings
      .filter((finding) => isBlockingFinding(finding, policy))
      .map((finding) => finding.id),
    observationFindingIds: findings
      .filter((finding) => isObservationModeFinding(finding, policy))
      .map((finding) => finding.id),
    confidenceSuppressedFindingIds: findings
      .filter(isConfidenceSuppressedFinding)
      .map((finding) => finding.id)
  };
}

export function getDetectorMaturity(detector: string): DetectorMaturity {
  return detectorMaturityByName.get(detector) ?? "experimental";
}

function summarizeConfidenceCalibration(
  findings: Finding[],
  policy: FindingDecisionPolicy
): GateResult["summary"]["confidenceCalibration"] {
  return {
    blockingEligibleCount: findings.filter((finding) => isBlockingFinding(finding, policy)).length,
    observationModeCount: findings.filter((finding) => isObservationModeFinding(finding, policy))
      .length,
    confidenceSuppressedCount: findings.filter(isConfidenceSuppressedFinding).length
  };
}

function isBlockingFinding(finding: Finding, policy: FindingDecisionPolicy): boolean {
  if (!meetsFailSeverity(finding, policy.failOn ?? "high")) {
    return false;
  }

  const calibration = calibrateFindingConfidence(finding);

  if (!calibration.blockingEligible) {
    return false;
  }

  if (policy.blockingDetectors?.includes(finding.detector) === true) {
    return true;
  }

  const observationDetectors = policy.observationDetectors ?? defaultObservationDetectors;

  return !observationDetectors.includes(finding.detector);
}

function isObservationModeFinding(finding: Finding, policy: FindingDecisionPolicy): boolean {
  if (!meetsFailSeverity(finding, policy.failOn ?? "high")) {
    return false;
  }

  if (!calibrateFindingConfidence(finding).blockingEligible) {
    return false;
  }

  if (policy.blockingDetectors?.includes(finding.detector) === true) {
    return false;
  }

  const observationDetectors = policy.observationDetectors ?? defaultObservationDetectors;

  return observationDetectors.includes(finding.detector);
}

function meetsFailSeverity(
  finding: Finding,
  failOn: NonNullable<FindingDecisionPolicy["failOn"]>
): boolean {
  if (failOn === "blocker") {
    return finding.severity === "blocker";
  }

  if (failOn === "medium") {
    return (
      finding.severity === "blocker" || finding.severity === "high" || finding.severity === "medium"
    );
  }

  return finding.severity === "blocker" || finding.severity === "high";
}

function isConfidenceSuppressedFinding(finding: Finding): boolean {
  return (
    (finding.severity === "blocker" || finding.severity === "high") &&
    !calibrateFindingConfidence(finding).blockingEligible
  );
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

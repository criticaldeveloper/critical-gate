import type { Finding, GateResult, TaskIntent } from "../schema/index.js";

import { dependencyDetector } from "./dependency-detector.js";
import type { Detector } from "./types.js";

const defaultDetectors: Detector[] = [dependencyDetector];

export function runDetectors(
  task: TaskIntent,
  diff: GateResult["diff"],
  detectors = defaultDetectors
): Finding[] {
  return detectors.flatMap((detector) => detector.run({ task, diff }));
}

export function summarizeFindings(findings: Finding[]): GateResult["summary"] {
  const blockerCount = countSeverity(findings, "blocker");
  const highCount = countSeverity(findings, "high");

  return {
    decision: blockerCount > 0 || highCount > 0 ? "fail" : "pass",
    findingCount: findings.length,
    blockerCount,
    highCount,
    mediumCount: countSeverity(findings, "medium"),
    lowCount: countSeverity(findings, "low"),
    infoCount: countSeverity(findings, "info"),
    diffCostScore: 0
  };
}

function countSeverity(findings: Finding[], severity: Finding["severity"]): number {
  return findings.filter((finding) => finding.severity === severity).length;
}

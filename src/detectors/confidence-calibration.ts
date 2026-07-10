import type { Finding } from "../schema/index.js";

export type ConfidenceBand = "low" | "medium" | "high" | "very-high";
export type EvidenceStrengthBand = ConfidenceBand;

export interface FindingConfidenceCalibration {
  band: ConfidenceBand;
  minimumBlockingConfidence: number;
  blockingEligible: boolean;
  reason: string;
}

export type FindingEvidenceStrengthCalibration = FindingConfidenceCalibration;

const detectorBlockingThresholds: Record<string, number> = {
  "api-surface": 0.84,
  dependency: 0.85,
  rewrite: 0.84,
  scope: 0.84,
  "secret-path": 0.85,
  "test-weakening": 0.85
};

export function calibrateFindingConfidence(finding: Finding): FindingConfidenceCalibration {
  const band = getEvidenceStrengthBand(finding.evidenceStrength ?? finding.confidence);
  const minimumBlockingConfidence =
    detectorBlockingThresholds[finding.detector] ?? getSeverityBlockingThreshold(finding.severity);
  const severityEligible =
    finding.severity === "blocker" || finding.severity === "high" || finding.severity === "medium";
  const blockingEligible =
    severityEligible &&
    (finding.evidenceStrength ?? finding.confidence) >= minimumBlockingConfidence;

  return {
    band,
    minimumBlockingConfidence,
    blockingEligible,
    reason: blockingEligible
      ? `${finding.detector} ${finding.severity} finding has ${band} evidence strength.`
      : getNonBlockingReason(finding, band, minimumBlockingConfidence)
  };
}

export const calibrateFindingEvidenceStrength = calibrateFindingConfidence;

export function getConfidenceBand(confidence: number): ConfidenceBand {
  return getEvidenceStrengthBand(confidence);
}

export function getEvidenceStrengthBand(confidence: number): EvidenceStrengthBand {
  if (confidence >= 0.9) {
    return "very-high";
  }

  if (confidence >= 0.8) {
    return "high";
  }

  if (confidence >= 0.6) {
    return "medium";
  }

  return "low";
}

function getSeverityBlockingThreshold(severity: Finding["severity"]): number {
  if (severity === "blocker") {
    return 0.85;
  }

  if (severity === "high") {
    return 0.8;
  }

  if (severity === "medium") {
    return 0.6;
  }

  return 1;
}

function getNonBlockingReason(
  finding: Finding,
  band: ConfidenceBand,
  minimumBlockingConfidence: number
): string {
  if (finding.severity !== "blocker" && finding.severity !== "high") {
    return `${finding.severity} findings are observational unless policy failOn is set to medium.`;
  }

  return `${finding.detector} ${finding.severity} finding has ${band} evidence strength; blocking requires ${Math.round(
    minimumBlockingConfidence * 100
  )}% evidence strength.`;
}

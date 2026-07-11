import type { Finding } from "../schema/index.js";

export type ConfidenceBand = "low" | "medium" | "high" | "very-high";
export type EvidenceStrengthBand = ConfidenceBand;

export interface FindingEvidenceStrengthCalibration {
  band: EvidenceStrengthBand;
  minimumBlockingEvidenceStrength: number;
  /** @deprecated Use minimumBlockingEvidenceStrength. */
  minimumBlockingConfidence: number;
  blockingEligible: boolean;
  reason: string;
}

/** @deprecated Use FindingEvidenceStrengthCalibration. */
export type FindingConfidenceCalibration = FindingEvidenceStrengthCalibration;

const detectorBlockingThresholds: Record<string, number> = {
  "api-surface": 0.84,
  dependency: 0.85,
  rewrite: 0.84,
  scope: 0.84,
  "secret-path": 0.85,
  "test-weakening": 0.85
};

export function calibrateFindingEvidenceStrength(
  finding: Finding
): FindingEvidenceStrengthCalibration {
  const band = getEvidenceStrengthBand(finding.evidenceStrength ?? finding.confidence);
  const minimumBlockingEvidenceStrength =
    detectorBlockingThresholds[finding.detector] ?? getSeverityBlockingThreshold(finding.severity);
  const severityEligible =
    finding.severity === "blocker" || finding.severity === "high" || finding.severity === "medium";
  const blockingEligible =
    severityEligible &&
    (finding.evidenceStrength ?? finding.confidence) >= minimumBlockingEvidenceStrength;

  return {
    band,
    minimumBlockingEvidenceStrength,
    minimumBlockingConfidence: minimumBlockingEvidenceStrength,
    blockingEligible,
    reason: blockingEligible
      ? `${finding.detector} ${finding.severity} finding has ${band} evidence strength.`
      : getNonBlockingReason(finding, band, minimumBlockingEvidenceStrength)
  };
}

/** @deprecated Use calibrateFindingEvidenceStrength. */
export const calibrateFindingConfidence = calibrateFindingEvidenceStrength;

export function getConfidenceBand(confidence: number): ConfidenceBand {
  return getEvidenceStrengthBand(confidence);
}

export function getEvidenceStrengthBand(evidenceStrength: number): EvidenceStrengthBand {
  if (evidenceStrength >= 0.9) {
    return "very-high";
  }

  if (evidenceStrength >= 0.8) {
    return "high";
  }

  if (evidenceStrength >= 0.6) {
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
  minimumBlockingEvidenceStrength: number
): string {
  if (finding.severity !== "blocker" && finding.severity !== "high") {
    return `${finding.severity} findings are observational unless policy failOn is set to medium.`;
  }

  return `${finding.detector} ${finding.severity} finding has ${band} evidence strength; blocking requires ${Math.round(
    minimumBlockingEvidenceStrength * 100
  )}% evidence strength.`;
}

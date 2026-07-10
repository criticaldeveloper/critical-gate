import type { Finding } from "../schema/index.js";

import type { Detector } from "./types.js";

export const requiredChecksDetector: Detector = {
  name: "required-checks",
  maturity: "experimental",
  run: ({ context }) => {
    const taskContract = context?.taskContract;
    const requiredChecks = taskContract?.requiredChecks ?? [];
    const checksRan = context?.checksRan;

    if (taskContract?.source !== "provided" || requiredChecks.length === 0) {
      return [];
    }

    if (checksRan === undefined) {
      return [toUnverifiedFinding(requiredChecks)];
    }

    const normalizedChecksRan = new Set(checksRan.map(normalizeCheckCommand));
    const missingChecks = requiredChecks.filter(
      (check) => !normalizedChecksRan.has(normalizeCheckCommand(check))
    );

    return missingChecks.length > 0 ? [toMissingChecksFinding(missingChecks, checksRan)] : [];
  }
};

function toUnverifiedFinding(requiredChecks: string[]): Finding {
  return {
    id: "required-checks:declared-not-verified",
    detector: "required-checks",
    severity: "medium",
    confidence: 0.8,
    evidenceStrength: 0.8,
    title: "Required checks declared but not verified",
    message:
      "The task contract declares required checks, but Critical Gate has no check execution evidence for this run.",
    evidence: requiredChecks.map((check, index) => ({
      kind: "metric" as const,
      message: `Required check ${index + 1}: ${check}`,
      data: {
        check,
        verified: false
      }
    })),
    repair:
      "Run the required checks and include their results in the task handoff until Critical Gate supports check execution metadata.",
    tags: ["config"]
  };
}

function toMissingChecksFinding(missingChecks: string[], checksRan: string[]): Finding {
  return {
    id: "required-checks:missing",
    detector: "required-checks",
    severity: "high",
    confidence: 0.9,
    evidenceStrength: 0.9,
    title: "Required checks were not reported as run",
    message: `The task contract requires ${formatList(missingChecks)}, but reported checks were ${formatList(checksRan)}.`,
    evidence: missingChecks.map((check, index) => ({
      kind: "metric" as const,
      message: `Missing required check ${index + 1}: ${check}`,
      data: {
        check,
        verified: false,
        checksRan
      }
    })),
    repair: "Run the missing required checks or pass the exact completed command with --check-ran.",
    tags: ["config"]
  };
}

function normalizeCheckCommand(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

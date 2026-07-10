import type { CheckExecutionResult, Finding } from "../schema/index.js";

import type { Detector } from "./types.js";

export const requiredChecksDetector: Detector = {
  name: "required-checks",
  maturity: "experimental",
  run: ({ context }) => {
    const taskContract = context?.taskContract;
    const requiredChecks = taskContract?.requiredChecks ?? [];
    const checksRan = context?.checksRan;
    const checkResults = context?.checkResults;

    if (taskContract?.source !== "provided" || requiredChecks.length === 0) {
      return [];
    }

    if (checksRan === undefined && checkResults === undefined) {
      return [toUnverifiedFinding(requiredChecks)];
    }

    const normalizedPassedChecks = new Set([
      ...(checksRan ?? []).map(normalizeCheckCommand),
      ...(checkResults ?? [])
        .filter((result) => result.status === "passed")
        .map((result) => normalizeCheckCommand(result.command))
    ]);
    const failedRequiredChecks = requiredChecks
      .map((check) => ({
        check,
        result: (checkResults ?? []).find(
          (result) => normalizeCheckCommand(result.command) === normalizeCheckCommand(check)
        )
      }))
      .filter(
        (entry): entry is { check: string; result: CheckExecutionResult } =>
          entry.result?.status === "failed"
      );
    const missingChecks = requiredChecks.filter(
      (check) =>
        !normalizedPassedChecks.has(normalizeCheckCommand(check)) &&
        !failedRequiredChecks.some(
          (entry) => normalizeCheckCommand(entry.check) === normalizeCheckCommand(check)
        )
    );

    return [
      ...(failedRequiredChecks.length > 0 ? [toFailedChecksFinding(failedRequiredChecks)] : []),
      ...(missingChecks.length > 0
        ? [toMissingChecksFinding(missingChecks, getReportedCheckCommands(checksRan, checkResults))]
        : [])
    ];
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

function toFailedChecksFinding(
  failedChecks: Array<{ check: string; result: CheckExecutionResult }>
): Finding {
  return {
    id: "required-checks:failed",
    detector: "required-checks",
    severity: "high",
    confidence: 0.95,
    evidenceStrength: 0.95,
    title: "Required checks failed",
    message: `The task contract requires ${formatList(
      failedChecks.map((entry) => entry.check)
    )}, but those checks were reported as failed.`,
    evidence: failedChecks.map(({ check, result }, index) => ({
      kind: "metric" as const,
      message: `Failed required check ${index + 1}: ${check}`,
      data: {
        check,
        command: result.command,
        status: result.status,
        exitCode: result.exitCode,
        verified: false
      }
    })),
    repair: "Fix the failing required checks before merging this diff.",
    tags: ["config"]
  };
}

function getReportedCheckCommands(
  checksRan: string[] | undefined,
  checkResults: CheckExecutionResult[] | undefined
): string[] {
  return [...(checksRan ?? []), ...(checkResults ?? []).map((result) => result.command)];
}

function normalizeCheckCommand(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

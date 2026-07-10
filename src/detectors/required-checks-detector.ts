import type { Finding } from "../schema/index.js";

import type { Detector } from "./types.js";

export const requiredChecksDetector: Detector = {
  name: "required-checks",
  maturity: "experimental",
  run: ({ context }) => {
    const taskContract = context?.taskContract;
    const requiredChecks = taskContract?.requiredChecks ?? [];

    if (taskContract?.source !== "provided" || requiredChecks.length === 0) {
      return [];
    }

    return [
      {
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
      } satisfies Finding
    ];
  }
};

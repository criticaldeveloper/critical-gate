import type { Finding } from "../schema/index.js";

import type { Detector } from "./types.js";

export const expectedArtifactsDetector: Detector = {
  name: "expected-artifacts",
  maturity: "experimental",
  run: ({ context }) => {
    const taskContract = context?.taskContract;
    const expectedArtifacts = taskContract?.expectedArtifacts ?? [];

    if (taskContract?.source !== "provided" || expectedArtifacts.length === 0) {
      return [];
    }

    return [
      {
        id: "expected-artifacts:declared",
        detector: "expected-artifacts",
        severity: "medium",
        confidence: 0.75,
        evidenceStrength: 0.75,
        title: "Expected artifacts declared by task contract",
        message:
          "The task contract declares expected artifacts that reviewers should verify against the diff.",
        evidence: expectedArtifacts.map((artifact, index) => ({
          kind: "metric" as const,
          message: `Expected artifact ${index + 1}: ${artifact}`,
          data: {
            artifact,
            verified: false
          }
        })),
        repair:
          "Ensure the diff includes or preserves each expected artifact, or update the task contract with explicit reviewer approval.",
        tags: ["config"]
      } satisfies Finding
    ];
  }
};

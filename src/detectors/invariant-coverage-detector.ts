import type { Finding } from "../schema/index.js";

import type { Detector } from "./types.js";

const enforcedInvariants = new Set(["no_new_dependencies", "no_public_api_change"]);

export const invariantCoverageDetector: Detector = {
  name: "invariant-coverage",
  maturity: "experimental",
  run: ({ context }) => {
    const taskContract = context?.taskContract;
    const invariants = taskContract?.invariants ?? [];
    const unenforcedInvariants = invariants.filter(
      (invariant) => !enforcedInvariants.has(invariant)
    );

    if (taskContract?.source !== "provided" || unenforcedInvariants.length === 0) {
      return [];
    }

    return [
      {
        id: "invariant-coverage:unenforced",
        detector: "invariant-coverage",
        severity: "medium",
        confidence: 0.8,
        evidenceStrength: 0.8,
        title: "Task contract invariants need manual verification",
        message:
          "The task contract declares invariants that do not yet have deterministic enforcement.",
        evidence: unenforcedInvariants.map((invariant, index) => ({
          kind: "metric" as const,
          message: `Unenforced invariant ${index + 1}: ${invariant}`,
          data: {
            invariant,
            enforced: false
          }
        })),
        repair:
          "Verify these invariants manually or add deterministic detector support before promoting them to blocking policy.",
        tags: ["config"]
      } satisfies Finding
    ];
  }
};

import { runDetectors, summarizeFindings, type Detector, type Finding } from "../src/index.js";

const highObservationFinding: Finding = {
  id: "blast-radius:unexpected-cluster:test",
  detector: "blast-radius",
  severity: "high",
  confidence: 0.9,
  title: "Unexpected changed-file cluster",
  message: "A separate cluster changed outside the expected task scope.",
  evidence: [{ kind: "file", path: "src/other.ts", message: "Unexpected cluster." }],
  repair: "Split the unrelated cluster or document why it belongs.",
  tags: ["scope"]
};

describe("rollout decision policy", () => {
  it("keeps new detector families in observation mode by default", () => {
    expect(summarizeFindings([highObservationFinding])).toMatchObject({
      decision: "pass",
      highCount: 1
    });
  });

  it("promotes configured detectors to blocking", () => {
    expect(
      summarizeFindings([highObservationFinding], undefined, undefined, {
        blockingDetectors: ["blast-radius"]
      })
    ).toMatchObject({
      decision: "fail",
      highCount: 1
    });
  });

  it("keeps legacy high-confidence detectors blocking", () => {
    expect(
      summarizeFindings([
        {
          ...highObservationFinding,
          id: "scope:tsconfig.json",
          detector: "scope"
        }
      ])
    ).toMatchObject({
      decision: "fail",
      highCount: 1
    });
  });

  it("enriches detector findings with reason chains", () => {
    const detector: Detector = {
      name: "test-detector",
      run: () => [
        {
          id: "scope:src/other.ts",
          detector: "scope",
          severity: "medium",
          confidence: 0.7,
          title: "Unexpected file changed for small task",
          message: "src/other.ts changed during a small task.",
          evidence: [
            {
              kind: "file",
              path: "src/other.ts",
              message: "Changed file role: source."
            }
          ],
          repair: "Remove unrelated edits.",
          tags: ["scope"]
        }
      ]
    };

    expect(
      runDetectors({ source: "cli", text: "Fix signup validation" }, { files: [] }, undefined, [
        detector
      ])[0]
    ).toMatchObject({
      reasonChain: {
        whatHappened: "src/other.ts changed during a small task.",
        whySuspicious:
          "The changed files or historical relationships do not clearly fit the task's expected blast radius.",
        supportingSignals: expect.arrayContaining([
          "Detector: scope",
          "Severity: medium",
          "Confidence: 70%",
          "src/other.ts: Changed file role: source."
        ]),
        acceptableIf: expect.arrayContaining([
          "The task intent explicitly covers this file or support area."
        ]),
        repairHint: "Remove unrelated edits."
      }
    });
  });
});

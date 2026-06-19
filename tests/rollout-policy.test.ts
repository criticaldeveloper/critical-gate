import { summarizeFindings, type Finding } from "../src/index.js";

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
});

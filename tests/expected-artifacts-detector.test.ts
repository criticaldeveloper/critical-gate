import { expectedArtifactsDetector, runDetectors, summarizeFindings } from "../src/index.js";
import type { GateResult, TaskContract, TaskIntent } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Correct profile heading font weight"
};
const diff: GateResult["diff"] = {
  files: []
};
const baseContract: TaskContract = {
  source: "provided",
  goal: "Correct profile heading font weight",
  allowedPaths: [],
  forbiddenPaths: [],
  expectedArtifacts: [],
  invariants: [],
  requiredChecks: []
};

describe("expectedArtifactsDetector", () => {
  it("emits observation evidence for provided task-contract expected artifacts", () => {
    const findings = expectedArtifactsDetector.run({
      task,
      diff,
      context: {
        taskContract: {
          ...baseContract,
          expectedArtifacts: ["profile heading stylesheet", "visual regression note"]
        }
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "expected-artifacts:declared",
        detector: "expected-artifacts",
        severity: "medium",
        title: "Expected artifacts declared by task contract",
        message:
          "The task contract declares expected artifacts that reviewers should verify against the diff.",
        repair:
          "Ensure the diff includes or preserves each expected artifact, or update the task contract with explicit reviewer approval.",
        tags: ["config"]
      })
    ]);
    expect(findings[0]?.evidence).toEqual([
      expect.objectContaining({
        kind: "metric",
        message: "Expected artifact 1: profile heading stylesheet",
        data: {
          artifact: "profile heading stylesheet",
          verified: false
        }
      }),
      expect.objectContaining({
        kind: "metric",
        message: "Expected artifact 2: visual regression note",
        data: {
          artifact: "visual regression note",
          verified: false
        }
      })
    ]);
  });

  it("does not emit for inferred contracts or contracts without expected artifacts", () => {
    expect(
      expectedArtifactsDetector.run({
        task,
        diff,
        context: {
          taskContract: {
            ...baseContract,
            source: "inferred",
            expectedArtifacts: ["profile heading stylesheet"]
          }
        }
      })
    ).toEqual([]);
    expect(
      expectedArtifactsDetector.run({
        task,
        diff,
        context: {
          taskContract: baseContract
        }
      })
    ).toEqual([]);
  });

  it("is observation-only by default when included in the normal detector run", () => {
    const findings = runDetectors(task, diff, {
      taskContract: {
        ...baseContract,
        expectedArtifacts: ["profile heading stylesheet"]
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "expected-artifacts",
        severity: "medium"
      })
    ]);
    expect(
      summarizeFindings(findings, task, diff, {
        failOn: "medium"
      })
    ).toMatchObject({
      decision: "pass",
      findingCount: 1,
      mediumCount: 1,
      policyApplied: {
        observationFindingIds: ["expected-artifacts:declared"],
        blockingFindingIds: []
      }
    });
  });
});

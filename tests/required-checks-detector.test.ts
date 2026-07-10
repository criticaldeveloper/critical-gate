import { requiredChecksDetector, runDetectors, summarizeFindings } from "../src/index.js";
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

describe("requiredChecksDetector", () => {
  it("emits observation evidence for provided task-contract required checks", () => {
    const findings = requiredChecksDetector.run({
      task,
      diff,
      context: {
        taskContract: {
          ...baseContract,
          requiredChecks: ["pnpm test profile", "pnpm typecheck"]
        }
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "required-checks:declared-not-verified",
        detector: "required-checks",
        severity: "medium",
        title: "Required checks declared but not verified",
        message:
          "The task contract declares required checks, but Critical Gate has no check execution evidence for this run.",
        repair:
          "Run the required checks and include their results in the task handoff until Critical Gate supports check execution metadata.",
        tags: ["config"]
      })
    ]);
    expect(findings[0]?.evidence).toEqual([
      expect.objectContaining({
        kind: "metric",
        message: "Required check 1: pnpm test profile",
        data: {
          check: "pnpm test profile",
          verified: false
        }
      }),
      expect.objectContaining({
        kind: "metric",
        message: "Required check 2: pnpm typecheck",
        data: {
          check: "pnpm typecheck",
          verified: false
        }
      })
    ]);
  });

  it("does not emit for inferred contracts or contracts without required checks", () => {
    expect(
      requiredChecksDetector.run({
        task,
        diff,
        context: {
          taskContract: {
            ...baseContract,
            source: "inferred",
            requiredChecks: ["pnpm test"]
          }
        }
      })
    ).toEqual([]);
    expect(
      requiredChecksDetector.run({
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
        requiredChecks: ["pnpm test profile"]
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "required-checks",
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
        observationFindingIds: ["required-checks:declared-not-verified"],
        blockingFindingIds: []
      }
    });
  });
});

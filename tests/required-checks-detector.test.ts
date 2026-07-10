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

  it("does not emit when all required checks are reported as run", () => {
    expect(
      requiredChecksDetector.run({
        task,
        diff,
        context: {
          taskContract: {
            ...baseContract,
            requiredChecks: ["pnpm test profile", "pnpm typecheck"]
          },
          checksRan: ["pnpm   test profile", "pnpm typecheck"]
        }
      })
    ).toEqual([]);
  });

  it("does not emit when all required checks have passed structured results", () => {
    expect(
      requiredChecksDetector.run({
        task,
        diff,
        context: {
          taskContract: {
            ...baseContract,
            requiredChecks: ["pnpm test profile", "pnpm typecheck"]
          },
          checkResults: [
            {
              command: "pnpm test profile",
              status: "passed"
            },
            {
              command: "pnpm typecheck",
              status: "passed",
              exitCode: 0
            }
          ]
        }
      })
    ).toEqual([]);
  });

  it("emits failed required checks from structured results", () => {
    const findings = requiredChecksDetector.run({
      task,
      diff,
      context: {
        taskContract: {
          ...baseContract,
          requiredChecks: ["pnpm test profile", "pnpm typecheck"]
        },
        checkResults: [
          {
            command: "pnpm test profile",
            status: "passed"
          },
          {
            command: "pnpm typecheck",
            status: "failed",
            exitCode: 2
          }
        ]
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "required-checks:failed",
        detector: "required-checks",
        severity: "high",
        title: "Required checks failed",
        message:
          "The task contract requires pnpm typecheck, but those checks were reported as failed.",
        repair: "Fix the failing required checks before merging this diff."
      })
    ]);
    expect(findings[0]?.evidence).toEqual([
      expect.objectContaining({
        kind: "metric",
        message: "Failed required check 1: pnpm typecheck",
        data: {
          check: "pnpm typecheck",
          command: "pnpm typecheck",
          status: "failed",
          exitCode: 2,
          verified: false
        }
      })
    ]);
  });

  it("emits missing required checks when reported checks are incomplete", () => {
    const findings = requiredChecksDetector.run({
      task,
      diff,
      context: {
        taskContract: {
          ...baseContract,
          requiredChecks: ["pnpm test profile", "pnpm typecheck"]
        },
        checksRan: ["pnpm test profile"]
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "required-checks:missing",
        detector: "required-checks",
        severity: "high",
        title: "Required checks were not reported as run",
        message:
          "The task contract requires pnpm typecheck, but reported checks were pnpm test profile.",
        repair:
          "Run the missing required checks or pass the exact completed command with --check-ran."
      })
    ]);
    expect(findings[0]?.evidence).toEqual([
      expect.objectContaining({
        kind: "metric",
        message: "Missing required check 1: pnpm typecheck",
        data: {
          check: "pnpm typecheck",
          verified: false,
          checksRan: ["pnpm test profile"]
        }
      })
    ]);
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

  it("keeps missing required checks observation-only by default", () => {
    const findings = runDetectors(task, diff, {
      taskContract: {
        ...baseContract,
        requiredChecks: ["pnpm test profile", "pnpm typecheck"]
      },
      checksRan: ["pnpm test profile"]
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "required-checks:missing",
        detector: "required-checks",
        severity: "high"
      })
    ]);
    expect(
      summarizeFindings(findings, task, diff, {
        failOn: "medium"
      })
    ).toMatchObject({
      decision: "pass",
      findingCount: 1,
      highCount: 1,
      policyApplied: {
        observationFindingIds: ["required-checks:missing"],
        blockingFindingIds: []
      }
    });
  });

  it("keeps failed required checks observation-only by default", () => {
    const findings = runDetectors(task, diff, {
      taskContract: {
        ...baseContract,
        requiredChecks: ["pnpm typecheck"]
      },
      checkResults: [
        {
          command: "pnpm typecheck",
          status: "failed",
          exitCode: 2
        }
      ]
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "required-checks:failed",
        detector: "required-checks",
        severity: "high"
      })
    ]);
    expect(
      summarizeFindings(findings, task, diff, {
        failOn: "medium"
      })
    ).toMatchObject({
      decision: "pass",
      findingCount: 1,
      highCount: 1,
      policyApplied: {
        observationFindingIds: ["required-checks:failed"],
        blockingFindingIds: []
      }
    });
  });
});

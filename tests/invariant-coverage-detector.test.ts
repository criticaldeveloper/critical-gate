import { invariantCoverageDetector, runDetectors, summarizeFindings } from "../src/index.js";
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

describe("invariantCoverageDetector", () => {
  it("emits observation evidence for invariants without deterministic enforcement", () => {
    const findings = invariantCoverageDetector.run({
      task,
      diff,
      context: {
        taskContract: {
          ...baseContract,
          invariants: [
            "no_new_dependencies",
            "no_public_api_change",
            "tests_must_not_weaken",
            "no_config_changes",
            "no_secret_leaks",
            "authentication_behavior_unchanged"
          ]
        }
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "invariant-coverage:unenforced",
        detector: "invariant-coverage",
        severity: "medium",
        title: "Task contract invariants need manual verification",
        message:
          "The task contract declares invariants that do not yet have deterministic enforcement.",
        repair:
          "Verify these invariants manually or add deterministic detector support before promoting them to blocking policy.",
        tags: ["config"]
      })
    ]);
    expect(findings[0]?.evidence).toEqual([
      expect.objectContaining({
        kind: "metric",
        message: "Unenforced invariant 1: authentication_behavior_unchanged",
        data: {
          invariant: "authentication_behavior_unchanged",
          enforced: false
        }
      })
    ]);
  });

  it("does not emit for inferred contracts or fully enforced invariant sets", () => {
    expect(
      invariantCoverageDetector.run({
        task,
        diff,
        context: {
          taskContract: {
            ...baseContract,
            source: "inferred",
            invariants: ["authentication_behavior_unchanged"]
          }
        }
      })
    ).toEqual([]);
    expect(
      invariantCoverageDetector.run({
        task,
        diff,
        context: {
          taskContract: {
            ...baseContract,
            invariants: [
              "no_new_dependencies",
              "no_public_api_change",
              "tests_must_not_weaken",
              "no_test_weakening",
              "no_config_changes",
              "configuration_unchanged",
              "no_secret_leaks",
              "no_environment_leaks"
            ]
          }
        }
      })
    ).toEqual([]);
  });

  it("is observation-only by default when included in the normal detector run", () => {
    const findings = runDetectors(task, diff, {
      taskContract: {
        ...baseContract,
        invariants: ["authentication_behavior_unchanged"]
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "invariant-coverage",
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
        observationFindingIds: ["invariant-coverage:unenforced"],
        blockingFindingIds: []
      }
    });
  });
});

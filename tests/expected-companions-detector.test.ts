import { expectedCompanionsDetector, parseUnifiedDiff, runDetectors } from "../src/index.js";
import type { GateResult, KnowledgeProvider, TaskIntent } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Update signup validation"
};

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

function knowledge(): KnowledgeProvider {
  return {
    getFileGraph: () => ({ nodes: [], edges: [] }),
    getHistoryIndex: () => ({
      coChanges: [],
      companionRules: [
        {
          sourcePath: "src/signup.ts",
          expectedPath: "tests/signup.test.ts",
          support: 5,
          confidence: 0.8
        }
      ]
    }),
    getPatternIndex: () => ({ patterns: [] }),
    getSolutionIndex: () => ({ solutions: [] })
  };
}

describe("expectedCompanionsDetector", () => {
  it("emits when a historically paired test companion is missing", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signup = true;
`);

    expect(
      expectedCompanionsDetector.run({ task, diff, context: { knowledge: knowledge() } })
    ).toEqual([
      expect.objectContaining({
        detector: "expected-companions",
        title: "Expected companion file missing",
        message:
          "src/signup.ts changed without historically paired companion tests/signup.test.ts.",
        repair:
          "Update tests/signup.test.ts, or document why this change does not need its usual companion."
      })
    ]);
  });

  it("does not emit when the companion is present", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signup = true;
diff --git a/tests/signup.test.ts b/tests/signup.test.ts
index 57b22a0..cb3e0f1 100644
--- a/tests/signup.test.ts
+++ b/tests/signup.test.ts
@@ -1 +1,2 @@
+expect(signup).toBe(true);
`);

    expect(
      expectedCompanionsDetector.run({ task, diff, context: { knowledge: knowledge() } })
    ).toEqual([]);
  });

  it("emits when package.json changes without a lockfile", () => {
    const diff = parse(`diff --git a/package.json b/package.json
index 57b22a0..cb3e0f1 100644
--- a/package.json
+++ b/package.json
@@ -1 +1,2 @@
+  "dependencies": {"left-pad": "^1.3.0"},
`);

    expect(
      expectedCompanionsDetector.run({ task, diff, context: { knowledge: knowledge() } })
    ).toEqual([
      expect.objectContaining({
        title: "Expected companion lockfile missing",
        message: "package.json changed without a corresponding package lockfile change."
      })
    ]);
  });

  it("deduplicates older repository-intelligence findings for the same historical root cause", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signup = true;
diff --git a/src/logger.ts b/src/logger.ts
index 57b22a0..cb3e0f1 100644
--- a/src/logger.ts
+++ b/src/logger.ts
@@ -1 +1,2 @@
+export const logger = true;
`);
    const findings = runDetectors(task, diff, {
      repositoryProfile: {
        commitCount: 50,
        minConfidenceCommitCount: 20,
        coChanges: [
          {
            path: "src/signup.ts",
            count: 5,
            relatedPaths: [{ path: "tests/signup.test.ts", count: 4 }]
          }
        ]
      },
      knowledge: knowledge()
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detector: "expected-companions",
          id: "expected-companions:src/signup.ts:tests/signup.test.ts"
        })
      ])
    );
    expect(
      findings.some(
        (finding) =>
          finding.detector === "repository-intelligence" &&
          finding.evidence.some((evidence) => evidence.path === "src/signup.ts")
      )
    ).toBe(false);
  });
});

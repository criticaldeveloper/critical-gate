import {
  parseUnifiedDiff,
  runDetectors,
  summarizeFindings,
  testWeakeningDetector
} from "../src/index.js";
import type { GateResult, TaskIntent } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Update signup validation"
};

describe("testWeakeningDetector", () => {
  it("emits high severity when an assertion is removed", () => {
    const diff = {
      files: parseUnifiedDiff(`diff --git a/tests/signup.test.ts b/tests/signup.test.ts
index 57b22a0..cb3e0f1 100644
--- a/tests/signup.test.ts
+++ b/tests/signup.test.ts
@@ -1,5 +1,4 @@
 test("validates signup", () => {
   const result = validateSignup(input);
-  expect(result.error).toContain("email");
   expect(result.ok).toBe(false);
 });
`)
    };

    const findings = testWeakeningDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "test-weakening",
        severity: "high",
        title: "Test assertion removed",
        message: "The diff removes a test assertion, which can weaken behavioral coverage.",
        repair:
          "Restore the removed assertion or replace it with an equally specific behavioral assertion.",
        tags: ["test"]
      })
    ]);
    expect(findings[0]?.evidence[0]).toMatchObject({
      kind: "line",
      path: "tests/signup.test.ts",
      message: 'expect(result.error).toContain("email");',
      data: {
        signal: "removed-assertion"
      }
    });
  });

  it("emits high severity when a skipped test is added", () => {
    const diff = {
      files: parseUnifiedDiff(`diff --git a/tests/signup.test.ts b/tests/signup.test.ts
index 57b22a0..cb3e0f1 100644
--- a/tests/signup.test.ts
+++ b/tests/signup.test.ts
@@ -1,3 +1,4 @@
+test.skip("validates invalid email", () => {});
 test("validates signup", () => {
   expect(validateSignup(input).ok).toBe(true);
 });
`)
    };

    const findings = testWeakeningDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        severity: "high",
        title: "Skipped or todo test added",
        message: "The diff adds a skipped or todo test, which can reduce effective coverage."
      })
    ]);
  });

  it("emits a blocker when a focused test is added", () => {
    const diff = {
      files: parseUnifiedDiff(`diff --git a/tests/signup.test.ts b/tests/signup.test.ts
index 57b22a0..cb3e0f1 100644
--- a/tests/signup.test.ts
+++ b/tests/signup.test.ts
@@ -1,3 +1,4 @@
+describe.only("signup", () => {});
 test("validates signup", () => {
   expect(validateSignup(input).ok).toBe(true);
 });
`)
    };

    const findings = testWeakeningDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        severity: "blocker",
        title: "Focused test committed",
        repair: "Remove the focused test marker and ensure the full test suite runs."
      })
    ]);
  });

  it("ignores assertion-like changes outside test files", () => {
    const diff = {
      files: parseUnifiedDiff(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1,3 +1,2 @@
-expect(value).toBe(true);
 export const signup = true;
`)
    };

    expect(testWeakeningDetector.run({ task, diff })).toEqual([]);
  });
});

describe("detector runner with test weakening", () => {
  it("summarizes high-severity test weakening into a failing gate decision", () => {
    const diff: GateResult["diff"] = {
      files: parseUnifiedDiff(`diff --git a/tests/signup.test.ts b/tests/signup.test.ts
index 57b22a0..cb3e0f1 100644
--- a/tests/signup.test.ts
+++ b/tests/signup.test.ts
@@ -1,3 +1,2 @@
-expect(validateSignup(input).ok).toBe(true);
 expect(validateSignup(input).ok).toBeDefined();
`)
    };

    const findings = runDetectors(task, diff);

    expect(summarizeFindings(findings)).toMatchObject({
      decision: "fail",
      findingCount: 1,
      highCount: 1
    });
  });
});

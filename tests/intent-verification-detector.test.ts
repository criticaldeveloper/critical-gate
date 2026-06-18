import { intentVerificationDetector, parseUnifiedDiff, runDetectors } from "../src/index.js";
import type { GateResult, TaskIntent } from "../src/index.js";

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

describe("intentVerificationDetector", () => {
  it("emits a finding when a UI task changes CI", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Fix button UI styling"
    };
    const diff = parse(`diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 57b22a0..cb3e0f1 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1 +1,2 @@
+name: CI
`);

    expect(intentVerificationDetector.run({ task, diff })).toEqual([
      expect.objectContaining({
        detector: "intent-verification",
        severity: "medium",
        title: "Unexpected ci change for task intent",
        tags: ["scope"]
      })
    ]);
  });

  it("emits a finding when a docs task changes source", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Update README documentation"
    };
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signup = true;
`);

    expect(intentVerificationDetector.run({ task, diff })).toEqual([
      expect.objectContaining({
        title: "Unexpected source change for task intent",
        message: "The diff includes source changes, but the task intent only allows: docs."
      })
    ]);
  });

  it("does not emit for release version manifest changes", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Bump version for release"
    };
    const diff = parse(`diff --git a/package.json b/package.json
index 57b22a0..cb3e0f1 100644
--- a/package.json
+++ b/package.json
@@ -1 +1,2 @@
+  "version": "1.0.1",
`);

    expect(intentVerificationDetector.run({ task, diff })).toEqual([]);
  });

  it("is registered in the default detector runner", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Update README documentation"
    };
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signup = true;
`);

    expect(runDetectors(task, diff)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detector: "intent-verification"
        })
      ])
    );
  });
});

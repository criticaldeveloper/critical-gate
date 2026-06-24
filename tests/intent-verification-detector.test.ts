import {
  intentVerificationDetector,
  parseUnifiedDiff,
  runDetectors,
  summarizeFindings
} from "../src/index.js";
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
      }),
      expect.objectContaining({
        id: "intent-verification:missing-docs",
        title: "Expected docs change not observed"
      })
    ]);
  });

  it("reports missing explicitly requested test coverage", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Add signup validation tests"
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
        id: "intent-verification:unexpected-source"
      }),
      expect.objectContaining({
        id: "intent-verification:missing-test-coverage",
        detector: "intent-verification",
        severity: "medium",
        title: "Expected test-coverage change not observed"
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

  it("treats explicit tool version upgrades as dependency intent", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Upgrade Critical Gate to 2.7.0 controlled dogfood calibration"
    };
    const diff = parse(`diff --git a/package.json b/package.json
index 57b22a0..cb3e0f1 100644
--- a/package.json
+++ b/package.json
@@ -2,7 +2,7 @@
   "devDependencies": {
-    "critical-gate": "2.6.0",
+    "critical-gate": "2.7.0",
     "sass": "^1.97.2"
   }
diff --git a/bun.lock b/bun.lock
index 57b22a0..cb3e0f1 100644
--- a/bun.lock
+++ b/bun.lock
@@ -1 +1 @@
-"critical-gate": ["critical-gate@2.6.0", "", {}, "sha512-old"]
+"critical-gate": ["critical-gate@2.7.0", "", {}, "sha512-new"]
`);

    expect(intentVerificationDetector.run({ task, diff })).toEqual([]);
  });

  it("fails strong UI feature intent when only trivial stylesheet values changed", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Add new section to the site to display works done"
    };
    const diff = parse(`diff --git a/src/styles/typography.scss b/src/styles/typography.scss
index 57b22a0..cb3e0f1 100644
--- a/src/styles/typography.scss
+++ b/src/styles/typography.scss
@@ -10,7 +10,7 @@
 .hero-title {
-  font-weight: 900;
+  font-weight: 700;
 }
`);

    const findings = intentVerificationDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "intent-coverage:ui-implementation-not-observed",
        detector: "intent-coverage",
        severity: "high",
        title: "Requested UI implementation not observed"
      })
    ]);
  });

  it("does not emit UI implementation undercoverage for explicit typography tasks", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Adjust typography font weight for the works section"
    };
    const diff = parse(`diff --git a/src/styles/typography.scss b/src/styles/typography.scss
index 57b22a0..cb3e0f1 100644
--- a/src/styles/typography.scss
+++ b/src/styles/typography.scss
@@ -10,7 +10,7 @@
 .hero-title {
-  font-weight: 900;
+  font-weight: 700;
 }
`);

    expect(intentVerificationDetector.run({ task, diff })).toEqual([]);
  });

  it("makes clear UI feature undercoverage fail in the default decision policy", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Add new section to the site to display works done"
    };
    const diff = parse(`diff --git a/src/styles/typography.scss b/src/styles/typography.scss
index 57b22a0..cb3e0f1 100644
--- a/src/styles/typography.scss
+++ b/src/styles/typography.scss
@@ -10,7 +10,7 @@
 .hero-title {
-  font-weight: 900;
+  font-weight: 700;
 }
`);

    const findings = runDetectors(task, diff);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detector: "intent-coverage",
          severity: "high"
        })
      ])
    );
    expect(summarizeFindings(findings, task, diff)).toMatchObject({
      decision: "fail",
      highCount: 1
    });
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

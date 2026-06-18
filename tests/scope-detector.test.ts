import { parseUnifiedDiff, runDetectors, scopeDetector, summarizeFindings } from "../src/index.js";
import type { GateResult, TaskIntent } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Fix signup validation"
};

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

describe("scopeDetector", () => {
  it("emits high severity for config changes in small tasks", () => {
    const diff = parse(`diff --git a/webpack.config.js b/webpack.config.js
index 57b22a0..cb3e0f1 100644
--- a/webpack.config.js
+++ b/webpack.config.js
@@ -1,2 +1,3 @@
+export const cache = true;
 export default {};
`);

    const findings = scopeDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "scope",
        severity: "high",
        title: "Unexpected file changed for small task",
        message:
          "webpack.config.js changed during a small task but does not align with expected scope.",
        repair:
          "Remove unrelated edits or split them into a separate task with explicit justification.",
        tags: ["scope"]
      })
    ]);
  });

  it("emits medium severity for unrelated source files in small tasks", () => {
    const diff = parse(`diff --git a/src/logger.ts b/src/logger.ts
index 57b22a0..cb3e0f1 100644
--- a/src/logger.ts
+++ b/src/logger.ts
@@ -1,2 +1,3 @@
+export const verbose = true;
 export const logger = true;
`);

    const findings = scopeDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        severity: "medium",
        message: "src/logger.ts changed during a small task but does not align with expected scope."
      })
    ]);
  });

  it("does not emit for task-aligned source and test files", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1,2 +1,3 @@
+export const signupValidation = true;
 export const signup = true;
diff --git a/tests/signup.test.ts b/tests/signup.test.ts
index 57b22a0..cb3e0f1 100644
--- a/tests/signup.test.ts
+++ b/tests/signup.test.ts
@@ -1,2 +1,3 @@
+expect(signupValidation).toBe(true);
 expect(signup).toBe(true);
`);

    expect(scopeDetector.run({ task, diff })).toEqual([]);
  });

  it("does not emit for broad refactor tasks", () => {
    const diff = parse(`diff --git a/src/logger.ts b/src/logger.ts
index 57b22a0..cb3e0f1 100644
--- a/src/logger.ts
+++ b/src/logger.ts
@@ -1,2 +1,3 @@
+export const verbose = true;
 export const logger = true;
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Refactor project logging architecture"
        },
        diff
      })
    ).toEqual([]);
  });

  it("does not emit for version-only release manifest changes", () => {
    const diff = parse(`diff --git a/package.json b/package.json
index 57b22a0..cb3e0f1 100644
--- a/package.json
+++ b/package.json
@@ -1,5 +1,5 @@
 {
   "name": "example",
-  "version": "1.2.2",
+  "version": "1.2.3",
   "type": "module"
 }
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "1.2.3"
        },
        diff
      })
    ).toEqual([]);
  });

  it("still emits for non-version manifest changes during release tasks", () => {
    const diff = parse(`diff --git a/package.json b/package.json
index 57b22a0..cb3e0f1 100644
--- a/package.json
+++ b/package.json
@@ -1,5 +1,6 @@
 {
   "name": "example",
   "version": "1.2.3",
+  "dependencies": {"left-pad": "^1.3.0"},
   "type": "module"
 }
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Release 1.2.3"
        },
        diff
      })
    ).toEqual([
      expect.objectContaining({
        detector: "scope",
        severity: "high",
        message: "package.json changed during a small task but does not align with expected scope."
      })
    ]);
  });
});

describe("detector runner with scope findings", () => {
  it("summarizes scope findings and diff cost score", () => {
    const diff = parse(`diff --git a/webpack.config.js b/webpack.config.js
index 57b22a0..cb3e0f1 100644
--- a/webpack.config.js
+++ b/webpack.config.js
@@ -1,2 +1,3 @@
+export const cache = true;
 export default {};
`);

    const findings = runDetectors(task, diff);

    expect(summarizeFindings(findings, task, diff)).toMatchObject({
      decision: "fail",
      findingCount: 2,
      highCount: 1,
      mediumCount: 1
    });
    expect(summarizeFindings(findings, task, diff).diffCostScore).toBeGreaterThan(0);
  });
});

import {
  apiSurfaceDetector,
  parseUnifiedDiff,
  runDetectors,
  summarizeFindings
} from "../src/index.js";
import type { GateResult, TaskIntent } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Update signup validation"
};

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

describe("apiSurfaceDetector", () => {
  it("emits medium severity when an export is added without acknowledgement", () => {
    const diff = parse(`diff --git a/src/index.ts b/src/index.ts
index 57b22a0..cb3e0f1 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
+export function validateSignup(input: SignupInput) {}
 export const existing = true;
`);

    const findings = apiSurfaceDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "api-surface",
        severity: "medium",
        title: "Public export added",
        message: "The diff adds an exported symbol without visible API acknowledgement.",
        repair:
          "Confirm the new export is intended public API and document it or keep it internal.",
        tags: ["api"]
      })
    ]);
    expect(findings[0]?.evidence[0]).toMatchObject({
      kind: "symbol",
      path: "src/index.ts",
      symbol: "validateSignup",
      message: "export function validateSignup(input: SignupInput) {}",
      data: {
        signal: "added-export"
      }
    });
  });

  it("emits high severity when an export is removed without acknowledgement", () => {
    const diff = parse(`diff --git a/src/index.ts b/src/index.ts
index 57b22a0..cb3e0f1 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1 @@
-export interface SignupOptions {}
 export const existing = true;
`);

    const findings = apiSurfaceDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        severity: "high",
        title: "Public export removed",
        message: "The diff removes an exported symbol without visible API acknowledgement.",
        repair:
          "Confirm this is an intended public API change and add changelog, release note, docs, or explicit task/PR acknowledgement."
      })
    ]);
  });

  it("detects named and default exports", () => {
    const diff = parse(`diff --git a/src/index.ts b/src/index.ts
index 57b22a0..cb3e0f1 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,4 @@
+export { validateSignup, parseSignup };
+export default createSignup;
 export const existing = true;
`);

    const findings = apiSurfaceDetector.run({ task, diff });

    expect(findings).toHaveLength(2);
    expect(findings[0]?.evidence[0]).toMatchObject({ symbol: "validateSignup" });
    expect(findings[1]?.evidence[0]).toMatchObject({ symbol: "default" });
  });

  it("does not emit when task text acknowledges API work", () => {
    const diff = parse(`diff --git a/src/index.ts b/src/index.ts
index 57b22a0..cb3e0f1 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
+export function validateSignup(input: SignupInput) {}
 export const existing = true;
`);

    const findings = apiSurfaceDetector.run({
      task: {
        source: "cli",
        text: "Export public API for signup validation"
      },
      diff
    });

    expect(findings).toEqual([]);
  });

  it("does not emit when docs change alongside API surface", () => {
    const diff = parse(`diff --git a/src/index.ts b/src/index.ts
index 57b22a0..cb3e0f1 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
+export function validateSignup(input: SignupInput) {}
 export const existing = true;
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 0000000..6bb83df
--- /dev/null
+++ b/CHANGELOG.md
@@ -0,0 +1 @@
+Document public API change.
`);

    expect(apiSurfaceDetector.run({ task, diff })).toEqual([]);
  });

  it("ignores non-export source changes", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1,2 +1,3 @@
+const internalValue = true;
 export const signup = true;
`);

    expect(apiSurfaceDetector.run({ task, diff })).toEqual([]);
  });
});

describe("detector runner with API surface findings", () => {
  it("summarizes removed exports into a failing gate decision", () => {
    const diff = parse(`diff --git a/src/index.ts b/src/index.ts
index 57b22a0..cb3e0f1 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1 @@
-export type SignupOptions = {};
 export const existing = true;
`);

    const findings = runDetectors(task, diff);

    expect(summarizeFindings(findings)).toMatchObject({
      decision: "fail",
      findingCount: 2,
      highCount: 1
    });
  });
});

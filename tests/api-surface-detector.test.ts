import {
  apiSurfaceDetector,
  parseUnifiedDiff,
  runDetectors,
  summarizeFindings
} from "../src/index.js";
import type { GateResult, TaskIntent } from "../src/index.js";
import type { ApiSurfaceSnapshot } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Update signup validation"
};

const apiSnapshot: ApiSurfaceSnapshot = {
  schemaVersion: "1.0",
  generatedAt: "2026-06-19T08:00:00.000Z",
  entrypoints: ["src/index.ts"],
  exports: [
    {
      path: "src/index.ts",
      name: "validateSignup",
      kind: "function",
      signature: "export function validateSignup(input: SignupInput): boolean"
    },
    {
      path: "src/index.ts",
      name: "SignupOptions",
      kind: "interface",
      signature: "export interface SignupOptions {}"
    }
  ]
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

  it("emits high severity framework contract findings without an API snapshot", () => {
    const diff = parse(`diff --git a/src/content.config.ts b/src/content.config.ts
index 57b22a0..cb3e0f1 100644
--- a/src/content.config.ts
+++ b/src/content.config.ts
@@ -1,3 +1,3 @@
 import { defineCollection } from "astro:content";
-export const collections = { releases: defineCollection({}) };
+const collections = { releases: defineCollection({}) };
`);

    const findings = apiSurfaceDetector.run({
      task: {
        source: "cli",
        text: "Refactor content config internals"
      },
      diff
    });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "api-surface",
        severity: "high",
        confidence: 0.9,
        title: "Framework contract export removed",
        message: "The diff removes an exported framework contract without visible acknowledgement.",
        repair:
          "Restore the framework contract export, or document the migration and update the task/PR to acknowledge the contract change."
      })
    ]);
    expect(findings[0]?.evidence[0]).toMatchObject({
      path: "src/content.config.ts",
      symbol: "collections",
      data: {
        signal: "removed-contract-export",
        contract: "framework"
      }
    });
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

  it("emits blocker when API work violates no_public_api_change invariant", () => {
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
      diff,
      context: {
        taskContract: {
          source: "provided",
          goal: "Refactor signup internals",
          allowedPaths: [],
          forbiddenPaths: [],
          expectedArtifacts: [],
          invariants: ["no_public_api_change"],
          requiredChecks: []
        }
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "api-surface",
        severity: "blocker",
        confidence: 0.95,
        title: "Public API change violates task contract",
        message:
          "The diff changes public API surface even though the task contract invariant no_public_api_change forbids public API changes.",
        repair:
          "Remove the public API change or revise the task contract with explicit reviewer approval."
      })
    ]);
    expect(findings[0]?.evidence[0]?.data).toMatchObject({
      signal: "added-export",
      enforcedInvariant: "no_public_api_change"
    });
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

  it("emits blocker for docs-backed API changes when no_public_api_change is declared", () => {
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

    const findings = apiSurfaceDetector.run({
      task,
      diff,
      context: {
        taskContract: {
          source: "provided",
          goal: "Update signup validation",
          allowedPaths: [],
          forbiddenPaths: [],
          expectedArtifacts: [],
          invariants: ["no_public_api_change"],
          requiredChecks: []
        }
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "api-surface",
        severity: "blocker",
        title: "Public API change violates task contract"
      })
    ]);
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

  it("ignores internal exports when public entrypoint context is available", () => {
    const diff = parse(`diff --git a/src/internal/signup.ts b/src/internal/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/internal/signup.ts
+++ b/src/internal/signup.ts
@@ -1,2 +1,3 @@
+export function internalSignupHelper() {}
 export const signup = true;
`);

    expect(
      apiSurfaceDetector.run({
        task,
        diff,
        context: {
          publicApiEntrypoints: [
            {
              path: "src/index.ts",
              source: "package-exports",
              packageKey: "exports",
              exportKey: "."
            }
          ]
        }
      })
    ).toEqual([]);
  });

  it("emits public entrypoint evidence for unsnapshotted package exports", () => {
    const diff = parse(`diff --git a/src/index.ts b/src/index.ts
index 57b22a0..cb3e0f1 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,3 @@
+export function validateSignup(input: SignupInput) {}
 export const existing = true;
`);

    const findings = apiSurfaceDetector.run({
      task,
      diff,
      context: {
        publicApiEntrypoints: [
          {
            path: "src/index.ts",
            source: "package-exports",
            packageKey: "exports",
            exportKey: "."
          }
        ]
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "api-surface",
        severity: "medium"
      })
    ]);
    expect(findings[0]?.evidence[0]?.data).toMatchObject({
      signal: "added-export",
      publicEntrypoint: {
        path: "src/index.ts",
        source: "package-exports",
        packageKey: "exports",
        exportKey: "."
      }
    });
  });

  it("flags snapshotted public signature changes without contract evidence", () => {
    const diff = parse(`diff --git a/src/index.ts b/src/index.ts
index 57b22a0..cb3e0f1 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,2 @@
-export function validateSignup(input: SignupInput): boolean
+export function validateSignup(input: SignupInput, strict: boolean): boolean
 export const existing = true;
`);

    const findings = apiSurfaceDetector.run({
      task: {
        source: "cli",
        text: "Change public API for signup validation"
      },
      diff,
      context: {
        apiSurfaceSnapshot: apiSnapshot
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        severity: "high",
        title: "Public API signature changed",
        message:
          "The diff changes a snapshotted public API signature without changelog, changeset, migration, or snapshot evidence."
      })
    ]);
    expect(findings[0]?.evidence[0]).toMatchObject({
      symbol: "validateSignup",
      data: {
        signal: "signature-change",
        snapshotSignature: "export function validateSignup(input: SignupInput): boolean"
      }
    });
  });

  it("flags API snapshot updates without release evidence", () => {
    const diff = parse(`diff --git a/src/index.ts b/src/index.ts
index 57b22a0..cb3e0f1 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1 +1 @@
-export function validateSignup(input: SignupInput): boolean
+export function validateSignup(input: SignupInput, strict: boolean): boolean
diff --git a/.critical-gate/api-surface.json b/.critical-gate/api-surface.json
index 0000000..6bb83df
--- a/.critical-gate/api-surface.json
+++ b/.critical-gate/api-surface.json
@@ -1 +1 @@
-{"exports":[]}
+{"exports":[{"name":"validateSignup"}]}
`);

    const findings = apiSurfaceDetector.run({
      task,
      diff,
      context: {
        apiSurfaceSnapshot: apiSnapshot
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "api-surface:.critical-gate/api-surface.json:snapshot-update-missing-release-evidence:unknown:1",
        detector: "api-surface",
        severity: "high",
        title: "API snapshot updated without release evidence",
        message:
          "The public API snapshot changed without changelog, changeset, migration, or explicit API release task evidence."
      })
    ]);
  });

  it("accepts snapshotted API changes when snapshot update has changelog evidence", () => {
    const diff = parse(`diff --git a/src/index.ts b/src/index.ts
index 57b22a0..cb3e0f1 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1 +1 @@
-export function validateSignup(input: SignupInput): boolean
+export function validateSignup(input: SignupInput, strict: boolean): boolean
diff --git a/.critical-gate/api-surface.json b/.critical-gate/api-surface.json
index 0000000..6bb83df
--- a/.critical-gate/api-surface.json
+++ b/.critical-gate/api-surface.json
@@ -1 +1 @@
-{"exports":[]}
+{"exports":[{"name":"validateSignup"}]}
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 0000000..6bb83df
--- /dev/null
+++ b/CHANGELOG.md
@@ -0,0 +1 @@
+Document signup API signature migration.
`);

    expect(
      apiSurfaceDetector.run({
        task,
        diff,
        context: {
          apiSurfaceSnapshot: apiSnapshot
        }
      })
    ).toEqual([]);
  });

  it("accepts snapshot updates for explicit API release tasks", () => {
    const diff =
      parse(`diff --git a/.critical-gate/api-surface.json b/.critical-gate/api-surface.json
index 0000000..6bb83df
--- a/.critical-gate/api-surface.json
+++ b/.critical-gate/api-surface.json
@@ -1 +1 @@
-{"exports":[]}
+{"exports":[{"name":"validateSignup"}]}
`);

    expect(
      apiSurfaceDetector.run({
        task: {
          source: "cli",
          text: "Prepare public API release for signup exports"
        },
        diff,
        context: {
          apiSurfaceSnapshot: apiSnapshot
        }
      })
    ).toEqual([]);
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

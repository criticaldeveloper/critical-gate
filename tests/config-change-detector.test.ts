import {
  configChangeDetector,
  parseUnifiedDiff,
  runDetectors,
  summarizeFindings
} from "../src/index.js";
import type { GateResult, TaskIntent } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Add signup validation"
};

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

describe("configChangeDetector", () => {
  it("emits a medium finding when config changes without task or docs explanation", () => {
    const diff = parse(`diff --git a/tsconfig.json b/tsconfig.json
index 57b22a0..cb3e0f1 100644
--- a/tsconfig.json
+++ b/tsconfig.json
@@ -2,6 +2,7 @@
   "compilerOptions": {
+    "skipLibCheck": true,
     "strict": true
   }
 }
`);

    const findings = configChangeDetector.run({ task, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "config-change",
        severity: "medium",
        title: "Config changed without visible explanation",
        message:
          "tsconfig.json changed, but the task did not mention configuration and no documentation file changed.",
        repair:
          "Confirm the config change is required. If it changes team workflow or runtime behavior, add docs, an ADR, changelog entry, or explicit task/PR explanation.",
        tags: ["config"]
      })
    ]);
    expect(findings[0]?.evidence[0]).toMatchObject({
      kind: "file",
      path: "tsconfig.json",
      message: "Config file changed during task: Add signup validation",
      data: {
        additions: 1,
        deletions: 0,
        role: "config"
      }
    });
  });

  it("does not emit when the task mentions config work", () => {
    const diff = parse(`diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 57b22a0..cb3e0f1 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,3 +1,4 @@
 name: CI
+timeout-minutes: 10
`);

    const findings = configChangeDetector.run({
      task: {
        source: "cli",
        text: "Update CI workflow timeout"
      },
      diff
    });

    expect(findings).toEqual([]);
  });

  it("does not emit when documentation changes alongside config", () => {
    const diff = parse(`diff --git a/vitest.config.ts b/vitest.config.ts
index 57b22a0..cb3e0f1 100644
--- a/vitest.config.ts
+++ b/vitest.config.ts
@@ -1,3 +1,4 @@
+export const timeout = 10000;
 export default {};
diff --git a/docs/testing.md b/docs/testing.md
new file mode 100644
index 0000000..6bb83df
--- /dev/null
+++ b/docs/testing.md
@@ -0,0 +1 @@
+# Testing
`);

    expect(configChangeDetector.run({ task, diff })).toEqual([]);
  });

  it("ignores non-config files", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1,2 +1,3 @@
+export const enabled = true;
 export const signup = true;
`);

    expect(configChangeDetector.run({ task, diff })).toEqual([]);
  });
});

describe("detector runner with config changes", () => {
  it("combines config and scope findings for unexpected small-task config edits", () => {
    const diff = parse(`diff --git a/eslint.config.js b/eslint.config.js
index 57b22a0..cb3e0f1 100644
--- a/eslint.config.js
+++ b/eslint.config.js
@@ -1,2 +1,3 @@
+export const ignores = [];
 export default [];
`);

    const findings = runDetectors(task, diff);

    expect(summarizeFindings(findings)).toMatchObject({
      decision: "fail",
      findingCount: 2,
      highCount: 1,
      mediumCount: 1
    });
  });
});

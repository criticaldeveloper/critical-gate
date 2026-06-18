import {
  parseUnifiedDiff,
  runDetectors,
  summarizeFindings,
  utilityReinventionDetector
} from "../src/index.js";
import type { GateResult, TaskIntent, UtilityIndex } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Add signup date formatting"
};

const utilityIndex: UtilityIndex = {
  utilities: [
    {
      path: "src/utils/date.ts",
      exportedNames: ["formatDate", "parseDate"]
    }
  ]
};

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

describe("utilityReinventionDetector", () => {
  it("emits a finding when a new utility duplicates an existing export", () => {
    const diff = parse(`diff --git a/src/helpers/date-utils.ts b/src/helpers/date-utils.ts
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/src/helpers/date-utils.ts
@@ -0,0 +1,2 @@
+export function formatDateForSignup() {}
+export const other = true;
`);

    const findings = utilityReinventionDetector.run({
      task,
      diff,
      context: { utilityIndex }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "utility-reinvention",
        severity: "medium",
        title: "New utility may duplicate existing helper",
        message:
          "formatDateForSignup was added in src/helpers/date-utils.ts, but formatDate already exists in src/utils/date.ts.",
        repair:
          "Reuse formatDate from src/utils/date.ts, or document why a separate helper is needed.",
        tags: ["utility"]
      })
    ]);
    expect(findings[0]?.evidence[0]).toMatchObject({
      kind: "symbol",
      path: "src/helpers/date-utils.ts",
      symbol: "formatDateForSignup",
      data: {
        newExport: "formatDateForSignup",
        existingExport: "formatDate",
        existingPath: "src/utils/date.ts"
      }
    });
  });

  it("does not emit without a utility index", () => {
    const diff = parse(`diff --git a/src/helpers/date-utils.ts b/src/helpers/date-utils.ts
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/src/helpers/date-utils.ts
@@ -0,0 +1 @@
+export function formatDateForSignup() {}
`);

    expect(utilityReinventionDetector.run({ task, diff })).toEqual([]);
  });

  it("does not emit for non-utility files", () => {
    const diff = parse(`diff --git a/src/signup/date.ts b/src/signup/date.ts
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/src/signup/date.ts
@@ -0,0 +1 @@
+export function formatDateForSignup() {}
`);

    expect(
      utilityReinventionDetector.run({
        task,
        diff,
        context: { utilityIndex }
      })
    ).toEqual([]);
  });
});

describe("detector runner with utility reinvention", () => {
  it("summarizes utility findings without failing by default", () => {
    const diff = parse(`diff --git a/src/helpers/date-utils.ts b/src/helpers/date-utils.ts
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/src/helpers/date-utils.ts
@@ -0,0 +1 @@
+export function formatDateForSignup() {}
`);

    const findings = runDetectors(task, diff, { utilityIndex });

    expect(summarizeFindings(findings, task, diff)).toMatchObject({
      decision: "pass",
      mediumCount: 2
    });
  });
});

import { parseUnifiedDiff, patternViolationDetector } from "../src/index.js";
import type { GateResult, KnowledgeProvider, PatternIndex, TaskIntent } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Add user helper"
};

const patternIndex: PatternIndex = {
  patterns: [
    {
      kind: "service",
      root: "src/services",
      examples: ["src/services/user.ts", "src/services/billing.ts"],
      confidence: 0.9
    },
    {
      kind: "hook",
      root: "src/hooks",
      examples: ["src/hooks/use-user.ts", "src/hooks/use-billing.ts"],
      confidence: 0.9
    }
  ]
};

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

function knowledge(patterns: PatternIndex): KnowledgeProvider {
  return {
    getFileGraph: () => ({ nodes: [], edges: [] }),
    getHistoryIndex: () => ({ coChanges: [], companionRules: [] }),
    getPatternIndex: () => patterns,
    getSolutionIndex: () => ({ solutions: [] })
  };
}

describe("patternViolationDetector", () => {
  it("emits when helper code appears in a repo with established service roots", () => {
    const diff = parse(`diff --git a/src/helpers/user-api-helper.ts b/src/helpers/user-api-helper.ts
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/src/helpers/user-api-helper.ts
@@ -0,0 +1 @@
+export function getUser() {}
`);

    expect(
      patternViolationDetector.run({ task, diff, context: { knowledge: knowledge(patternIndex) } })
    ).toEqual([
      expect.objectContaining({
        detector: "pattern-violation",
        message:
          "src/helpers/user-api-helper.ts adds helper-style code, but this repository has an established service pattern at src/services.",
        repair:
          "Move this code under src/services, reuse the existing pattern, or document why this task needs a new location."
      })
    ]);
  });

  it("emits when a hook-like symbol is added outside established hook roots", () => {
    const diff = parse(`diff --git a/src/user/use-user.ts b/src/user/use-user.ts
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/src/user/use-user.ts
@@ -0,0 +1 @@
+export function useUser() {}
`);

    expect(
      patternViolationDetector.run({ task, diff, context: { knowledge: knowledge(patternIndex) } })
    ).toEqual([
      expect.objectContaining({
        message:
          "src/user/use-user.ts exports a hook-like symbol outside the established hook root src/hooks."
      })
    ]);
  });

  it("does not emit when new hook follows the established hook root", () => {
    const diff = parse(`diff --git a/src/hooks/use-user-form.ts b/src/hooks/use-user-form.ts
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/src/hooks/use-user-form.ts
@@ -0,0 +1 @@
+export function useUserForm() {}
`);

    expect(
      patternViolationDetector.run({ task, diff, context: { knowledge: knowledge(patternIndex) } })
    ).toEqual([]);
  });
});

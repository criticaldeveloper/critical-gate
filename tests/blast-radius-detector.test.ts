import { blastRadiusDetector, parseUnifiedDiff, runDetectors } from "../src/index.js";
import type { FileGraph, GateResult, KnowledgeProvider, TaskIntent } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Add signup validation"
};

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

function knowledge(graph: FileGraph): KnowledgeProvider {
  return {
    getFileGraph: () => graph,
    getHistoryIndex: () => ({ coChanges: [], companionRules: [] }),
    getSolutionIndex: () => ({ solutions: [] })
  };
}

describe("blastRadiusDetector", () => {
  it("emits one aggregate finding for an unexpected changed cluster", () => {
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
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 57b22a0..cb3e0f1 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1 +1,2 @@
+name: CI
`);

    const findings = blastRadiusDetector.run({
      task,
      diff,
      context: {
        knowledge: knowledge({
          nodes: [],
          edges: [
            {
              from: "src/signup.ts",
              to: "tests/signup.test.ts",
              kind: "test",
              weight: 0.9
            }
          ]
        })
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "blast-radius",
        severity: "medium",
        title: "Unexpected changed-file cluster",
        message:
          "The diff includes a separate changed-file cluster (.github/workflows/ci.yml) outside the primary blast radius.",
        tags: ["scope"]
      })
    ]);
    expect(findings[0]?.evidence).toEqual([
      expect.objectContaining({
        kind: "file",
        path: ".github/workflows/ci.yml",
        data: {
          clusterSize: 1,
          roles: ["config"]
        }
      })
    ]);
  });

  it("does not emit for a connected source and test cluster", () => {
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
      blastRadiusDetector.run({
        task,
        diff,
        context: {
          knowledge: knowledge({
            nodes: [],
            edges: [
              {
                from: "src/signup.ts",
                to: "tests/signup.test.ts",
                kind: "test",
                weight: 0.9
              }
            ]
          })
        }
      })
    ).toEqual([]);
  });

  it("does not emit from the default runner without a knowledge graph", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signup = true;
diff --git a/README.md b/README.md
index 57b22a0..cb3e0f1 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
+docs
`);

    expect(runDetectors(task, diff).some((finding) => finding.detector === "blast-radius")).toBe(
      false
    );
  });
});

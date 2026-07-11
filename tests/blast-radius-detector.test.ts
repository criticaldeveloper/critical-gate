import { blastRadiusDetector, parseUnifiedDiff, runDetectors } from "../src/index.js";
import type {
  FileGraph,
  GateResult,
  KnowledgeProvider,
  TaskContract,
  TaskIntent
} from "../src/index.js";

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
    getPatternIndex: () => ({ patterns: [] }),
    getSolutionIndex: () => ({ solutions: [] })
  };
}

describe("blastRadiusDetector", () => {
  it("does not report disconnected files explicitly allowed by a provided contract", () => {
    const diff = parse(`diff --git a/src/component.ts b/src/component.ts
new file mode 100644
--- /dev/null
+++ b/src/component.ts
@@ -0,0 +1 @@
+export const component = true;
diff --git a/docs/contracts/component.json b/docs/contracts/component.json
new file mode 100644
--- /dev/null
+++ b/docs/contracts/component.json
@@ -0,0 +1 @@
+{}
`);
    const taskContract: TaskContract = {
      source: "provided",
      goal: "Add component",
      allowedPaths: ["src/component.ts", "docs/contracts/component.json"],
      forbiddenPaths: [],
      expectedArtifacts: ["src/component.ts"],
      invariants: [],
      requiredChecks: []
    };

    expect(
      blastRadiusDetector.run({
        task,
        diff,
        context: { knowledge: knowledge({ nodes: [], edges: [] }), taskContract }
      })
    ).toEqual([]);
  });

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

  it("deduplicates overlapping medium legacy scope findings in the runner", () => {
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
diff --git a/src/logger.ts b/src/logger.ts
index 57b22a0..cb3e0f1 100644
--- a/src/logger.ts
+++ b/src/logger.ts
@@ -1 +1,2 @@
+export const logger = true;
`);

    const findings = runDetectors(task, diff, {
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
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detector: "blast-radius"
        })
      ])
    );
    expect(
      findings.some(
        (finding) =>
          finding.detector === "scope" &&
          finding.evidence.some((evidence) => evidence.path === "src/logger.ts")
      )
    ).toBe(false);
    expect(findings.some((finding) => finding.detector === "blast-radius")).toBe(true);
  });

  it("keeps high-confidence legacy scope findings for config clusters", () => {
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
diff --git a/webpack.config.js b/webpack.config.js
index 57b22a0..cb3e0f1 100644
--- a/webpack.config.js
+++ b/webpack.config.js
@@ -1 +1,2 @@
+export const cache = true;
`);

    const findings = runDetectors(task, diff, {
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
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detector: "blast-radius"
        }),
        expect.objectContaining({
          detector: "scope",
          severity: "high",
          id: "scope:webpack.config.js"
        })
      ])
    );
  });

  it("does not emit for explicitly requested separate UI and visual asset clusters", () => {
    const diff =
      parse(`diff --git a/src/components/NowPlaying.astro b/src/components/NowPlaying.astro
index 57b22a0..cb3e0f1 100644
--- a/src/components/NowPlaying.astro
+++ b/src/components/NowPlaying.astro
@@ -1 +1 @@
-<span class="now-playing__dot"></span>
+<img class="now-playing__vinyl" src="/icons/vinyl.png" alt="" />
diff --git a/src/views/ContactView.astro b/src/views/ContactView.astro
index 57b22a0..cb3e0f1 100644
--- a/src/views/ContactView.astro
+++ b/src/views/ContactView.astro
@@ -1 +1 @@
-<section class="contact contact--loose">
+<section class="contact">
diff --git a/public/icons/vinyl.png b/public/icons/vinyl.png
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/public/icons/vinyl.png
@@ -0,0 +1 @@
+png
`);

    const findings = blastRadiusDetector.run({
      task: {
        source: "cli",
        text: "Match contact card spacing and replace now playing dot with rotating vinyl"
      },
      diff,
      context: {
        knowledge: knowledge({ nodes: [], edges: [] })
      }
    });

    expect(findings).toEqual([]);
  });

  it("does not emit for new content posts with reciprocal related metadata clusters", () => {
    const diff =
      parse(`diff --git a/src/content/posts/diff-integrity-evidence.md b/src/content/posts/diff-integrity-evidence.md
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/src/content/posts/diff-integrity-evidence.md
@@ -0,0 +1,8 @@
+---
+title: "Diff Integrity Evidence"
+related:
+  [
+    "testing-ai-agents",
+  ]
+---
+Evidence text.
diff --git a/src/content/posts/testing-ai-agents.md b/src/content/posts/testing-ai-agents.md
index 57b22a0..cb3e0f1 100644
--- a/src/content/posts/testing-ai-agents.md
+++ b/src/content/posts/testing-ai-agents.md
@@ -1,6 +1,7 @@
 ---
 related:
   [
+    "diff-integrity-evidence",
     "developer-tools",
   ]
 ---
diff --git a/src/content/posts/developer-tools.md b/src/content/posts/developer-tools.md
index 57b22a0..cb3e0f1 100644
--- a/src/content/posts/developer-tools.md
+++ b/src/content/posts/developer-tools.md
@@ -1,6 +1,7 @@
 ---
 related:
   [
+    "diff-integrity-evidence",
     "testing-ai-agents",
   ]
 ---
`);

    const findings = blastRadiusDetector.run({
      task: {
        source: "cli",
        text: "Publish a new article about diff integrity evidence and update related content synapses"
      },
      diff,
      context: {
        knowledge: knowledge({ nodes: [], edges: [] })
      }
    });

    expect(findings).toEqual([]);
  });

  it("still emits when content metadata updates are paired with non-content drift", () => {
    const diff =
      parse(`diff --git a/src/content/posts/testing-ai-agents.md b/src/content/posts/testing-ai-agents.md
index 57b22a0..cb3e0f1 100644
--- a/src/content/posts/testing-ai-agents.md
+++ b/src/content/posts/testing-ai-agents.md
@@ -1,6 +1,7 @@
 ---
 related:
   [
+    "diff-integrity-evidence",
     "developer-tools",
   ]
 ---
diff --git a/src/router.ts b/src/router.ts
index 57b22a0..cb3e0f1 100644
--- a/src/router.ts
+++ b/src/router.ts
@@ -1 +1,2 @@
+export const route = true;
`);

    const findings = blastRadiusDetector.run({
      task: {
        source: "cli",
        text: "Publish a new article about diff integrity evidence and update related content synapses"
      },
      diff,
      context: {
        knowledge: knowledge({ nodes: [], edges: [] })
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "blast-radius"
      })
    ]);
  });
});

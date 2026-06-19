import {
  parseUnifiedDiff,
  repositoryIntelligenceDetector,
  runDetectors,
  summarizeFindings
} from "../src/index.js";
import type { GateResult, RepositoryProfile, TaskIntent } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Update signup validation"
};

const profile: RepositoryProfile = {
  commitCount: 50,
  minConfidenceCommitCount: 20,
  coChanges: [
    {
      path: "src/signup.ts",
      count: 10,
      relatedPaths: [{ path: "tests/signup.test.ts", count: 8 }]
    },
    {
      path: "webpack.config.js",
      count: 6,
      relatedPaths: [{ path: "package.json", count: 5 }]
    }
  ]
};

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

describe("repositoryIntelligenceDetector", () => {
  it("emits medium findings for historically unusual file combinations", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signup = true;
diff --git a/webpack.config.js b/webpack.config.js
index 57b22a0..cb3e0f1 100644
--- a/webpack.config.js
+++ b/webpack.config.js
@@ -1 +1,2 @@
+export const cache = true;
`);

    const findings = repositoryIntelligenceDetector.run({
      task,
      diff,
      context: { repositoryProfile: profile }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "repository-intelligence",
        severity: "medium",
        title: "Unusual historical change pattern",
        message:
          "src/signup.ts changed with files it has not historically changed with in this repository.",
        tags: ["scope"]
      }),
      expect.objectContaining({
        message:
          "webpack.config.js changed with files it has not historically changed with in this repository."
      })
    ]);
    expect(findings[0]?.evidence[0]).toMatchObject({
      kind: "history",
      path: "src/signup.ts",
      data: {
        commitCount: 50,
        fileChangeCount: 10,
        historicallyRelatedPaths: ["tests/signup.test.ts"]
      }
    });
  });

  it("does not emit when changed files have historical co-change evidence", () => {
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
      repositoryIntelligenceDetector.run({
        task,
        diff,
        context: { repositoryProfile: profile }
      })
    ).toEqual([]);
  });

  it("does not emit when history confidence is too low", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signup = true;
diff --git a/webpack.config.js b/webpack.config.js
index 57b22a0..cb3e0f1 100644
--- a/webpack.config.js
+++ b/webpack.config.js
@@ -1 +1,2 @@
+export const cache = true;
`);

    expect(
      repositoryIntelligenceDetector.run({
        task,
        diff,
        context: {
          repositoryProfile: {
            ...profile,
            commitCount: 5
          }
        }
      })
    ).toEqual([]);
  });

  it("includes normal change model evidence for unusual combinations", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signup = true;
diff --git a/webpack.config.js b/webpack.config.js
index 57b22a0..cb3e0f1 100644
--- a/webpack.config.js
+++ b/webpack.config.js
@@ -1 +1,2 @@
+export const cache = true;
`);

    const findings = repositoryIntelligenceDetector.run({
      task,
      diff,
      context: {
        repositoryProfile: profile,
        knowledge: {
          getFileGraph: () => ({ nodes: [], edges: [] }),
          getHistoryIndex: () => ({
            coChanges: profile.coChanges,
            companionRules: [],
            normalPatterns: [
              {
                kind: "source-test",
                sourcePath: "src/signup.ts",
                relatedPath: "tests/signup.test.ts",
                support: 8,
                confidence: 0.8
              }
            ]
          }),
          getPatternIndex: () => ({ patterns: [] }),
          getSolutionIndex: () => ({ solutions: [] })
        }
      }
    });

    expect(findings[0]?.evidence[0]?.data).toMatchObject({
      normalPatterns: [
        {
          kind: "source-test",
          relatedPath: "tests/signup.test.ts",
          support: 8,
          confidence: 0.8
        }
      ]
    });
  });
});

describe("detector runner with repository intelligence", () => {
  it("includes repository intelligence when context has history", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signup = true;
diff --git a/webpack.config.js b/webpack.config.js
index 57b22a0..cb3e0f1 100644
--- a/webpack.config.js
+++ b/webpack.config.js
@@ -1 +1,2 @@
+export const cache = true;
`);

    const findings = runDetectors(task, diff, { repositoryProfile: profile });

    expect(summarizeFindings(findings, task, diff)).toMatchObject({
      decision: "fail",
      highCount: 1,
      mediumCount: 4
    });
  });
});

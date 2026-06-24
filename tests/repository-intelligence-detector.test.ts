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

const uiProfile: RepositoryProfile = {
  commitCount: 50,
  minConfidenceCommitCount: 20,
  coChanges: [
    {
      path: "src/components/StatusBadge.astro",
      count: 8,
      relatedPaths: [{ path: "src/styles/status.scss", count: 7 }]
    },
    {
      path: "src/views/ProfileView.astro",
      count: 8,
      relatedPaths: [{ path: "src/content/profile.ts", count: 6 }]
    },
    {
      path: "src/views/ContactView.astro",
      count: 8,
      relatedPaths: [{ path: "src/content/contact.ts", count: 6 }]
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

  it("does not emit for explicitly named focused UI presentation surfaces", () => {
    const diff =
      parse(`diff --git a/src/components/StatusBadge.astro b/src/components/StatusBadge.astro
index 57b22a0..cb3e0f1 100644
--- a/src/components/StatusBadge.astro
+++ b/src/components/StatusBadge.astro
@@ -1 +1 @@
-<span class="status-badge">Live</span>
+<span class="status-badge status-badge--animated">Live</span>
diff --git a/src/views/ProfileView.astro b/src/views/ProfileView.astro
index 57b22a0..cb3e0f1 100644
--- a/src/views/ProfileView.astro
+++ b/src/views/ProfileView.astro
@@ -1 +1 @@
-<section class="profile-card">
+<section class="profile-card profile-card--compact">
diff --git a/src/views/ContactView.astro b/src/views/ContactView.astro
index 57b22a0..cb3e0f1 100644
--- a/src/views/ContactView.astro
+++ b/src/views/ContactView.astro
@@ -1 +1 @@
-<section class="contact-card contact-card--loose">
+<section class="contact-card">
`);

    expect(
      repositoryIntelligenceDetector.run({
        task: {
          source: "cli",
          text: "Align profile card, contact card spacing, and animated status badge"
        },
        diff,
        context: { repositoryProfile: uiProfile }
      })
    ).toEqual([]);
  });

  it("still emits for vague UI presentation tasks without an explicit surface match", () => {
    const diff =
      parse(`diff --git a/src/components/StatusBadge.astro b/src/components/StatusBadge.astro
index 57b22a0..cb3e0f1 100644
--- a/src/components/StatusBadge.astro
+++ b/src/components/StatusBadge.astro
@@ -1 +1 @@
-<span class="status-badge">Live</span>
+<span class="status-badge status-badge--animated">Live</span>
diff --git a/src/views/ProfileView.astro b/src/views/ProfileView.astro
index 57b22a0..cb3e0f1 100644
--- a/src/views/ProfileView.astro
+++ b/src/views/ProfileView.astro
@@ -1 +1 @@
-<section class="profile-card">
+<section class="profile-card profile-card--compact">
`);

    const findings = repositoryIntelligenceDetector.run({
      task: {
        source: "cli",
        text: "Polish card spacing"
      },
      diff,
      context: { repositoryProfile: uiProfile }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "repository-intelligence:src/components/StatusBadge.astro"
      }),
      expect.objectContaining({
        id: "repository-intelligence:src/views/ProfileView.astro"
      })
    ]);
  });

  it("still emits when an explicitly named UI surface is paired with config drift", () => {
    const diff =
      parse(`diff --git a/src/components/StatusBadge.astro b/src/components/StatusBadge.astro
index 57b22a0..cb3e0f1 100644
--- a/src/components/StatusBadge.astro
+++ b/src/components/StatusBadge.astro
@@ -1 +1 @@
-<span class="status-badge">Live</span>
+<span class="status-badge status-badge--animated">Live</span>
diff --git a/webpack.config.js b/webpack.config.js
index 57b22a0..cb3e0f1 100644
--- a/webpack.config.js
+++ b/webpack.config.js
@@ -1 +1,2 @@
+export const cache = true;
`);

    expect(
      repositoryIntelligenceDetector.run({
        task: {
          source: "cli",
          text: "Animate the status badge indicator"
        },
        diff,
        context: {
          repositoryProfile: {
            ...uiProfile,
            coChanges: [
              ...uiProfile.coChanges,
              {
                path: "webpack.config.js",
                count: 6,
                relatedPaths: [{ path: "package.json", count: 5 }]
              }
            ]
          }
        }
      })
    ).toEqual([
      expect.objectContaining({
        id: "repository-intelligence:src/components/StatusBadge.astro"
      }),
      expect.objectContaining({
        id: "repository-intelligence:webpack.config.js"
      })
    ]);
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

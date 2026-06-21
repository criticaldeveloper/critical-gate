import type { GateResult, TaskIntent } from "../src/index.js";
import { parseUnifiedDiff, runDetectors, scopeDetector, summarizeFindings } from "../src/index.js";
import { buildRepositoryTokenIndex } from "../src/repository/index.js";

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

  it("emits high severity for deleted stylesheet files that do not match a small task", () => {
    const diff = parse(`diff --git a/src/styles/typography.scss b/src/styles/typography.scss
deleted file mode 100644
index 57b22a0..0000000
--- a/src/styles/typography.scss
+++ /dev/null
@@ -1,3 +0,0 @@
-.heading {
-  font-weight: 600;
-}
`);

    const findings = scopeDetector.run({
      task: {
        source: "cli",
        text: "Fixed fonts"
      },
      diff
    });

    expect(findings).toEqual([
      expect.objectContaining({
        severity: "high",
        title: "Unexpected file deleted for small task",
        message:
          "src/styles/typography.scss was deleted during a small task but does not align with expected scope."
      })
    ]);
  });

  it("does not treat casual project wording as a broad task", () => {
    const diff = parse(`diff --git a/src/styles/reset.scss b/src/styles/reset.scss
deleted file mode 100644
index 57b22a0..0000000
--- a/src/styles/reset.scss
+++ /dev/null
@@ -1,3 +0,0 @@
-* {
-  box-sizing: border-box;
-}
diff --git a/src/styles/typography.scss b/src/styles/typography.scss
deleted file mode 100644
index 57b22a0..0000000
--- a/src/styles/typography.scss
+++ /dev/null
@@ -1,3 +0,0 @@
-.heading {
-  font-weight: 600;
-}
`);

    const findings = runDetectors(
      {
        source: "cli",
        text: "Fixed fonts of the project"
      },
      diff
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detector: "scope",
          severity: "high",
          message:
            "src/styles/reset.scss was deleted during a small task but does not align with expected scope."
        }),
        expect.objectContaining({
          detector: "scope",
          severity: "high",
          message:
            "src/styles/typography.scss was deleted during a small task but does not align with expected scope."
        })
      ])
    );
    expect(
      summarizeFindings(findings, { source: "cli", text: "Fixed fonts of the project" }, diff)
    ).toMatchObject({
      decision: "fail",
      highCount: 2
    });
  });

  it("treats typography changes as aligned with font task wording", () => {
    const diff = parse(`diff --git a/src/styles/typography.scss b/src/styles/typography.scss
index 57b22a0..cb3e0f1 100644
--- a/src/styles/typography.scss
+++ b/src/styles/typography.scss
@@ -10,7 +10,7 @@
 .hero-title {
-  font-weight: 900;
+  font-weight: 700;
 }
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Fixed fonts of the project"
        },
        diff
      })
    ).toEqual([]);
  });

  it("does not emit for acknowledged deleted stylesheet files", () => {
    const diff = parse(`diff --git a/src/styles/typography.scss b/src/styles/typography.scss
deleted file mode 100644
index 57b22a0..0000000
--- a/src/styles/typography.scss
+++ /dev/null
@@ -1,3 +0,0 @@
-.heading {
-  font-weight: 600;
-}
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Remove typography stylesheet"
        },
        diff
      })
    ).toEqual([]);
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

  it("uses repository symbol tokens as task alignment evidence", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Fix email validator"
    };
    const diff = parse(`diff --git a/src/rules/user.ts b/src/rules/user.ts
index 57b22a0..cb3e0f1 100644
--- a/src/rules/user.ts
+++ b/src/rules/user.ts
@@ -1,2 +1,3 @@
+export function validateEmailAddress(value: string) { return value.includes("@"); }
 export const user = true;
`);
    const repositoryTokenIndex = buildRepositoryTokenIndex({ files: diff.files });

    expect(scopeDetector.run({ task, diff })).toEqual([
      expect.objectContaining({
        detector: "scope",
        severity: "medium"
      })
    ]);
    expect(
      scopeDetector.run({
        task,
        diff,
        context: { repositoryTokenIndex }
      })
    ).toEqual([]);
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

  it("does not emit for workflow changes when the task mentions CI", () => {
    const diff = parse(`diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 57b22a0..cb3e0f1 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,2 +1,2 @@
-node-version: 20
+node-version: 24
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Fix CI Node version for pnpm"
        },
        diff
      })
    ).toEqual([]);
  });

  it("emits for config changes when the task explicitly forbids config edits", () => {
    const diff = parse(`diff --git a/.node-version b/.node-version
index 57b22a0..cb3e0f1 100644
--- a/.node-version
+++ b/.node-version
@@ -1 +1 @@
-22.12.0
+24.0.0
diff --git a/src/components/ArtistIntro.astro b/src/components/ArtistIntro.astro
index 57b22a0..cb3e0f1 100644
--- a/src/components/ArtistIntro.astro
+++ b/src/components/ArtistIntro.astro
@@ -1,3 +1,3 @@
 <section class="artist-intro">
-  <p>Original spacing</p>
+  <p class="artist-intro__lede">Original spacing</p>
 </section>
`);

    const findings = scopeDetector.run({
      task: {
        source: "cli",
        text: "Adjust ArtistIntro spacing without changing config"
      },
      diff
    });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "scope",
        severity: "high",
        message: ".node-version changed during a small task but does not align with expected scope."
      })
    ]);
  });

  it("does not emit for package engine changes when the task mentions Node", () => {
    const diff = parse(`diff --git a/package.json b/package.json
index 57b22a0..cb3e0f1 100644
--- a/package.json
+++ b/package.json
@@ -1,5 +1,5 @@
 {
   "name": "example",
-  "engines": {"node": ">=20"}
+  "engines": {"node": ">=22.13"}
 }
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Fix Node runtime support for pnpm"
        },
        diff
      })
    ).toEqual([]);
  });

  it("does not emit for package metadata changes when the task mentions Marketplace", () => {
    const diff = parse(`diff --git a/extensions/vscode/package.json b/extensions/vscode/package.json
index 57b22a0..cb3e0f1 100644
--- a/extensions/vscode/package.json
+++ b/extensions/vscode/package.json
@@ -1,5 +1,6 @@
 {
   "name": "critical-gate",
+  "publisher": "criticaldeveloper",
   "displayName": "Critical-Gate"
 }
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Prepare VS Code Marketplace metadata"
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

  it("does not emit for version-only manifest changes in bugfix tasks", () => {
    const diff = parse(`diff --git a/package.json b/package.json
index 57b22a0..cb3e0f1 100644
--- a/package.json
+++ b/package.json
@@ -1,5 +1,5 @@
 {
   "name": "critical-gate",
-  "version": "2.1.0",
+  "version": "2.1.1",
   "type": "module"
 }
diff --git a/extensions/vscode/package.json b/extensions/vscode/package.json
index 57b22a0..cb3e0f1 100644
--- a/extensions/vscode/package.json
+++ b/extensions/vscode/package.json
@@ -1,5 +1,5 @@
 {
   "name": "critical-gate-vscode",
-  "version": "2.1.0",
+  "version": "2.1.1",
   "publisher": "criticaldeveloper"
 }
`);

    expect(
      scopeDetector.run({
        task: {
          source: "cli",
          text: "Fix global CLI entrypoint execution"
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

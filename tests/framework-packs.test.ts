import {
  detectFrameworkPacks,
  expectedCompanionsDetector,
  matchesPathPattern,
  parseUnifiedDiff,
  type GateResult
} from "../src/index.js";

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

describe("framework packs", () => {
  it("detects packs from package dependencies and config", () => {
    expect(
      detectFrameworkPacks({
        files: [],
        packageJson: {
          dependencies: {
            react: "^19.0.0"
          },
          devDependencies: {
            vite: "^7.0.0"
          }
        },
        config: {
          frameworkPacks: ["storybook"]
        }
      }).map((pack) => pack.id)
    ).toEqual(["react", "vite", "storybook"]);
  });

  it("matches zero-or-more directory globs", () => {
    expect(matchesPathPattern("src/**/*.test.tsx", "src/Button.test.tsx")).toBe(true);
    expect(matchesPathPattern("src/**/*.test.tsx", "src/components/Button.test.tsx")).toBe(true);
  });

  it("matches trailing globstars as directory descendants", () => {
    expect(
      matchesPathPattern("docs/critical-gate-evidence/**", "docs/critical-gate-evidence")
    ).toBe(true);
    expect(
      matchesPathPattern("docs/critical-gate-evidence/**", "docs/critical-gate-evidence/report.md")
    ).toBe(true);
    expect(
      matchesPathPattern(
        "docs/critical-gate-evidence/**",
        "docs/critical-gate-evidence/2026-06-22/report.md"
      )
    ).toBe(true);
    expect(
      matchesPathPattern(
        "docs\\critical-gate-evidence\\**",
        "docs\\critical-gate-evidence\\2026-06-22\\report.md"
      )
    ).toBe(true);
  });

  it("emits framework companion findings for active packs", () => {
    const diff = parse(`diff --git a/src/components/Button.tsx b/src/components/Button.tsx
index 57b22a0..cb3e0f1 100644
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1 +1,2 @@
+export function Button() { return <button />; }
`);

    const findings = expectedCompanionsDetector.run({
      task: {
        source: "cli",
        text: "Update Button component"
      },
      diff,
      context: {
        frameworkPacks: ["react"]
      }
    });

    expect(findings).toEqual([
      expect.objectContaining({
        id: "expected-companions:framework:react-component-test:src/components/Button.tsx",
        title: "Expected framework companion missing",
        message: "src/components/Button.tsx changed without an expected React support file."
      }),
      expect.objectContaining({
        id: "expected-companions:framework:react-component-story:src/components/Button.tsx"
      })
    ]);
  });

  it("does not emit framework companion findings when an expected support file changed", () => {
    const diff = parse(`diff --git a/src/components/Button.tsx b/src/components/Button.tsx
index 57b22a0..cb3e0f1 100644
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1 +1,2 @@
+export function Button() { return <button />; }
diff --git a/src/components/Button.test.tsx b/src/components/Button.test.tsx
index 57b22a0..cb3e0f1 100644
--- a/src/components/Button.test.tsx
+++ b/src/components/Button.test.tsx
@@ -1 +1,2 @@
+expect(Button).toBeDefined();
`);

    const findings = expectedCompanionsDetector.run({
      task: {
        source: "cli",
        text: "Update Button component"
      },
      diff,
      context: {
        frameworkPacks: ["react"]
      }
    });

    expect(findings.some((finding) => finding.id.includes("react-component-test"))).toBe(false);
  });

  it("does not require external Astro support files for inline style edits", () => {
    const diff =
      parse(`diff --git a/src/components/NowPlaying.astro b/src/components/NowPlaying.astro
index 57b22a0..cb3e0f1 100644
--- a/src/components/NowPlaying.astro
+++ b/src/components/NowPlaying.astro
@@ -1,8 +1,8 @@
 <div class="now-playing">
-  <span class="now-playing__dot"></span>
+  <img class="now-playing__vinyl" src="/icons/vinyl.png" alt="" />
 </div>
 <style>
-.now-playing__dot { inline-size: 8px; }
+.now-playing__vinyl { inline-size: 28px; animation: spin 4s linear infinite; }
 </style>
`);

    const findings = expectedCompanionsDetector.run({
      task: {
        source: "cli",
        text: "Replace now playing dot with rotating vinyl"
      },
      diff,
      context: {
        frameworkPacks: ["astro"]
      }
    });

    expect(findings).toEqual([]);
  });
});

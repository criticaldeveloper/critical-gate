import { expectedCompanionsDetector, parseUnifiedDiff, runDetectors } from "../src/index.js";
import type { GateResult, KnowledgeProvider, TaskIntent } from "../src/index.js";

const task: TaskIntent = {
  source: "cli",
  text: "Update signup validation"
};

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

function knowledge(): KnowledgeProvider {
  return {
    getFileGraph: () => ({ nodes: [], edges: [] }),
    getHistoryIndex: () => ({
      coChanges: [],
      companionRules: [
        {
          sourcePath: "src/signup.ts",
          expectedPath: "tests/signup.test.ts",
          support: 5,
          confidence: 0.8
        }
      ],
      normalPatterns: [
        {
          kind: "source-test",
          sourcePath: "src/signup.ts",
          relatedPath: "tests/signup.test.ts",
          support: 5,
          confidence: 0.8
        }
      ]
    }),
    getPatternIndex: () => ({ patterns: [] }),
    getSolutionIndex: () => ({ solutions: [] })
  };
}

function knowledgeWithHistory(options: {
  commitCount?: number;
  support?: number;
  confidence?: number;
}): KnowledgeProvider {
  return {
    getFileGraph: () => ({ nodes: [], edges: [] }),
    getHistoryIndex: () => ({
      profile:
        options.commitCount === undefined
          ? undefined
          : {
              commitCount: options.commitCount,
              minConfidenceCommitCount: 20,
              coChanges: []
            },
      coChanges: [],
      companionRules: [
        {
          sourcePath: "src/components/HeroVideo.astro",
          expectedPath: "src/scripts/cinematic-motion.ts",
          support: options.support ?? 5,
          confidence: options.confidence ?? 0.85
        }
      ]
    }),
    getPatternIndex: () => ({ patterns: [] }),
    getSolutionIndex: () => ({ solutions: [] })
  };
}

function blogKnowledge(): KnowledgeProvider {
  return {
    getFileGraph: () => ({ nodes: [], edges: [] }),
    getHistoryIndex: () => ({
      profile: {
        commitCount: 50,
        minConfidenceCommitCount: 20,
        coChanges: []
      },
      coChanges: [],
      companionRules: [
        {
          sourcePath: "src/components/BlogHomePage.astro",
          expectedPath: "src/pages/posts/[...slug].astro",
          support: 7,
          confidence: 0.7
        },
        {
          sourcePath: "src/components/BlogHomePage.astro",
          expectedPath: "astro.config.mjs",
          support: 5,
          confidence: 0.45
        },
        {
          sourcePath: "src/pages/index.astro",
          expectedPath: "src/pages/posts/[...slug].astro",
          support: 9,
          confidence: 0.9
        },
        {
          sourcePath: "src/pages/index.astro",
          expectedPath: "astro.config.mjs",
          support: 8,
          confidence: 0.75
        },
        {
          sourcePath: "src/styles/home.scss",
          expectedPath: "src/pages/posts/[...slug].astro",
          support: 8,
          confidence: 0.65
        },
        {
          sourcePath: "src/styles/post.scss",
          expectedPath: "src/components/BlogHomePage.astro",
          support: 8,
          confidence: 0.75
        },
        {
          sourcePath: "src/styles/post.scss",
          expectedPath: "src/styles/home.scss",
          support: 7,
          confidence: 0.65
        },
        {
          sourcePath: "src/styles/post.scss",
          expectedPath: "src/pages/posts/[...slug].astro",
          support: 6,
          confidence: 0.5
        }
      ]
    }),
    getPatternIndex: () => ({ patterns: [] }),
    getSolutionIndex: () => ({ solutions: [] })
  };
}

describe("expectedCompanionsDetector", () => {
  it("emits when a historically paired test companion is missing", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signup = true;
`);

    expect(
      expectedCompanionsDetector.run({ task, diff, context: { knowledge: knowledge() } })
    ).toEqual([
      expect.objectContaining({
        detector: "expected-companions",
        title: "Expected companion file missing",
        message: "src/signup.ts changed without source-test companion tests/signup.test.ts.",
        evidence: [
          expect.objectContaining({
            data: expect.objectContaining({
              normalPattern: "source-test"
            })
          })
        ],
        repair:
          "Update tests/signup.test.ts, or document why this change does not need its usual companion."
      })
    ]);
  });

  it("does not emit when the companion is present", () => {
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
      expectedCompanionsDetector.run({ task, diff, context: { knowledge: knowledge() } })
    ).toEqual([]);
  });

  it("emits when package.json changes without a lockfile", () => {
    const diff = parse(`diff --git a/package.json b/package.json
index 57b22a0..cb3e0f1 100644
--- a/package.json
+++ b/package.json
@@ -1 +1,2 @@
+  "dependencies": {"left-pad": "^1.3.0"},
`);

    expect(
      expectedCompanionsDetector.run({ task, diff, context: { knowledge: knowledge() } })
    ).toEqual([
      expect.objectContaining({
        title: "Expected companion lockfile missing",
        message: "package.json changed without a corresponding package lockfile change."
      })
    ]);
  });

  it("deduplicates older repository-intelligence findings for the same historical root cause", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signup = true;
diff --git a/src/logger.ts b/src/logger.ts
index 57b22a0..cb3e0f1 100644
--- a/src/logger.ts
+++ b/src/logger.ts
@@ -1 +1,2 @@
+export const logger = true;
`);
    const findings = runDetectors(task, diff, {
      repositoryProfile: {
        commitCount: 50,
        minConfidenceCommitCount: 20,
        coChanges: [
          {
            path: "src/signup.ts",
            count: 5,
            relatedPaths: [{ path: "tests/signup.test.ts", count: 4 }]
          }
        ]
      },
      knowledge: knowledge()
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detector: "expected-companions",
          id: "expected-companions:src/signup.ts:tests/signup.test.ts"
        })
      ])
    );
    expect(
      findings.some(
        (finding) =>
          finding.detector === "repository-intelligence" &&
          finding.evidence.some((evidence) => evidence.path === "src/signup.ts")
      )
    ).toBe(false);
  });

  it("caps historical companion findings per changed source path", () => {
    const diff = parse(`diff --git a/src/signup.ts b/src/signup.ts
index 57b22a0..cb3e0f1 100644
--- a/src/signup.ts
+++ b/src/signup.ts
@@ -1 +1,2 @@
+export const signup = true;
`);
    const findings = expectedCompanionsDetector.run({
      task,
      diff,
      context: {
        knowledge: {
          getFileGraph: () => ({ nodes: [], edges: [] }),
          getHistoryIndex: () => ({
            coChanges: [],
            companionRules: [
              {
                sourcePath: "src/signup.ts",
                expectedPath: "src/components/Hero.astro",
                support: 4,
                confidence: 0.8
              },
              {
                sourcePath: "src/signup.ts",
                expectedPath: "src/components/Footer.astro",
                support: 7,
                confidence: 0.82
              },
              {
                sourcePath: "src/signup.ts",
                expectedPath: "src/layouts/BaseLayout.astro",
                support: 3,
                confidence: 0.8
              },
              {
                sourcePath: "src/signup.ts",
                expectedPath: "src/pages/index.astro",
                support: 9,
                confidence: 0.7
              }
            ]
          }),
          getPatternIndex: () => ({ patterns: [] }),
          getSolutionIndex: () => ({ solutions: [] })
        }
      }
    });

    expect(findings).toHaveLength(3);
    expect(findings.map((finding) => finding.id)).toEqual([
      "expected-companions:src/signup.ts:src/components/Footer.astro",
      "expected-companions:src/signup.ts:src/components/Hero.astro",
      "expected-companions:src/signup.ts:src/layouts/BaseLayout.astro"
    ]);
  });

  it("does not emit historical companions for tiny stylesheet value changes", () => {
    const diff = parse(`diff --git a/src/styles/typography.scss b/src/styles/typography.scss
index 57b22a0..cb3e0f1 100644
--- a/src/styles/typography.scss
+++ b/src/styles/typography.scss
@@ -1 +1 @@
-.artist-title { font-weight: 900; }
+.artist-title { font-weight: 700; }
`);
    const findings = expectedCompanionsDetector.run({
      task,
      diff,
      context: {
        knowledge: {
          getFileGraph: () => ({ nodes: [], edges: [] }),
          getHistoryIndex: () => ({
            coChanges: [],
            companionRules: [
              {
                sourcePath: "src/styles/typography.scss",
                expectedPath: "ai-docs/architecture.md",
                support: 9,
                confidence: 1
              },
              {
                sourcePath: "src/styles/typography.scss",
                expectedPath: "src/components/ArtistIntro.astro",
                support: 8,
                confidence: 1
              },
              {
                sourcePath: "src/styles/typography.scss",
                expectedPath: "src/components/FinalOutro.astro",
                support: 7,
                confidence: 1
              }
            ]
          }),
          getPatternIndex: () => ({ patterns: [] }),
          getSolutionIndex: () => ({ solutions: [] })
        }
      }
    });

    expect(findings).toEqual([]);
  });

  it("does not emit historical companions for narrow multi-file UI presentation fixes", () => {
    const diff =
      parse(`diff --git a/src/components/BlogHomePage.astro b/src/components/BlogHomePage.astro
index 57b22a0..cb3e0f1 100644
--- a/src/components/BlogHomePage.astro
+++ b/src/components/BlogHomePage.astro
@@ -1,6 +1,4 @@
 <section class="blog-home">
-  <span class="blog-home__badge">Signal archive</span>
   <h1>Critical Developer</h1>
-  <p class="blog-home__lede">Systems, notes, and field logs.</p>
 </section>
diff --git a/src/pages/index.astro b/src/pages/index.astro
index 57b22a0..cb3e0f1 100644
--- a/src/pages/index.astro
+++ b/src/pages/index.astro
@@ -1,5 +1,5 @@
 <BlogHomePage posts={posts} />
-<link rel="stylesheet" href="/src/styles/home-critical.css" />
+<link rel="stylesheet" href="/src/styles/home.scss" />
diff --git a/src/styles/home-critical.css b/src/styles/home-critical.css
index 57b22a0..cb3e0f1 100644
--- a/src/styles/home-critical.css
+++ b/src/styles/home-critical.css
@@ -1,4 +1,2 @@
-.blog-home__badge { display: inline-flex; }
-.blog-home__lede { max-width: 48rem; }
 .blog-home { min-height: 100vh; }
diff --git a/src/styles/home.scss b/src/styles/home.scss
index 57b22a0..cb3e0f1 100644
--- a/src/styles/home.scss
+++ b/src/styles/home.scss
@@ -1,8 +1,8 @@
 .blog-home {
-  display: block;
+  display: grid;
   gap: 2rem;
 }
 .blog-home__featured-title {
-  font-size: 6rem;
+  font-size: clamp(2.75rem, 8vw, 5rem);
 }
diff --git a/src/styles/post.scss b/src/styles/post.scss
index 57b22a0..cb3e0f1 100644
--- a/src/styles/post.scss
+++ b/src/styles/post.scss
@@ -1,4 +1,4 @@
 .post-card {
-  margin-block: 2rem;
+  margin-block: 1.25rem;
 }
`);

    const findings = expectedCompanionsDetector.run({
      task: {
        source: "cli",
        text: "Fix homepage redesign grid, featured title sizing, reload flicker, and article mobile spacing"
      },
      diff,
      context: { knowledge: blogKnowledge() }
    });

    expect(findings).toEqual([]);
  });

  it("does not emit historical companions for single-file article stylesheet polish", () => {
    const diff = parse(`diff --git a/src/styles/post.scss b/src/styles/post.scss
index 57b22a0..cb3e0f1 100644
--- a/src/styles/post.scss
+++ b/src/styles/post.scss
@@ -1,12 +1,7 @@
 .article-meta {
-  margin-block: 2rem;
-  padding-block: 1rem;
-  border-block: 1px solid currentColor;
+  margin-block: 1rem;
 }
-.article-content p:first-of-type::first-letter,
-.article-content li:first-of-type::first-letter {
+.article-content > p:first-of-type::first-letter {
   float: left;
-  font-size: 5rem;
-  line-height: 0.8;
+  font-size: 4.5rem;
 }
`);

    const findings = expectedCompanionsDetector.run({
      task: {
        source: "cli",
        text: "Polish article meta spacing and restrict drop cap styling"
      },
      diff,
      context: { knowledge: blogKnowledge() }
    });

    expect(findings).toEqual([]);
  });

  it("does not emit historical companions for small default-state UI changes", () => {
    const diff =
      parse(`diff --git a/src/components/BlogHomePage.astro b/src/components/BlogHomePage.astro
index 57b22a0..cb3e0f1 100644
--- a/src/components/BlogHomePage.astro
+++ b/src/components/BlogHomePage.astro
@@ -1,9 +1,9 @@
 <div class="blog-home__view-toggle">
-  <button class="blog-home__view-btn is-active" data-view="grid" aria-pressed="true">Grid</button>
-  <button class="blog-home__view-btn" data-view="list" aria-pressed="false">List</button>
+  <button class="blog-home__view-btn" data-view="grid" aria-pressed="false">Grid</button>
+  <button class="blog-home__view-btn is-active" data-view="list" aria-pressed="true">List</button>
 </div>
-<ol class="blog-home__posts" data-view-current="grid">
+<ol class="blog-home__posts" data-view-current="list">
   <li>Article</li>
 </ol>
diff --git a/src/scripts/blog-listing-view.ts b/src/scripts/blog-listing-view.ts
index 57b22a0..cb3e0f1 100644
--- a/src/scripts/blog-listing-view.ts
+++ b/src/scripts/blog-listing-view.ts
@@ -1,3 +1,4 @@
-const initialView = "grid";
+const initialView = "list";
+document.documentElement.dataset.blogView = initialView;
 setView(initialView);
`);

    const findings = expectedCompanionsDetector.run({
      task: {
        source: "cli",
        text: "Make homepage list view the default display mode"
      },
      diff,
      context: { knowledge: blogKnowledge() }
    });

    expect(findings).toEqual([]);
  });

  it("does not emit immature or weak historical companions", () => {
    const diff = parse(`diff --git a/src/components/HeroVideo.astro b/src/components/HeroVideo.astro
index 57b22a0..cb3e0f1 100644
--- a/src/components/HeroVideo.astro
+++ b/src/components/HeroVideo.astro
@@ -1 +1,2 @@
 <section class="hero-video">
+  <p>Updated hero copy</p>
`);

    expect(
      expectedCompanionsDetector.run({
        task,
        diff,
        context: { knowledge: knowledgeWithHistory({ commitCount: 14, support: 9 }) }
      })
    ).toEqual([]);
    expect(
      expectedCompanionsDetector.run({
        task,
        diff,
        context: { knowledge: knowledgeWithHistory({ commitCount: 50, support: 2 }) }
      })
    ).toEqual([]);
  });

  it("does not emit companions for tiny self-contained component copy edits", () => {
    const diff = parse(`diff --git a/src/components/HeroVideo.astro b/src/components/HeroVideo.astro
index 57b22a0..cb3e0f1 100644
--- a/src/components/HeroVideo.astro
+++ b/src/components/HeroVideo.astro
@@ -1,3 +1,3 @@
 <section class="hero-video">
-  <p class="hero-video__eyebrow" data-hero-kicker>Transmission 001 / nocturnal cinema</p>
+  <p class="hero-video__eyebrow" data-hero-kicker>Transmission 001 / cinematic signal</p>
 </section>
`);

    expect(
      expectedCompanionsDetector.run({
        task,
        diff,
        context: {
          frameworkPacks: ["astro"],
          knowledge: knowledgeWithHistory({ commitCount: 50, support: 9, confidence: 1 })
        }
      })
    ).toEqual([]);
  });

  it("still emits historical companions for structural component hook changes", () => {
    const diff = parse(`diff --git a/src/components/HeroVideo.astro b/src/components/HeroVideo.astro
index 57b22a0..cb3e0f1 100644
--- a/src/components/HeroVideo.astro
+++ b/src/components/HeroVideo.astro
@@ -1 +1 @@
-<canvas data-frame-sequence-id="hero"></canvas>
+<canvas data-frame-sequence-id="hero" data-frame-max-scale="1.02"></canvas>
`);

    expect(
      expectedCompanionsDetector.run({
        task,
        diff,
        context: { knowledge: knowledgeWithHistory({ commitCount: 50, support: 9, confidence: 1 }) }
      })
    ).toEqual([
      expect.objectContaining({
        detector: "expected-companions",
        title: "Expected companion file missing"
      })
    ]);
  });

  it("does not emit framework companions when wiring an added Astro component", () => {
    const diff = parse(`diff --git a/src/pages/index.astro b/src/pages/index.astro
index 57b22a0..cb3e0f1 100644
--- a/src/pages/index.astro
+++ b/src/pages/index.astro
@@ -1,3 +1,5 @@
 import HeroVideo from "../components/HeroVideo.astro";
+import WorksSection from "../components/WorksSection.astro";
 <HeroVideo />
+<WorksSection />
diff --git a/src/components/WorksSection.astro b/src/components/WorksSection.astro
new file mode 100644
index 0000000..cb3e0f1
--- /dev/null
+++ b/src/components/WorksSection.astro
@@ -0,0 +1,7 @@
+<section class="works-section">
+  <h2>Selected works</h2>
+</section>
+
+<style lang="scss">
+  .works-section { display: grid; }
+</style>
`);

    expect(
      expectedCompanionsDetector.run({
        task,
        diff,
        context: { frameworkPacks: ["astro"] }
      })
    ).toEqual([]);
  });
});

import {
  parseUnifiedDiff,
  rewriteDetector,
  runDetectors,
  summarizeFindings
} from "../src/index.js";
import type { GateResult, TaskIntent } from "../src/index.js";

const smallTask: TaskIntent = {
  source: "cli",
  text: "Fix signup validation"
};

const mediumTask: TaskIntent = {
  source: "cli",
  text: "Update authentication forms and service responses across account flows for error handling"
};

const largeTask: TaskIntent = {
  source: "cli",
  text: "Refactor signup validation architecture"
};

const vagueTask: TaskIntent = {
  source: "cli",
  text: "Update project"
};

function parse(diffText: string): GateResult["diff"] {
  return {
    files: parseUnifiedDiff(diffText)
  };
}

describe("rewriteDetector", () => {
  it("emits high severity for large balanced rewrites in small tasks", () => {
    const diff = parse(createRewriteDiff("src/signup.ts", 45, 42));

    const findings = rewriteDetector.run({ task: smallTask, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        detector: "rewrite",
        severity: "high",
        title: "Large balanced rewrite detected",
        message:
          "src/signup.ts has 87 changed lines with balanced additions and deletions, which looks like a rewrite.",
        repair:
          "Reduce the change to targeted edits, or split the rewrite into an explicit refactor task with tests and review notes.",
        tags: ["rewrite"]
      })
    ]);
    expect(findings[0]?.evidence[0]).toMatchObject({
      kind: "metric",
      path: "src/signup.ts",
      data: {
        additions: 45,
        deletions: 42,
        churn: 87,
        rewriteRatio: 93
      }
    });
  });

  it("emits medium severity for medium task rewrites", () => {
    const diff = parse(createRewriteDiff("src/signup.ts", 50, 35));

    const findings = rewriteDetector.run({ task: mediumTask, diff });

    expect(findings).toEqual([
      expect.objectContaining({
        severity: "medium"
      })
    ]);
  });

  it("does not emit for broad refactor tasks", () => {
    const diff = parse(createRewriteDiff("src/signup.ts", 50, 45));

    expect(rewriteDetector.run({ task: largeTask, diff })).toEqual([]);
  });

  it("does not emit for mostly additive changes", () => {
    const diff = parse(createRewriteDiff("src/signup.ts", 90, 5));

    expect(rewriteDetector.run({ task: smallTask, diff })).toEqual([]);
  });

  it("does not emit for test rewrites", () => {
    const diff = parse(createRewriteDiff("tests/signup.test.ts", 50, 45));

    expect(rewriteDetector.run({ task: smallTask, diff })).toEqual([]);
  });

  it("emits high severity for Astro component rewrites under vague task intent", () => {
    const diff = parse(createRewriteDiff("src/components/HeroVideo.astro", 219, 187));

    expect(rewriteDetector.run({ task: vagueTask, diff })).toEqual([
      expect.objectContaining({
        detector: "rewrite",
        severity: "high",
        message:
          "src/components/HeroVideo.astro has 406 changed lines with balanced additions and deletions, which looks like a rewrite."
      })
    ]);
  });
});

describe("detector runner with rewrites", () => {
  it("summarizes high rewrite findings into a failing gate decision", () => {
    const diff = parse(createRewriteDiff("src/signup.ts", 45, 42));
    const findings = runDetectors(smallTask, diff);

    expect(summarizeFindings(findings, smallTask, diff)).toMatchObject({
      decision: "fail",
      findingCount: 1,
      highCount: 1
    });
  });

  it("fails vague task text with a large component rewrite", () => {
    const diff = parse(createRewriteDiff("src/components/HeroVideo.astro", 219, 187));
    const findings = runDetectors(vagueTask, diff);

    expect(summarizeFindings(findings, vagueTask, diff)).toMatchObject({
      decision: "fail",
      highCount: 1
    });
  });
});

function createRewriteDiff(path: string, additions: number, deletions: number): string {
  const removedLines = Array.from(
    { length: deletions },
    (_, index) => `-const oldValue${index} = ${index};`
  );
  const addedLines = Array.from(
    { length: additions },
    (_, index) => `+const newValue${index} = ${index};`
  );

  return [
    `diff --git a/${path} b/${path}`,
    "index 57b22a0..cb3e0f1 100644",
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,${deletions} +1,${additions} @@`,
    ...removedLines,
    ...addedLines,
    ""
  ].join("\n");
}

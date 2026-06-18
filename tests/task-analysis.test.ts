import {
  analyzeTaskIntent,
  buildIntentModel,
  calculateDiffCostScore,
  estimateTaskComplexity,
  extractTaskKeywords
} from "../src/index.js";
import type { DiffFile, TaskIntent } from "../src/index.js";

describe("task analysis", () => {
  it("estimates small task complexity", () => {
    expect(estimateTaskComplexity("fix signup validation")).toBe("small");
  });

  it("estimates large task complexity", () => {
    expect(estimateTaskComplexity("refactor the authentication architecture")).toBe("large");
  });

  it("treats detector implementation as feature-sized work", () => {
    expect(estimateTaskComplexity("add dependency detector")).toBe("large");
  });

  it("extracts meaningful keywords", () => {
    expect(extractTaskKeywords("Add signup validation for email input")).toEqual([
      "signup",
      "validation",
      "email",
      "input"
    ]);
  });

  it("analyzes task intent", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Fix signup validation"
    };

    expect(analyzeTaskIntent(task)).toEqual({
      complexity: "small",
      keywords: ["signup", "validation"]
    });
  });

  it("builds a structured intent model for a small source task", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Fix signup validation"
    };

    expect(buildIntentModel(task)).toEqual({
      complexity: "small",
      verbs: ["fix"],
      targetTokens: ["signup", "validation"],
      allowedChangeClasses: ["source"],
      forbiddenChangeClasses: ["config", "dependency", "api-surface", "ci", "build"],
      targetAreas: [
        { token: "signup", kind: "domain" },
        { token: "validation", kind: "domain" }
      ]
    });
  });

  it("allows docs and ci classes when the task asks for workflow documentation", () => {
    const model = buildIntentModel({
      source: "cli",
      text: "Document GitHub Action workflow setup"
    });

    expect(model.allowedChangeClasses).toEqual(["ci", "docs"]);
    expect(model.forbiddenChangeClasses).not.toContain("ci");
  });

  it("allows release version package changes", () => {
    const model = buildIntentModel({
      source: "cli",
      text: "Bump version for release"
    });

    expect(model.verbs).toEqual(["bump"]);
    expect(model.allowedChangeClasses).toEqual(["dependency", "docs"]);
  });

  it("calculates higher diff cost for broad small-task diffs", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Fix signup validation"
    };
    const files: DiffFile[] = [
      createFile("src/signup.ts", "source", 20, 4),
      createFile("tests/signup.test.ts", "test", 12, 1),
      createFile("webpack.config.js", "config", 8, 3),
      createFile("package.json", "manifest", 1, 0)
    ];

    expect(calculateDiffCostScore(task, files)).toBeGreaterThanOrEqual(50);
  });
});

function createFile(
  path: string,
  role: DiffFile["role"],
  additions: number,
  deletions: number
): DiffFile {
  return {
    path,
    role,
    status: "modified",
    additions,
    deletions,
    hunks: []
  };
}

import {
  analyzeTaskIntent,
  calculateScopeExpansionScore,
  calculateDiffCoherenceScore,
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

  it("expands style-related task aliases and drops generic project wording", () => {
    expect(extractTaskKeywords("Fixed fonts of the project")).toEqual([
      "fonts",
      "font",
      "typography",
      "type",
      "text",
      "style",
      "styles",
      "css",
      "scss"
    ]);
  });

  it("preserves accented Spanish keywords and removes grammatical task wording", () => {
    expect(extractTaskKeywords("Corrige la validación del correo electrónico")).toEqual([
      "validación",
      "correo",
      "electrónico"
    ]);
  });

  it("normalizes canonically equivalent Unicode task tokens", () => {
    expect(extractTaskKeywords("Navegacio\u0301n móvil")).toEqual(["navegación", "móvil"]);
  });

  it("extracts mixed-language task targets without dropping Unicode words", () => {
    expect(extractTaskKeywords("Update navegación móvil del Drawer component")).toEqual([
      "navegación",
      "móvil",
      "drawer",
      "component"
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
      expectedCategories: ["source-behavior"],
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
    expect(model.expectedCategories).toEqual(["config-tooling", "docs"]);
    expect(model.forbiddenChangeClasses).not.toContain("ci");
  });

  it("allows release version package changes", () => {
    const model = buildIntentModel({
      source: "cli",
      text: "Bump version for release"
    });

    expect(model.verbs).toEqual(["bump"]);
    expect(model.allowedChangeClasses).toEqual(["dependency", "docs"]);
    expect(model.expectedCategories).toEqual(["dependency"]);
  });

  it("does not treat release UI wording as release management", () => {
    const model = buildIntentModel({
      source: "cli",
      text: "Improve release carousel counter label readability"
    });

    expect(model.allowedChangeClasses).toEqual(["source"]);
    expect(model.expectedCategories).toEqual(["source-behavior"]);
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

  it("calculates a scope expansion score with drivers", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Fix signup validation"
    };
    const files: DiffFile[] = [
      createFile("src/signup.ts", "source", 90, 4),
      createFile("webpack.config.js", "config", 8, 3),
      createFile("package.json", "manifest", 1, 0)
    ];

    expect(
      calculateScopeExpansionScore(task, files, [
        {
          id: "expected-companions:src/signup.ts:tests/signup.test.ts",
          detector: "expected-companions",
          severity: "medium",
          confidence: 0.8,
          title: "Expected companion file missing",
          message: "Missing test.",
          evidence: [{ kind: "history", message: "Missing test." }],
          repair: "Add test.",
          tags: ["scope"]
        }
      ])
    ).toEqual({
      score: 5,
      drivers: [
        {
          code: "high-risk-roles",
          label: "Config, manifest, or lockfile touched",
          points: 2,
          evidence: ["webpack.config.js", "package.json"]
        },
        {
          code: "missing-companions",
          label: "Expected companion files missing",
          points: 1,
          evidence: ["expected-companions:src/signup.ts:tests/signup.test.ts"]
        },
        {
          code: "churn",
          label: "Churn exceeds task complexity",
          points: 2,
          evidence: ["churn:106", "complexity:small"]
        }
      ]
    });
  });

  it("calculates a high coherence score for contained source and test changes", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Fix signup validation"
    };
    const files: DiffFile[] = [
      createFile("src/signup.ts", "source", 10, 2),
      createFile("tests/signup.test.ts", "test", 8, 1)
    ];

    expect(calculateDiffCoherenceScore(task, files, [])).toEqual({
      score: 100,
      drivers: [
        {
          code: "contained-diff",
          label: "Diff is contained to the expected task area",
          points: 30,
          evidence: ["src/signup.ts", "tests/signup.test.ts"]
        },
        {
          code: "support-files-present",
          label: "No expected companion files are missing",
          points: 20,
          evidence: ["source", "test"]
        },
        {
          code: "risk-disciplined",
          label: "No high-risk integrity findings",
          points: 25
        },
        {
          code: "churn-fits-task",
          label: "Churn fits task complexity",
          points: 15,
          evidence: ["churn:21", "complexity:small"]
        },
        {
          code: "tests-move-with-source",
          label: "Tests changed with source",
          points: 10
        }
      ]
    });
  });

  it("reduces coherence for missing support and high-risk findings", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Fix signup validation"
    };
    const files: DiffFile[] = [
      createFile("src/signup.ts", "source", 120, 30),
      createFile("package.json", "manifest", 1, 0)
    ];
    const score = calculateDiffCoherenceScore(task, files, [
      {
        id: "dependency-addition:package.json:dependencies:axios",
        detector: "dependency-addition",
        severity: "blocker",
        confidence: 0.9,
        title: "Unjustified production dependency added",
        message: "axios added.",
        evidence: [{ kind: "manifest", path: "package.json", message: "axios" }],
        repair: "Remove dependency.",
        tags: ["dependency"]
      },
      {
        id: "expected-companions:src/signup.ts:tests/signup.test.ts",
        detector: "expected-companions",
        severity: "medium",
        confidence: 0.8,
        title: "Expected companion file missing",
        message: "Missing test.",
        evidence: [{ kind: "history", message: "Missing test." }],
        repair: "Add test.",
        tags: ["scope"]
      }
    ]);

    expect(score.score).toBeLessThan(70);
    expect(score.drivers.map((driver) => driver.code)).toEqual([
      "scope-drift",
      "missing-support-files",
      "risk-findings",
      "churn-exceeds-task",
      "source-without-tests"
    ]);
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

import {
  classifyObservedDiffActions,
  parseUnifiedDiff,
  summarizeIntentVerification
} from "../src/index.js";
import type { DiffFile, TaskIntent } from "../src/index.js";

describe("classifyObservedDiffActions", () => {
  it("recognizes package subpath exports as public API changes", () => {
    const files =
      parseUnifiedDiff(`diff --git a/packages/components/package.json b/packages/components/package.json
index 57b22a0..cb3e0f1 100644
--- a/packages/components/package.json
+++ b/packages/components/package.json
@@ -2,3 +2,4 @@
   "exports": {
+    "./autocomplete-field": "./dist/autocomplete-field.js"
   }
`);

    expect(classifyObservedDiffActions(files)).toEqual(
      expect.objectContaining({
        classes: expect.arrayContaining(["api-surface", "dependency"]),
        evidence: expect.arrayContaining([
          expect.objectContaining({
            changeClass: "api-surface",
            path: "packages/components/package.json",
            symbol: "./autocomplete-field"
          })
        ])
      })
    );
  });

  it("maps GitHub workflow changes to ci and config", () => {
    expect(
      classifyObservedDiffActions([createFile(".github/workflows/ci.yml", "config")]).classes
    ).toEqual(["ci", "config"]);
  });

  it("maps package manifest and lockfile changes to dependency", () => {
    expect(
      classifyObservedDiffActions([
        createFile("package.json", "manifest"),
        createFile("pnpm-lock.yaml", "lockfile")
      ]).classes
    ).toEqual(["dependency"]);
  });

  it("maps tests, docs, and source changes", () => {
    expect(
      classifyObservedDiffActions([
        createFile("src/signup.ts", "source"),
        createFile("tests/signup.test.ts", "test"),
        createFile("docs/signup.md", "docs")
      ]).classes
    ).toEqual(["docs", "source", "tests"]);
  });

  it("detects public export changes as api surface", () => {
    const actions = classifyObservedDiffActions([
      {
        ...createFile("src/index.ts", "source"),
        hunks: [
          {
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 2,
            lines: [
              {
                kind: "add",
                content: "export function validateSignup() {}",
                newLineNumber: 2
              }
            ]
          }
        ]
      }
    ]);

    expect(actions.classes).toEqual(["api-surface", "source"]);
    expect(actions.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          changeClass: "api-surface",
          path: "src/index.ts",
          symbol: "validateSignup",
          lineNumber: 2
        })
      ])
    );
  });

  it("maps styling paths to ui and build configs to build", () => {
    expect(
      classifyObservedDiffActions([
        createFile("src/styles/theme.scss", "source"),
        createFile("tsconfig.json", "config")
      ]).classes
    ).toEqual(["build", "config", "source", "ui"]);
  });

  it("summarizes matched source and test coverage categories", () => {
    const summary = summarizeIntentVerification(
      createTask("Add signup validation implementation and tests"),
      [createFile("src/signup.ts", "source"), createFile("tests/signup.test.ts", "test")]
    );

    expect(summary).toMatchObject({
      requestedCategories: ["source-behavior", "test-coverage"],
      observedCategories: ["source-behavior", "test-coverage"],
      missingCategories: [],
      unexpectedCategories: [],
      coverage: "matched"
    });
    expect(summary.categoryAssessments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "source-behavior",
          expected: true,
          observed: true,
          confidence: 0.9
        }),
        expect.objectContaining({
          category: "test-coverage",
          expected: true,
          observed: true,
          confidence: 0.9
        })
      ])
    );
  });

  it("separates missing docs from unexpected source work", () => {
    const summary = summarizeIntentVerification(createTask("Update README documentation"), [
      createFile("src/signup.ts", "source")
    ]);

    expect(summary).toMatchObject({
      requestedCategories: ["docs"],
      observedCategories: ["source-behavior"],
      missingCategories: ["docs"],
      unexpectedCategories: ["source-behavior"],
      coverage: "none"
    });
    expect(summary.explanationCodes).toEqual(
      expect.arrayContaining(["missing-category:docs", "unexpected-category:source-behavior"])
    );
  });

  it("summarizes config, dependency, public API, and UI content categories", () => {
    const summary = summarizeIntentVerification(
      createTask("Update package dependency, public API, config, and UI"),
      [
        createFile("package.json", "manifest"),
        createFile("vite.config.ts", "config"),
        {
          ...createFile("src/index.ts", "source"),
          hunks: [
            {
              oldStart: 1,
              oldLines: 1,
              newStart: 1,
              newLines: 2,
              lines: [
                {
                  kind: "add",
                  content: "export function validateSignup() {}",
                  newLineNumber: 2
                }
              ]
            }
          ]
        },
        createFile("src/components/LoginForm.tsx", "source")
      ]
    );

    expect(summary.requestedCategories).toEqual(
      expect.arrayContaining(["config-tooling", "dependency", "public-api", "ui-content"])
    );
    expect(summary.observedCategories).toEqual(
      expect.arrayContaining([
        "config-tooling",
        "dependency",
        "public-api",
        "source-behavior",
        "ui-content"
      ])
    );
  });

  it("treats card layout and vinyl indicator tasks as UI intent", () => {
    expect(
      summarizeIntentVerification(
        createTask("Masonry-align about cards and fix project card arrow"),
        [createFile("src/views/AboutView.astro", "source")]
      )
    ).toMatchObject({
      requestedClasses: expect.arrayContaining(["ui"]),
      unexpectedClasses: []
    });

    expect(
      summarizeIntentVerification(
        createTask("Replace now playing dot with rotating vinyl indicator"),
        [createFile("src/components/NowPlaying.astro", "source")]
      )
    ).toMatchObject({
      requestedClasses: expect.arrayContaining(["ui"]),
      unexpectedClasses: []
    });
  });
});

function createTask(text: string): TaskIntent {
  return {
    source: "cli",
    text
  };
}

function createFile(path: string, role: DiffFile["role"]): DiffFile {
  return {
    path,
    role,
    status: "modified",
    additions: 1,
    deletions: 0,
    hunks: []
  };
}

import { classifyObservedDiffActions } from "../src/index.js";
import type { DiffFile } from "../src/index.js";

describe("classifyObservedDiffActions", () => {
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
});

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

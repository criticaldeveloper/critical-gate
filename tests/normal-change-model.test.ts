import {
  buildNormalChangePatterns,
  classifyNormalChangePattern,
  type RepositoryCoChange
} from "../src/index.js";

describe("normal change model", () => {
  it("classifies common repository co-change relationships", () => {
    expect(classifyNormalChangePattern("src/signup.ts", "tests/signup.test.ts")).toBe(
      "source-test"
    );
    expect(classifyNormalChangePattern("src/Button.tsx", "src/Button.stories.tsx")).toBe(
      "component-story"
    );
    expect(classifyNormalChangePattern("src/LoginForm.tsx", "locales/en.json")).toBe(
      "translation-ui"
    );
    expect(classifyNormalChangePattern("vite.config.ts", "docs/build.md")).toBe("config-docs");
    expect(classifyNormalChangePattern("package.json", "pnpm-lock.yaml")).toBe("package-lockfile");
  });

  it("builds support and confidence weighted normal patterns", () => {
    const coChanges: RepositoryCoChange[] = [
      {
        path: "src/signup.ts",
        count: 4,
        relatedPaths: [
          { path: "tests/signup.test.ts", count: 3 },
          { path: "docs/signup.md", count: 1 }
        ]
      }
    ];

    expect(
      buildNormalChangePatterns(coChanges, {
        minSupport: 2,
        minConfidence: 0.5
      })
    ).toEqual([
      {
        kind: "source-test",
        sourcePath: "src/signup.ts",
        relatedPath: "tests/signup.test.ts",
        support: 3,
        confidence: 0.75
      }
    ]);
  });
});

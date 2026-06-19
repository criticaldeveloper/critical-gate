import { buildHistoryIndex, buildRepositoryProfile, parseNameOnlyLog } from "../src/index.js";

describe("repository profile", () => {
  it("parses git name-only log output into commits", () => {
    expect(parseNameOnlyLog("__COMMIT__\nsrc/a.ts\nsrc/b.ts\n__COMMIT__\nsrc/a.ts\n")).toEqual([
      ["src/a.ts", "src/b.ts"],
      ["src/a.ts"]
    ]);
  });

  it("builds a co-change profile from git history", () => {
    const profile = buildRepositoryProfile({
      root: "C:/repo",
      minConfidenceCommitCount: 1,
      runner: {
        execFile: (_file, args) => {
          expect(args[0]).toBe("log");
          return [
            "__COMMIT__",
            "src/signup.ts",
            "tests/signup.test.ts",
            "__COMMIT__",
            "src/signup.ts",
            "src/signup-form.ts",
            "__COMMIT__",
            "src/logger.ts",
            "tests/logger.test.ts"
          ].join("\n");
        }
      }
    });

    expect(profile).toEqual({
      commitCount: 3,
      minConfidenceCommitCount: 1,
      coChanges: expect.arrayContaining([
        {
          path: "src/signup.ts",
          count: 2,
          relatedPaths: [
            { path: "src/signup-form.ts", count: 1 },
            { path: "tests/signup.test.ts", count: 1 }
          ]
        }
      ])
    });
  });

  it("builds a history index with compatibility profile and directed companion rules", () => {
    const index = buildHistoryIndex({
      root: "C:/repo",
      minConfidenceCommitCount: 1,
      runner: {
        execFile: () =>
          [
            "__COMMIT__",
            "src/signup.ts",
            "tests/signup.test.ts",
            "__COMMIT__",
            "src/signup.ts",
            "tests/signup.test.ts",
            "__COMMIT__",
            "src/signup.ts",
            "docs/signup.md"
          ].join("\n")
      }
    });

    expect(index.profile).toMatchObject({
      commitCount: 3,
      minConfidenceCommitCount: 1
    });
    expect(index.coChanges).toEqual(index.profile?.coChanges);
    expect(index.companionRules).toEqual(
      expect.arrayContaining([
        {
          sourcePath: "src/signup.ts",
          expectedPath: "tests/signup.test.ts",
          support: 2,
          confidence: 2 / 3
        }
      ])
    );
  });

  it("filters low-support companion rules while preserving co-change profile", () => {
    const index = buildHistoryIndex({
      root: "C:/repo",
      minConfidenceCommitCount: 1,
      minCompanionSupport: 2,
      minCompanionConfidence: 0.5,
      runner: {
        execFile: () =>
          [
            "__COMMIT__",
            "src/signup.ts",
            "tests/signup.test.ts",
            "__COMMIT__",
            "src/signup.ts",
            "tests/signup.test.ts",
            "__COMMIT__",
            "src/signup.ts",
            "docs/signup.md"
          ].join("\n")
      }
    });

    expect(index.coChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/signup.ts",
          relatedPaths: expect.arrayContaining([{ path: "docs/signup.md", count: 1 }])
        })
      ])
    );
    expect(index.companionRules).toEqual([
      {
        sourcePath: "src/signup.ts",
        expectedPath: "tests/signup.test.ts",
        support: 2,
        confidence: 2 / 3
      },
      {
        sourcePath: "tests/signup.test.ts",
        expectedPath: "src/signup.ts",
        support: 2,
        confidence: 1
      }
    ]);
  });

  it("returns an empty low-confidence profile when git history is unavailable", () => {
    const profile = buildRepositoryProfile({
      root: "C:/repo",
      runner: {
        execFile: () => {
          throw new Error("no history");
        }
      }
    });

    expect(profile).toEqual({
      commitCount: 0,
      minConfidenceCommitCount: 20,
      coChanges: []
    });
  });
});

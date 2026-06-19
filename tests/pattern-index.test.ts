import { buildPatternIndex } from "../src/index.js";

describe("buildPatternIndex", () => {
  it("infers repository class patterns and feature roots from tracked files", () => {
    const index = buildPatternIndex({
      root: "C:/repo",
      runner: {
        execFile: () =>
          [
            "src/services/user.ts",
            "src/services/billing.ts",
            "src/hooks/use-user.ts",
            "src/hooks/use-billing.ts",
            "src/validators/email.ts",
            "src/signup/form.ts",
            "src/signup/view.ts",
            "src/signup/model.ts"
          ].join("\n")
      }
    });

    expect(index.patterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "service",
          root: "src/services",
          confidence: 0.75
        }),
        expect.objectContaining({
          kind: "hook",
          root: "src/hooks",
          confidence: 0.75
        }),
        expect.objectContaining({
          kind: "validator",
          root: "src/validators",
          confidence: 0.6
        }),
        expect.objectContaining({
          kind: "feature-root",
          root: "src/signup",
          confidence: 0.9
        })
      ])
    );
  });

  it("returns an empty index when tracked files cannot be listed", () => {
    expect(
      buildPatternIndex({
        root: "C:/repo",
        runner: {
          execFile: () => {
            throw new Error("git unavailable");
          }
        }
      })
    ).toEqual({ patterns: [] });
  });
});

import { buildFileGraph } from "../src/index.js";
import type { HistoryIndex } from "../src/index.js";

const history: HistoryIndex = {
  coChanges: [
    {
      path: "src/signup/form.ts",
      count: 3,
      relatedPaths: [{ path: "docs/signup.md", count: 2 }]
    }
  ],
  companionRules: []
};

describe("buildFileGraph", () => {
  it("builds file nodes and relationship edges", () => {
    const graph = buildFileGraph({
      root: "C:/repo",
      history,
      runner: {
        execFile: () =>
          [
            "src/signup.ts",
            "src/signup/form.ts",
            "src/signup/view.ts",
            "src/validation/email.ts",
            "tests/signup/form.test.ts",
            "docs/signup.md"
          ].join("\n"),
        readFile: (path) => {
          if (path.replaceAll("\\", "/").endsWith("src/signup/form.ts")) {
            return 'import { validateEmail } from "../validation/email";';
          }

          return "";
        }
      }
    });

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        { path: "src/signup.ts", role: "source" },
        { path: "tests/signup/form.test.ts", role: "test" }
      ])
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "src/signup/form.ts",
          to: "src/validation/email.ts",
          kind: "import",
          weight: 1
        }),
        expect.objectContaining({
          from: "tests/signup/form.test.ts",
          to: "src/signup/form.ts",
          kind: "test",
          weight: 0.9
        }),
        expect.objectContaining({
          from: "src/signup/form.ts",
          to: "docs/signup.md",
          kind: "history",
          weight: 0.6
        }),
        expect.objectContaining({
          from: "src/signup/form.ts",
          to: "src/signup/view.ts",
          kind: "path",
          weight: 0.2
        })
      ])
    );
  });

  it("returns an empty graph when tracked files cannot be listed", () => {
    const graph = buildFileGraph({
      root: "C:/repo",
      runner: {
        execFile: () => {
          throw new Error("git unavailable");
        }
      }
    });

    expect(graph).toEqual({
      nodes: [],
      edges: []
    });
  });

  it("resolves exact and wildcard TypeScript path aliases from JSONC config", () => {
    const files = [
      "src/config/index.ts",
      "packages/profile/src/form.ts",
      "packages/auth/src/session.ts"
    ];
    const graph = buildFileGraph({
      root: "C:/repo",
      runner: {
        execFile: () => files.join("\n"),
        readFile: (path) => {
          const normalized = path.replaceAll("\\", "/");

          if (normalized.endsWith("tsconfig.json")) {
            return `{
              // Root aliases used by workspace packages.
              "compilerOptions": {
                "baseUrl": ".",
                "paths": {
                  "@profile/*": ["packages/profile/src/*"],
                  "@config": ["src/config/index.ts"],
                },
              },
            }`;
          }

          if (normalized.endsWith("packages/auth/src/session.ts")) {
            return [
              'import { form } from "@profile/form";',
              'import { config } from "@config";'
            ].join("\n");
          }

          return "";
        }
      }
    });

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "packages/auth/src/session.ts",
          to: "packages/profile/src/form.ts",
          kind: "import",
          evidence: "TypeScript path alias @profile/* -> packages/profile/src/*."
        }),
        expect.objectContaining({
          from: "packages/auth/src/session.ts",
          to: "src/config/index.ts",
          kind: "import",
          evidence: "TypeScript path alias @config -> src/config/index.ts."
        })
      ])
    );
  });

  it("ignores malformed config and unresolved aliases without failing graph construction", () => {
    const graph = buildFileGraph({
      root: "C:/repo",
      runner: {
        execFile: () => "src/main.ts",
        readFile: (path) =>
          path.replaceAll("\\", "/").endsWith("tsconfig.json")
            ? "{ invalid"
            : 'import value from "@missing/value";'
      }
    });

    expect(graph.nodes).toEqual([{ path: "src/main.ts", role: "source" }]);
    expect(graph.edges).toEqual([]);
  });
});

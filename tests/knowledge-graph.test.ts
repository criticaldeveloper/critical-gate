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
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  classifyPath,
  getKnowledgeCacheRoot,
  parseUnifiedDiff,
  readGitDiff,
  type GitCommandRunner
} from "../src/index.js";

const fixturePath = join(process.cwd(), "fixtures", "diffs", "basic-ts.diff");

describe("parseUnifiedDiff", () => {
  it("parses file statuses, hunks, churn, languages, and roles", () => {
    const diff = readFileSync(fixturePath, "utf8");
    const files = parseUnifiedDiff(diff);

    expect(files).toHaveLength(5);

    expect(files[0]).toMatchObject({
      path: "src/signup.ts",
      status: "modified",
      role: "source",
      language: "typescript",
      additions: 1,
      deletions: 0
    });
    expect(files[0]?.hunks[0]?.lines).toEqual([
      {
        kind: "context",
        content: "export function validateSignup(input: SignupInput) {",
        oldLineNumber: 1,
        newLineNumber: 1
      },
      {
        kind: "context",
        content: "  validateName(input.name);",
        oldLineNumber: 2,
        newLineNumber: 2
      },
      {
        kind: "add",
        content: "  validateEmail(input.email);",
        newLineNumber: 3
      },
      {
        kind: "context",
        content: "  return true;",
        oldLineNumber: 3,
        newLineNumber: 4
      },
      {
        kind: "context",
        content: "}",
        oldLineNumber: 4,
        newLineNumber: 5
      }
    ]);

    expect(files[1]).toMatchObject({
      path: "package.json",
      status: "modified",
      role: "manifest",
      language: "json",
      additions: 1
    });

    expect(files[2]).toMatchObject({
      path: "tests/signup.test.ts",
      status: "deleted",
      role: "test",
      additions: 0,
      deletions: 3,
      newPath: undefined
    });

    expect(files[3]).toMatchObject({
      path: "src/new-name.ts",
      status: "renamed",
      role: "source",
      oldPath: "src/old-name.ts",
      newPath: "src/new-name.ts",
      additions: 1,
      deletions: 1
    });

    expect(files[4]).toMatchObject({
      path: "docs/usage.md",
      status: "added",
      role: "docs",
      language: "markdown",
      additions: 2,
      deletions: 0,
      oldPath: undefined
    });
  });
});

describe("classifyPath", () => {
  it.each([
    ["src/app.ts", "source"],
    ["tests/app.test.ts", "test"],
    ["package.json", "manifest"],
    ["pnpm-lock.yaml", "lockfile"],
    [".github/workflows/ci.yml", "config"],
    ["docs/usage.md", "docs"],
    ["dist/bundle.js", "generated"]
  ] as const)("classifies %s as %s", (path, role) => {
    expect(classifyPath(path)).toBe(role);
  });
});

describe("readGitDiff", () => {
  it("collects root, branch, and parsed base diff through the git runner", () => {
    const originalDisableCache = process.env.CRITICAL_GATE_DISABLE_CACHE;
    process.env.CRITICAL_GATE_DISABLE_CACHE = "true";
    const calls: string[][] = [];
    const runner: GitCommandRunner = {
      execFile: (_file, args) => {
        calls.push(args);

        if (args.join(" ") === "rev-parse --show-toplevel") {
          return "C:/dev/critical-gate\n";
        }

        if (args.join(" ") === "rev-parse --abbrev-ref HEAD") {
          return "feature/diff-reader\n";
        }

        if (args[0] === "diff") {
          return readFileSync(fixturePath, "utf8");
        }

        if (args[0] === "log") {
          return "__COMMIT__\nsrc/signup.ts\ntests/signup.test.ts\n";
        }

        if (args.join(" ") === "ls-files") {
          return "src/utils/date.ts\n";
        }

        throw new Error(`Unexpected git args: ${args.join(" ")}`);
      },
      readFile: (path) => {
        if (path.replaceAll("\\", "/").endsWith("src/utils/date.ts")) {
          return "export function formatDate() {}";
        }

        return "";
      }
    };

    try {
      const result = readGitDiff({ baseRef: "main", runner });

      expect(result.root).toBe("C:/dev/critical-gate");
      expect(result.baseRef).toBe("main");
      expect(result.headRef).toBe("feature/diff-reader");
      expect(result.files).toHaveLength(5);
      expect(result.repositoryProfile).toBeUndefined();
      expect(result.utilityIndex).toBeUndefined();
      expect(calls).toContainEqual(["diff", "--no-ext-diff", "--no-color", "main...HEAD", "--"]);
      expect(calls).not.toContainEqual(["ls-files"]);
      expect(calls.some((args) => args[0] === "log")).toBe(false);

      expect(result.knowledge?.getHistoryIndex().profile).toMatchObject({
        commitCount: 1
      });
      expect(result.knowledge?.getSolutionIndex().utilityIndex).toEqual({
        utilities: [{ path: "src/utils/date.ts", exportedNames: ["formatDate"] }]
      });
      expect(calls).toContainEqual(["ls-files"]);
      expect(calls.some((args) => args[0] === "log")).toBe(true);
    } finally {
      if (originalDisableCache === undefined) {
        delete process.env.CRITICAL_GATE_DISABLE_CACHE;
      } else {
        process.env.CRITICAL_GATE_DISABLE_CACHE = originalDisableCache;
      }
    }
  });

  it("uses HEAD and includes untracked files for working-tree checks", () => {
    const calls: string[][] = [];
    const runner: GitCommandRunner = {
      execFile: (_file, args) => {
        calls.push(args);

        if (args.join(" ") === "rev-parse --show-toplevel") {
          return "C:/dev/critical-gate\n";
        }

        if (args.join(" ") === "rev-parse --abbrev-ref HEAD") {
          return "feature/diff-reader\n";
        }

        if (args.join(" ") === "diff --no-ext-diff --no-color HEAD --") {
          return "";
        }

        if (args.join(" ") === "ls-files --others --exclude-standard") {
          return "src/new-detector.ts\n";
        }

        throw new Error(`Unexpected git args: ${args.join(" ")}`);
      },
      readFile: (path) => {
        expect(path.replaceAll("\\", "/")).toBe("C:/dev/critical-gate/src/new-detector.ts");
        return "export const detector = true;\n";
      }
    };

    const result = readGitDiff({ runner });

    expect(result.files).toEqual([
      {
        path: "src/new-detector.ts",
        status: "added",
        role: "source",
        additions: 1,
        deletions: 0,
        newPath: "src/new-detector.ts",
        language: "typescript",
        hunks: []
      }
    ]);
    expect(calls).toContainEqual(["diff", "--no-ext-diff", "--no-color", "HEAD", "--"]);
  });

  it("uses cached diff and skips untracked files for staged checks", () => {
    const calls: string[][] = [];
    const runner: GitCommandRunner = {
      execFile: (_file, args) => {
        calls.push(args);

        if (args.join(" ") === "rev-parse --show-toplevel") {
          return "C:/dev/critical-gate\n";
        }

        if (args.join(" ") === "rev-parse --abbrev-ref HEAD") {
          return "feature/hooks\n";
        }

        if (args.join(" ") === "diff --cached --no-ext-diff --no-color --") {
          return readFileSync(fixturePath, "utf8");
        }

        throw new Error(`Unexpected git args: ${args.join(" ")}`);
      }
    };

    const result = readGitDiff({ runner, staged: true });

    expect(result.files).toHaveLength(5);
    expect(calls).toContainEqual(["diff", "--cached", "--no-ext-diff", "--no-color", "--"]);
    expect(calls).not.toContainEqual(["ls-files", "--others", "--exclude-standard"]);
  });

  it("excludes Critical Gate cache artifacts from working-tree checks", () => {
    const runner: GitCommandRunner = {
      execFile: (_file, args) => {
        if (args.join(" ") === "rev-parse --show-toplevel") {
          return "C:/dev/mv-ft\n";
        }

        if (args.join(" ") === "rev-parse --abbrev-ref HEAD") {
          return "main\n";
        }

        if (args.join(" ") === "diff --no-ext-diff --no-color HEAD --") {
          return `diff --git a/.critical-gate/cache/cache.json b/.critical-gate/cache/cache.json
new file mode 100644
index 0000000..57b22a0
--- /dev/null
+++ b/.critical-gate/cache/cache.json
@@ -0,0 +1 @@
+{"cached":true}
diff --git a/src/app.ts b/src/app.ts
index 57b22a0..cb3e0f1 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1 +1,2 @@
 export const app = true;
+export const changed = true;
`;
        }

        if (args.join(" ") === "ls-files --others --exclude-standard") {
          return ".critical-gate/cache/other.json\nsrc/created.ts\n";
        }

        throw new Error(`Unexpected git args: ${args.join(" ")}`);
      },
      readFile: (path) => {
        expect(path.replaceAll("\\", "/")).toBe("C:/dev/mv-ft/src/created.ts");
        return "export const created = true;\n";
      }
    };

    const result = readGitDiff({ runner });

    expect(result.files.map((file) => file.path)).toEqual(["src/app.ts", "src/created.ts"]);
  });

  it("stores knowledge cache outside the repository root", () => {
    expect(getKnowledgeCacheRoot("C:/dev/mv-ft").replaceAll("\\", "/")).not.toContain(
      "C:/dev/mv-ft/.critical-gate"
    );
  });
});

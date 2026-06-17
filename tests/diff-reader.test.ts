import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  classifyPath,
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

        throw new Error(`Unexpected git args: ${args.join(" ")}`);
      }
    };

    const result = readGitDiff({ baseRef: "main", runner });

    expect(result.root).toBe("C:/dev/critical-gate");
    expect(result.baseRef).toBe("main");
    expect(result.headRef).toBe("feature/diff-reader");
    expect(result.files).toHaveLength(5);
    expect(calls).toContainEqual(["diff", "--no-ext-diff", "--no-color", "main...HEAD", "--"]);
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
});

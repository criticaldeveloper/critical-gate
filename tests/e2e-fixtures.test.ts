import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { ExitCode, main } from "../src/cli.js";
import { readGitDiff } from "../src/diff/index.js";
import type { GateResult } from "../src/index.js";

interface FixtureCase {
  name: string;
  task: string;
  useWorkingTree?: boolean;
  setup: (repo: string) => void;
}

describe("e2e fixture repositories", () => {
  it("runs CLI snapshots over real git fixture repositories", () => {
    const snapshots = fixtureCases.map((fixture) => {
      const { exitCode, result } = runFixture(fixture);

      return {
        name: fixture.name,
        exitCode,
        decision: result.summary.decision,
        score: result.summary.scopeExpansionScore?.score,
        detectors: [...new Set(result.findings.map((finding) => finding.detector))].sort(),
        unexpectedClasses: result.intentVerification?.unexpectedClasses ?? []
      };
    });

    expect(snapshots).toMatchInlineSnapshot(`
      [
        {
          "decision": "fail",
          "detectors": [
            "api-surface",
            "intent-verification",
          ],
          "exitCode": 1,
          "name": "intent mismatch",
          "score": 2,
          "unexpectedClasses": [
            "api-surface",
            "source",
          ],
        },
        {
          "decision": "pass",
          "detectors": [
            "blast-radius",
            "scope",
          ],
          "exitCode": 0,
          "name": "unexpected cluster",
          "score": 2,
          "unexpectedClasses": [],
        },
        {
          "decision": "pass",
          "detectors": [
            "api-surface",
            "existing-solution",
          ],
          "exitCode": 0,
          "name": "existing solution duplication",
          "score": 1,
          "unexpectedClasses": [
            "api-surface",
          ],
        },
        {
          "decision": "pass",
          "detectors": [
            "api-surface",
            "pattern-violation",
          ],
          "exitCode": 0,
          "name": "pattern violation",
          "score": 1,
          "unexpectedClasses": [
            "api-surface",
          ],
        },
        {
          "decision": "pass",
          "detectors": [],
          "exitCode": 0,
          "name": "missing companion",
          "score": 0,
          "unexpectedClasses": [],
        },
        {
          "decision": "pass",
          "detectors": [],
          "exitCode": 0,
          "name": "legitimate broad refactor",
          "score": 0,
          "unexpectedClasses": [],
        },
      ]
    `);
  }, 60000);
});

const fixtureCases: FixtureCase[] = [
  {
    name: "intent mismatch",
    task: "Document signup form wording",
    setup: (repo) => {
      writeBaseFiles(repo, {
        "src/signup.ts": "export const label = 'Email';\n",
        "README.md": "# Fixture\n"
      });
      commit(repo, "base");
      branch(repo);
      writeFile(repo, "src/signup.ts", "export const label = 'Work email';\n");
      commit(repo, "change source instead of docs");
    }
  },
  {
    name: "unexpected cluster",
    task: "Fix signup form label",
    useWorkingTree: true,
    setup: (repo) => {
      writeBaseFiles(repo, {
        "src/signup/form.ts": "const label = 'Email';\nconsole.log(label);\n"
      });
      commit(repo, "base signup");
      writeFile(repo, "src/billing/invoice.ts", "const title = 'Invoice';\nconsole.log(title);\n");
      commit(repo, "base billing");
      branch(repo);
      writeFile(repo, "src/signup/form.ts", "const label = 'Work email';\nconsole.log(label);\n");
      writeFile(
        repo,
        "src/billing/invoice.ts",
        "const title = 'Paid invoice';\nconsole.log(title);\n"
      );
    }
  },
  {
    name: "existing solution duplication",
    task: "Add signup email validator",
    setup: (repo) => {
      writeBaseFiles(repo, {
        "src/validators/email.ts":
          "export function validateEmail(value: string): boolean {\n  return value.includes('@');\n}\n",
        "src/validators/name.ts":
          "export function validateName(value: string): boolean {\n  return value.length > 0;\n}\n"
      });
      commit(repo, "base");
      branch(repo);
      writeFile(
        repo,
        "src/validators/email-helper.ts",
        "export function validateEmailForSignup(value: string): boolean {\n  return value.includes('@');\n}\n"
      );
      commit(repo, "duplicate validator");
    }
  },
  {
    name: "pattern violation",
    task: "Add user service helper",
    setup: (repo) => {
      writeBaseFiles(repo, {
        "src/services/user.ts": "export function getUser() {\n  return { id: 'user-1' };\n}\n",
        "src/services/user-profile.ts":
          "export function getUserProfile() {\n  return { name: 'Ada' };\n}\n"
      });
      commit(repo, "base");
      branch(repo);
      writeFile(
        repo,
        "src/helpers/user-helper.ts",
        "export function getUserName() {\n  return 'Ada';\n}\n"
      );
      commit(repo, "add helper outside service pattern");
    }
  },
  {
    name: "missing companion",
    task: "Fix signup validation",
    setup: (repo) => {
      writeBaseFiles(repo, {
        "src/signup.ts":
          "export function validateSignup(value: string) {\n  return value.length > 0;\n}\n",
        "tests/signup.test.ts": "expect(validateSignup('a')).toBe(true);\n"
      });
      commit(repo, "base");
      writeFile(
        repo,
        "src/signup.ts",
        "export function validateSignup(value: string) {\n  return value.trim().length > 0;\n}\n"
      );
      writeFile(repo, "tests/signup.test.ts", "expect(validateSignup(' a ')).toBe(true);\n");
      commit(repo, "co-change signup once");
      writeFile(
        repo,
        "src/signup.ts",
        "export function validateSignup(value: string) {\n  return value.trim().length >= 1;\n}\n"
      );
      writeFile(repo, "tests/signup.test.ts", "expect(validateSignup('b')).toBe(true);\n");
      commit(repo, "co-change signup twice");
      branch(repo);
      writeFile(
        repo,
        "src/signup.ts",
        "export function validateSignup(value: string) {\n  return value.trim().length >= 2;\n}\n"
      );
      commit(repo, "change source without companion");
    }
  },
  {
    name: "legitimate broad refactor",
    task: "Refactor source signup validation and update tests",
    setup: (repo) => {
      writeBaseFiles(repo, {
        "src/signup.ts":
          "export function validateSignup(value: string) {\n  return value.length > 0;\n}\n",
        "tests/signup.test.ts": "expect(validateSignup('a')).toBe(true);\n"
      });
      commit(repo, "base");
      branch(repo);
      writeFile(
        repo,
        "src/signup.ts",
        "export function validateSignup(value: string) {\n  const trimmed = value.trim();\n  return trimmed.length > 0;\n}\n"
      );
      writeFile(repo, "tests/signup.test.ts", "expect(validateSignup(' a ')).toBe(true);\n");
      commit(repo, "refactor source and tests");
    }
  }
];

function runFixture(fixture: FixtureCase): { exitCode: ExitCode; result: GateResult } {
  const repo = mkdtempSync(join(tmpdir(), "critical-gate-e2e-"));

  try {
    initRepo(repo);
    fixture.setup(repo);

    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = main(getCliArgs(fixture), {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
      writeFile: () => undefined,
      now: () => new Date("2026-06-17T21:20:00.000Z"),
      readDiff: (baseRef) => readGitDiff({ cwd: repo, baseRef })
    });

    if (stderr.length > 0) {
      throw new Error(stderr.join("\n"));
    }

    return {
      exitCode,
      result: JSON.parse(stdout[0] ?? "") as GateResult
    };
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

function getCliArgs(fixture: FixtureCase): string[] {
  const args = ["check", "--task", fixture.task, "--format", "json"];

  if (fixture.useWorkingTree !== true) {
    args.splice(3, 0, "--base", "main");
  }

  return args;
}

function initRepo(repo: string): void {
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.email", "critical-gate@example.test"]);
  git(repo, ["config", "user.name", "Critical Gate Test"]);
}

function writeBaseFiles(repo: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    writeFile(repo, path, content);
  }
}

function writeFile(repo: string, path: string, content: string): void {
  const absolutePath = join(repo, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
}

function branch(repo: string): void {
  git(repo, ["switch", "-c", "feature/e2e-fixture"]);
}

function commit(repo: string, message: string): void {
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", message]);
}

function git(repo: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

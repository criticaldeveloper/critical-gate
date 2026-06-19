import { ExitCode, main } from "../src/cli.js";
import type { GitDiffResult } from "../src/index.js";

const testDiffResult: GitDiffResult = {
  root: "C:/dev/critical-gate",
  baseRef: "main",
  headRef: "feature/cli-foundation",
  files: [
    {
      path: "src/signup.ts",
      status: "modified",
      role: "source",
      additions: 2,
      deletions: 1,
      language: "typescript",
      hunks: []
    }
  ]
};

function createTestIo() {
  const writes = new Map<string, string>();
  const stdout: string[] = [];
  const stderr: string[] = [];
  const files = new Map<string, string>();

  return {
    io: {
      stdout: (message: string) => stdout.push(message),
      stderr: (message: string) => stderr.push(message),
      writeFile: (path: string, content: string) => writes.set(path, content),
      exists: (path: string) => files.has(path),
      readFile: (path: string) => files.get(path) ?? "",
      now: () => new Date("2026-06-17T21:20:00.000Z"),
      readDiff: () => testDiffResult
    },
    stdout,
    stderr,
    writes,
    files
  };
}

describe("cli", () => {
  it("prints global help", () => {
    const { io, stdout, stderr } = createTestIo();

    expect(main(["--help"], io)).toBe(ExitCode.Pass);
    expect(stdout.join("\n")).toContain("--format json|markdown|sarif|repair");
    expect(stderr).toEqual([]);
  });

  it("prints version output", () => {
    const { io, stdout, stderr } = createTestIo();

    expect(main(["--version"], io)).toBe(ExitCode.Pass);
    expect(stdout).toEqual(["critical-gate 2.1.0"]);
    expect(stderr).toEqual([]);
  });

  it("requires task intent for check", () => {
    const { io, stderr } = createTestIo();

    expect(main(["check"], io)).toBe(ExitCode.UsageError);
    expect(stderr[0]).toBe("Missing required --task value.");
  });

  it("rejects unknown commands", () => {
    const { io, stderr } = createTestIo();

    expect(main(["scan", "--task", "Add validation"], io)).toBe(ExitCode.UsageError);
    expect(stderr[0]).toBe("Unknown command: scan");
  });

  it("records accepted findings in .critical-gate.json", () => {
    const { io, stdout, writes } = createTestIo();

    expect(
      main(
        [
          "accept",
          "--finding",
          "scope:src/generated.ts",
          "--reason",
          "Generated file is expected for this task."
        ],
        io
      )
    ).toBe(ExitCode.Pass);

    expect(stdout[0]).toContain("Accepted finding scope:src/generated.ts");
    expect(JSON.parse([...writes.values()][0] ?? "{}")).toMatchObject({
      learning: {
        acceptedFindings: [
          {
            id: "scope:src/generated.ts",
            reason: "Generated file is expected for this task.",
            createdAt: "2026-06-17T21:20:00.000Z"
          }
        ]
      }
    });
  });

  it("records expected support-file rules in .critical-gate.json", () => {
    const { io, stdout, writes } = createTestIo();

    expect(
      main(
        [
          "teach",
          "--id",
          "i18n-for-ui-copy",
          "--when-changed",
          "src/features/**/*.tsx",
          "--allow",
          "src/i18n/**/*.json,locales/**/*.json",
          "--reason",
          "UI copy changes require translations."
        ],
        io
      )
    ).toBe(ExitCode.Pass);

    expect(stdout[0]).toContain("Taught expected support rule i18n-for-ui-copy");
    expect(JSON.parse([...writes.values()][0] ?? "{}")).toMatchObject({
      learning: {
        expectedSupportFiles: [
          {
            id: "i18n-for-ui-copy",
            whenChanged: "src/features/**/*.tsx",
            allow: ["src/i18n/**/*.json", "locales/**/*.json"],
            reason: "UI copy changes require translations.",
            createdAt: "2026-06-17T21:20:00.000Z"
          }
        ]
      }
    });
  });

  it("rejects invalid formats", () => {
    const { io, stderr } = createTestIo();

    expect(main(["check", "--task", "Add validation", "--format", "xml"], io)).toBe(
      ExitCode.UsageError
    );
    expect(stderr[0]).toBe("Invalid --format value. Expected json, markdown, sarif, or repair.");
  });

  it("emits markdown by default", () => {
    const { io, stdout, stderr } = createTestIo();

    expect(main(["check", "--task", "Add signup validation", "--base", "main"], io)).toBe(
      ExitCode.Pass
    );
    expect(stdout.join("\n")).toContain("# Critical Gate Report");
    expect(stdout.join("\n")).toContain("Task: Add signup validation");
    expect(stdout.join("\n")).toContain("Base: main");
    expect(stdout.join("\n")).toContain("Changed Files: 1");
    expect(stdout.join("\n")).toContain("Additions: 2");
    expect(stdout.join("\n")).toContain("Deletions: 1");
    expect(stderr).toEqual([]);
  });

  it("emits valid json output", () => {
    const { io, stdout } = createTestIo();

    expect(main(["check", "--task", "Add signup validation", "--format", "json"], io)).toBe(
      ExitCode.Pass
    );

    const result = JSON.parse(stdout[0] ?? "");

    expect(result).toMatchObject({
      schemaVersion: "1.0",
      generatedAt: "2026-06-17T21:20:00.000Z",
      task: {
        source: "cli",
        text: "Add signup validation"
      },
      diff: {
        baseRef: "main",
        headRef: "feature/cli-foundation",
        files: [
          {
            path: "src/signup.ts",
            additions: 2,
            deletions: 1
          }
        ]
      },
      findings: [],
      summary: {
        decision: "pass",
        findingCount: 0
      }
    });
  });

  it("writes output to a file when requested", () => {
    const { io, stdout, writes } = createTestIo();

    expect(main(["check", "--task", "Add signup validation", "--output", "report.md"], io)).toBe(
      ExitCode.Pass
    );

    expect(stdout).toEqual([]);
    expect(writes.get("report.md")).toContain("Task: Add signup validation");
  });

  it("emits SARIF output", () => {
    const { io, stdout } = createTestIo();

    expect(main(["check", "--task", "Add signup validation", "--format", "sarif"], io)).toBe(
      ExitCode.Pass
    );

    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "Critical Gate"
            }
          },
          results: []
        }
      ]
    });
  });

  it("emits compact repair output", () => {
    const { io, stdout } = createTestIo();

    expect(main(["check", "--task", "Add signup validation", "--format", "repair"], io)).toBe(
      ExitCode.Pass
    );

    expect(stdout).toEqual(["Critical Gate passed. No repair actions required.\n"]);
  });

  it("prints hook help", () => {
    const { io, stdout, stderr } = createTestIo();

    expect(main(["hook", "--help"], io)).toBe(ExitCode.Pass);
    expect(stdout.join("\n")).toContain("critical-gate hook");
    expect(stdout.join("\n")).toContain("defaults to Codex completed feature implementation");
    expect(stderr).toEqual([]);
  });

  it("runs hook mode with default task text", () => {
    const { io, stdout } = createTestIo();

    expect(main(["hook"], io)).toBe(ExitCode.Pass);
    expect(stdout).toEqual(["Critical Gate passed. No repair actions required.\n"]);
  });

  it("suppresses medium-only findings in hook mode", () => {
    const { io, stdout } = createTestIo();
    const utilityDiffIo = {
      ...io,
      readDiff: () => ({
        ...testDiffResult,
        utilityIndex: {
          utilities: [{ path: "src/utils/date.ts", exportedNames: ["formatDate"] }]
        },
        files: [
          {
            path: "src/helpers/date-utils.ts",
            status: "added" as const,
            role: "source" as const,
            additions: 1,
            deletions: 0,
            language: "typescript",
            hunks: [
              {
                oldStart: 0,
                oldLines: 0,
                newStart: 1,
                newLines: 1,
                lines: [
                  {
                    kind: "add" as const,
                    content: "export function formatDateForSignup() {}",
                    newLineNumber: 1
                  }
                ]
              }
            ]
          }
        ]
      })
    };

    expect(main(["hook", "--task", "Add signup date formatting"], utilityDiffIo)).toBe(
      ExitCode.Pass
    );
    expect(stdout).toEqual(["Critical Gate passed. No repair actions required.\n"]);
  });

  it("fails when dependency detector reports a blocker", () => {
    const { io, stdout } = createTestIo();
    const packageDiffIo = {
      ...io,
      readDiff: () => ({
        ...testDiffResult,
        files: [
          {
            path: "package.json",
            status: "modified" as const,
            role: "manifest" as const,
            additions: 1,
            deletions: 0,
            language: "json",
            hunks: [
              {
                oldStart: 10,
                oldLines: 4,
                newStart: 10,
                newLines: 5,
                lines: [
                  {
                    kind: "context" as const,
                    content: '  "dependencies": {',
                    oldLineNumber: 10,
                    newLineNumber: 10
                  },
                  {
                    kind: "add" as const,
                    content: '    "axios": "^1.7.0",',
                    newLineNumber: 11
                  }
                ]
              }
            ]
          }
        ]
      })
    };

    expect(
      main(["check", "--task", "Add signup validation", "--format", "repair"], packageDiffIo)
    ).toBe(ExitCode.FindingsFailed);
    expect(stdout[0]).toContain("Unjustified production dependency added");
  });

  it("applies accepted finding learning rules during checks", () => {
    const { io, stdout, files } = createTestIo();
    const packageDiffIo = {
      ...io,
      readDiff: () => ({
        ...testDiffResult,
        files: [
          {
            path: "package.json",
            status: "modified" as const,
            role: "manifest" as const,
            additions: 1,
            deletions: 0,
            language: "json",
            hunks: [
              {
                oldStart: 10,
                oldLines: 4,
                newStart: 10,
                newLines: 5,
                lines: [
                  {
                    kind: "context" as const,
                    content: '  "dependencies": {',
                    oldLineNumber: 10,
                    newLineNumber: 10
                  },
                  {
                    kind: "add" as const,
                    content: '    "axios": "^1.7.0",',
                    newLineNumber: 11
                  }
                ]
              }
            ]
          }
        ]
      })
    };
    files.set(
      "C:\\dev\\critical-gate\\.critical-gate.json",
      JSON.stringify({
        learning: {
          acceptedFindings: [
            {
              id: "dependency-addition:package.json:dependencies:axios",
              reason: "Axios is approved for this repository.",
              createdAt: "2026-06-17T21:20:00.000Z"
            },
            {
              id: "scope:package.json",
              reason: "Package manifest change is expected with the approved dependency.",
              createdAt: "2026-06-17T21:20:00.000Z"
            }
          ]
        }
      })
    );

    expect(
      main(["check", "--task", "Add signup validation", "--format", "json"], packageDiffIo)
    ).toBe(ExitCode.Pass);

    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({
      findings: [],
      metadata: {
        learning: {
          acceptedFindingsApplied: [
            "dependency-addition:package.json:dependencies:axios",
            "scope:package.json"
          ]
        }
      }
    });
  });

  it("fails hook mode with compact repair output", () => {
    const { io, stdout } = createTestIo();
    const packageDiffIo = {
      ...io,
      readDiff: () => ({
        ...testDiffResult,
        files: [
          {
            path: "package.json",
            status: "modified" as const,
            role: "manifest" as const,
            additions: 1,
            deletions: 0,
            language: "json",
            hunks: [
              {
                oldStart: 10,
                oldLines: 4,
                newStart: 10,
                newLines: 5,
                lines: [
                  {
                    kind: "context" as const,
                    content: '  "dependencies": {',
                    oldLineNumber: 10,
                    newLineNumber: 10
                  },
                  {
                    kind: "add" as const,
                    content: '    "axios": "^1.7.0",',
                    newLineNumber: 11
                  }
                ]
              }
            ]
          }
        ]
      })
    };

    expect(main(["hook", "--task", "Add signup validation"], packageDiffIo)).toBe(
      ExitCode.FindingsFailed
    );
    expect(stdout[0]).toContain("Critical Gate found findings that need repair:");
    expect(stdout[0]).toContain("Unjustified production dependency added");
  });

  it("fails when test weakening detector reports a high severity finding", () => {
    const { io, stdout } = createTestIo();
    const testDiffIo = {
      ...io,
      readDiff: () => ({
        ...testDiffResult,
        files: [
          {
            path: "tests/signup.test.ts",
            status: "modified" as const,
            role: "test" as const,
            additions: 0,
            deletions: 1,
            language: "typescript",
            hunks: [
              {
                oldStart: 1,
                oldLines: 3,
                newStart: 1,
                newLines: 2,
                lines: [
                  {
                    kind: "delete" as const,
                    content: "expect(result.ok).toBe(true);",
                    oldLineNumber: 1
                  }
                ]
              }
            ]
          }
        ]
      })
    };

    expect(
      main(["check", "--task", "Update signup validation", "--format", "repair"], testDiffIo)
    ).toBe(ExitCode.FindingsFailed);
    expect(stdout[0]).toContain("Test assertion removed");
  });

  it("fails when a small task unexpectedly changes config", () => {
    const { io, stdout } = createTestIo();
    const configDiffIo = {
      ...io,
      readDiff: () => ({
        ...testDiffResult,
        files: [
          {
            path: "tsconfig.json",
            status: "modified" as const,
            role: "config" as const,
            additions: 1,
            deletions: 0,
            language: "json",
            hunks: [
              {
                oldStart: 1,
                oldLines: 4,
                newStart: 1,
                newLines: 5,
                lines: [
                  {
                    kind: "add" as const,
                    content: '    "skipLibCheck": true,',
                    newLineNumber: 2
                  }
                ]
              }
            ]
          }
        ]
      })
    };

    expect(
      main(["check", "--task", "Add signup validation", "--format", "markdown"], configDiffIo)
    ).toBe(ExitCode.FindingsFailed);
    expect(stdout[0]).toContain("Config changed without visible explanation");
    expect(stdout[0]).toContain("Unexpected file changed for small task");
  });

  it("fails when secret detector reports a blocker", () => {
    const { io, stdout } = createTestIo();
    const fakeSecret = ["super", "secretvalue12345"].join("");
    const secretDiffIo = {
      ...io,
      readDiff: () => ({
        ...testDiffResult,
        files: [
          {
            path: "src/config.ts",
            status: "modified" as const,
            role: "source" as const,
            additions: 1,
            deletions: 0,
            language: "typescript",
            hunks: [
              {
                oldStart: 1,
                oldLines: 1,
                newStart: 1,
                newLines: 2,
                lines: [
                  {
                    kind: "add" as const,
                    content: `export const API_SECRET = "${fakeSecret}";`,
                    newLineNumber: 2
                  }
                ]
              }
            ]
          }
        ]
      })
    };

    expect(
      main(["check", "--task", "Add signup validation", "--format", "repair"], secretDiffIo)
    ).toBe(ExitCode.FindingsFailed);
    expect(stdout[0]).toContain("Possible hardcoded secret added");
    expect(stdout[0]).not.toContain(fakeSecret);
  });

  it("reports added public exports without failing on medium severity", () => {
    const { io, stdout } = createTestIo();
    const apiDiffIo = {
      ...io,
      readDiff: () => ({
        ...testDiffResult,
        files: [
          {
            path: "src/index.ts",
            status: "modified" as const,
            role: "source" as const,
            additions: 1,
            deletions: 0,
            language: "typescript",
            hunks: [
              {
                oldStart: 1,
                oldLines: 1,
                newStart: 1,
                newLines: 2,
                lines: [
                  {
                    kind: "add" as const,
                    content: "export function validateSignup() {}",
                    newLineNumber: 2
                  }
                ]
              }
            ]
          }
        ]
      })
    };

    expect(
      main(["check", "--task", "Add signup validation", "--format", "markdown"], apiDiffIo)
    ).toBe(ExitCode.Pass);
    expect(stdout[0]).toContain("Public export added");
  });

  it("fails when API surface detector reports a removed export", () => {
    const { io, stdout } = createTestIo();
    const apiDiffIo = {
      ...io,
      readDiff: () => ({
        ...testDiffResult,
        files: [
          {
            path: "src/index.ts",
            status: "modified" as const,
            role: "source" as const,
            additions: 0,
            deletions: 1,
            language: "typescript",
            hunks: [
              {
                oldStart: 1,
                oldLines: 2,
                newStart: 1,
                newLines: 1,
                lines: [
                  {
                    kind: "delete" as const,
                    content: "export type SignupOptions = {};",
                    oldLineNumber: 1
                  }
                ]
              }
            ]
          }
        ]
      })
    };

    expect(
      main(["check", "--task", "Update signup validation", "--format", "repair"], apiDiffIo)
    ).toBe(ExitCode.FindingsFailed);
    expect(stdout[0]).toContain("Public export removed");
  });

  it("fails when rewrite detector reports a small-task rewrite", () => {
    const { io, stdout } = createTestIo();
    const rewriteDiffIo = {
      ...io,
      readDiff: () => ({
        ...testDiffResult,
        files: [
          {
            path: "src/signup.ts",
            status: "modified" as const,
            role: "source" as const,
            additions: 45,
            deletions: 42,
            language: "typescript",
            hunks: [
              {
                oldStart: 1,
                oldLines: 42,
                newStart: 1,
                newLines: 45,
                lines: [
                  {
                    kind: "delete" as const,
                    content: "const oldValue = true;",
                    oldLineNumber: 1
                  },
                  {
                    kind: "add" as const,
                    content: "const newValue = true;",
                    newLineNumber: 1
                  }
                ]
              }
            ]
          }
        ]
      })
    };

    expect(
      main(["check", "--task", "Fix signup validation", "--format", "repair"], rewriteDiffIo)
    ).toBe(ExitCode.FindingsFailed);
    expect(stdout[0]).toContain("Large balanced rewrite detected");
  });

  it("reports utility reinvention without failing by default", () => {
    const { io, stdout } = createTestIo();
    const utilityDiffIo = {
      ...io,
      readDiff: () => ({
        ...testDiffResult,
        utilityIndex: {
          utilities: [{ path: "src/utils/date.ts", exportedNames: ["formatDate"] }]
        },
        files: [
          {
            path: "src/helpers/date-utils.ts",
            status: "added" as const,
            role: "source" as const,
            additions: 1,
            deletions: 0,
            language: "typescript",
            hunks: [
              {
                oldStart: 0,
                oldLines: 0,
                newStart: 1,
                newLines: 1,
                lines: [
                  {
                    kind: "add" as const,
                    content: "export function formatDateForSignup() {}",
                    newLineNumber: 1
                  }
                ]
              }
            ]
          }
        ]
      })
    };

    expect(
      main(["check", "--task", "Add signup date formatting", "--format", "markdown"], utilityDiffIo)
    ).toBe(ExitCode.Pass);
    expect(stdout[0]).toContain("New utility may duplicate existing helper");
  });
});

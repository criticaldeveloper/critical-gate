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

  return {
    io: {
      stdout: (message: string) => stdout.push(message),
      stderr: (message: string) => stderr.push(message),
      writeFile: (path: string, content: string) => writes.set(path, content),
      now: () => new Date("2026-06-17T21:20:00.000Z"),
      readDiff: () => testDiffResult
    },
    stdout,
    stderr,
    writes
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
    expect(stdout).toEqual(["critical-gate 0.1.0"]);
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
});

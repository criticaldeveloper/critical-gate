import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { ExitCode, isCliEntrypoint, main } from "../src/cli.js";
import { parseUnifiedDiff, type GitDiffResult } from "../src/index.js";
import { CRITICAL_GATE_VERSION } from "../src/version.js";

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
  const pathVariants = (path: string): string[] => [
    path,
    path.replaceAll("/", "\\"),
    path.replaceAll("\\", "/")
  ];

  return {
    io: {
      stdout: (message: string) => stdout.push(message),
      stderr: (message: string) => stderr.push(message),
      writeFile: (path: string, content: string) => {
        for (const variant of pathVariants(path)) {
          writes.set(variant, content);
        }
      },
      chmodFile: () => undefined,
      exists: (path: string) => pathVariants(path).some((variant) => files.has(variant)),
      readFile: (path: string) =>
        pathVariants(path)
          .map((variant) => files.get(variant))
          .find((content): content is string => content !== undefined) ?? "",
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
    expect(stdout.join("\n")).toContain("--format json|markdown|sarif|repair|pr-comment");
    expect(stderr).toEqual([]);
  });

  it("prints version output", () => {
    const { io, stdout, stderr } = createTestIo();

    expect(main(["--version"], io)).toBe(ExitCode.Pass);
    expect(stdout).toEqual([`critical-gate ${CRITICAL_GATE_VERSION}`]);
    expect(stderr).toEqual([]);
  });

  it("recognizes CLI entrypoints invoked through symlinked package paths", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "critical-gate-cli-"));
    const realCliPath = join(tempDir, "dist-cli.js");
    const shimCliPath = join(tempDir, "critical-gate.js");

    try {
      writeFileSync(realCliPath, "");
      try {
        symlinkSync(realCliPath, shimCliPath);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "EPERM") {
          expect(isCliEntrypoint(pathToFileURL(realCliPath).href, realCliPath)).toBe(true);
          return;
        }

        throw error;
      }

      expect(isCliEntrypoint(pathToFileURL(realCliPath).href, shimCliPath)).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
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

  it("installs pre-commit and pre-push git hooks with conservative defaults", () => {
    const { io, stdout, writes } = createTestIo();

    expect(main(["install-hooks", "--cli", "node ./dist/cli.js"], io)).toBe(ExitCode.Pass);

    expect(stdout[0]).toContain("Installed Critical Gate hook(s):");
    expect(writes.get("C:\\dev\\critical-gate\\.git\\hooks\\pre-commit")).toContain(
      "'node ./dist/cli.js' check --staged --task \"$TASK\" --format repair --fail-on blocker"
    );
    expect(writes.get("C:\\dev\\critical-gate\\.git\\hooks\\pre-push")).toContain(
      '\'node ./dist/cli.js\' check --base "$BASE" --task "$TASK" --format repair --fail-on high'
    );
  });

  it("refuses to overwrite existing git hooks without force", () => {
    const { io, stderr, files } = createTestIo();

    files.set("C:\\dev\\critical-gate\\.git\\hooks\\pre-commit", "# custom hook\n");

    expect(main(["install-hooks", "--hook", "pre-commit"], io)).toBe(ExitCode.UsageError);
    expect(stderr[0]).toContain("Refusing to overwrite existing pre-commit hook");
  });

  it("writes a starter policy file", () => {
    const { io, stdout, writes } = createTestIo();

    expect(main(["init-policy"], io)).toBe(ExitCode.Pass);

    const output = writes.get("C:\\dev\\critical-gate\\.critical-gate.json");
    expect(output).toBeDefined();
    expect(JSON.parse(output ?? "{}")).toMatchObject({
      policy: {
        failOn: "high",
        detectorOverrides: [
          {
            detector: "expected-companions",
            mode: "observation"
          }
        ]
      }
    });
    expect(stdout[0]).toContain("Wrote reviewable Critical Gate policy");
  });

  it("initializes observe-only project setup", () => {
    const { io, stdout, writes, files } = createTestIo();

    files.set(
      "C:\\dev\\critical-gate\\package.json",
      JSON.stringify({
        name: "consumer-app",
        scripts: {
          test: "vitest"
        },
        dependencies: {
          react: "^19.0.0",
          vite: "^7.0.0"
        }
      })
    );
    files.set("C:\\dev\\critical-gate\\pnpm-lock.yaml", "");

    expect(main(["init", "--skip-workflow"], io)).toBe(ExitCode.Pass);

    const packageJson = JSON.parse(writes.get("C:\\dev\\critical-gate\\package.json") ?? "{}");
    expect(packageJson.scripts).toMatchObject({
      test: "vitest",
      gate: "critical-gate check --format markdown --fail-on blocker",
      "gate:evidence": "node scripts/critical-gate-evidence.mjs"
    });

    const policy = JSON.parse(writes.get("C:\\dev\\critical-gate\\.critical-gate.json") ?? "{}");
    expect(policy).toMatchObject({
      frameworkPacks: ["vite", "react"],
      policy: {
        failOn: "blocker",
        detectorOverrides: expect.arrayContaining([
          {
            detector: "dependency",
            mode: "observation",
            reason:
              "Phase 1 dogfood rollout: collect evidence and calibrate findings before enforcement."
          }
        ]),
        allowedSupportFiles: expect.arrayContaining([
          expect.objectContaining({
            id: "critical-gate-dogfood-docs",
            allow: expect.arrayContaining(["docs/critical-gate-evidence/**"])
          })
        ])
      }
    });
    expect(writes.get("C:\\dev\\critical-gate\\scripts\\critical-gate-evidence.mjs")).toContain(
      "Critical Gate evidence exported"
    );
    expect(writes.get("C:\\dev\\critical-gate\\docs\\critical-gate-dogfood.md")).toContain(
      "pnpm run gate:evidence"
    );
    expect(writes.get("C:\\dev\\critical-gate\\AGENTS.md")).toContain(
      "## Critical Gate Agent Instructions"
    );
    expect(writes.has("C:\\dev\\critical-gate\\.github\\workflows\\critical-gate.yml")).toBe(false);
    expect(stdout[0]).toContain("Package manager: pnpm");
  });

  it("preserves existing init files unless forced", () => {
    const { io, stdout, writes, files } = createTestIo();

    files.set("C:\\dev\\critical-gate\\package.json", JSON.stringify({ name: "app" }));
    files.set("C:\\dev\\critical-gate\\.critical-gate.json", "{}");
    files.set("C:\\dev\\critical-gate\\docs\\critical-gate-dogfood.md", "# Existing\n");

    expect(main(["init", "--skip-agent", "--skip-workflow"], io)).toBe(ExitCode.Pass);

    expect(writes.get("C:\\dev\\critical-gate\\.critical-gate.json")).toBeUndefined();
    expect(writes.get("C:\\dev\\critical-gate\\docs\\critical-gate-dogfood.md")).toBeUndefined();
    expect(stdout[0]).toContain(
      "Skipped existing files: .critical-gate.json, docs/critical-gate-dogfood.md"
    );
  });

  it("initializes before the repository has a diffable HEAD", () => {
    const { io, writes, files } = createTestIo();
    const emptyRepoIo = {
      ...io,
      getRoot: () => "C:/dev/empty-repo",
      readDiff: () => {
        throw new Error("HEAD is not available.");
      }
    };

    files.set("C:\\dev\\empty-repo\\package.json", JSON.stringify({ name: "empty-repo" }));

    expect(main(["init", "--skip-agent", "--skip-workflow"], emptyRepoIo)).toBe(ExitCode.Pass);
    expect(writes.get("C:\\dev\\empty-repo\\.critical-gate.json")).toBeDefined();
  });

  it("refuses to overwrite an existing policy file without force", () => {
    const { io, stderr, files } = createTestIo();

    files.set("C:\\dev\\critical-gate\\.critical-gate.json", "{}");

    expect(main(["init-policy"], io)).toBe(ExitCode.UsageError);
    expect(stderr[0]).toContain("Refusing to overwrite existing .critical-gate.json");
  });

  it("creates AGENTS.md with Critical Gate agent instructions", () => {
    const { io, stdout, writes } = createTestIo();

    expect(main(["init-agent", "--cli", "node ./node_modules/.bin/critical-gate"], io)).toBe(
      ExitCode.Pass
    );

    const output = writes.get("C:\\dev\\critical-gate\\AGENTS.md");
    expect(output).toContain("## Critical Gate Agent Instructions");
    expect(output).toContain(
      'node ./node_modules/.bin/critical-gate check --task "<task intent>" --base <base-ref>'
    );
    expect(output).toContain("<!-- critical-gate:start -->");
    expect(stdout[0]).toContain("Created");
  });

  it("updates only the managed Critical Gate block in existing AGENTS.md", () => {
    const { io, stdout, writes, files } = createTestIo();

    files.set(
      "C:\\dev\\critical-gate\\AGENTS.md",
      [
        "# AGENTS.md",
        "",
        "Keep this local rule.",
        "",
        "<!-- critical-gate:start -->",
        "old generated content",
        "<!-- critical-gate:end -->",
        "",
        "Keep this trailing rule.",
        ""
      ].join("\n")
    );

    expect(main(["init-agent"], io)).toBe(ExitCode.Pass);

    const output = writes.get("C:\\dev\\critical-gate\\AGENTS.md");
    expect(output).toContain("Keep this local rule.");
    expect(output).toContain("Keep this trailing rule.");
    expect(output).not.toContain("old generated content");
    expect(output).toContain("npx critical-gate check --task");
    expect(stdout[0]).toContain("Updated");
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
    expect(stderr[0]).toBe(
      "Invalid --format value. Expected json, markdown, sarif, repair, or pr-comment."
    );
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

  it("emits task intent quality warnings for vague task text", () => {
    const { io, stdout } = createTestIo();

    expect(main(["check", "--task", "fix bug", "--format", "markdown"], io)).toBe(ExitCode.Pass);

    expect(stdout[0]).toContain("## Task Intent Quality");
    expect(stdout[0]).toContain('Task intent uses vague wording: "fix bug".');
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
        findingCount: 0,
        detectorRuns: expect.arrayContaining([
          expect.objectContaining({
            detector: "dependency-addition",
            status: "passed",
            findingCount: 0,
            maturity: "review"
          })
        ])
      }
    });
  });

  it("loads a structured task contract for checks", () => {
    const { io, stdout, files } = createTestIo();

    files.set(
      "C:\\dev\\critical-gate\\task-contract.json",
      JSON.stringify({
        goal: "Correct the profile heading font weight",
        allowed_paths: ["src/profile/**", "tests/profile/**", "src/signup.ts"],
        forbidden_paths: ["src/auth/**", "package.json"],
        expected_artifacts: ["profile heading stylesheet"],
        invariants: ["no_new_dependencies", "authentication_behavior_unchanged"],
        required_checks: ["pnpm test profile"]
      })
    );

    expect(
      main(
        [
          "check",
          "--task-contract",
          "task-contract.json",
          "--format",
          "json",
          "--fail-on",
          "medium"
        ],
        io
      )
    ).toBe(ExitCode.Pass);

    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({
      task: {
        source: "cli",
        text: "Correct the profile heading font weight"
      },
      taskContract: {
        source: "provided",
        goal: "Correct the profile heading font weight",
        allowedPaths: ["src/profile/**", "tests/profile/**", "src/signup.ts"],
        forbiddenPaths: ["src/auth/**", "package.json"],
        expectedArtifacts: ["profile heading stylesheet"],
        invariants: ["no_new_dependencies", "authentication_behavior_unchanged"],
        requiredChecks: ["pnpm test profile"]
      },
      metadata: {
        taskContractPath: "task-contract.json"
      }
    });
  });

  it("reports expected artifacts from a structured task contract", () => {
    const { io, stdout, files } = createTestIo();

    files.set(
      "C:\\dev\\critical-gate\\task-contract.json",
      JSON.stringify({
        goal: "Add signup validation",
        allowed_paths: ["src/signup.ts"],
        expected_artifacts: ["signup validator"],
        required_checks: []
      })
    );

    expect(
      main(
        [
          "check",
          "--task-contract",
          "task-contract.json",
          "--format",
          "json",
          "--fail-on",
          "medium"
        ],
        io
      )
    ).toBe(ExitCode.Pass);

    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({
      findings: [
        expect.objectContaining({
          id: "expected-artifacts:declared",
          detector: "expected-artifacts",
          severity: "medium",
          title: "Expected artifacts declared by task contract"
        })
      ],
      summary: {
        decision: "pass",
        mediumCount: 1,
        policyApplied: {
          observationFindingIds: ["expected-artifacts:declared"],
          blockingFindingIds: []
        }
      }
    });
  });

  it("enforces forbidden paths from a structured task contract", () => {
    const { io, stdout, files } = createTestIo();

    files.set(
      "C:\\dev\\critical-gate\\task-contract.json",
      JSON.stringify({
        goal: "Correct the profile heading font weight",
        allowed_paths: ["src/profile/**"],
        forbidden_paths: ["src/signup.ts"],
        invariants: []
      })
    );

    expect(main(["check", "--task-contract", "task-contract.json", "--format", "json"], io)).toBe(
      ExitCode.FindingsFailed
    );

    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({
      summary: {
        decision: "fail",
        blockerCount: 1
      },
      findings: [
        expect.objectContaining({
          id: "scope:forbidden-path:src/signup.ts",
          severity: "blocker",
          title: "Forbidden path changed by task contract"
        })
      ]
    });
  });

  it("enforces allowed paths from a structured task contract", () => {
    const { io, stdout, files } = createTestIo();

    files.set(
      "C:\\dev\\critical-gate\\task-contract.json",
      JSON.stringify({
        goal: "Correct the profile heading font weight",
        allowed_paths: ["src/profile/**", "tests/profile/**"],
        forbidden_paths: [],
        invariants: []
      })
    );

    expect(main(["check", "--task-contract", "task-contract.json", "--format", "json"], io)).toBe(
      ExitCode.FindingsFailed
    );

    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({
      summary: {
        decision: "fail",
        blockerCount: 1
      },
      findings: [
        expect.objectContaining({
          id: "scope:outside-allowed-path:src/signup.ts",
          severity: "blocker",
          title: "Path outside task contract allowed paths"
        })
      ]
    });
  });

  it("records reported check execution metadata for task contracts", () => {
    const { io, stdout, files } = createTestIo();

    files.set(
      "C:\\dev\\critical-gate\\task-contract.json",
      JSON.stringify({
        goal: "Add signup validation",
        allowed_paths: ["src/signup.ts"],
        required_checks: ["pnpm test signup", "pnpm typecheck"]
      })
    );

    expect(
      main(
        [
          "check",
          "--task-contract",
          "task-contract.json",
          "--check-ran",
          "pnpm test signup",
          "--check-ran",
          "pnpm typecheck",
          "--format",
          "json"
        ],
        io
      )
    ).toBe(ExitCode.Pass);

    const result = JSON.parse(stdout[0] ?? "");

    expect(result.metadata).toMatchObject({
      checksRan: ["pnpm test signup", "pnpm typecheck"]
    });
    expect(result.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detector: "required-checks"
        })
      ])
    );
  });

  it("reports missing task-contract checks from CLI metadata without failing by default", () => {
    const { io, stdout, files } = createTestIo();

    files.set(
      "C:\\dev\\critical-gate\\task-contract.json",
      JSON.stringify({
        goal: "Add signup validation",
        allowed_paths: ["src/signup.ts"],
        required_checks: ["pnpm test signup", "pnpm typecheck"]
      })
    );

    expect(
      main(
        [
          "check",
          "--task-contract",
          "task-contract.json",
          "--check-ran",
          "pnpm test signup",
          "--format",
          "json"
        ],
        io
      )
    ).toBe(ExitCode.Pass);

    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({
      findings: [
        expect.objectContaining({
          id: "required-checks:missing",
          severity: "high",
          title: "Required checks were not reported as run"
        })
      ],
      summary: {
        decision: "pass",
        highCount: 1,
        policyApplied: {
          observationFindingIds: ["required-checks:missing"],
          blockingFindingIds: []
        }
      }
    });
  });

  it("loads structured check results for task-contract checks", () => {
    const { io, stdout, files } = createTestIo();

    files.set(
      "C:\\dev\\critical-gate\\task-contract.json",
      JSON.stringify({
        goal: "Add signup validation",
        allowed_paths: ["src/signup.ts"],
        required_checks: ["pnpm test signup", "pnpm typecheck"]
      })
    );
    files.set(
      "C:\\dev\\critical-gate\\checks-report.json",
      JSON.stringify({
        checks: [
          {
            command: "pnpm test signup",
            status: "passed",
            exitCode: 0
          },
          {
            command: "pnpm typecheck",
            status: "passed",
            exitCode: 0
          }
        ]
      })
    );

    expect(
      main(
        [
          "check",
          "--task-contract",
          "task-contract.json",
          "--checks-report",
          "checks-report.json",
          "--format",
          "json"
        ],
        io
      )
    ).toBe(ExitCode.Pass);

    const result = JSON.parse(stdout[0] ?? "");

    expect(result.metadata).toMatchObject({
      checksReportPath: "checks-report.json",
      checkResults: [
        {
          command: "pnpm test signup",
          status: "passed",
          exitCode: 0
        },
        {
          command: "pnpm typecheck",
          status: "passed",
          exitCode: 0
        }
      ]
    });
    expect(result.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detector: "required-checks"
        })
      ])
    );
  });

  it("reports failed task-contract checks from structured check results", () => {
    const { io, stdout, files } = createTestIo();

    files.set(
      "C:\\dev\\critical-gate\\task-contract.json",
      JSON.stringify({
        goal: "Add signup validation",
        allowed_paths: ["src/signup.ts"],
        required_checks: ["pnpm test signup", "pnpm typecheck"]
      })
    );
    files.set(
      "C:\\dev\\critical-gate\\checks-report.json",
      JSON.stringify([
        {
          command: "pnpm test signup",
          status: "passed"
        },
        {
          command: "pnpm typecheck",
          status: "failed",
          exitCode: 2
        }
      ])
    );

    expect(
      main(
        [
          "check",
          "--task-contract",
          "task-contract.json",
          "--checks-report",
          "checks-report.json",
          "--format",
          "json"
        ],
        io
      )
    ).toBe(ExitCode.Pass);

    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({
      findings: [
        expect.objectContaining({
          id: "required-checks:failed",
          severity: "high",
          title: "Required checks failed"
        })
      ],
      summary: {
        decision: "pass",
        highCount: 1,
        policyApplied: {
          observationFindingIds: ["required-checks:failed"],
          blockingFindingIds: []
        }
      }
    });
  });

  it("fails required-checks when promoted by repository policy", () => {
    const { io, stdout, files } = createTestIo();

    files.set(
      "C:\\dev\\critical-gate\\.critical-gate.json",
      JSON.stringify({
        policy: {
          detectorOverrides: [
            {
              detector: "required-checks",
              mode: "blocking",
              reason: "Required checks are calibrated for this repository."
            }
          ]
        }
      })
    );
    files.set(
      "C:\\dev\\critical-gate\\task-contract.json",
      JSON.stringify({
        goal: "Add signup validation",
        allowed_paths: ["src/signup.ts"],
        required_checks: ["pnpm typecheck"]
      })
    );
    files.set(
      "C:\\dev\\critical-gate\\checks-report.json",
      JSON.stringify([
        {
          command: "pnpm typecheck",
          status: "failed",
          exitCode: 2
        }
      ])
    );

    expect(
      main(
        [
          "check",
          "--task-contract",
          "task-contract.json",
          "--checks-report",
          "checks-report.json",
          "--format",
          "json"
        ],
        io
      )
    ).toBe(ExitCode.FindingsFailed);

    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({
      findings: [
        expect.objectContaining({
          id: "required-checks:failed",
          severity: "high"
        })
      ],
      summary: {
        decision: "fail",
        policyApplied: {
          blockingDetectors: ["required-checks"],
          blockingFindingIds: ["required-checks:failed"],
          observationFindingIds: []
        }
      }
    });
  });

  it("rejects invalid structured check result reports", () => {
    const { io, stderr, files } = createTestIo();

    files.set(
      "C:\\dev\\critical-gate\\task-contract.json",
      JSON.stringify({
        goal: "Add signup validation",
        allowed_paths: ["src/signup.ts"],
        required_checks: ["pnpm typecheck"]
      })
    );
    files.set(
      "C:\\dev\\critical-gate\\checks-report.json",
      JSON.stringify({
        checks: [
          {
            command: "pnpm typecheck",
            status: "unknown"
          }
        ]
      })
    );

    expect(
      main(
        [
          "check",
          "--task-contract",
          "task-contract.json",
          "--checks-report",
          "checks-report.json",
          "--format",
          "json"
        ],
        io
      )
    ).toBe(ExitCode.InternalError);
    expect(stderr[0]).toContain("Invalid checks report status at index 0");
  });

  it("passes the criticaldeveloper-blog local SVG icon dependency removal replay", () => {
    const { io, stdout } = createTestIo();
    const fixtureDiff = readFileSync(
      join(process.cwd(), "fixtures", "diffs", "blog-local-svg-icons-dependency-removal.diff"),
      "utf8"
    );
    const replayIo = {
      ...io,
      readDiff: () => ({
        root: "C:/dev/criticaldeveloper-blog",
        headRef: "6047886",
        files: parseUnifiedDiff(fixtureDiff)
      })
    };

    expect(
      main(
        [
          "check",
          "--task",
          "Replace Material Symbols font with local SVG icons",
          "--format",
          "json"
        ],
        replayIo
      )
    ).toBe(ExitCode.Pass);

    const result = JSON.parse(stdout[0] ?? "");
    const findingIds = result.findings.map((finding: { id: string }) => finding.id);

    expect(result.summary.decision).toBe("pass");
    expect(findingIds).not.toContain("dependency-addition:package.json:dependencies:astro");
    expect(findingIds).not.toContain("scope:package.json");
    expect(findingIds).not.toContain("expected-companions:package.json:lockfile");
  });

  it("allows blocker-only checks to pass high findings for pre-commit style hooks", () => {
    const { io, stdout } = createTestIo();
    const testDiffIo = {
      ...io,
      readDiff: (_baseRef?: string, options?: { staged?: boolean }) => {
        expect(options).toEqual({ staged: true });

        return {
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
                  oldLines: 1,
                  newStart: 1,
                  newLines: 0,
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
        };
      }
    };

    expect(
      main(
        [
          "check",
          "--staged",
          "--task",
          "Pre-commit staged change",
          "--format",
          "json",
          "--fail-on",
          "blocker"
        ],
        testDiffIo
      )
    ).toBe(ExitCode.Pass);

    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({
      summary: {
        decision: "pass",
        highCount: 1
      },
      metadata: {
        staged: true,
        failOn: "blocker"
      }
    });
  });

  it("writes a public API snapshot", () => {
    const { io, stdout, writes, files } = createTestIo();

    files.set(
      "C:\\dev\\critical-gate\\package.json",
      JSON.stringify({
        exports: {
          ".": "./src/index.ts"
        }
      })
    );
    files.set(
      "C:\\dev\\critical-gate\\src\\index.ts",
      "export function validateSignup(): boolean { return true; }\n"
    );

    expect(main(["snapshot-api"], io)).toBe(ExitCode.Pass);

    const output = writes.get("C:\\dev\\critical-gate\\.critical-gate\\api-surface.json");
    expect(output).toBeDefined();
    expect(JSON.parse(output ?? "{}")).toMatchObject({
      schemaVersion: "1.0",
      entrypoints: ["src/index.ts"],
      exports: [
        {
          path: "src/index.ts",
          name: "validateSignup",
          kind: "function"
        }
      ]
    });
    expect(stdout[0]).toContain("Wrote public API snapshot");
  });

  it("includes public API snapshot context in json output", () => {
    const { io, stdout, files } = createTestIo();

    files.set(
      "C:\\dev\\critical-gate\\.critical-gate\\api-surface.json",
      JSON.stringify({
        schemaVersion: "1.0",
        generatedAt: "2026-06-19T08:00:00.000Z",
        entrypoints: ["src/index.ts"],
        exports: [
          {
            path: "src/index.ts",
            name: "validateSignup",
            kind: "function",
            signature: "export function validateSignup(): boolean"
          }
        ]
      })
    );

    expect(main(["check", "--task", "Add signup validation", "--format", "json"], io)).toBe(
      ExitCode.Pass
    );

    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({
      context: {
        apiSnapshot: {
          path: ".critical-gate/api-surface.json",
          schemaVersion: "1.0",
          exportCount: 1,
          entrypoints: ["src/index.ts"]
        }
      }
    });
  });

  it("includes monorepo ownership context in json output", () => {
    const { io, stdout, files } = createTestIo();
    const monorepoIo = {
      ...io,
      readDiff: () => ({
        ...testDiffResult,
        files: [
          {
            ...testDiffResult.files[0]!,
            path: "apps/web/src/signup.ts"
          }
        ]
      })
    };

    files.set(
      "C:\\dev\\critical-gate\\pnpm-workspace.yaml",
      ["packages:", "  - apps/*", "  - packages/*"].join("\n")
    );
    files.set("C:\\dev\\critical-gate\\apps\\web\\package.json", '{"name":"@repo/web"}');

    expect(main(["check", "--task", "Add signup validation", "--format", "json"], monorepoIo)).toBe(
      ExitCode.Pass
    );

    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({
      context: {
        monorepo: {
          tools: ["pnpm"],
          configFiles: ["pnpm-workspace.yaml"],
          workspaceGlobs: ["apps/*", "packages/*"],
          packages: [
            {
              path: "apps/web",
              name: "@repo/web"
            }
          ]
        }
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
              name: "Critical Gate",
              semanticVersion: CRITICAL_GATE_VERSION
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

  it("emits compact PR comment output", () => {
    const { io, stdout } = createTestIo();

    expect(main(["check", "--task", "Add signup validation", "--format", "pr-comment"], io)).toBe(
      ExitCode.Pass
    );

    expect(stdout[0]).toContain("## Critical Gate: pass");
    expect(stdout[0]).toContain("Task: Add signup validation");
    expect(stdout[0]).toContain("### Blocking findings");
    expect(stdout[0]).toContain("### Observations");
  });

  it("prints hook help", () => {
    const { io, stdout, stderr } = createTestIo();

    expect(main(["hook", "--help"], io)).toBe(ExitCode.Pass);
    expect(stdout.join("\n")).toContain("critical-gate hook");
    expect(stdout.join("\n")).toContain("defaults to Codex completed feature implementation");
    expect(stderr).toEqual([]);
  });

  it("prints init-agent help with the installable CLI default", () => {
    const { io, stdout, stderr } = createTestIo();

    expect(main(["init-agent", "--help"], io)).toBe(ExitCode.Pass);
    expect(stdout.join("\n")).toContain("critical-gate init-agent");
    expect(stdout.join("\n")).toContain("defaults to npx critical-gate");
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
      findings: [
        {
          id: "expected-companions:package.json:lockfile",
          severity: "medium"
        }
      ],
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

  it("uses policy failOn medium when no CLI fail-on override is provided", () => {
    const { io, stdout, files } = createTestIo();
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
    files.set(
      "C:\\dev\\critical-gate\\.critical-gate.json",
      JSON.stringify({
        policy: {
          failOn: "medium"
        }
      })
    );

    expect(main(["check", "--task", "Add signup validation", "--format", "json"], apiDiffIo)).toBe(
      ExitCode.FindingsFailed
    );

    expect(JSON.parse(stdout[0] ?? "")).toMatchObject({
      summary: {
        decision: "fail",
        mediumCount: expect.any(Number)
      },
      metadata: {
        failOn: "medium",
        policy: {
          failOn: "medium"
        }
      }
    });
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

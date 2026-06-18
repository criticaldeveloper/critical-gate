import {
  GATE_RESULT_SCHEMA_VERSION,
  renderJsonReport,
  renderMarkdownReport,
  renderRepairReport,
  renderSarifReport,
  type GateResult
} from "../src/index.js";

const result: GateResult = {
  schemaVersion: GATE_RESULT_SCHEMA_VERSION,
  generatedAt: "2026-06-17T21:30:00.000Z",
  task: {
    source: "cli",
    text: "Add signup validation"
  },
  diff: {
    baseRef: "main",
    headRef: "feature/signup-validation",
    files: [
      {
        path: "src/signup.ts",
        status: "modified",
        role: "source",
        additions: 3,
        deletions: 1,
        language: "typescript",
        hunks: []
      },
      {
        path: "tests/signup.test.ts",
        status: "modified",
        role: "test",
        additions: 0,
        deletions: 1,
        language: "typescript",
        hunks: []
      }
    ]
  },
  findings: [
    {
      id: "test-weakening-001",
      detector: "test-weakening",
      severity: "high",
      confidence: 0.92,
      title: "Assertion removed from signup test",
      message: "The diff removes a behavioral assertion from the signup test.",
      evidence: [
        {
          kind: "line",
          path: "tests/signup.test.ts",
          startLine: 24,
          endLine: 24,
          message: 'Removed expect(error.message).toContain("email")'
        }
      ],
      repair: "Restore the removed behavioral assertion.",
      tags: ["test"]
    }
  ],
  summary: {
    decision: "fail",
    findingCount: 1,
    blockerCount: 0,
    highCount: 1,
    mediumCount: 0,
    lowCount: 0,
    infoCount: 0,
    diffCostScore: 42
  },
  intentVerification: {
    requestedClasses: ["source"],
    observedClasses: ["source", "tests"],
    unexpectedClasses: ["tests"],
    coverage: "partial",
    explanationCodes: ["matched:source", "unexpected:tests"]
  }
};

describe("reporters", () => {
  it("renders JSON output", () => {
    expect(JSON.parse(renderJsonReport(result))).toMatchObject({
      schemaVersion: "1.0",
      summary: {
        decision: "fail"
      }
    });
  });

  it("renders Markdown output with changed files and findings", () => {
    const report = renderMarkdownReport(result);

    expect(report).toContain("# Critical Gate Report");
    expect(report).toContain("Changed Files: 2");
    expect(report).toContain("## Intent Verification");
    expect(report).toContain("Requested Classes: source");
    expect(report).toContain("Unexpected Classes: tests");
    expect(report).toContain("- modified src/signup.ts (source, +3/-1)");
    expect(report).toContain("### Assertion removed from signup test");
    expect(report).toContain("Repair: Restore the removed behavioral assertion.");
  });

  it("renders compact repair output", () => {
    const report = renderRepairReport(result);

    expect(report).toContain("Critical Gate found findings that need repair:");
    expect(report).toContain("1. HIGH: Assertion removed from signup test");
    expect(report).toContain("Evidence: tests/signup.test.ts:24.");
  });

  it("renders pass repair output without noisy instructions", () => {
    expect(renderRepairReport({ ...result, findings: [] })).toBe(
      "Critical Gate passed. No repair actions required.\n"
    );
  });

  it("renders SARIF output", () => {
    const sarif = JSON.parse(renderSarifReport(result));

    expect(sarif).toMatchObject({
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "Critical Gate"
            }
          },
          results: [
            {
              ruleId: "test-weakening",
              level: "error",
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: {
                      uri: "tests/signup.test.ts"
                    },
                    region: {
                      startLine: 24,
                      endLine: 24
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    });
  });
});

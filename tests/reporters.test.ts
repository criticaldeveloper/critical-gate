import {
  GATE_RESULT_SCHEMA_VERSION,
  buildReviewerChecklist,
  renderJsonReport,
  renderMarkdownReport,
  renderPrCommentReport,
  renderRepairReport,
  renderSarifReport,
  type Finding,
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
      reasonChain: {
        whatHappened: "The diff removes a behavioral assertion from the signup test.",
        whySuspicious: "Agent changes can keep tests green while removing behavioral protection.",
        supportingSignals: [
          "Detector: test-weakening",
          "tests/signup.test.ts:24: Removed assertion"
        ],
        acceptableIf: ["The assertion is replaced by an equally specific behavioral assertion."],
        repairHint: "Restore the removed behavioral assertion."
      },
      repairContract: {
        instructions: [
          "Restore the removed behavioral assertion.",
          "Keep the repair limited to the allowed files unless the task intent explicitly requires more."
        ],
        allowedFiles: ["tests/signup.test.ts"],
        forbiddenFiles: ["src/signup.ts"],
        successCriteria: [
          "The finding test-weakening-001 no longer appears after rerunning Critical Gate.",
          "The original task intent is still satisfied."
        ]
      },
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
    diffCostScore: 42,
    diffCoherenceScore: {
      score: 71,
      drivers: [
        {
          code: "scope-drift",
          label: "Scope findings reduce diff coherence",
          points: 22,
          evidence: ["expected-companions:src/signup.ts:tests/signup.test.ts"]
        },
        {
          code: "tests-move-with-source",
          label: "Tests changed with source",
          points: 10
        }
      ]
    },
    scopeExpansionScore: {
      score: 3,
      drivers: [
        {
          code: "missing-companions",
          label: "Expected companion files missing",
          points: 1,
          evidence: ["expected-companions:src/signup.ts:tests/signup.test.ts"]
        },
        {
          code: "high-risk-roles",
          label: "Config, manifest, or lockfile touched",
          points: 2,
          evidence: ["package.json"]
        }
      ]
    }
  },
  intentVerification: {
    requestedClasses: ["source"],
    observedClasses: ["source", "tests"],
    unexpectedClasses: ["tests"],
    coverage: "partial",
    explanationCodes: ["matched:source", "unexpected:tests"]
  },
  intentQuality: {
    score: 70,
    warnings: [
      {
        code: "missing-target",
        message: "Task intent does not name a clear target area.",
        suggestion:
          "Mention the feature, module, file family, user flow, or public API being changed.",
        penalty: 25
      }
    ]
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
    expect(report).toContain("Diff Coherence Score: 71/100");
    expect(report).toContain("Scope Expansion Score: 3/10");
    expect(report).toContain("- Config, manifest, or lockfile touched: +2 (high-risk-roles)");
    expect(report).toContain("## Diff Coherence Drivers");
    expect(report).toContain("- Tests changed with source: +10 (tests-move-with-source)");
    expect(report).toContain("## Intent Verification");
    expect(report).toContain("Requested Classes: source");
    expect(report).toContain("Unexpected Classes: tests");
    expect(report).toContain("## Task Intent Quality");
    expect(report).toContain("Score: 70/100");
    expect(report).toContain("Task intent does not name a clear target area.");
    expect(report).toContain("- modified src/signup.ts (source, +3/-1)");
    expect(report).toContain("### Assertion removed from signup test");
    expect(report).toContain("## Reviewer Checklist");
    expect(report).toContain(
      "- [ ] Resolve or explicitly accept Assertion removed from signup test."
    );
    expect(report).toContain(
      "- [ ] Confirm changed tests still assert behavior, not only rendering or existence."
    );
    expect(report).toContain("Reason Chain:");
    expect(report).toContain(
      "- Why suspicious: Agent changes can keep tests green while removing behavioral protection."
    );
    expect(report).toContain("Repair: Restore the removed behavioral assertion.");
  });

  it("renders a clean diff certificate for passing Markdown reports", () => {
    const report = renderMarkdownReport({
      ...result,
      findings: [],
      summary: {
        ...result.summary,
        decision: "pass",
        findingCount: 0,
        highCount: 0,
        mediumCount: 0
      }
    });

    expect(report).toContain("## Clean Diff Certificate");
    expect(report).toContain("- Gate passed with 2 changed files and 0 non-blocking findings.");
    expect(report).toContain("- Diff coherence is 71/100.");
    expect(report).toContain("- No dependency changes were flagged.");
    expect(report).toContain("- No test weakening was detected.");
    expect(report).toContain("- No public API surface change was flagged.");
    expect(report).toContain("- No hardcoded secrets, local paths, or internal URLs were flagged.");
  });

  it("renders compact repair output", () => {
    const report = renderRepairReport(result);

    expect(report).toContain("Critical Gate found findings that need repair:");
    expect(report).toContain("Scope Expansion Score: 3/10");
    expect(report).toContain("- Config, manifest, or lockfile touched: +2");
    expect(report).toContain("1. HIGH: Assertion removed from signup test");
    expect(report).toContain(
      "Why suspicious: Agent changes can keep tests green while removing behavioral protection."
    );
    expect(report).toContain(
      "Acceptable if: The assertion is replaced by an equally specific behavioral assertion."
    );
    expect(report).toContain("Evidence: tests/signup.test.ts:24.");
    expect(report).toContain("Repair Contract:");
    expect(report).toContain("Repair contract for test-weakening-001");
    expect(report).toContain("Allowed files:");
    expect(report).toContain("- tests/signup.test.ts");
    expect(report).toContain("Forbidden files:");
    expect(report).toContain("- src/signup.ts");
    expect(report).toContain("Success criteria:");
    expect(report).toContain(
      "- The finding test-weakening-001 no longer appears after rerunning Critical Gate."
    );
  });

  it("renders a compact PR comment with grouped findings and support changes", () => {
    const report = renderPrCommentReport(result);

    expect(report).toContain("## Critical Gate: fail");
    expect(report).toContain("Task: Add signup validation");
    expect(report).toContain("Changed files: 2 (+3/-2)");
    expect(report).toContain("Diff coherence: 71/100");
    expect(report).toContain("### Blocking findings");
    expect(report).toContain(
      "- **HIGH** Assertion removed from signup test (test-weakening, 92%)."
    );
    expect(report).toContain("Repair: Restore the removed behavioral assertion.");
    expect(report).toContain("Evidence: tests/signup.test.ts:24");
    expect(report).toContain("### Observations");
    expect(report).toContain("- None.");
    expect(report).toContain("### Expected support changes");
    expect(report).toContain("- modified tests/signup.test.ts (test, +0/-1)");
    expect(report).toContain("### Scope drivers");
    expect(report).toContain("- Config, manifest, or lockfile touched: +2");
    expect(report).toContain("### Task intent quality");
    expect(report).toContain("Mention the feature, module, file family, user flow, or public API");
    expect(report).toContain("### Reviewer checklist");
    expect(report).toContain(
      "- [ ] Resolve or explicitly accept Assertion removed from signup test."
    );
  });

  it("builds a concise evidence-backed reviewer checklist", () => {
    expect(buildReviewerChecklist(result)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "blocking-finding",
          findingId: "test-weakening-001",
          text: "Resolve or explicitly accept Assertion removed from signup test.",
          evidence: 'tests/signup.test.ts:24: Removed expect(error.message).toContain("email")'
        }),
        expect.objectContaining({
          source: "changed-role",
          text: "Confirm changed tests still assert behavior, not only rendering or existence.",
          evidence: "tests/signup.test.ts"
        }),
        expect.objectContaining({
          source: "intent",
          text: "Confirm the task intent is specific enough to bound the diff."
        })
      ])
    );
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
              partialFingerprints: {
                criticalGateFinding: expect.any(String)
              },
              properties: {
                detector: "test-weakening",
                category: "tests"
              },
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
    expect(sarif.runs[0].tool.driver.rules[0]).toMatchObject({
      id: "test-weakening",
      properties: {
        detector: "test-weakening",
        category: "tests",
        tags: ["test"]
      }
    });
    expect(sarif.runs[0].invocations[0].properties).toMatchObject({
      resultCount: 1,
      emittedResultCount: 1,
      truncated: false
    });
  });

  it("renders stable SARIF sub-rules, fingerprints, and truncation metadata", () => {
    const manyFindings: Finding[] = Array.from({ length: 505 }, (_, index) => ({
      id: `blast-radius:unexpected-cluster-${index}:src/file-${index}.ts`,
      detector: "blast-radius",
      severity: "low" as const,
      confidence: 0.74,
      title: "Unexpected changed-file cluster",
      message: "The diff includes a separate changed-file cluster.",
      evidence: [
        {
          kind: "file" as const,
          path: `src/file-${index}.ts`,
          message: "Cluster role(s): source."
        }
      ],
      repair: "Confirm this separate cluster belongs to the current task.",
      tags: ["scope"]
    }));
    const sarif = JSON.parse(renderSarifReport({ ...result, findings: manyFindings }));

    expect(sarif.runs[0].results).toHaveLength(500);
    expect(sarif.runs[0].results[0]).toMatchObject({
      ruleId: "blast-radius:unexpected-cluster",
      partialFingerprints: {
        criticalGateFinding: expect.any(String)
      },
      properties: {
        detector: "blast-radius",
        category: "scope"
      }
    });
    expect(sarif.runs[0].tool.driver.rules[0]).toMatchObject({
      id: "blast-radius:unexpected-cluster",
      properties: {
        category: "scope"
      }
    });
    expect(sarif.runs[0].invocations[0].properties).toMatchObject({
      resultCount: 505,
      emittedResultCount: 500,
      truncated: true
    });
  });
});

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
import { CRITICAL_GATE_VERSION } from "../src/version.js";

const result: GateResult = {
  schemaVersion: GATE_RESULT_SCHEMA_VERSION,
  generatedAt: "2026-06-17T21:30:00.000Z",
  task: {
    source: "cli",
    text: "Add signup validation"
  },
  taskContract: {
    source: "provided",
    goal: "Add signup validation",
    allowedPaths: ["src/signup.ts", "tests/signup.test.ts"],
    forbiddenPaths: ["package.json"],
    expectedArtifacts: ["signup validator"],
    invariants: ["no_new_dependencies"],
    requiredChecks: ["pnpm test signup"]
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
    policyApplied: {
      failOn: "high",
      observationDetectors: [
        "intent-verification",
        "blast-radius",
        "existing-solution",
        "pattern-violation",
        "expected-companions"
      ],
      blockingDetectors: [],
      detectorMaturity: [
        {
          detector: "test-weakening",
          maturity: "review",
          defaultMode: "blocking"
        },
        {
          detector: "blast-radius",
          maturity: "experimental",
          defaultMode: "observation"
        }
      ],
      acceptedFindingIds: ["scope:accepted-fixture"],
      blockingFindingIds: ["test-weakening-001"],
      observationFindingIds: [],
      confidenceSuppressedFindingIds: []
    },
    detectorRuns: [
      {
        detector: "test-weakening",
        status: "findings",
        durationMs: 2,
        findingCount: 1,
        maturity: "review",
        filesInspected: 2
      },
      {
        detector: "blast-radius",
        status: "passed",
        durationMs: 1,
        findingCount: 0,
        maturity: "experimental",
        filesInspected: 2
      }
    ],
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
    explanationCodes: ["matched:source", "unexpected:tests"],
    requestedCategories: ["source-behavior"],
    observedCategories: ["source-behavior", "test-coverage"],
    missingCategories: [],
    unexpectedCategories: ["test-coverage"],
    categoryAssessments: [
      {
        category: "source-behavior",
        expected: true,
        observed: true,
        confidence: 0.9,
        evidence: ["src/signup.ts: Source file changed."]
      },
      {
        category: "test-coverage",
        expected: false,
        observed: true,
        confidence: 0.72,
        evidence: ["tests/signup.test.ts: Test file changed."]
      }
    ]
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
    expect(report).toContain("## Policy Applied");
    expect(report).toContain("Fail threshold: high.");
    expect(report).toContain("Blocking findings after policy: test-weakening-001.");
    expect(report).toContain("Detector maturity: 0 blocker-certified, 1 review, 1 experimental.");
    expect(report).toContain("Accepted findings applied: scope:accepted-fixture.");
    expect(report).toContain("## Detector Runs");
    expect(report).toContain("1 passed, 1 produced findings, 0 degraded across 2 detectors.");
    expect(report).toContain("## Task Contract");
    expect(report).toContain("Source: provided.");
    expect(report).toContain("Allowed paths: src/signup.ts, tests/signup.test.ts.");
    expect(report).toContain("Forbidden paths: package.json.");
    expect(report).toContain("Invariants: no_new_dependencies.");
    expect(report).toContain("## Intent Verification");
    expect(report).toContain("Requested Classes: source");
    expect(report).toContain("Unexpected Classes: tests");
    expect(report).toContain("Requested Categories: source-behavior");
    expect(report).toContain("Observed Categories: source-behavior, test-coverage");
    expect(report).toContain("Unexpected Categories: test-coverage");
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
        mediumCount: 0,
        policyApplied: {
          ...result.summary.policyApplied!,
          blockingFindingIds: [],
          observationFindingIds: []
        }
      }
    });

    expect(report).toContain("## Clean Diff Certificate");
    expect(report).toContain("- Gate passed with 2 changed files and 0 non-blocking findings.");
    expect(report).toContain(
      "- Detector families checked: dependency, test integrity, public API, configuration, secret/path, scope, rewrite, and repository convention signals."
    );
    expect(report).toContain("- Diff coherence is 71/100.");
    expect(report).toContain(
      "- Policy applied: fail threshold high; 0 blocking findings and 0 observation findings after policy."
    );
    expect(report).toContain("- No dependency changes were flagged.");
    expect(report).toContain("- No test weakening was detected.");
    expect(report).toContain("- No public API surface change was flagged.");
    expect(report).toContain("- No configuration drift was flagged.");
    expect(report).toContain("- No hardcoded secrets, local paths, or internal URLs were flagged.");
  });

  it("renders a compact why-passed certificate for observation-only Markdown reports", () => {
    const observationFinding: Finding = {
      id: "config-change:vitest.config.ts",
      detector: "config-change",
      severity: "medium",
      confidence: 0.78,
      title: "Configuration changed",
      message: "A project configuration file changed.",
      evidence: [
        {
          kind: "file",
          path: "vitest.config.ts",
          message: "Configuration file changed."
        }
      ],
      repair: "Document the operational effect of this configuration change.",
      tags: ["config"]
    };
    const report = renderMarkdownReport({
      ...result,
      findings: [observationFinding],
      summary: {
        ...result.summary,
        decision: "pass",
        findingCount: 1,
        blockerCount: 0,
        highCount: 0,
        mediumCount: 1,
        policyApplied: {
          ...result.summary.policyApplied!,
          blockingFindingIds: [],
          observationFindingIds: [observationFinding.id]
        }
      }
    });

    expect(report).toContain("## Clean Diff Certificate");
    expect(report).toContain("- Gate passed with 2 changed files and 1 non-blocking finding.");
    expect(report).toContain(
      "- Policy applied: fail threshold high; 0 blocking findings and 1 observation finding after policy."
    );
    expect(report).toContain(
      "- No blocker or high-severity findings failed the configured threshold."
    );
    expect(report).toContain("- Configuration checks emitted non-blocking observations.");
    expect(report).toContain("## Findings");
    expect(report).toContain("### Configuration changed");
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
    expect(report).toContain(
      "Contract: provided; allowed paths: src/signup.ts, tests/signup.test.ts; forbidden paths: package.json; invariants: no_new_dependencies"
    );
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
    expect(report).toContain("### Policy applied");
    expect(report).toContain("- Fail threshold: high.");
    expect(report).toContain("- Detector maturity: 0 blocker-certified, 1 review, 1 experimental.");
    expect(report).toContain("- Accepted findings applied: scope:accepted-fixture.");
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

  it("uses applied rollout policy when grouping PR comment findings", () => {
    const observationFinding: Finding = {
      id: "blast-radius:unexpected-cluster:test",
      detector: "blast-radius",
      severity: "high",
      confidence: 0.9,
      title: "Unexpected changed-file cluster",
      message: "A separate cluster changed outside the expected task scope.",
      evidence: [{ kind: "file", path: "src/other.ts", message: "Unexpected cluster." }],
      repair: "Split the unrelated cluster or document why it belongs.",
      tags: ["scope"]
    };

    const report = renderPrCommentReport({
      ...result,
      findings: [observationFinding],
      summary: {
        ...result.summary,
        decision: "pass",
        findingCount: 1,
        highCount: 1,
        policyApplied: {
          ...result.summary.policyApplied!,
          blockingFindingIds: [],
          observationFindingIds: [observationFinding.id]
        }
      }
    });

    expect(report).toContain("### Blocking findings\n\n- None.");
    expect(report).toContain("### Observations");
    expect(report).toContain("Unexpected changed-file cluster");
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
              name: "Critical Gate",
              semanticVersion: CRITICAL_GATE_VERSION
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

  it("keeps representative blocking finding ids, SARIF rule ids, fingerprints, and repair fields stable", () => {
    const stableFindings: Finding[] = [
      {
        id: "dependency-addition:package.json:dependencies:axios",
        detector: "dependency-addition",
        severity: "blocker",
        confidence: 0.9,
        title: "Unjustified production dependency added",
        message: "axios@^1.7.0 was added to dependencies without visible task justification.",
        evidence: [
          {
            kind: "manifest",
            path: "package.json",
            startLine: 12,
            endLine: 12,
            message: "axios was added to dependencies."
          }
        ],
        repair:
          "Remove axios unless it is required, or update the task/PR context with a clear justification and alternatives considered.",
        repairContract: {
          instructions: [
            "Remove axios unless it is required, or update the task/PR context with a clear justification and alternatives considered.",
            "Keep the repair limited to the allowed files unless the task intent explicitly requires more."
          ],
          allowedFiles: ["package.json"],
          forbiddenFiles: ["src/signup.ts"],
          successCriteria: [
            "The finding dependency-addition:package.json:dependencies:axios no longer appears after rerunning Critical Gate."
          ]
        },
        tags: ["dependency"]
      },
      {
        id: "secret-path:src/config.ts:provider-token:8",
        detector: "secret-path",
        severity: "blocker",
        confidence: 0.94,
        title: "Provider token pattern added",
        message: "The diff adds a value matching a known provider token pattern.",
        evidence: [
          {
            kind: "line",
            path: "src/config.ts",
            startLine: 8,
            endLine: 8,
            message: 'token: "ghp_abc...[redacted]...99"'
          }
        ],
        repair:
          "Remove the token, rotate it if it was real, and load it from a managed secret source.",
        repairContract: {
          instructions: [
            "Remove the token, rotate it if it was real, and load it from a managed secret source.",
            "Keep the repair limited to the allowed files unless the task intent explicitly requires more."
          ],
          allowedFiles: ["src/config.ts"],
          forbiddenFiles: [],
          successCriteria: [
            "The finding secret-path:src/config.ts:provider-token:8 no longer appears after rerunning Critical Gate."
          ]
        },
        tags: ["secret"]
      },
      {
        id: "test-weakening:tests/signup.test.ts:focused-test:42",
        detector: "test-weakening",
        severity: "blocker",
        confidence: 0.95,
        title: "Focused test committed",
        message: "The diff adds a focused test marker that can hide the rest of the suite.",
        evidence: [
          {
            kind: "line",
            path: "tests/signup.test.ts",
            startLine: 42,
            endLine: 42,
            message: "it.only"
          }
        ],
        repair: "Remove the focused test marker and ensure the full test suite runs.",
        repairContract: {
          instructions: [
            "Remove the focused test marker and ensure the full test suite runs.",
            "Keep the repair limited to the allowed files unless the task intent explicitly requires more."
          ],
          allowedFiles: ["tests/signup.test.ts"],
          forbiddenFiles: [],
          successCriteria: [
            "The finding test-weakening:tests/signup.test.ts:focused-test:42 no longer appears after rerunning Critical Gate."
          ]
        },
        tags: ["test"]
      },
      {
        id: "api-surface:src/index.ts:snapshot-signature-change:validateSignup:3",
        detector: "api-surface",
        severity: "high",
        confidence: 0.9,
        title: "Public API signature changed without release evidence",
        message: "validateSignup signature changed from the committed public API snapshot.",
        evidence: [
          {
            kind: "symbol",
            path: "src/index.ts",
            startLine: 3,
            endLine: 3,
            symbol: "validateSignup",
            message: "Signature differs from snapshot."
          }
        ],
        repair:
          "Add release evidence for the public contract change, update the API snapshot intentionally, or restore the previous signature.",
        repairContract: {
          instructions: [
            "Add release evidence for the public contract change, update the API snapshot intentionally, or restore the previous signature.",
            "Keep the repair limited to the allowed files unless the task intent explicitly requires more."
          ],
          allowedFiles: ["src/index.ts"],
          forbiddenFiles: [],
          successCriteria: [
            "The finding api-surface:src/index.ts:snapshot-signature-change:validateSignup:3 no longer appears after rerunning Critical Gate."
          ]
        },
        tags: ["api"]
      },
      {
        id: "scope:package.json",
        detector: "scope",
        severity: "high",
        confidence: 0.84,
        title: "Unexpected file changed for small task",
        message: "package.json changed during a small task but does not align with expected scope.",
        evidence: [
          {
            kind: "file",
            path: "package.json",
            startLine: 5,
            endLine: 5,
            message: "Changed file role: manifest. Task keywords: signup."
          }
        ],
        repair:
          "Remove unrelated edits or split them into a separate task with explicit justification.",
        repairContract: {
          instructions: [
            "Remove unrelated edits or split them into a separate task with explicit justification.",
            "Keep the repair limited to the allowed files unless the task intent explicitly requires more."
          ],
          allowedFiles: ["package.json"],
          forbiddenFiles: [],
          successCriteria: [
            "The finding scope:package.json no longer appears after rerunning Critical Gate."
          ]
        },
        tags: ["scope"]
      },
      {
        id: "rewrite:src/signup.ts",
        detector: "rewrite",
        severity: "high",
        confidence: 0.86,
        title: "Large balanced rewrite detected",
        message:
          "src/signup.ts has 100 changed lines with balanced additions and deletions, which looks like a rewrite.",
        evidence: [
          {
            kind: "metric",
            path: "src/signup.ts",
            startLine: 10,
            endLine: 10,
            message: "Additions: 50, deletions: 50, rewrite balance: 100%."
          }
        ],
        repair:
          "Reduce the change to targeted edits, or split the rewrite into an explicit refactor task with tests and review notes.",
        repairContract: {
          instructions: [
            "Reduce the change to targeted edits, or split the rewrite into an explicit refactor task with tests and review notes.",
            "Keep the repair limited to the allowed files unless the task intent explicitly requires more."
          ],
          allowedFiles: ["src/signup.ts"],
          forbiddenFiles: [],
          successCriteria: [
            "The finding rewrite:src/signup.ts no longer appears after rerunning Critical Gate."
          ]
        },
        tags: ["rewrite"]
      },
      {
        id: "intent-coverage:ui-implementation-not-observed",
        detector: "intent-coverage",
        severity: "high",
        confidence: 0.88,
        title: "Requested UI implementation not observed",
        message:
          "The task asks for visible UI implementation work, but the diff only changes trivial stylesheet values.",
        evidence: [
          {
            kind: "file",
            path: "src/App.css",
            message: "src/App.css only contains small stylesheet value edits."
          }
        ],
        repair:
          "Add the requested UI/page/component changes, or revise the task intent if this diff is only a style adjustment.",
        repairContract: {
          instructions: [
            "Add the requested UI/page/component changes, or revise the task intent if this diff is only a style adjustment.",
            "Keep the repair limited to the allowed files unless the task intent explicitly requires more."
          ],
          allowedFiles: ["src/App.css"],
          forbiddenFiles: [],
          successCriteria: [
            "The finding intent-coverage:ui-implementation-not-observed no longer appears after rerunning Critical Gate."
          ]
        },
        tags: ["scope"]
      }
    ];

    const sarif = JSON.parse(renderSarifReport({ ...result, findings: stableFindings }));
    const stableContract = sarif.runs[0].results.map(
      (sarifResult: {
        ruleId: string;
        partialFingerprints: { criticalGateFinding: string };
        properties: {
          id: string;
          detector: string;
          severity: string;
          repair: string;
        };
      }) => ({
        id: sarifResult.properties.id,
        detector: sarifResult.properties.detector,
        severity: sarifResult.properties.severity,
        ruleId: sarifResult.ruleId,
        fingerprint: sarifResult.partialFingerprints.criticalGateFinding,
        repair: sarifResult.properties.repair
      })
    );

    expect(stableContract).toEqual([
      {
        id: "dependency-addition:package.json:dependencies:axios",
        detector: "dependency-addition",
        severity: "blocker",
        ruleId: "dependency-addition:package.json",
        fingerprint: "a8c4d2cee5ac65fcb98406d5f419c10c",
        repair:
          "Remove axios unless it is required, or update the task/PR context with a clear justification and alternatives considered."
      },
      {
        id: "secret-path:src/config.ts:provider-token:8",
        detector: "secret-path",
        severity: "blocker",
        ruleId: "secret-path:src/config.ts",
        fingerprint: "cd74e35d9cf4216b82f64b5fc8e5e3ba",
        repair:
          "Remove the token, rotate it if it was real, and load it from a managed secret source."
      },
      {
        id: "test-weakening:tests/signup.test.ts:focused-test:42",
        detector: "test-weakening",
        severity: "blocker",
        ruleId: "test-weakening:tests/signup.test.ts",
        fingerprint: "1903c7c347e28aa43bfe3152f0e17eac",
        repair: "Remove the focused test marker and ensure the full test suite runs."
      },
      {
        id: "api-surface:src/index.ts:snapshot-signature-change:validateSignup:3",
        detector: "api-surface",
        severity: "high",
        ruleId: "api-surface:src/index.ts",
        fingerprint: "7dc59aca9f2c4c40ec64b0447f93c786",
        repair:
          "Add release evidence for the public contract change, update the API snapshot intentionally, or restore the previous signature."
      },
      {
        id: "scope:package.json",
        detector: "scope",
        severity: "high",
        ruleId: "scope:package.json",
        fingerprint: "19a36af06dd1840527c5be6bbd74469a",
        repair:
          "Remove unrelated edits or split them into a separate task with explicit justification."
      },
      {
        id: "rewrite:src/signup.ts",
        detector: "rewrite",
        severity: "high",
        ruleId: "rewrite:src/signup.ts",
        fingerprint: "0c578b247f48ce41da73c978737cda44",
        repair:
          "Reduce the change to targeted edits, or split the rewrite into an explicit refactor task with tests and review notes."
      },
      {
        id: "intent-coverage:ui-implementation-not-observed",
        detector: "intent-coverage",
        severity: "high",
        ruleId: "intent-coverage:ui-implementation-not-observed",
        fingerprint: "4070c83d8da9f0c1d2295426a7963864",
        repair:
          "Add the requested UI/page/component changes, or revise the task intent if this diff is only a style adjustment."
      }
    ]);
  });
});

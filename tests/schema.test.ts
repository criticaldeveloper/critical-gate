import { Ajv2020 } from "ajv/dist/2020.js";

import { GATE_RESULT_SCHEMA_VERSION, gateResultJsonSchema, type GateResult } from "../src/index.js";

const ajv = new Ajv2020({ allErrors: true });
const validateGateResult = ajv.compile(gateResultJsonSchema);

describe("gate result schema", () => {
  it("validates a complete gate result", () => {
    const result: GateResult = {
      schemaVersion: GATE_RESULT_SCHEMA_VERSION,
      generatedAt: "2026-06-17T21:15:00.000Z",
      task: {
        source: "cli",
        text: "Add signup validation",
        summary: "Add validation to the signup form"
      },
      taskContract: {
        source: "provided",
        goal: "Add signup validation",
        allowedPaths: ["src/signup.ts", "tests/signup.test.ts"],
        forbiddenPaths: ["package.json"],
        expectedChangedRoles: ["source", "test"],
        expectedArtifacts: ["signup validator"],
        invariants: ["no_new_dependencies"],
        requiredChecks: ["pnpm test signup"],
        provenance: ["pull request body", "repository policy"]
      },
      diff: {
        baseRef: "main",
        headRef: "feature/signup-validation",
        files: [
          {
            path: "src/signup.ts",
            status: "modified",
            role: "source",
            additions: 2,
            deletions: 1,
            language: "typescript",
            hunks: [
              {
                oldStart: 10,
                oldLines: 3,
                newStart: 10,
                newLines: 4,
                heading: "validateSignup",
                lines: [
                  {
                    kind: "context",
                    content: "function validateSignup(input) {",
                    oldLineNumber: 10,
                    newLineNumber: 10
                  },
                  {
                    kind: "add",
                    content: "  validateEmail(input.email);",
                    newLineNumber: 11
                  }
                ]
              }
            ]
          }
        ]
      },
      context: {
        packageManager: "pnpm",
        monorepo: {
          tools: ["pnpm", "turbo"],
          configFiles: ["pnpm-workspace.yaml", "turbo.json"],
          workspaceGlobs: ["apps/*", "packages/*"],
          typescriptPathAliases: ["@repo/web/*"],
          packages: [
            {
              path: "apps/web",
              name: "@repo/web"
            }
          ]
        },
        manifests: ["package.json"],
        configFiles: ["tsconfig.json"],
        testFrameworks: ["vitest"],
        publicEntrypoints: ["src/index.ts"],
        publicApiEntrypoints: [
          {
            path: "src/index.ts",
            source: "package-exports",
            packageKey: "exports",
            exportKey: "."
          }
        ],
        apiSnapshot: {
          path: ".critical-gate/api-surface.json",
          schemaVersion: "1.0",
          exportCount: 2,
          entrypoints: ["src/index.ts"]
        },
        repositoryTokenIndex: {
          files: [
            {
              path: "src/signup.ts",
              tokens: [
                {
                  value: "signup",
                  source: "path",
                  raw: "signup"
                }
              ]
            }
          ]
        },
        git: {
          baseRef: "main",
          headRef: "feature/signup-validation"
        }
      },
      findings: [
        {
          id: "test-weakening-001",
          detector: "test-weakening",
          severity: "high",
          confidence: 0.92,
          evidenceStrength: 0.92,
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
            whySuspicious:
              "Agent changes can keep tests green while removing behavioral protection.",
            supportingSignals: [
              "Detector: test-weakening",
              "tests/signup.test.ts:24: Removed assertion"
            ],
            acceptableIf: [
              "The assertion is replaced by an equally specific behavioral assertion."
            ],
            repairHint:
              "Restore the removed behavioral assertion or replace it with an equally specific assertion."
          },
          repairContract: {
            instructions: [
              "Restore the removed behavioral assertion or replace it with an equally specific assertion."
            ],
            allowedFiles: ["tests/signup.test.ts"],
            forbiddenFiles: ["src/signup.ts"],
            successCriteria: [
              "The test-weakening-001 finding no longer appears after rerunning Critical Gate."
            ]
          },
          repair:
            "Restore the removed behavioral assertion or replace it with an equally specific assertion.",
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
        evidenceStrengthSummary: {
          blockingEligibleCount: 1,
          observationModeCount: 0,
          evidenceThresholdSuppressedCount: 0
        },
        confidenceCalibration: {
          blockingEligibleCount: 1,
          observationModeCount: 0,
          confidenceSuppressedCount: 0
        },
        policyApplied: {
          failOn: "high",
          observationDetectors: ["blast-radius"],
          blockingDetectors: ["api-surface"],
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
          evidenceThresholdSuppressedFindingIds: [],
          confidenceSuppressedFindingIds: []
        },
        detectorRuns: [
          {
            detector: "test-weakening",
            status: "findings",
            durationMs: 2,
            findingCount: 1,
            maturity: "review",
            filesInspected: 1
          },
          {
            detector: "blast-radius",
            status: "passed",
            durationMs: 1,
            findingCount: 0,
            maturity: "experimental",
            filesInspected: 1
          }
        ],
        diffCostScore: 32,
        diffCoherenceScore: {
          score: 86,
          drivers: [
            {
              code: "tests-move-with-source",
              label: "Tests changed with source",
              points: 10,
              evidence: ["tests/signup.test.ts"]
            }
          ]
        },
        scopeExpansionScore: {
          score: 4,
          drivers: [
            {
              code: "missing-companions",
              label: "Expected companion files missing",
              points: 1,
              evidence: ["expected-companions:src/signup.ts:tests/signup.test.ts"]
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
          }
        ]
      },
      intentQuality: {
        score: 100,
        warnings: []
      },
      metadata: {
        cliVersion: "0.1.0"
      }
    };

    expect(validateGateResult(result)).toBe(true);
  });

  it("rejects invalid severity and confidence values", () => {
    const result = {
      schemaVersion: GATE_RESULT_SCHEMA_VERSION,
      generatedAt: "2026-06-17T21:15:00.000Z",
      task: {
        source: "cli",
        text: "Add signup validation"
      },
      diff: {
        files: []
      },
      findings: [
        {
          id: "invalid",
          detector: "scope",
          severity: "critical",
          confidence: 2,
          title: "Invalid finding",
          message: "This finding should not pass schema validation.",
          evidence: [
            {
              kind: "metric",
              message: "Invalid confidence"
            }
          ],
          repair: "Use a valid severity and confidence value.",
          tags: ["scope"]
        }
      ],
      summary: {
        decision: "fail",
        findingCount: 1,
        blockerCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        infoCount: 0
      }
    };

    expect(validateGateResult(result)).toBe(false);
    expect(validateGateResult.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instancePath: "/findings/0/severity" }),
        expect.objectContaining({ instancePath: "/findings/0/confidence" })
      ])
    );
  });
});

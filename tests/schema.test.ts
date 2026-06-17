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
        manifests: ["package.json"],
        configFiles: ["tsconfig.json"],
        testFrameworks: ["vitest"],
        publicEntrypoints: ["src/index.ts"],
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
        diffCostScore: 32
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

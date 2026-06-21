import { GATE_RESULT_SCHEMA_VERSION } from "./types.js";

const stringArraySchema = {
  type: "array",
  items: { type: "string" }
} as const;

export const gateResultJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://critical-gate.dev/schemas/gate-result.schema.json",
  title: "Critical Gate Result",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "generatedAt", "task", "diff", "findings", "summary"],
  properties: {
    schemaVersion: { const: GATE_RESULT_SCHEMA_VERSION },
    generatedAt: { type: "string", minLength: 1 },
    task: { $ref: "#/$defs/taskIntent" },
    diff: { $ref: "#/$defs/diff" },
    context: { $ref: "#/$defs/repoContext" },
    findings: {
      type: "array",
      items: { $ref: "#/$defs/finding" }
    },
    summary: { $ref: "#/$defs/gateSummary" },
    intentVerification: { $ref: "#/$defs/intentVerificationSummary" },
    intentQuality: { $ref: "#/$defs/taskIntentQualitySummary" },
    metadata: {
      type: "object",
      additionalProperties: true
    }
  },
  $defs: {
    taskIntent: {
      type: "object",
      additionalProperties: false,
      required: ["source", "text"],
      properties: {
        source: {
          enum: ["cli", "commit", "pull_request", "issue", "codex", "unknown"]
        },
        text: { type: "string", minLength: 1 },
        summary: { type: "string" },
        id: { type: "string" }
      }
    },
    diff: {
      type: "object",
      additionalProperties: false,
      required: ["files"],
      properties: {
        baseRef: { type: "string" },
        headRef: { type: "string" },
        files: {
          type: "array",
          items: { $ref: "#/$defs/diffFile" }
        }
      }
    },
    diffFile: {
      type: "object",
      additionalProperties: false,
      required: ["path", "status", "role", "additions", "deletions", "hunks"],
      properties: {
        path: { type: "string", minLength: 1 },
        status: {
          enum: ["added", "modified", "deleted", "renamed"]
        },
        role: {
          enum: ["source", "test", "config", "docs", "manifest", "lockfile", "generated", "unknown"]
        },
        additions: { type: "integer", minimum: 0 },
        deletions: { type: "integer", minimum: 0 },
        oldPath: { type: "string" },
        newPath: { type: "string" },
        language: { type: "string" },
        hunks: {
          type: "array",
          items: { $ref: "#/$defs/diffHunk" }
        }
      }
    },
    diffHunk: {
      type: "object",
      additionalProperties: false,
      required: ["oldStart", "oldLines", "newStart", "newLines", "lines"],
      properties: {
        oldStart: { type: "integer", minimum: 0 },
        oldLines: { type: "integer", minimum: 0 },
        newStart: { type: "integer", minimum: 0 },
        newLines: { type: "integer", minimum: 0 },
        heading: { type: "string" },
        lines: {
          type: "array",
          items: { $ref: "#/$defs/diffLine" }
        }
      }
    },
    diffLine: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "content"],
      properties: {
        kind: {
          enum: ["add", "delete", "context"]
        },
        content: { type: "string" },
        oldLineNumber: { type: "integer", minimum: 1 },
        newLineNumber: { type: "integer", minimum: 1 }
      }
    },
    repoContext: {
      type: "object",
      additionalProperties: false,
      properties: {
        root: { type: "string" },
        packageManager: {
          enum: ["pnpm", "npm", "yarn", "bun", "unknown"]
        },
        monorepo: { $ref: "#/$defs/monorepoContext" },
        manifests: stringArraySchema,
        configFiles: stringArraySchema,
        testFrameworks: stringArraySchema,
        frameworkPacks: stringArraySchema,
        publicEntrypoints: stringArraySchema,
        apiSnapshot: { $ref: "#/$defs/apiSnapshotSummary" },
        publicApiEntrypoints: {
          type: "array",
          items: { $ref: "#/$defs/publicApiEntrypointSummary" }
        },
        repositoryProfile: { $ref: "#/$defs/repositoryProfile" },
        utilityIndex: { $ref: "#/$defs/utilityIndex" },
        repositoryTokenIndex: { $ref: "#/$defs/repositoryTokenIndex" },
        git: {
          type: "object",
          additionalProperties: false,
          properties: {
            baseRef: { type: "string" },
            headRef: { type: "string" }
          }
        }
      }
    },
    monorepoContext: {
      type: "object",
      additionalProperties: false,
      required: ["configFiles", "workspaceGlobs", "packages"],
      properties: {
        tools: {
          type: "array",
          items: {
            enum: ["pnpm", "turbo", "nx", "lerna"]
          }
        },
        configFiles: stringArraySchema,
        workspaceGlobs: stringArraySchema,
        typescriptPathAliases: stringArraySchema,
        packages: {
          type: "array",
          items: { $ref: "#/$defs/monorepoPackage" }
        }
      }
    },
    monorepoPackage: {
      type: "object",
      additionalProperties: false,
      required: ["path"],
      properties: {
        path: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 }
      }
    },
    apiSnapshotSummary: {
      type: "object",
      additionalProperties: false,
      required: ["path", "schemaVersion", "exportCount", "entrypoints"],
      properties: {
        path: { type: "string", minLength: 1 },
        schemaVersion: { type: "string", minLength: 1 },
        exportCount: { type: "integer", minimum: 0 },
        entrypoints: stringArraySchema
      }
    },
    publicApiEntrypointSummary: {
      type: "object",
      additionalProperties: false,
      required: ["path", "source"],
      properties: {
        path: { type: "string", minLength: 1 },
        source: { type: "string", minLength: 1 },
        packageKey: { type: "string", minLength: 1 },
        exportKey: { type: "string", minLength: 1 },
        condition: { type: "string", minLength: 1 }
      }
    },
    repositoryProfile: {
      type: "object",
      additionalProperties: false,
      required: ["commitCount", "minConfidenceCommitCount", "coChanges"],
      properties: {
        commitCount: { type: "integer", minimum: 0 },
        minConfidenceCommitCount: { type: "integer", minimum: 0 },
        coChanges: {
          type: "array",
          items: { $ref: "#/$defs/repositoryCoChange" }
        }
      }
    },
    repositoryCoChange: {
      type: "object",
      additionalProperties: false,
      required: ["path", "count", "relatedPaths"],
      properties: {
        path: { type: "string", minLength: 1 },
        count: { type: "integer", minimum: 0 },
        relatedPaths: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["path", "count"],
            properties: {
              path: { type: "string", minLength: 1 },
              count: { type: "integer", minimum: 0 }
            }
          }
        }
      }
    },
    utilityIndex: {
      type: "object",
      additionalProperties: false,
      required: ["utilities"],
      properties: {
        utilities: {
          type: "array",
          items: { $ref: "#/$defs/utilityEntry" }
        }
      }
    },
    utilityEntry: {
      type: "object",
      additionalProperties: false,
      required: ["path", "exportedNames"],
      properties: {
        path: { type: "string", minLength: 1 },
        exportedNames: stringArraySchema
      }
    },
    repositoryTokenIndex: {
      type: "object",
      additionalProperties: false,
      required: ["files"],
      properties: {
        files: {
          type: "array",
          items: { $ref: "#/$defs/repositoryTokenFile" }
        }
      }
    },
    repositoryTokenFile: {
      type: "object",
      additionalProperties: false,
      required: ["path", "tokens"],
      properties: {
        path: { type: "string", minLength: 1 },
        tokens: {
          type: "array",
          items: { $ref: "#/$defs/repositoryToken" }
        }
      }
    },
    repositoryToken: {
      type: "object",
      additionalProperties: false,
      required: ["value", "source", "raw"],
      properties: {
        value: { type: "string", minLength: 1 },
        source: {
          enum: ["path", "folder", "package-name", "symbol", "test-name", "markdown-heading"]
        },
        raw: { type: "string", minLength: 1 }
      }
    },
    finding: {
      type: "object",
      additionalProperties: false,
      required: [
        "id",
        "detector",
        "severity",
        "confidence",
        "title",
        "message",
        "evidence",
        "repair",
        "tags"
      ],
      properties: {
        id: { type: "string", minLength: 1 },
        detector: { type: "string", minLength: 1 },
        severity: {
          enum: ["blocker", "high", "medium", "low", "info"]
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        title: { type: "string", minLength: 1 },
        message: { type: "string", minLength: 1 },
        evidence: {
          type: "array",
          minItems: 1,
          items: { $ref: "#/$defs/findingEvidence" }
        },
        reasonChain: { $ref: "#/$defs/findingReasonChain" },
        repairContract: { $ref: "#/$defs/findingRepairContract" },
        repair: { type: "string", minLength: 1 },
        tags: {
          type: "array",
          items: {
            enum: [
              "scope",
              "dependency",
              "api",
              "test",
              "secret",
              "config",
              "rewrite",
              "convention",
              "utility",
              "dead-code",
              "duplicate-code"
            ]
          }
        }
      }
    },
    findingReasonChain: {
      type: "object",
      additionalProperties: false,
      required: [
        "whatHappened",
        "whySuspicious",
        "supportingSignals",
        "acceptableIf",
        "repairHint"
      ],
      properties: {
        whatHappened: { type: "string", minLength: 1 },
        whySuspicious: { type: "string", minLength: 1 },
        supportingSignals: stringArraySchema,
        acceptableIf: stringArraySchema,
        repairHint: { type: "string", minLength: 1 }
      }
    },
    findingRepairContract: {
      type: "object",
      additionalProperties: false,
      required: ["instructions", "allowedFiles", "forbiddenFiles", "successCriteria"],
      properties: {
        instructions: {
          type: "array",
          items: { type: "string", minLength: 1 }
        },
        allowedFiles: {
          type: "array",
          items: { type: "string", minLength: 1 }
        },
        forbiddenFiles: {
          type: "array",
          items: { type: "string", minLength: 1 }
        },
        successCriteria: {
          type: "array",
          items: { type: "string", minLength: 1 }
        }
      }
    },
    findingEvidence: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "message"],
      properties: {
        kind: {
          enum: ["file", "line", "symbol", "manifest", "metric", "history"]
        },
        message: { type: "string", minLength: 1 },
        path: { type: "string" },
        startLine: { type: "integer", minimum: 1 },
        endLine: { type: "integer", minimum: 1 },
        symbol: { type: "string" },
        data: {
          type: "object",
          additionalProperties: true
        }
      }
    },
    gateSummary: {
      type: "object",
      additionalProperties: false,
      required: [
        "decision",
        "findingCount",
        "blockerCount",
        "highCount",
        "mediumCount",
        "lowCount",
        "infoCount"
      ],
      properties: {
        decision: {
          enum: ["pass", "fail"]
        },
        findingCount: { type: "integer", minimum: 0 },
        blockerCount: { type: "integer", minimum: 0 },
        highCount: { type: "integer", minimum: 0 },
        mediumCount: { type: "integer", minimum: 0 },
        lowCount: { type: "integer", minimum: 0 },
        infoCount: { type: "integer", minimum: 0 },
        diffCostScore: { type: "number", minimum: 0, maximum: 100 },
        scopeExpansionScore: { $ref: "#/$defs/scopeExpansionScore" },
        diffCoherenceScore: { $ref: "#/$defs/diffCoherenceScore" },
        confidenceCalibration: { $ref: "#/$defs/confidenceCalibrationSummary" }
      }
    },
    confidenceCalibrationSummary: {
      type: "object",
      additionalProperties: false,
      required: ["blockingEligibleCount", "observationModeCount", "confidenceSuppressedCount"],
      properties: {
        blockingEligibleCount: { type: "integer", minimum: 0 },
        observationModeCount: { type: "integer", minimum: 0 },
        confidenceSuppressedCount: { type: "integer", minimum: 0 }
      }
    },
    scopeExpansionScore: {
      type: "object",
      additionalProperties: false,
      required: ["score", "drivers"],
      properties: {
        score: { type: "number", minimum: 0, maximum: 10 },
        drivers: {
          type: "array",
          items: { $ref: "#/$defs/scopeExpansionDriver" }
        }
      }
    },
    scopeExpansionDriver: {
      type: "object",
      additionalProperties: false,
      required: ["code", "label", "points"],
      properties: {
        code: { type: "string", minLength: 1 },
        label: { type: "string", minLength: 1 },
        points: { type: "number", minimum: 0 },
        evidence: stringArraySchema
      }
    },
    diffCoherenceScore: {
      type: "object",
      additionalProperties: false,
      required: ["score", "drivers"],
      properties: {
        score: { type: "number", minimum: 0, maximum: 100 },
        drivers: {
          type: "array",
          items: { $ref: "#/$defs/diffCoherenceDriver" }
        }
      }
    },
    diffCoherenceDriver: {
      type: "object",
      additionalProperties: false,
      required: ["code", "label", "points"],
      properties: {
        code: { type: "string", minLength: 1 },
        label: { type: "string", minLength: 1 },
        points: { type: "number", minimum: 0 },
        evidence: stringArraySchema
      }
    },
    intentVerificationSummary: {
      type: "object",
      additionalProperties: false,
      required: [
        "requestedClasses",
        "observedClasses",
        "unexpectedClasses",
        "coverage",
        "explanationCodes"
      ],
      properties: {
        requestedClasses: stringArraySchema,
        observedClasses: stringArraySchema,
        unexpectedClasses: stringArraySchema,
        coverage: {
          enum: ["none", "partial", "matched"]
        },
        explanationCodes: stringArraySchema
      }
    },
    taskIntentQualitySummary: {
      type: "object",
      additionalProperties: false,
      required: ["score", "warnings"],
      properties: {
        score: { type: "number", minimum: 0, maximum: 100 },
        warnings: {
          type: "array",
          items: { $ref: "#/$defs/taskIntentQualityWarning" }
        }
      }
    },
    taskIntentQualityWarning: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message", "suggestion", "penalty"],
      properties: {
        code: {
          enum: ["too-short", "vague-task", "missing-target", "generic-only"]
        },
        message: { type: "string", minLength: 1 },
        suggestion: { type: "string", minLength: 1 },
        penalty: { type: "number", minimum: 0 }
      }
    }
  }
} as const;

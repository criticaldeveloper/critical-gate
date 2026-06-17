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
        manifests: stringArraySchema,
        configFiles: stringArraySchema,
        testFrameworks: stringArraySchema,
        publicEntrypoints: stringArraySchema,
        repositoryProfile: { $ref: "#/$defs/repositoryProfile" },
        utilityIndex: { $ref: "#/$defs/utilityIndex" },
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
        diffCostScore: { type: "number", minimum: 0, maximum: 100 }
      }
    }
  }
} as const;

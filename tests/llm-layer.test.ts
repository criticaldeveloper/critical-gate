import {
  MemoryLlmCache,
  buildExplanationPrompt,
  createModelInputArtifact,
  explainFindingsWithModel,
  redactForModel,
  type GateResult,
  type LlmProvider
} from "../src/index.js";

const result: GateResult = {
  schemaVersion: "1.0",
  generatedAt: "2026-06-18T00:00:00.000Z",
  task: {
    source: "pull_request",
    text: "Add signup validation using token sk-abcdefghijklmnopqrstuvwxyz"
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
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 2,
            lines: [
              {
                kind: "context",
                content: "const WHOLE_REPO_ONLY_SECRET = 'never send this hunk body';",
                oldLineNumber: 1,
                newLineNumber: 1
              },
              {
                kind: "add",
                content: "export const signup = true;",
                newLineNumber: 2
              }
            ]
          }
        ]
      }
    ]
  },
  findings: [
    {
      id: "secret-path-001",
      detector: "secret-path",
      severity: "blocker",
      confidence: 0.98,
      title: "Secret-like token added",
      message: "The diff adds a token from /Users/marc/project/.env.",
      repair: "Remove the token and load it from the runtime secret store.",
      tags: ["secret"],
      evidence: [
        {
          kind: "line",
          path: "src/signup.ts",
          startLine: 2,
          endLine: 2,
          message: "API_TOKEN=sk-abcdefghijklmnopqrstuvwxyz and email marc@example.com"
        }
      ]
    }
  ],
  summary: {
    decision: "fail",
    findingCount: 1,
    blockerCount: 1,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    infoCount: 0,
    diffCostScore: 23
  }
};

describe("optional LLM layer", () => {
  it("creates a compact artifact without diff hunks or repo-wide content", () => {
    const artifact = createModelInputArtifact({
      ...result,
      context: {
        repositoryTokenIndex: {
          files: [
            {
              path: "src/unrelated.ts",
              tokens: [
                {
                  value: "unrelated",
                  source: "symbol",
                  raw: "WHOLE_REPOSITORY_TREE_SHOULD_NOT_BE_SENT"
                }
              ]
            }
          ]
        }
      }
    });
    const serialized = JSON.stringify(artifact);

    expect(Object.keys(artifact).sort()).toEqual([
      "artifactVersion",
      "diff",
      "findings",
      "summary",
      "task"
    ]);
    expect(Object.keys(artifact.diff).sort()).toEqual(["baseRef", "files", "headRef", "totals"]);
    expect(Object.keys(artifact.diff.files[0] ?? {}).sort()).toEqual([
      "additions",
      "deletions",
      "language",
      "path",
      "role",
      "status"
    ]);
    expect(Object.keys(artifact.findings[0] ?? {}).sort()).toEqual([
      "confidence",
      "detector",
      "evidence",
      "id",
      "message",
      "repair",
      "severity",
      "tags",
      "title"
    ]);
    expect(Object.keys(artifact.findings[0]?.evidence[0] ?? {}).sort()).toEqual([
      "endLine",
      "kind",
      "message",
      "path",
      "startLine",
      "symbol"
    ]);
    expect(artifact.diff.files).toEqual([
      {
        path: "src/signup.ts",
        status: "modified",
        role: "source",
        additions: 2,
        deletions: 1,
        language: "typescript"
      }
    ]);
    expect(serialized).not.toContain("hunks");
    expect(serialized).not.toContain("WHOLE_REPO_ONLY_SECRET");
    expect(serialized).not.toContain("never send this hunk body");
    expect(serialized).not.toContain("repositoryTokenIndex");
    expect(serialized).not.toContain("src/unrelated.ts");
    expect(serialized).not.toContain("WHOLE_REPOSITORY_TREE_SHOULD_NOT_BE_SENT");
  });

  it("redacts sensitive values before building prompts", () => {
    const artifact = createModelInputArtifact(result);
    const prompt = buildExplanationPrompt(artifact);
    const serializedPrompt = JSON.stringify(prompt);

    expect(serializedPrompt).toContain("[redacted-token]");
    expect(serializedPrompt).toContain("[redacted-path]");
    expect(serializedPrompt).toContain("[redacted-email]");
    expect(serializedPrompt).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
    expect(serializedPrompt).not.toContain("/Users/marc/project");
    expect(serializedPrompt).not.toContain("marc@example.com");
  });

  it("redacts prompt-visible artifact identifiers, paths, refs, symbols, and repairs", () => {
    const artifact = createModelInputArtifact({
      ...result,
      task: {
        source: "cli",
        text: "Fix signup for marc@example.com using api_key=abcdef1234567890"
      },
      diff: {
        ...result.diff,
        baseRef: "C:\\Users\\Marc\\repo",
        headRef: "feature/marc@example.com",
        files: [
          {
            ...result.diff.files[0]!,
            path: "C:\\Users\\Marc\\repo\\src\\signup.ts"
          }
        ]
      },
      findings: [
        {
          ...result.findings[0]!,
          id: "secret-path:C:\\Users\\Marc\\repo\\src\\signup.ts:token",
          title: "Internal URL http://localhost:3000 added",
          message: "Token from C:\\Users\\Marc\\repo\\.env sent to marc@example.com.",
          repair: "Remove api_key=abcdef1234567890 and use an environment variable.",
          evidence: [
            {
              kind: "symbol",
              path: "C:\\Users\\Marc\\repo\\src\\signup.ts",
              startLine: 2,
              endLine: 2,
              symbol: "notify_marc@example.com",
              message:
                "API_TOKEN=sk-abcdefghijklmnopqrstuvwxyz in C:\\Users\\Marc\\repo\\.env for marc@example.com"
            }
          ]
        }
      ]
    });
    const serializedPrompt = JSON.stringify(buildExplanationPrompt(artifact));

    expect(serializedPrompt).toContain("[redacted-path]");
    expect(serializedPrompt).toContain("[redacted-email]");
    expect(serializedPrompt).toContain("[redacted-token]");
    expect(serializedPrompt).toContain("api_key=[redacted]");
    expect(serializedPrompt).toContain("[redacted-url]");
    expect(serializedPrompt).not.toContain("C:\\Users\\Marc\\repo");
    expect(serializedPrompt).not.toContain("marc@example.com");
    expect(serializedPrompt).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
    expect(serializedPrompt).not.toContain("abcdef1234567890");
    expect(serializedPrompt).not.toContain("http://localhost:3000");
  });

  it("honors artifact and output budgets", async () => {
    const requests: Array<Parameters<LlmProvider["complete"]>[0]> = [];
    const provider: LlmProvider = {
      name: "fake",
      complete: async (request) => {
        requests.push(request);
        return { text: "repair signup token", model: "fake-model" };
      }
    };

    await explainFindingsWithModel(result, provider, {
      cache: new MemoryLlmCache(),
      budget: {
        maxInputChars: 700,
        maxOutputTokens: 123
      }
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.maxOutputTokens).toBe(123);
    expect(requests[0]?.user.length).toBeLessThanOrEqual(1000);
  });

  it("caches provider responses by artifact and prompt", async () => {
    let calls = 0;
    const provider: LlmProvider = {
      name: "fake",
      complete: async () => {
        calls += 1;
        return { text: "cached explanation", model: "fake-model" };
      }
    };
    const cache = new MemoryLlmCache();

    const first = await explainFindingsWithModel(result, provider, { cache });
    const second = await explainFindingsWithModel(result, provider, { cache });

    expect(calls).toBe(1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.cacheKey).toBe(first.cacheKey);
    expect(second.text).toBe("cached explanation");
  });

  it("redacts common model-sensitive values directly", () => {
    expect(
      redactForModel(
        "password=hunter2token token=github_pat_abcdefghijklmnopqrstuvwxyz and http://localhost:3000"
      )
    ).toBe("password=[redacted] token=[redacted] and [redacted-url]");
  });
});

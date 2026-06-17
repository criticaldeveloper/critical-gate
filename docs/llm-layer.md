# Optional LLM Layer

The LLM layer is an optional interpreter that runs after deterministic detectors. It must never be
the detector of record, and it must not receive the whole repository.

## Model Input Artifact

`createModelInputArtifact` builds a compact artifact from a `GateResult`:

- Task source, id, and redacted task text.
- Changed file metadata: path, status, role, language, additions, and deletions.
- Diff totals.
- Gate summary.
- Top detector findings with redacted evidence messages.

The artifact intentionally excludes:

- Diff hunks.
- Full file contents.
- Repository-wide source trees.
- Dependency trees or package source.
- Unbounded nearby context.

## Redaction

`redactForModel` strips common sensitive values before prompt construction:

- Provider tokens.
- Secret-like assignments.
- Absolute local paths.
- Internal or localhost URLs.
- Email addresses.

Detector evidence should already be safe when possible, but the model layer applies its own
redaction because model prompts are a stricter boundary.

## Provider Interface

The core package exposes a small provider interface:

```ts
const provider = {
  name: "example",
  complete: async (request) => ({
    text: await callModel(request.system, request.user),
    model: "example-model"
  })
};
```

Callers opt in explicitly:

```ts
const explanation = await explainFindingsWithModel(result, provider);
```

No provider is bundled or enabled by default. CI and Codex hooks should keep deterministic findings
as the merge decision source.

## Prompt Shape

`buildExplanationPrompt` asks the model to explain the supplied artifact only. The expected output is
plain text with:

1. Why the gate failed or passed.
2. The top repairs in priority order.
3. Any uncertainty caused by missing context.

## Cache And Budget Controls

The model request uses:

- Stable cache keys from provider name, prompt version, and artifact.
- `MemoryLlmCache` for opt-in local reuse.
- `ModelBudget` limits for task length, finding count, evidence count, evidence message length,
  input artifact size, and output token count.

Recommended defaults:

- Keep model mode disabled in CI until detector precision is proven.
- Use a provider-specific persistent cache only after redaction and retention requirements are clear.
- Lower `maxFindings` and `maxEvidencePerFinding` before raising token budgets.

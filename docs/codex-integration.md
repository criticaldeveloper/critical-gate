# Codex Integration

## Integration Goal

Critical Gate should make Codex safer by turning final diff checks into a repair loop.

Codex works on a task, the gate runs over the resulting diff, and high-risk findings are returned as focused repair instructions.

## Recommended Surfaces

### AGENTS.md

Use `AGENTS.md` for durable repository guidance:

- Product identity.
- Engineering principles.
- Detector priorities.
- What not to build.
- Verification expectations.

This repository includes `AGENTS.md` for that purpose.

### CLI

The CLI is the canonical integration surface. Other integrations should call the CLI instead of reimplementing analysis.

Example future shape:

```bash
critical-gate check --task "Add signup validation" --base origin/main --format markdown
```

### Codex Hook

Use a Codex `Stop` hook after the CLI exists and findings are precise enough.

Future example:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ./bin/critical-gate.js hook --base origin/main",
            "timeout": 60,
            "statusMessage": "Running Critical Gate"
          }
        ]
      }
    ]
  }
}
```

The hook command should:

- Run deterministic checks.
- Return pass when the diff is acceptable.
- Return compact repair guidance when blockers exist.
- Avoid dumping long reports into the agent loop.

### Codex Exec And CI

Use noninteractive execution for scripts and CI workflows when Codex needs to consume or repair findings.

The gate should emit machine-readable JSON so downstream Codex runs or CI jobs can decide what to do.

## Repair Prompt Shape

Repair prompts should be short and evidence-backed.

Good:

```text
Critical Gate found blocker findings:

1. Unjustified production dependency: axios was added in package.json, but the task only asked to add a validation rule and the repo already uses fetch wrappers in src/api.
Repair: remove axios unless the task explicitly requires it; use the existing API client if possible.

2. Test weakening: tests/signup.test.ts removed expect(error.message).toContain("email").
Repair: restore behavioral assertion or replace it with an equally specific assertion.
```

Bad:

```text
Review the whole PR for quality issues.
```

## Hook Safety

The hook should not mutate files directly. It should report findings and let Codex perform scoped repairs.

Keep hook output compact:

- Top blockers only.
- Evidence.
- Minimal repair action.
- Link or path to full JSON report if needed.

## Integration Order

1. Build CLI.
2. Add stable JSON and Markdown reports.
3. Add compact repair reporter.
4. Add hook mode.
5. Add example Codex hook configuration.
6. Add CI/GitHub integration.
7. Add optional LLM explanation.

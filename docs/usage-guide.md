# Usage Guide

This guide explains how to use Critical Gate in local development, CI, Codex repair loops, and VS
Code.

## Mental Model

Critical Gate answers one question:

```text
Does this diff satisfy the task without taking unsafe or unjustified liberties?
```

It does not try to review every line like a human reviewer. It focuses on evidence-backed integrity
signals:

- What files changed?
- Do those files match the task intent?
- Did the diff change tests, public exports, dependencies, config, secrets, or conventions?
- Is the amount of churn reasonable for the task?
- Can a finding be repaired with specific, local guidance?

## Local CLI Workflow

Run the CLI directly from npm:

```bash
npx critical-gate --version
```

Initialize a repository for observe-only rollout and evidence collection:

```bash
npx critical-gate init --install
```

This adds package scripts, an observe-only `.critical-gate.json`, durable evidence export files,
advisory GitHub SARIF workflow, and managed `AGENTS.md` instructions. Omit `--install` when you want
to review generated files without changing package dependencies.

Run a Markdown report against the target branch:

```bash
npx critical-gate check \
  --task "Add email validation to signup form" \
  --base main \
  --format markdown
```

Write JSON for automation:

```bash
npx critical-gate check \
  --task "Add email validation to signup form" \
  --base main \
  --format json \
  --output critical-gate.json
```

Write SARIF for code scanning:

```bash
npx critical-gate check \
  --task "Add email validation to signup form" \
  --base main \
  --format sarif \
  --output critical-gate.sarif
```

Write compact repair guidance for agents:

```bash
npx critical-gate check \
  --task "Add email validation to signup form" \
  --base main \
  --format repair
```

Write a compact GitHub PR comment:

```bash
npx critical-gate check \
  --task "Add email validation to signup form" \
  --base main \
  --format pr-comment \
  --output critical-gate-pr-comment.md
```

## Choosing Good Task Intent

Task intent is part of the input contract. The gate uses it to estimate expected scope and identify
surprising changes.

Good examples:

```text
Add email validation to signup form without changing authentication flow.
Fix the VS Code Activity Bar icon so it renders visibly in dark themes.
Document CLI, GitHub Action, Codex hook, and VS Code installation.
```

Weak examples:

```text
Update code.
Fix stuff.
Improve project.
```

Critical Gate reports task intent quality warnings for vague or generic task text. These warnings do
not fail the gate by themselves; they explain why a diff may be harder to judge and suggest adding a
feature, module, file family, user flow, or public API target.

When running in CI, prefer PR titles plus short PR-body context. If a PR intentionally changes
configuration, dependencies, or public API, include that in the task text so the gate can distinguish
expected blast radius from drift.

## Understanding Reports

A report includes:

- **Decision**: `pass` or `fail`.
- **Changed files**: file role, status, additions, and deletions.
- **Findings**: severity, detector, confidence, message, evidence, and repair guidance.
- **Diff Cost Score**: a rough signal for blast radius and churn.
- **Diff Coherence Score**: a 0-100 positive signal for how well the changed files, support files,
  churn, and findings fit the task intent.

JSON output also includes confidence calibration counts. These show whether high-risk findings were
eligible to block, kept in observation mode, or suppressed because confidence was below the
detector's calibrated threshold.

Use `--format pr-comment` when the audience is a pull request discussion. It keeps the same
evidence-backed data but groups it into blocking findings, observations, expected support changes,
and the strongest scope drivers.

Severity levels:

- `blocker`: should fail by default.
- `high`: should fail by default or require explicit acknowledgement.
- `medium`: should be reviewed, tuned, or justified.
- `low`: informational unless combined with other risks.
- `info`: context for humans and dashboards.

## Repository Learning Controls

Critical Gate can record explicit repository knowledge in `.critical-gate.json`. These entries are
reviewable policy-as-code, not hidden global suppressions.

Accept an exact finding when the team has reviewed it and wants future runs with the same finding id
to stay quiet:

```bash
npx critical-gate accept \
  --finding "scope:src/generated/client.ts" \
  --reason "Generated client file is expected for API schema refreshes."
```

Teach expected support files when a repository has a normal companion relationship that the generic
detectors do not know yet:

```bash
npx critical-gate teach \
  --id "i18n-for-ui-copy" \
  --when-changed "src/features/**/*.tsx" \
  --allow "src/i18n/**/*.json,locales/**/*.json" \
  --reason "UI copy changes require translation updates."
```

The next `check` or `hook` run applies those rules and reports applied rule ids in JSON metadata.
Use this for durable team conventions; do not use it to hide one-off risky diffs that should be
fixed or split.

## Policy As Code

Create a starter repository policy:

```bash
critical-gate init-policy
git add .critical-gate.json
```

The policy section controls reviewable defaults:

```json
{
  "policy": {
    "failOn": "high",
    "detectorOverrides": [
      {
        "detector": "expected-companions",
        "mode": "observation",
        "reason": "Useful guidance during rollout, not blocking yet."
      }
    ],
    "expectedCompanions": [
      {
        "id": "source-test-companion",
        "whenChanged": "src/**/*.ts",
        "allow": ["tests/**/*.test.ts", "src/**/*.test.ts"],
        "reason": "Source changes commonly need behavior tests.",
        "createdAt": "2026-06-19T10:00:00.000Z"
      }
    ],
    "allowedSupportFiles": [
      {
        "id": "docs-for-config",
        "whenChanged": ".github/workflows/**",
        "allow": ["docs/**/*.md", "README.md", "CHANGELOG.md"],
        "reason": "Workflow changes may include visible operational docs.",
        "createdAt": "2026-06-19T10:00:00.000Z"
      }
    ]
  }
}
```

CLI flags such as `--fail-on blocker` still override policy for a single run. Use policy for team
defaults and use `accept` or `teach` commands for reviewable local exceptions.
See [policy-file.md](policy-file.md) for supported keys, validated examples, and current policy
limits.

## Framework Packs

Critical Gate includes deterministic framework packs for React, Next.js, Angular, Astro, Lit, Nest,
Express, Vite, and Storybook. Packs add ecosystem-specific expected companion hints such as
component tests, stories, Angular templates, Nest specs, or framework docs.

Packs are auto-detected from `package.json` dependencies and common framework config files when
possible. You can also force packs in `.critical-gate.json`:

```json
{
  "frameworkPacks": ["react", "storybook", "vite"]
}
```

Framework-pack findings use the existing `expected-companions` detector. They are evidence-backed,
non-blocking by default, and intended to explain normal support files for the stack rather than
replace repository-specific learning rules.

## Normal Change Model

Critical Gate also derives normal change patterns from git history. These are typed relationships
such as source/test, component/story, translation/UI, config/docs, package/lockfile, and source/docs.
They help the gate distinguish normal support changes from unrelated drift and make missing
companion evidence clearer.

The model is deterministic and local. It uses co-change support and confidence from repository
history, and it stays quiet when the repository does not have enough history to be reliable.

## Monorepo Support

Critical Gate detects common JavaScript and TypeScript monorepo layouts from
`pnpm-workspace.yaml`, package `workspaces`, `turbo.json`, `nx.json`, and `lerna.json`. The JSON
result includes `context.monorepo` with detected tools, config files, workspace globs, changed
package owners, and root TypeScript `compilerOptions.paths` aliases when present.

This is ownership context, not a separate finding. It helps later detector and policy decisions
judge whether a diff stayed inside one package or crossed workspace boundaries.

## Public API Snapshots

Libraries and shared packages can commit a deterministic public API snapshot:

```bash
critical-gate snapshot-api
git add .critical-gate/api-surface.json
```

The command infers public entrypoints from `package.json` `exports`, `main`, `module`, `types`,
`browser`, and `bin` fields, then falls back to common index files when package metadata does not
declare a public surface. You can pin entrypoints explicitly:

```bash
critical-gate snapshot-api --entrypoint src/index.ts --entrypoint src/testing.ts
```

Durable repository policy can also declare explicit public API entrypoints:

```json
{
  "policy": {
    "publicApi": {
      "entrypoints": ["src/index.ts", "src/testing.ts"]
    }
  }
}
```

Once committed, normal checks load `.critical-gate/api-surface.json` automatically. If a diff removes
a snapshotted export, changes a public signature, or adds an export to a snapshotted entrypoint, the
gate expects visible contract evidence: a snapshot update, changelog, changeset, migration note, or
similar documentation in the same diff.

## Reviewer Checklist

Markdown and PR-comment reports include a concise reviewer checklist derived from findings, changed
file roles, intent quality, and coherence scores. The checklist is not a generic review template; it
is a short handoff of evidence-backed prompts such as resolving blocking findings, checking changed
tests still assert behavior, confirming dependency changes, or verifying config changes include
operational context.

## Local Git Hooks

Use local hooks for lightweight pre-merge guardrails:

```bash
critical-gate install-hooks
```

The generated `pre-commit` hook checks staged changes only and fails on blocker findings. The
generated `pre-push` hook checks the branch against `${CRITICAL_GATE_BASE:-origin/main}` and fails
on high or blocker findings. The files are plain shell scripts under `.git/hooks` so teams can
review and adapt them before relying on them.

For vulnerability reporting and sensitive-data handling expectations, see
[../SECURITY.md](../SECURITY.md).

## Common Examples

### Small Feature With Expected Source And Test Changes

```bash
npx critical-gate check \
  --task "Add username length validation to signup form and cover it with tests" \
  --base origin/main \
  --format markdown
```

Expected result: source and test changes are normal. A dependency addition or CI config edit would be
surprising unless the task explains it.

### Dependency Addition

```bash
npx critical-gate check \
  --task "Add CSV export using the existing file writer utilities" \
  --base origin/main \
  --format markdown
```

If the diff adds a new CSV library without justification, Critical Gate should flag it. Repair
guidance should point toward removing the dependency, using existing utilities, or documenting why
the new package is necessary.

### Test Weakening

```bash
npx critical-gate check \
  --task "Refactor signup validation internals without changing behavior" \
  --base origin/main \
  --format markdown
```

If assertions disappear, tests become skipped, or matchers become less specific, the gate should
report test-integrity findings.

### Public API Change

```bash
npx critical-gate check \
  --task "Expose a new parseReport helper and document the API change" \
  --base origin/main \
  --format markdown
```

Public exports are acceptable when the task and docs acknowledge them. Silent removals or signature
changes should be flagged.

## VS Code Workflow

Install the Marketplace extension:

<https://marketplace.visualstudio.com/items?itemName=criticaldeveloper.critical-gate-vscode>

Open any local git repository, then use:

- Activity Bar: `Critical Gate > Gate Runs`.
- Command Palette: `Critical Gate: Run Check`.
- Output panel: `Critical Gate`.
- Problems panel: file diagnostics from findings.

The dashboard shows:

- Latest decision.
- Files checked.
- Finding count.
- Scope Expansion Score.
- Finding cards with evidence and repair actions.
- Changed files.
- Recent run history.

The `Analysis` tree shows the same run as native VS Code tree items: latest run metrics, findings by
detector, changed clusters, missing companions, existing-solution signals, changed files, and recent
runs. After a VS Code reload, the extension restores the last report and run history as historical
state, but it does not restore Problems diagnostics as fresh findings. Run the gate again when you
need diagnostics for the current diff.

Contextual actions appear where the finding has matching evidence:

- Existing-solution findings can open the existing repository implementation.
- Missing-companion findings can open the expected companion path when it exists.
- Blast-radius findings can open a compact cluster report or be accepted locally in VS Code
  workspace storage.
- All findings with file evidence can open evidence and copy a repair prompt.

The status bar summarizes the most important latest-run signal. A clean result shows
`Critical Gate: clean`; larger or risky diffs may show the Scope Expansion Score, unexpected
clusters, missing companions, or API-surface changes. Hover the status item for counts, timestamps,
and top scope drivers. Click it to open the latest report after a run.

The Diff Coherence Score is intentionally evidence-backed and additive. A high score means the diff
looks contained, expected companions are present, churn fits the task size, and no high-risk detector
fired. A low score is not a separate detector; it is a summary of the concrete signals already shown
in changed files and findings.

Useful settings:

- `criticalGate.task`: preset task intent so runs do not prompt.
- `criticalGate.base`: base ref or SHA.
- `criticalGate.cliPath`: optional custom CLI path. Leave empty to use the bundled analyzer.
- `criticalGate.refreshMode`: `manual` or `onSave`.
- `criticalGate.refreshDebounceMs`: debounce for save-triggered runs.

## Codex Hook Workflow

The hook mode is designed for repair loops:

```bash
npx critical-gate hook --base main
```

When findings fail the gate, the hook emits compact repair guidance instead of a long review. Codex
or another agent can use that guidance to make a scoped repair and rerun the gate.

Each failing finding includes an agent repair contract with deterministic instructions, allowed
files, forbidden files, and success criteria. The allowed files come from finding evidence, and the
forbidden files are other changed files that should not be touched while fixing that finding unless
the task intent is expanded.

For consumer repositories, configure the hook command to run `npx critical-gate hook --base main` or
a project-local wrapper. This repository's `.codex/hooks.json` is a source-mode dogfood example that
builds the local checkout before running the hook; review any hook command before trusting it in
Codex CLI.

## GitHub Action Workflow

For pull requests, run Critical Gate with SARIF upload and fail only after uploading results:

```yaml
- id: critical-gate
  uses: criticaldeveloper/critical-gate@v2
  continue-on-error: true
  with:
    task: ${{ github.event.pull_request.title }}
    base: ${{ github.event.pull_request.base.sha }}
    format: sarif
    output: critical-gate.sarif

- uses: github/codeql-action/upload-sarif@v4
  if: always() && hashFiles('critical-gate.sarif') != ''
  with:
    sarif_file: critical-gate.sarif

- if: steps.critical-gate.outcome == 'failure'
  run: exit 1
```

Use `fetch-depth: 0` on checkout so base diffs and repository history are available.

## Rollout Advice

Start with the default threshold and focus on high-confidence findings. Review medium findings for a
few weeks before making them blocking. Tune task text and repository docs when the gate lacks
context.

Good rollout sequence:

1. Run `npx critical-gate init --install` to create observe-only setup and evidence exports.
2. Run locally on AI-generated diffs with specific task text.
3. Add the VS Code extension for developer feedback and one-click repository initialization.
4. Add GitHub Action SARIF upload with default thresholds.
5. Review noisy findings and tune task text, repository docs, or `.critical-gate.json` policy.
6. Add Codex hook enforcement where compact repair loops are useful.
7. Promote observation-friendly detector families only after dogfooding shows acceptable precision.

New detector families start as observation-friendly by default. They still report evidence and
repair guidance, but they do not fail the gate unless promoted. Promote a detector family in
`.critical-gate.json` after dogfooding:

```json
{
  "rollout": {
    "blockingDetectors": ["expected-companions"]
  }
}
```

Promotion does not bypass confidence calibration. A promoted detector still needs a high or blocker
severity finding with enough confidence to fail the gate.

## Troubleshooting

### The CLI reports no changed files

Make sure the diff is committed or present relative to the selected base, and that `--base` points at
the branch or SHA you expect.

### The VS Code extension cannot run

Build the CLI in the opened workspace:

```bash
pnpm build
```

Marketplace installs use the bundled analyzer by default. Set `criticalGate.cliPath` only when
testing a custom local CLI build.

### The dashboard asks for task intent every run

Set `criticalGate.task` in workspace settings.

### GitHub Action has shallow history

Use:

```yaml
with:
  fetch-depth: 0
```

### SARIF uploads but the job still passes

Keep the Critical Gate step as `continue-on-error: true` so SARIF uploads, then add a final step that
fails when the gate step outcome is failure.

### Repository knowledge looks stale

Critical Gate caches repository history and solution indexes under `.critical-gate/cache/` for
faster warm runs. The cache is keyed by refs and repository fingerprints, but you can bypass it while
debugging:

```bash
CRITICAL_GATE_DISABLE_CACHE=true npx critical-gate check --task "Fix signup validation"
```

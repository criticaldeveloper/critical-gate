# Critical Gate

Critical Gate is a repository-aware diff integrity gate for AI-assisted development. It checks
whether an agent-produced change is acceptably scoped, justified, and safe for the repository it
lands in.

It is not a generic AI code reviewer. Critical Gate is an enforcement layer for the final diff: it
looks for evidence-backed risks such as unrelated edits, unnecessary rewrites, unjustified
dependencies, weakened tests, silent public API changes, hardcoded secrets, environment leaks, and
configuration changes without operational context.

## Why It Matters

AI coding agents can follow instructions, but instructions do not prove that the resulting diff
stayed inside the requested task. A change can compile and still be dangerous because it widened the
blast radius, changed repository contracts, or quietly weakened tests.

Critical Gate gives teams a cheap deterministic-first checkpoint before merge. The goal is to catch
high-risk agent failure patterns with concrete evidence and repair guidance, while keeping noise low
enough to run locally, in Codex loops, and in CI.

## What It Checks

Current detectors focus on TypeScript and JavaScript repositories:

- Unrelated or unexpected file changes for the task intent.
- Large rewrites for small requests.
- New dependencies without task or documentation justification.
- Test weakening, removed assertions, skipped tests, and weaker matchers.
- Hardcoded secrets, internal hosts, absolute paths, and environment-specific leaks.
- Silent public export/API surface changes.
- Build, lint, test, CI, or config changes without explanation.
- Unusual historical co-change patterns.
- Repository convention drift and utility reinvention signals.

Every finding includes severity, confidence, evidence, tags, and a repair hint that another agent or
developer can act on.

## Supported Scope

Current support is strongest for TypeScript and JavaScript repositories with Git history and
package-manager metadata available. The best-covered ecosystems are Node-based projects using
common TS/JS source, test, package manifest, lockfile, config, and CI patterns.

Experimental support includes framework-aware heuristics for patterns seen in dogfooding, such as
Astro-style content contracts and repository-specific history or utility reuse signals. These checks
start conservatively and should stay in observation mode until a repository has enough clean runs.

Out of scope for the current release stage:

- Deep semantic analysis for non-TS/JS languages.
- Whole-repository LLM scanning.
- Broad vulnerability scanning beyond lightweight diff-only secret and path checks.
- Treating current internal dogfood metrics as a broad external benchmark.

Critical Gate is useful today as a pre-review integrity gate for agent-produced TS/JS diffs, but it
is still pre-stable. Roll it out progressively before making it a hard organization-wide merge
requirement.

## Concrete Examples

Critical Gate is most useful when an AI-generated diff looks plausible at a glance but breaks the
shape of the task.

### Dependency Drift

Task:

```text
Add CSV export using the existing file writer utilities.
```

Risky diff:

- Adds `papaparse` or another production dependency.
- Changes `package.json` and the lockfile.
- Does not document why the existing repository utilities are insufficient.

What Critical Gate reports:

- The manifest changed.
- A dependency was added.
- The task did not ask for a dependency.
- Repair guidance asks the agent to remove the package, use existing utilities, or add explicit
  justification.

### Test Weakening

Task:

```text
Refactor signup validation internals without changing behavior.
```

Risky diff:

```diff
- expect(result.error.message).toContain("email is required");
+ expect(result.error).toBeDefined();
```

What Critical Gate reports:

- A behavioral assertion became a generic existence assertion.
- The replacement is less specific even though the test still passes.
- Repair guidance asks for an equally specific behavioral assertion.

### Unrelated Edits

Task:

```text
Fix font weight in the profile heading.
```

Risky diff:

- Changes the intended stylesheet.
- Also rewrites unrelated layout files.
- Touches CI config or package metadata.

What Critical Gate reports:

- The changed files do not fit the small task boundary.
- Diff Cost Score and Scope Expansion Score increase.
- Repair guidance asks to split unrelated edits or expand the task explicitly.

### Utility Reinvention

Task:

```text
Add signup date formatting.
```

Risky diff:

```ts
export function formatDateForSignup(value: Date): string {
  return value.toISOString();
}
```

when the repository already has:

```ts
export function formatDate(value: Date): string;
```

What Critical Gate reports:

- A similar exported helper already exists.
- Evidence includes existing export name, signature shape, folder role, path, and import count.
- Repair guidance points the agent toward reuse instead of another local abstraction.

### Public API Changes

Task:

```text
Improve internal validation.
```

Risky diff:

```diff
- export interface SignupOptions {}
+ interface SignupOptions {}
```

What Critical Gate reports:

- A public export was removed without task or release evidence.
- If `.critical-gate/api-surface.json` exists, the finding cites the snapshotted public contract.
- Repair guidance asks for restore, migration notes, changelog/changeset evidence, or an updated API
  snapshot.

### Clean Diff Certification

When the gate passes, the Markdown report still explains what was checked:

- Changed file count and churn.
- Diff Coherence Score.
- Dependency discipline.
- Test integrity.
- Public API surface.
- Secret/path checks.

This makes clean runs useful in PRs and agent handoffs instead of just saying “no findings.”

## Positioning

Critical Gate is adjacent to linters, test suites, security scanners, and AI code review tools, but
it is not trying to replace them.

- **Linters and formatters** enforce code style and static rules. Critical Gate checks whether the
  diff stayed inside the task and repository contract.
- **Test suites** prove selected behavior still passes. Critical Gate looks for tests that were
  weakened, skipped, or changed to assert less meaningful behavior.
- **Security scanners** look for known vulnerabilities or secrets. Critical Gate includes lightweight
  diff-only secret/path checks but focuses on agent failure patterns beyond security.
- **AI code reviewers** often produce broad suggestions. Critical Gate is deterministic-first and
  evidence-first; optional model help is for explanation, not primary detection.
- **CI checks** usually answer whether the project builds. Critical Gate answers whether the diff is
  acceptable for the task before it is merged.

The category is a **diff integrity gate for AI-assisted development**: a cheap, local, repository-
aware enforcement layer that catches high-risk agent behavior before humans have to infer it from a
large patch.

## Surfaces

Critical Gate has one analysis core and multiple surfaces:

- **CLI**: canonical local and scripted interface.
- **GitHub Action**: CI wrapper with SARIF upload support.
- **Codex hook**: repair-oriented stop hook for agent workflows.
- **VS Code extension**: Activity Bar dashboard, status bar state, Problems diagnostics, full report
  output, evidence navigation, and repair-copy actions.
- **Agent onboarding**: `critical-gate init-agent` and the VS Code initialization command add a
  managed Critical Gate section to `AGENTS.md` while preserving existing repository instructions.

The CLI remains the source of truth. The editor and CI surfaces consume CLI output rather than
reimplementing detector logic.

## Recommended Team Rollout

Start with report-only local runs and default thresholds. Treat medium, low, info, and
observation-mode findings as calibration data until the repository has enough clean runs.

Recommended sequence:

1. Run the CLI locally on AI-generated diffs with specific task text.
2. Add the VS Code extension for developer feedback where useful.
3. Add GitHub Action SARIF upload with default blocking behavior for eligible blocker and high
   findings.
4. Review noisy findings and tune task text, repository docs, or `.critical-gate.json` policy.
5. Add Codex hook enforcement only where compact repair loops are useful.
6. Promote observation-friendly detector families only after dogfooding shows acceptable precision.

See [docs/usage-guide.md](docs/usage-guide.md) for local rollout advice and
[docs/github-integration.md](docs/github-integration.md) for CI thresholds.

## Quick Start From Source

Critical Gate's current CLI distribution path is source-based: clone, install, build, and run
`node dist/cli.js`. Package-registry publishing and prebuilt action releases are intentionally held
until repository metadata, external dogfooding, and release artifacts are stable enough for broader
public use.

Requirements:

- Node.js 22.13 or newer.
- pnpm 11.1.2.
- Git history for baseline comparisons.

```bash
git clone git@github.com:criticaldeveloper/critical-gate.git
cd critical-gate
pnpm install --frozen-lockfile
pnpm build
```

Run a local check against `main`:

```bash
node dist/cli.js check --task "Add signup validation" --base main --format markdown
```

Common output formats:

```bash
node dist/cli.js check --task "Add signup validation" --format json --output critical-gate.json
node dist/cli.js check --task "Add signup validation" --format sarif --output critical-gate.sarif
node dist/cli.js check --task "Add signup validation" --format repair
```

Create a public API contract snapshot for repositories that expose TS/JS entrypoints:

```bash
node dist/cli.js snapshot-api
git add .critical-gate/api-surface.json
```

After the snapshot is committed, normal `check` runs compare export removals, additions, and
signature changes against it. Public contract changes should include snapshot, changelog, changeset,
or migration evidence.

Exit codes:

- `0`: gate passed.
- `1`: findings failed the configured threshold.
- `2`: usage or configuration error.
- `3`: internal error.

## Task Intent And Baselines

The task intent tells the gate what the diff is supposed to satisfy. Good task text is specific:

```bash
node dist/cli.js check \
  --task "Add email validation to signup form without changing authentication flow" \
  --base origin/main \
  --format markdown
```

Avoid generic task text such as `changes` or `update code`; that gives the scope detector less
signal. In CI, use PR titles, issue summaries, release notes, or a composed task string from the PR
body.

The `--base` option should point at the merge base or target branch. If omitted, Critical Gate uses
its default git baseline resolution.

## GitHub Action Example

Use full history so diff and repository-intelligence detectors have enough context:

```yaml
name: Critical Gate

on:
  pull_request:

permissions:
  actions: read
  contents: read
  pull-requests: read
  security-events: write

jobs:
  critical-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - id: critical-gate
        uses: ./
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

See [docs/github-integration.md](docs/github-integration.md) for SARIF and job-summary variants.

## Codex Hook Example

Critical Gate can run as a Codex `Stop` hook so an agent receives compact repair guidance before the
task is considered complete.

```bash
pnpm build
node dist/cli.js hook --base main
```

This repository includes `.codex/hooks.json` as a reviewable project hook example. See
[docs/codex-integration.md](docs/codex-integration.md) for setup and safety notes.

## VS Code Extension

Build and package the VSIX:

```bash
pnpm package:vscode
```

Install locally:

```bash
code --install-extension artifacts/vscode/critical-gate-vscode.vsix --force
```

The extension adds:

- `Critical Gate` Activity Bar view with the `Gate Runs` dashboard.
- `Run Gate`, `Show Report`, `Clear`, and `Settings` actions.
- Latest run decision, changed files, findings, Diff Cost Score, and recent runs.
- Problems diagnostics mapped from findings.
- Evidence navigation and repair-copy actions.
- Status bar pass/fail state.
- Full Markdown-style report in the `Critical Gate` output channel.

The Marketplace extension bundles the analyzer, so users do not need to clone this repository to use
the VS Code surface. Configure `criticalGate.cliPath` only when testing a custom local CLI build.

## Usage Guide

For a fuller walkthrough with examples, rollout advice, report interpretation, and troubleshooting,
read [docs/usage-guide.md](docs/usage-guide.md).

## Quality Evidence

The CI workflow publishes coverage and deterministic evaluation reports as GitHub Actions artifacts:
`critical-gate-coverage` and `critical-gate-evaluation`. See
[docs/evaluation-strategy.md](docs/evaluation-strategy.md) for artifact paths, thresholds, and the
current limits of the internal evaluation corpus.

## Development

Useful commands:

```bash
pnpm verify
pnpm test:vscode
pnpm package:vscode
```

Branch and commit conventions for this repository:

- `feature/example-two` for new implementations.
- `bugfix/example` for fixes.
- Commit format:

  ```text
  [branch-name]

  Implementation description
  ```

## Documentation Map

- [AGENTS.md](AGENTS.md): durable instructions for Codex and other AI agents.
- [docs/project-brief.md](docs/project-brief.md): product thesis, users, positioning, and scope.
- [docs/architecture.md](docs/architecture.md): core architecture and data flow.
- [docs/detectors.md](docs/detectors.md): detector catalog, severities, evidence, and implementation notes.
- [docs/detector-quality.md](docs/detector-quality.md): detector quality boundaries, blind spots,
  and coverage expectations.
- [docs/usage-guide.md](docs/usage-guide.md): practical usage examples and troubleshooting.
- [docs/installation.md](docs/installation.md): CLI, GitHub Action, Codex hook, and VSIX installation.
- [docs/editor-surface.md](docs/editor-surface.md): VS Code dashboard and diagnostics behavior.
- [docs/github-integration.md](docs/github-integration.md): GitHub Action, SARIF, and threshold guidance.
- [docs/policy-file.md](docs/policy-file.md): `.critical-gate.json` policy-as-code reference and
  validated examples.
- [docs/codex-integration.md](docs/codex-integration.md): Codex hook and repair-loop guidance.
- [docs/dogfood-evidence-plan.md](docs/dogfood-evidence-plan.md): real-repository dogfood automation,
  repair-loop metrics, and screenshot proof plan.
- [docs/dogfood-mv-ft-2026-06-19.md](docs/dogfood-mv-ft-2026-06-19.md): mv-ft dogfood
  evidence, misses, fixes, and current evaluation baseline.
- [docs/versioning-policy.md](docs/versioning-policy.md): release and versioning policy.
- [docs/improvements-task-plan.md](docs/improvements-task-plan.md): trust and calibration roadmap.
- [docs/tasks/pragmatic-improvement-backlog.md](docs/tasks/pragmatic-improvement-backlog.md):
  realistic next improvements for trust, evaluation, policy, and rollout.
- [SECURITY.md](SECURITY.md): supported security policy and private vulnerability reporting path.
- [CHANGELOG.md](CHANGELOG.md): project-level release notes.

## Project Status

The repository contains the TypeScript CLI implementation, deterministic detectors, Codex hook
integration, GitHub Action integration, optional LLM explanation boundaries, source-based CLI
distribution, and a VS Code Marketplace extension surface.

## License

Critical Gate is open source under the [MIT License](LICENSE).

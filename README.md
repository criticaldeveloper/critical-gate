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

## Surfaces

Critical Gate has one analysis core and multiple surfaces:

- **CLI**: canonical local and scripted interface.
- **GitHub Action**: CI wrapper with SARIF upload support.
- **Codex hook**: repair-oriented stop hook for agent workflows.
- **VS Code extension**: Activity Bar dashboard, status bar state, Problems diagnostics, full report
  output, evidence navigation, and repair-copy actions.

The CLI remains the source of truth. The editor and CI surfaces consume CLI output rather than
reimplementing detector logic.

## Quick Start From Source

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

By default, the extension runs `dist/cli.js` from the opened workspace. Configure
`criticalGate.cliPath` if the CLI lives somewhere else.

## Usage Guide

For a fuller walkthrough with examples, rollout advice, report interpretation, and troubleshooting,
read [docs/usage-guide.md](docs/usage-guide.md).

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
- [docs/usage-guide.md](docs/usage-guide.md): practical usage examples and troubleshooting.
- [docs/installation.md](docs/installation.md): CLI, GitHub Action, Codex hook, and VSIX installation.
- [docs/editor-surface.md](docs/editor-surface.md): VS Code dashboard and diagnostics behavior.
- [docs/github-integration.md](docs/github-integration.md): GitHub Action, SARIF, and threshold guidance.
- [docs/codex-integration.md](docs/codex-integration.md): Codex hook and repair-loop guidance.
- [docs/versioning-policy.md](docs/versioning-policy.md): release and versioning policy.
- [CHANGELOG.md](CHANGELOG.md): project-level release notes.

## Project Status

The repository contains the first TypeScript CLI implementation, deterministic detectors, Codex hook
integration, GitHub Action integration, optional LLM explanation boundaries, and a VS Code extension
surface. The root CLI package is still on the alpha release line, while the VS Code extension uses
Marketplace-compatible numeric versions.

## License

Critical Gate is open source under the [MIT License](LICENSE).

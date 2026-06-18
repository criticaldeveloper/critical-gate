# Critical Gate

Critical Gate is a diff integrity gate for AI-assisted development. It checks whether an agent-produced change is acceptable for the requested task and for the repository it lands in.

The project is intentionally not a generic AI reviewer. Its job is to reduce the blast radius of autonomous coding agents by finding evidence-backed risks in the diff: unrelated edits, unnecessary rewrites, new dependencies, public API changes, weakened tests, hardcoded secrets, and configuration changes without visible explanation.

## Why It Exists

Agent instructions, skills, and project docs guide behavior, but they do not enforce it. Critical Gate turns repository expectations into checks over the actual diff.

The strongest product version is:

> A quality enforcement layer for coding agents.

The gate should be cheap, deterministic-first, and repair-oriented. Most checks should run without an LLM. When a model is useful, it should receive a compact finding summary instead of the whole repository.

## First Milestone

The first milestone is a TypeScript/JavaScript CLI that accepts:

- Task intent: prompt, issue text, commit message, or PR description.
- Git diff: changed files and hunks against a baseline.
- Minimal repo context: package manifests, config files, public exports, nearby symbols, tests, and optional git history.

And emits:

- JSON findings.
- Markdown summary.
- SARIF-compatible results.
- Exit codes suitable for CI and Codex hooks.

## Current CLI

The current scaffold exposes the first `check` command contract:

```bash
pnpm build
node dist/cli.js check --task "Add signup validation" --base main --format markdown
node dist/cli.js check --task "Add signup validation" --format json --output report.json
node dist/cli.js check --task "Add signup validation" --format sarif --output critical-gate.sarif
node dist/cli.js check --task "Add signup validation" --format repair
node dist/cli.js hook --base main
```

GitHub Actions can use the root composite action:

```yaml
- uses: ./
  with:
    task: ${{ github.event.pull_request.title }}
    base: ${{ github.event.pull_request.base.sha }}
    format: sarif
    output: critical-gate.sarif
```

Exit codes:

- `0`: pass.
- `1`: findings failed the configured threshold.
- `2`: usage or configuration error.
- `3`: internal error.

The command currently emits real changed-file, role, and churn data. It also reports early
detector findings for unjustified package dependency additions, test weakening, unexplained config
changes, hardcoded secrets or environment-specific paths, silent public export changes, and
unexpected scope, unusual historical change patterns, utility reinvention, or large rewrites for
small tasks. Reports include an initial Diff Cost Score.

## Documentation Map

- `AGENTS.md`: durable instructions for Codex and other AI agents working in this repo.
- `docs/project-brief.md`: product thesis, users, positioning, and scope.
- `docs/architecture.md`: proposed architecture and core data flow.
- `docs/detectors.md`: v1 detector catalog, severities, evidence, and implementation notes.
- `docs/implementation-roadmap.md`: chronological phases from docs to CLI, repair loop, and repository intelligence.
- `docs/task-backlog.md`: concrete implementation tasks in dependency order.
- `docs/evaluation-strategy.md`: how to measure precision, recall, noise, and usefulness.
- `docs/codex-integration.md`: how this should integrate with Codex instructions, hooks, and automation.
- `docs/github-integration.md`: GitHub Action, SARIF upload, checks summary, and threshold guidance.
- `docs/llm-layer.md`: optional model explanation boundary, artifact, redaction, cache, and budgets.
- `docs/editor-surface.md`: VS Code diagnostics prototype and editor integration notes.
- `docs/versioning-policy.md`: release stages, SemVer policy, artifact alignment, and checklist.
- `CHANGELOG.md`: project-level release notes.

## Current State

This repository now contains the first CLI implementation, deterministic detectors, Codex hook
integration, GitHub Action integration, and an optional LLM explanation boundary. Continue with the
roadmap and backlog before extending the next surface. A first VS Code diagnostics prototype lives
under `extensions/vscode`.

The current release target is `0.1.0-alpha.0`: suitable for internal alpha dogfooding, not yet a
public stable release.

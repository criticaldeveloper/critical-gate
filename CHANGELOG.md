# Changelog

All notable project-level changes are documented here.

This project follows the versioning policy in `docs/versioning-policy.md`.

## 0.1.0-alpha.0 - 2026-06-18

Initial alpha candidate for Critical Gate.

### Added

- TypeScript CLI with `check` and `hook` commands.
- JSON, Markdown, SARIF, and compact repair report formats.
- Git diff reader with path classification, churn metrics, untracked file handling, and repository
  context.
- Deterministic detectors for:
  - Dependency additions.
  - Test weakening.
  - Configuration changes.
  - Secrets, local paths, and environment-specific URLs.
  - Public API surface changes.
  - Scope drift.
  - Large rewrites for small tasks.
  - Repository co-change anomalies.
  - Utility reinvention.
- Diff Cost Score summary signal.
- Codex `Stop` hook example and compact repair payload fixtures.
- GitHub composite action and SARIF upload workflow examples.
- Optional LLM explanation boundary with compact model artifacts, redaction, provider interface,
  cache, and budget controls.
- VS Code diagnostics prototype with Problems panel diagnostics, evidence/repair quick actions,
  on-demand refresh, optional on-save refresh, extension-host tests, and VSIX artifact packaging.
- VS Code Marketplace pre-release metadata, icon, publisher identity, and publishing scripts.
- External dogfood pass against `sindresorhus/ky` with false-positive tuning.
- AI-agent documentation covering architecture, detectors, roadmap, Codex integration, GitHub
  integration, editor surface, evaluation strategy, and release policy.
- MIT License for root package and VS Code extension package.

### Release Status

- Intended audience: alpha users and dogfooding repositories.
- Distribution: local CLI build, local Codex hook, GitHub Action from this repository, and VSIX
  artifact from `pnpm package:vscode` or the VS Code extension workflow.
- Marketplace status: pre-release package metadata is configured for `criticaldeveloper.critical-gate`.

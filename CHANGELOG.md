# Changelog

All notable project-level changes are documented here.

This project follows the versioning policy in `docs/versioning-policy.md`.

## 2.1.0 - 2026-06-19

Trust and calibration release based on real-project dogfooding.

### Added

- Add an improvement task plan in `docs/improvements-task-plan.md` that converts the root
  improvement brief into implementation-sized roadmap tasks.
- Add clean diff certificates to passing Markdown reports so successful runs explain what was
  checked, not only what failed.

### Changed

- Expand style-related task aliases so words such as font, fonts, typography, weight, CSS, SCSS,
  and styles align with stylesheet and typography paths.
- Treat generic words such as project and repo as non-scope keywords during task analysis.
- Cap historical expected-companion findings to the top three per changed source path to reduce
  report noise.
- Normalize task keyword extraction defensively for mixed-case task text.

## 2.0.1 - 2026-06-19

Patch release for real-project dogfood findings.

### Fixed

- Stop treating casual task wording such as "of the project" as a broad scope escape hatch.
- Fail small scoped tasks when unrelated stylesheet/source deletions are detected.
- Ignore Critical Gate internal cache artifacts in working-tree reports.
- Move repository knowledge cache files outside user repositories so gate runs do not dirty the
  target project.

## 2.0.0 - 2026-06-19

Release candidate for the completed Critical Gate deep-improvement package.

### Added

- Cached repository knowledge layer with history, graph, solution, pattern, and local cache support.
- Intent verification, observed action classification, blast-radius analysis, existing-solution
  detection, pattern-violation detection, expected-companion detection, and Scope Expansion Score.
- VS Code Analysis tree, contextual finding actions, persisted run history, and richer status bar
  semantics.
- Stabilized SARIF rule IDs, deterministic fingerprints, SARIF size safeguards, and reusable
  GitHub workflow templates.
- End-to-end fixture repository tests, local evaluation harness, and observation-mode rollout
  policy.

### Fixed

- Avoid secret-detector false positives for token-like local identifier names such as
  `targetTokens`, `importTokens`, and `domainTokens`.

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
- VS Code extension with Activity Bar dashboard, Problems panel diagnostics, evidence/repair quick
  actions, output-channel reports, status bar state, on-demand refresh, optional on-save refresh,
  extension-host tests, and VSIX artifact packaging.
- VS Code Marketplace metadata, icon assets, publisher identity, and publishing scripts.
- External dogfood pass against `sindresorhus/ky` with false-positive tuning.
- AI-agent documentation covering architecture, detectors, roadmap, Codex integration, GitHub
  integration, editor surface, evaluation strategy, and release policy.
- MIT License for root package and VS Code extension package.

### Release Status

- Intended audience: alpha users and dogfooding repositories.
- Distribution: local CLI build, local Codex hook, GitHub Action from this repository, and VSIX
  artifact from `pnpm package:vscode` or the VS Code extension workflow.
- Marketplace status: stable extension package metadata is configured for
  `criticaldeveloper.critical-gate`.

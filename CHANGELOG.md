# Changelog

All notable project-level changes are documented here.

This project follows the versioning policy in `docs/versioning-policy.md`.

## 2.7.4 - 2026-06-30

### Fixed

- Calibrate `expected-companions` and `scope` for coherent static Astro visual tasks that touch
  multiple section, navigator, page, and visual asset files without structural or config drift.
- Add the `astro-multisection-visual-001` regression fixture from `diegolopes-ft` dogfood evidence.
- Extend fixture evaluation with optional framework packs and exact finding-count assertions for
  false-positive regression cases.

## 2.7.3 - 2026-06-24

### Fixed

- Calibrate content-heavy reciprocal metadata updates so adding a new content post with related
  content or synapse references does not produce repository-intelligence noise when the task
  explicitly names those companion updates.
- Add a generalized content metadata fixture and focused detector tests for the calibration.

## 2.7.2 - 2026-06-24

### Fixed

- Detect package-only tool upgrades when the manifest diff hunk starts inside the dependency block,
  avoiding residual expected-companion noise for pnpm monorepo lockfile updates.

## 2.7.1 - 2026-06-24

### Fixed

- Calibrate explicit package-only tool upgrades so manifest and lockfile changes for the named
  upgraded dependency stay in scope and do not require unrelated historical companion files.

## 2.7.0 - 2026-06-24

### Changed

- Calibrate `repository-intelligence` so sparse history does not report focused UI presentation
  changes when the task explicitly names the touched component or view surface and the diff remains
  inside UI source or visual asset paths.
- Extend fixture evaluation cases with optional synthetic repository profiles so history-aware
  detector behavior can be tested without relying on private repository state.

### Fixed

- Add a generalized false-positive regression fixture for explicit UI surface changes discovered
  from the `criticaldeveloper-ft` 2.6.0 replay evidence.
- Keep `repository-intelligence` active for vague UI tasks and for explicit UI work mixed with
  config drift.

## 2.6.0 - 2026-06-23

### Changed

- Calibrate focused UI presentation tasks so explicitly requested multi-area component, view, style,
  script, and visual-asset changes produce fewer noisy scope and blast-radius observations.
- Downgrade non-structural UI presentation rewrites from blocking severity to observational severity
  when the task and changed file path show layout/style intent and no imports, exports, props, or
  companion-relevant data hooks changed.
- Expand task intent vocabulary for common design/product wording such as cards, CTA, masonry,
  arrows, icons, indicators, vinyl, animation, layout, and spacing.

### Fixed

- Treat changed inline Astro styles as self-contained framework style evidence so component changes
  do not require external CSS/SCSS companions by default.
- Add `criticaldeveloper-ft` false-positive regression fixtures for multi-area UI scope and visual
  asset replacement evidence.

## 2.5.0 - 2026-06-23

### Added

- Add `critical-gate init` for first-class observe-only repository setup with package scripts,
  evidence export files, advisory GitHub workflow, managed agent instructions, package-manager
  detection, and optional dev-dependency installation.
- Add a VS Code `Critical Gate: Initialize Repository` command and visible Activity Bar panel action
  for running the same repository setup flow from the editor.

## 2.4.4 - 2026-06-23

Patch release for policy glob matching semantics discovered during dogfooding.

### Fixed

- Treat trailing `/**` support-file policy globs as matching the directory itself and all nested
  descendants, so rules such as `docs/critical-gate-evidence/**` cover dated evidence reports
  without requiring the less intuitive `/**/*` form.
- Normalize Windows path separators before policy/framework glob matching.

## 2.4.3 - 2026-06-22

Patch release replacing the stale 2.4.2 artifact and covering the full `criticaldeveloper-blog`
Material Symbols removal replay.

### Fixed

- Ensure the built and published CLI reports the package version through `critical-gate --version`.
- Add a built-artifact version test that verifies `dist/version.js` and `dist/cli.js --version`
  match `package.json`.
- Treat text `bun.lock` files as package lockfiles.
- Keep package manifest and lockfile dependency removals non-blocking when the removed package is
  named by the task intent.
- Add a full replay fixture for replacing Material Symbols with local SVG icons.
- Keep SARIF upload best-effort in GitHub workflows so a passing gate is not failed by code scanning
  ingestion.

## 2.4.2 - 2026-06-22

Patch release for the `criticaldeveloper-blog` dependency-removal replay and package artifact
version validation.

### Fixed

- Rebuild and validate published CLI runtime metadata so `critical-gate --version` matches the npm
  package version.
- Harden package validation to fail when `dist/version.js` is stale.
- Compare before/after manifest dependency keys so dependency removals do not classify unchanged
  neighboring dependencies as additions.

## 2.4.1 - 2026-06-22

Patch release for dogfood-backed detector calibration.

### Fixed

- Stop reporting unchanged package neighbors as newly added dependencies when a package is removed
  and JSON comma normalization re-adds an existing dependency line.
- Suppress noisy historical expected-companion findings for focused UI presentation and small
  default-state changes when the diff is self-contained.

## 2.4.0 - 2026-06-22

Installable distribution and CLI maintainability release.

### Added

- Make the npm CLI package the primary public install path with package validation for the built
  executable.
- Make the public GitHub Action run the versioned npm CLI by default while preserving local source
  mode for dogfooding and release verification.
- Document Marketplace installation as the primary VS Code extension path.
- Add release governance checks for keeping npm, GitHub Action, VS Code Marketplace, docs, runtime
  version output, and SARIF tool metadata aligned.

### Changed

- Update Codex hook and agent onboarding guidance to prefer installable CLI commands.
- Split the CLI entrypoint into focused modules for argument parsing, command implementations,
  result construction, IO defaults, help text, git hook rendering, and public compatibility exports.

### Fixed

- Pin source development and CI to a Node 20-compatible pnpm release so the Node 20 workflow remains
  a real supported-runtime check.
- Bundle the VS Code analyzer into a single CLI file so Marketplace packaging avoids the many-file
  JavaScript warning.

## 2.3.1 - 2026-06-22

Patch release for npm package metadata.

### Fixed

- Prepare a patch republish so npm package README metadata can be regenerated for the registry page.

## 2.3.0 - 2026-06-21

Agent onboarding and evaluation hardening release.

### Added

- Add `critical-gate init-agent` to create or update a managed Critical Gate section in `AGENTS.md`
  while preserving existing repository instructions.
- Add grouped evaluation metrics by source repository and case type.
- Expand the sanitized evaluation corpus to 22 cases across generic fixtures, mv-ft dogfood
  regressions, `sindresorhus/ky`, and `withastro/docs`.

### Changed

- Improve clean Markdown reports with compact why-passed evidence.
- Harden LLM artifact redaction and document the maximum model artifact shape.
- Add release checklist guardrails for product non-goals.

## 2.2.0 - 2026-06-19

Dogfood-backed detector release based on the `mv-ft` real-repository evaluation pass.

### Added

- Add `docs/dogfood-mv-ft-2026-06-19.md` with scenario outcomes, initial precision/recall,
  false-negative fixes, repair-loop notes, and current evaluation baseline.
- Add eval cases for broad component rewrites, skipped tests in newly added files, runtime config
  drift, and framework contract export removals.

### Changed

- Detect source-like rewrites even when role metadata is stale or unknown.
- Expose untracked file content as synthetic added-file hunks so detectors can inspect new files
  before staging.
- Classify runtime/tooling pin files such as `.node-version`, `.nvmrc`, `.tool-versions`, `.npmrc`,
  `.pnpmrc`, and related files as configuration.
- Treat task wording such as "without changing config" as a config-change prohibition rather than
  config-change permission.
- Protect framework contract exports such as Astro `collections` in `content.config.ts` even before
  a repository has committed a public API snapshot.

### Fixed

- Close four `mv-ft` dogfood false negatives: copy-task rewrites, skipped test additions in new
  files, UI-task runtime config drift, and silent framework contract export removals.

## 2.1.1 - 2026-06-19

Patch release for global CLI installs.

### Fixed

- Normalize CLI entrypoint paths through real paths so pnpm global shims and symlinked package
  paths execute the CLI instead of exiting silently.

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

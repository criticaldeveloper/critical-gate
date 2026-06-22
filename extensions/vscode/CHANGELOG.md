# Changelog

This extension follows the project release policy in `../../docs/versioning-policy.md`.

## 2.4.3 - 2026-06-22

Patch release aligned with Critical Gate 2.4.3.

- Bundle the full Material Symbols dependency-removal replay fix.
- Bundle the built CLI version validation fix.

## 2.4.2 - 2026-06-22

Patch release aligned with Critical Gate 2.4.2.

- Bundle the dependency-removal replay fix for unchanged neighboring dependencies.
- Bundle runtime version validation so the packaged analyzer reports the released version.

## 2.4.1 - 2026-06-22

Patch release aligned with Critical Gate 2.4.1.

- Bundle dogfood-backed dependency detector calibration so dependency removals do not appear as
  unchanged dependency additions.
- Bundle lower-noise expected-companion calibration for focused UI presentation and default-state
  changes.

## 2.4.0 - 2026-06-22

Marketplace release aligned with Critical Gate 2.4.0.

- Keep the bundled analyzer aligned with the npm-first CLI distribution release.
- Keep Marketplace installation documented as the primary VS Code install path.
- Bundle CLI maintainability refactors with no intentional command, schema, or exit-code changes.
- Bundle the analyzer CLI into a single file to avoid VSIX many-file packaging warnings.

## 2.3.1 - 2026-06-22

Patch release aligned with Critical Gate 2.3.1.

- Keep extension metadata aligned with the npm package patch release.

## 2.3.0 - 2026-06-21

### Added

- Add `Critical Gate: Initialize Agent Instructions` to initialize the managed Critical Gate
  section in `AGENTS.md` from VS Code.

## 2.2.0 - 2026-06-19

Marketplace release aligned with Critical Gate 2.2.0.

- Bundle dogfood-backed detector fixes for broad rewrites, untracked skipped tests, runtime config
  drift, and framework contract export removals.
- Bundle the mv-ft dogfood proof report and expanded evaluation fixtures.
- Preserve lower-noise clean passes for legitimate typography and coherent multi-file UI work.

## 2.1.1 - 2026-06-19

Patch release aligned with Critical Gate 2.1.1.

- Bundle the CLI entrypoint fix for pnpm global installs and symlinked package paths.

## 2.1.0 - 2026-06-19

Marketplace release aligned with Critical Gate 2.1.0.

- Bundle style/font task-alignment calibration for lower-noise legitimate typography changes.
- Bundle capped expected-companion findings so one changed file does not flood the dashboard.
- Show clean diff certificate details in passing Markdown reports.

## 2.0.1 - 2026-06-19

Patch release aligned with Critical Gate 2.0.1.

- Bundle the scope fix for casual "project" wording in task intent.
- Bundle cache-noise fixes so Critical Gate cache artifacts do not appear as changed files.

## 2.0.0 - 2026-06-19

Marketplace release aligned with the Critical Gate 2.0.0 package.

- Add native Analysis tree for latest run metrics, detector-grouped findings, changed clusters,
  missing companions, existing-solution signals, changed files, and recent runs.
- Add contextual actions for opening existing solutions, expected companions, cluster reports,
  evidence, and repair prompts.
- Persist last report and recent run history across VS Code reloads as clearly historical state.
- Improve status bar semantics with scope score, unexpected cluster, missing companion, API surface,
  and clean-pass signals.
- Use the bundled analyzer by default.

## 1.1.0 - 2026-06-18

Self-contained Marketplace package.

- Bundle the Critical Gate analyzer inside the VSIX.
- Run the bundled analyzer by default so users do not need a local Critical Gate source checkout.
- Keep `criticalGate.cliPath` as an advanced override for testing a custom CLI build.

## 1.0.1 - 2026-06-18

Patch Marketplace package for the renamed `critical-gate-vscode` extension ID.

- Fix deleted-file evidence navigation by opening missing files from git history.
- Improve scope detection for deleted stylesheet/source files in small tasks.
- Add semantic changed-file badges for created, updated, deleted, and renamed files.

## 1.0.0 - 2026-06-18

Stable Marketplace package for the Critical Gate VS Code extension.

- Add Critical Gate diagnostics command.
- Add Activity Bar dashboard with latest run status, changed files, findings, actions, and recent
  run history.
- Add full report output channel and status bar pass/fail state.
- Add evidence and repair quick actions.
- Add optional on-save refresh mode.
- Add extension-host tests and VSIX artifact packaging.
- Add Marketplace metadata and inverted icon for dark Marketplace surfaces.

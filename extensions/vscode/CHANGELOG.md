# Changelog

This extension follows the project release policy in `../../docs/versioning-policy.md`.

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

# Changelog

This extension follows the project release policy in `../../docs/versioning-policy.md`.

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

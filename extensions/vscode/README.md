# Critical Gate

Critical Gate brings repository-aware diff integrity checks into VS Code.

It is not a generic AI code reviewer. It is a local diagnostics surface for checking whether an
agent-produced diff stays inside the requested task, repository conventions, API surface, tests,
dependencies, and expected blast radius.

## Features

- Use the Critical Gate Activity Bar view to run checks, inspect the latest run, review changed
  files, browse the native Analysis tree, and revisit recent gate runs.
- Run Critical Gate from the Command Palette with `Critical Gate: Run Check`.
- Show the full run report in the `Critical Gate` output channel.
- See pass/fail state in the VS Code status bar.
- Show findings in the Problems panel with file, line, severity, and detector context.
- Open evidence locations from diagnostics.
- Copy repair guidance for Codex or another coding agent.
- Restore the last report and recent run history after reloading VS Code, clearly marked as
  historical until the next run.
- Optionally refresh diagnostics on file save.

## Requirements

The extension bundles the Critical Gate analyzer, so Marketplace users do not need to clone or build
the `critical-gate` repository.

The opened workspace must be a local git repository. Configure `criticalGate.cliPath` only when you
want to test a custom local Critical Gate CLI build.

## Settings

- `criticalGate.task`: task intent passed to Critical Gate.
- `criticalGate.base`: optional git base ref or SHA.
- `criticalGate.cliPath`: optional path to a custom Critical Gate CLI. Empty uses the bundled analyzer.
- `criticalGate.refreshMode`: `manual` or `onSave`.
- `criticalGate.refreshDebounceMs`: debounce for save-triggered checks.

## Status

This extension is a local diagnostics and run-visibility surface for Critical Gate. The CLI remains
the source of truth for detector behavior and output schemas.

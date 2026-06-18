# Critical Gate

Critical Gate brings repository-aware diff integrity checks into VS Code.

It is not a generic AI code reviewer. It is a local diagnostics surface for checking whether an
agent-produced diff stays inside the requested task, repository conventions, API surface, tests,
dependencies, and expected blast radius.

## Features

- Use the Critical Gate Activity Bar view to run checks, inspect the latest run, review changed
  files, and revisit recent gate runs.
- Run Critical Gate from the Command Palette with `Critical Gate: Run Check`.
- Show the full run report in the `Critical Gate` output channel.
- See pass/fail state in the VS Code status bar.
- Show findings in the Problems panel with file, line, severity, and detector context.
- Open evidence locations from diagnostics.
- Copy repair guidance for Codex or another coding agent.
- Optionally refresh diagnostics on file save.

## Requirements

Critical Gate must be available in the opened workspace. For source checkouts, build the CLI first:

```bash
pnpm install --frozen-lockfile
pnpm build
```

By default, the extension runs `dist/cli.js` from the workspace root. Change
`criticalGate.cliPath` if your workspace uses another path.

## Settings

- `criticalGate.task`: task intent passed to Critical Gate.
- `criticalGate.base`: optional git base ref or SHA.
- `criticalGate.cliPath`: path to the built Critical Gate CLI.
- `criticalGate.refreshMode`: `manual` or `onSave`.
- `criticalGate.refreshDebounceMs`: debounce for save-triggered checks.

## Status

This extension is a local diagnostics and run-visibility surface for Critical Gate. The CLI remains
the source of truth for detector behavior and output schemas.

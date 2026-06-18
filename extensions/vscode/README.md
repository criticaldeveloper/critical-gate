# Critical Gate

Critical Gate brings repository-aware diff integrity checks into VS Code.

It is not a generic AI code reviewer. It is a local diagnostics surface for checking whether an
agent-produced diff stays inside the requested task, repository conventions, API surface, tests,
dependencies, and expected blast radius.

## Features

- Run Critical Gate from the Command Palette with `Critical Gate: Run Check`.
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

This is an alpha diagnostics surface for Critical Gate. Expect the CLI and finding schema to evolve
before the first stable release.

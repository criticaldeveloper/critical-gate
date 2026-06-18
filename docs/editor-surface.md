# Editor Surface

The editor surface starts as a VS Code diagnostics prototype. It should display mature Critical Gate
findings close to the changed files without replacing the CLI, Codex hook, or CI enforcement path.

## Current Prototype

The prototype has two layers:

- `src/editor`: dependency-free mapping from Critical Gate findings to editor diagnostic data.
- `extensions/vscode`: VS Code extension scaffold that runs the built CLI and publishes diagnostics
  to the Problems panel.

The extension command is:

```text
Critical Gate: Run Check
```

It runs:

```bash
node dist/cli.js check --task "<task>" --format json
```

When `criticalGate.base` is configured, the command also passes `--base <ref>`.

## Configuration

The VS Code scaffold contributes these settings:

- `criticalGate.task`: task intent passed to the CLI. If empty, the extension asks before running.
- `criticalGate.base`: optional git base ref or SHA.
- `criticalGate.cliPath`: path to the built CLI, defaulting to `dist/cli.js` in the workspace.

## Diagnostic Mapping

Editor diagnostics are intentionally quiet:

- `blocker` and `high` findings become errors.
- `medium` findings become warnings.
- `low` findings become information.
- `info` findings become hints.

Diagnostics are created only when finding evidence has a file path. The diagnostic message includes
the finding title, explanation, and repair text.

## Quick Actions

The VS Code scaffold registers quick fixes for Critical Gate diagnostics:

- `Critical Gate: Open evidence` opens the evidence file and selects the reported line range.
- `Critical Gate: Copy repair text` copies the finding repair guidance to the clipboard.

The diagnostic code link also opens the evidence location when VS Code renders it as a command URI.

## Local Build

Build the root CLI before running the extension:

```bash
pnpm build
pnpm build:vscode
pnpm build:vscode-tests
```

The prototype extension build output lives under `extensions/vscode/dist/` and is ignored by git.
The root dev dependency `@types/vscode` is required so `pnpm build:vscode` can typecheck the
extension scaffold without bundling VS Code itself.

Run the extension-host test harness explicitly when a VS Code runtime is available:

```bash
pnpm test:vscode
```

The harness uses `@vscode/test-electron`, launches the fixture workspace in
`fixtures/vscode-workspace`, activates the command contributions, and checks the evidence/repair
commands.

## Later Work

Before packaging this as a marketplace extension:

1. Reuse the core editor mapper directly from a packaged module instead of keeping the scaffold
   self-contained.
2. Tune refresh behavior so diagnostics run on demand or after explicit save, not continuously.
3. Add packaging metadata and a VSIX release workflow.

# Installation

Critical Gate currently supports source-based CLI and action installation, local Codex hook setup,
and a self-contained VS Code extension VSIX. The root CLI package and VS Code extension use aligned
numeric dogfood release versions, but the project has not declared a stable public API contract yet.

The official CLI path for this release stage is source-based installation. Do not assume an npm
registry package, global install, or prebuilt GitHub Action artifact is available until the release
policy explicitly changes.

## Requirements

- Node.js 22.13 or newer. CI uses Node.js 24.
- pnpm 11.1.2, via Corepack or a local pnpm install.
- Git, with enough history for `--base` comparisons.
- VS Code only when installing or testing the editor extension.

Review [../SECURITY.md](../SECURITY.md) before enabling Critical Gate in shared CI, trusted Codex
hooks, or editor workflows that may process private repositories.

Enable pnpm with Corepack when needed:

```bash
corepack enable
corepack prepare pnpm@11.1.2 --activate
```

## From Source

Clone the repository, install dependencies, and build:

```bash
git clone https://github.com/criticaldeveloper/critical-gate.git critical-gate
cd critical-gate
pnpm install --frozen-lockfile
pnpm build
```

Run the CLI from the built entrypoint:

```bash
node dist/cli.js check --task "Add signup validation" --base main --format markdown
```

For repeated local use, create a shell alias or script that points to the built CLI:

```bash
alias critical-gate='node /absolute/path/to/critical-gate/dist/cli.js'
```

On Windows PowerShell:

```powershell
function critical-gate { node C:\path\to\critical-gate\dist\cli.js @args }
```

## CLI

Build before running:

```bash
pnpm build
```

Common commands:

```bash
node dist/cli.js --version
node dist/cli.js check --task "Add signup validation" --base main --format markdown
node dist/cli.js check --task "Add signup validation" --format json --output critical-gate.json
node dist/cli.js check --task "Add signup validation" --format sarif --output critical-gate.sarif
node dist/cli.js check --task "Add signup validation" --format repair
node dist/cli.js snapshot-api
node dist/cli.js install-hooks
node dist/cli.js init-policy
```

Exit codes:

- `0`: pass.
- `1`: findings failed the configured threshold.
- `2`: usage or configuration error.
- `3`: internal error.

## Local Git Hooks

Critical Gate can install reviewable local git hooks:

```bash
critical-gate install-hooks
```

This writes:

- `.git/hooks/pre-commit`: checks staged changes with `--fail-on blocker`.
- `.git/hooks/pre-push`: checks the branch against `${CRITICAL_GATE_BASE:-origin/main}` with
  `--fail-on high`.

Install only one hook when desired:

```bash
critical-gate install-hooks --hook pre-commit
critical-gate install-hooks --hook pre-push
```

Use `--force` to overwrite an existing hook after reviewing it. Use `--cli <command>` when the hook
should call a specific local CLI path, for example:

```bash
critical-gate install-hooks --cli "node ./node_modules/critical-gate/dist/cli.js" --force
```

At runtime, hooks accept:

- `CRITICAL_GATE_TASK`: overrides the task intent.
- `CRITICAL_GATE_BASE`: overrides the pre-push base branch.

## GitHub Action

Until the action is published under a remote slug, use it from this repository checkout or from the
same repository with `uses: ./`.

The composite action installs dependencies and builds by default. Source checkouts should keep the
defaults.

For release artifacts, build and smoke-test the prebuilt action directory:

```bash
pnpm package:action
pnpm smoke:action
```

That writes `artifacts/action` with `action.yml`, required package metadata, and prebuilt `dist/`
output. It intentionally excludes `node_modules`. Only use `install: "false"` and `build: "false"`
with an artifact that has passed the smoke check.

Minimal workflow:

```yaml
name: Critical Gate

on:
  pull_request:

permissions:
  contents: read
  pull-requests: read
  security-events: write

jobs:
  critical-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - id: critical-gate
        uses: ./
        continue-on-error: true
        with:
          task: ${{ github.event.pull_request.title }}
          base: ${{ github.event.pull_request.base.sha }}
          format: sarif
          output: critical-gate.sarif

      - uses: github/codeql-action/upload-sarif@v4
        if: always() && hashFiles('critical-gate.sarif') != ''
        with:
          sarif_file: critical-gate.sarif

      - if: steps.critical-gate.outcome == 'failure'
        run: exit 1
```

For external repositories before publication, checkout Critical Gate as a secondary path and call
that path's action:

```yaml
- name: Checkout project
  uses: actions/checkout@v6
  with:
    fetch-depth: 0

- name: Checkout Critical Gate
  uses: actions/checkout@v6
  with:
    repository: <owner>/critical-gate
    path: .critical-gate

- name: Run Critical Gate
  uses: ./.critical-gate
  with:
    task: ${{ github.event.pull_request.title }}
    base: ${{ github.event.pull_request.base.sha }}
```

## Codex Hook

This repository includes a sample Codex project hook at `.codex/hooks.json`.

Install locally:

1. Build the CLI:

   ```bash
   pnpm build
   ```

2. Review `.codex/hooks.json`.

3. In Codex CLI, run `/hooks` and trust the repo-local hook after reviewing it.

4. Confirm the hook command works:

   ```bash
   node dist/cli.js hook --base main
   ```

The sample `Stop` hook builds Critical Gate and runs compact repair output:

```bash
ROOT=$(git rev-parse --show-toplevel) && pnpm --dir "$ROOT" --silent build && node "$ROOT/dist/cli.js" hook --base main
```

On Windows, the sample hook also includes `commandWindows` using PowerShell.

## VS Code Extension VSIX

Build and package the local VSIX:

```bash
pnpm package:vscode
```

The generated package is:

```text
artifacts/vscode/critical-gate-vscode.vsix
```

Install from the command line:

```bash
code --install-extension artifacts/vscode/critical-gate-vscode.vsix
```

Or in VS Code:

1. Open Extensions.
2. Choose `Install from VSIX...`.
3. Select `artifacts/vscode/critical-gate-vscode.vsix`.

After installing:

1. Open a local git repository in VS Code.
2. Open the `Critical Gate` Activity Bar view or run `Critical Gate: Run Check`.

The extension provides a `Gate Runs` dashboard, Problems diagnostics, a `Critical Gate` output
channel report, evidence navigation, repair-copy actions, and status bar pass/fail state.

Optional settings:

- `criticalGate.task`: task intent to avoid prompting.
- `criticalGate.base`: git base ref or SHA.
- `criticalGate.cliPath`: optional custom CLI path. Leave empty to use the bundled analyzer.
- `criticalGate.refreshMode`: `manual` or `onSave`.
- `criticalGate.refreshDebounceMs`: on-save debounce delay.

## Verification

After installation changes, run:

```bash
pnpm verify
pnpm audit
pnpm test:vscode
pnpm package:vscode
```

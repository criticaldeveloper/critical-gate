# Installation

Critical Gate supports an npm-distributed CLI, source-based development setup, local Codex hook
setup, an npm-backed GitHub Action, and a Marketplace VS Code extension. The root CLI package
and VS Code extension use aligned numeric dogfood release versions, but the project has not declared
a stable public API contract yet.

The official CLI path for public alpha and beta users is the npm package. Source-based installation
is for contributors, repository dogfooding, and release artifact testing.

## Requirements

- Node.js 20 or newer for the CLI.
- pnpm 10.34.4, via Corepack or a local pnpm install, only when developing this repository from
  source.
- Git, with enough history for `--base` comparisons.
- VS Code only when installing or testing the editor extension.

Review [../SECURITY.md](../SECURITY.md) before enabling Critical Gate in shared CI, trusted Codex
hooks, or editor workflows that may process private repositories.

Enable pnpm with Corepack when working from source:

```bash
corepack enable
corepack prepare pnpm@10.34.4 --activate
```

## CLI

Run without installing:

```bash
npx critical-gate check --task "Add signup validation" --base main --format markdown
```

Or with pnpm:

```bash
pnpm dlx critical-gate check --task "Add signup validation" --base main --format markdown
```

Install in a repository for repeated local, hook, and CI use:

```bash
npm install -D critical-gate
```

With pnpm:

```bash
pnpm add -D critical-gate
```

Common commands:

```bash
npx critical-gate --version
npx critical-gate init --install
npx critical-gate check --task "Add signup validation" --base main --format markdown
npx critical-gate check --task "Add signup validation" --format json --output critical-gate.json
npx critical-gate check --task "Add signup validation" --format sarif --output critical-gate.sarif
npx critical-gate check --task "Add signup validation" --format repair
npx critical-gate snapshot-api
npx critical-gate install-hooks
npx critical-gate init-policy
npx critical-gate init-agent
```

When `critical-gate` is installed as a dev dependency, package scripts and local git hooks can call
`critical-gate` directly.

## Project Initializer

Initialize Critical Gate in observe-only mode for an existing JavaScript or TypeScript repository:

```bash
npx critical-gate init --install
```

The initializer detects npm, pnpm, bun, or yarn from lockfiles. With `--install`, it adds
`critical-gate` as a dev dependency using the detected package manager; without `--install`, it only
writes reviewable setup files.

Generated setup includes:

- `gate`, `gate:base`, `gate:sarif`, and `gate:evidence` package scripts.
- `.critical-gate.json` with detector families in observation mode and `failOn: "blocker"`.
- `scripts/critical-gate-evidence.mjs` for durable Markdown and JSON evidence exports.
- `docs/critical-gate-dogfood.md` and `docs/critical-gate-evidence/README.md`.
- Advisory GitHub SARIF workflow at `.github/workflows/critical-gate.yml`.
- Managed Critical Gate instructions in `AGENTS.md`.
- Generated report/cache entries in `.gitignore`.

Useful options:

```bash
npx critical-gate init --package-manager pnpm --install
npx critical-gate init --version 2.10.1 --install
npx critical-gate init --skip-workflow
npx critical-gate init --skip-agent
npx critical-gate init --force
```

Exit codes:

- `0`: pass.
- `1`: findings failed the configured threshold.
- `2`: usage or configuration error.
- `3`: internal error.

## Development From Source

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

## Agent Instructions

Initialize durable agent instructions in a consumer repository:

```bash
npx critical-gate init-agent
```

This creates or updates a managed Critical Gate section in `AGENTS.md`. Existing user instructions
are preserved, and repeated runs replace only the managed Critical Gate block. Use `--cli <command>`
when agents should run a project-local command:

```bash
npx critical-gate init-agent --cli "npx critical-gate"
```

The generated section tells agents how to run `check`, `hook`, `snapshot-api`, `init-policy`, and
`install-hooks`, and it explicitly keeps Critical Gate scoped to evidence-backed diff integrity
rather than generic review or automatic fixes.

## GitHub Action

Use the versioned public action in consumer repositories. The action runs the npm-published CLI by
default, so workflows do not need to install pnpm or build Critical Gate from source.

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
        uses: criticaldeveloper/critical-gate@v2
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

Pin the CLI package version only when needed:

```yaml
with:
  version: "2.4.0"
```

Maintainers can run the action from a source checkout with local mode:

```yaml
- id: critical-gate
  uses: ./
  with:
    version: local
    task: ${{ github.event.pull_request.title }}
```

For release artifacts, build and smoke-test the prebuilt action directory:

```bash
pnpm package:action
pnpm smoke:action
```

That writes `artifacts/action` with `action.yml`, required package metadata, and prebuilt `dist/`
output. It intentionally excludes `node_modules`. Only use `install: "false"` and `build: "false"`
with local mode and an artifact that has passed the smoke check:

```yaml
with:
  version: local
  install: "false"
  build: "false"
```

## Codex Hook

For consumer repositories, run hook mode through the installable CLI:

```bash
npx critical-gate hook --base main
```

A Codex `Stop` hook can call that command after the agent finishes a task:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx critical-gate hook --base main",
            "timeout": 60,
            "statusMessage": "Running Critical Gate"
          }
        ]
      }
    ]
  }
}
```

Review hook commands before trusting them. Hooks should report evidence-backed findings and compact
repair guidance; they should not mutate files directly.

This repository includes a source-oriented dogfood hook at `.codex/hooks.json`. It builds the local
checkout and runs `node dist/cli.js`, so use it only when developing Critical Gate itself.

To use this repository's dogfood hook locally:

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

The dogfood `Stop` hook builds Critical Gate and runs compact repair output:

```bash
ROOT=$(git rev-parse --show-toplevel) && pnpm --dir "$ROOT" --silent build && node "$ROOT/dist/cli.js" hook --base main
```

On Windows, the sample hook also includes `commandWindows` using PowerShell.

## VS Code Extension

Install the public Marketplace extension:

<https://marketplace.visualstudio.com/items?itemName=criticaldeveloper.critical-gate-vscode>

After installing:

1. Open a local git repository in VS Code.
2. Open the `Critical Gate` Activity Bar view or run `Critical Gate: Run Check`.

The extension bundles the analyzer by default, so users do not need to clone this repository or
install a global CLI for the editor surface.

Optional settings:

- `criticalGate.task`: task intent to avoid prompting.
- `criticalGate.base`: git base ref or SHA.
- `criticalGate.cliPath`: optional custom CLI path. Leave empty to use the bundled analyzer.
- `criticalGate.refreshMode`: `manual` or `onSave`.
- `criticalGate.refreshDebounceMs`: on-save debounce delay.

## Development VSIX

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

The extension provides a `Gate Runs` dashboard, Problems diagnostics, a `Critical Gate` output
channel report, evidence navigation, repair-copy actions, and status bar pass/fail state.

## Verification

After installation changes, run:

```bash
pnpm verify
pnpm audit
pnpm test:vscode
pnpm package:vscode
```

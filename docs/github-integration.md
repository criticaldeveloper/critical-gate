# GitHub Integration

Critical Gate can run as a GitHub Action or as plain CLI steps in a workflow. The
recommended first integration is SARIF upload, because GitHub can attach findings to code scanning
while the workflow still fails on blocker or high-severity findings.
Installation steps live in `docs/installation.md`.

## Public Composite Action

The repository exposes a composite action at `action.yml`. For third-party repositories, use the
versioned public action. The action runs the npm-published CLI by default, so consumer workflows do
not need pnpm, a Critical Gate source checkout, or a local TypeScript build.

```yaml
- name: Run Critical Gate
  uses: criticaldeveloper/critical-gate@v2
  with:
    task: ${{ github.event.pull_request.title }}
    base: ${{ github.event.pull_request.base.sha }}
    format: sarif
    output: critical-gate.sarif
```

By default, the action runs:

```bash
npx --yes critical-gate@<version> check --task "<task>" --base "<base>" --format sarif --output critical-gate.sarif
```

The `version` input defaults to the package version declared by the release. Pin it only when a
workflow needs to test a specific CLI package version:

```yaml
with:
  version: "2.8.0"
```

Use `version: local` only for Critical Gate maintainer workflows, source checkouts, or smoke-tested
prebuilt action artifacts. Local mode uses pnpm and runs:

```bash
node "$GITHUB_ACTION_PATH/dist/cli.js" check ...
```

The `install` and `build` inputs are ignored for npm package runs. They apply only when
`version: local`.

Pass `task-contract` when the checked-out repository contains a structured JSON contract. The
action forwards it to the CLI, where explicit paths, artifacts, invariants, and required checks take
precedence over free-text inference:

```yaml
with:
  task: ${{ github.event.pull_request.title }}
  task-contract: .critical-gate/task-contract.json
```

## Prebuilt Action Artifact

Release builds can prepare a self-contained action directory without `node_modules`:

```bash
pnpm package:action
pnpm smoke:action
```

The package script builds the CLI and writes `artifacts/action` with:

- `action.yml`
- `package.json`
- `README.md` and `LICENSE`
- `ACTION_ARTIFACT.md`
- prebuilt `dist/`

Use that artifact with local mode:

```yaml
with:
  version: local
  install: "false"
  build: "false"
```

Source checkouts should use `version: local` and keep the install/build defaults. The prebuilt mode
is only for release artifacts that have passed `pnpm smoke:action`.

For push workflows, make the task intent cover the same range as the selected base. If one push
contains multiple commits, join all commit messages from the push payload instead of using only the
head commit message.

## Maintainer CI Runtime Matrix

Critical Gate supports Node 20 and newer for the CLI. The maintained CI workflow runs core
verification on Node 20, Node 22, and Node 24 on Ubuntu, because most analyzer behavior is
platform-independent and should stay stable across supported Node runtimes.

The CI workflow also keeps a focused Windows CLI smoke job on Node 24. That job builds the CLI,
checks help output, and writes a JSON report through a Windows-style output path so path handling is
covered without duplicating the full verification suite on every operating system.

VS Code extension packaging intentionally stays in `.github/workflows/vscode-extension.yml`. It runs
only on relevant paths or manual dispatch so the normal CI path remains fast.

## SARIF Upload Workflow

Use full git history so repository intelligence and base comparisons have enough context.
Copy the maintained template from `docs/workflows/critical-gate-sarif.yml` when you want GitHub code
scanning annotations.

```yaml
name: Critical Gate

on:
  pull_request:

permissions:
  actions: read
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
        continue-on-error: true
        with:
          sarif_file: critical-gate.sarif

      - if: steps.critical-gate.outcome == 'failure'
        run: exit 1
```

## Checks Summary Workflow

For repositories that do not use GitHub code scanning, emit Markdown to the job summary and rely on
the failed check as the blocking signal.
Copy the maintained template from `docs/workflows/critical-gate-summary.yml`.

```yaml
name: Critical Gate

on:
  pull_request:

permissions:
  actions: read
  contents: read
  pull-requests: read

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
          format: markdown
          output: critical-gate.md

      - if: always() && hashFiles('critical-gate.md') != ''
        run: cat critical-gate.md >> "$GITHUB_STEP_SUMMARY"

      - if: steps.critical-gate.outcome == 'failure'
        run: exit 1
```

## Recommended Thresholds

Start with the default threshold: fail the workflow on blocker and high findings, and report medium,
low, and info findings without blocking. This matches the CLI decision model and keeps early rollout
focused on high-confidence failures.

Keep SARIF upload best-effort with `continue-on-error: true`. Code scanning ingestion can fail
independently of the gate decision because of repository permissions, branch protection settings, or
GitHub-side SARIF validation. The final `steps.critical-gate.outcome == 'failure'` step remains the
blocking signal for Critical Gate findings.

Use `strict: "true"` only after the repository has several clean runs and the team agrees that medium
findings should become actionable. The current strict flag is passed through in metadata for
compatibility with future detector thresholds.

Recommended rollout:

1. Run on pull requests with SARIF upload and default thresholds.
2. Review medium findings for one or two weeks without blocking merges.
3. Add task text from PR titles, issue summaries, or release notes rather than generic workflow names.
4. Tune noisy findings with better task text, repository docs, or `.critical-gate.json` policy.
5. Enable stricter thresholds only after noisy detectors have been tuned for the repository.
6. Keep `fetch-depth: 0` for better base diffs, co-change history, and repository intelligence.

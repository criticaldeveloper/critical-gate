# GitHub Integration

Critical Gate can run as a GitHub Action or as plain CLI steps in a workflow. The
recommended first integration is SARIF upload, because GitHub can attach findings to code scanning
while the workflow still fails on blocker or high-severity findings.
Installation steps live in `docs/installation.md`.

## Composite Action

The repository exposes a composite action at `action.yml`.

```yaml
- name: Run Critical Gate
  uses: ./
  with:
    task: ${{ github.event.pull_request.title }}
    base: ${{ github.event.pull_request.base.sha }}
    format: sarif
    output: critical-gate.sarif
```

The action uses pnpm, builds the package when needed, and runs:

```bash
node dist/cli.js check --task "<task>" --base "<base>" --format sarif --output critical-gate.sarif
```

For a published action, keep `dist/` available in the release package or leave `build: "true"` so
the composite action can compile before it runs.

## SARIF Upload Workflow

Use full git history so repository intelligence and base comparisons have enough context.

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

## Checks Summary Workflow

For repositories that do not use GitHub code scanning, emit Markdown to the job summary and rely on
the failed check as the blocking signal.

```yaml
- name: Run Critical Gate summary
  run: |
    pnpm build
    node dist/cli.js check \
      --task "${{ github.event.pull_request.title }}" \
      --base "${{ github.event.pull_request.base.sha }}" \
      --format markdown \
      --output critical-gate.md

- name: Publish Critical Gate summary
  if: always() && hashFiles('critical-gate.md') != ''
  run: cat critical-gate.md >> "$GITHUB_STEP_SUMMARY"
```

## Recommended Thresholds

Start with the default threshold: fail the workflow on blocker and high findings, and report medium,
low, and info findings without blocking. This matches the CLI decision model and keeps early rollout
focused on high-confidence failures.

Use `strict: "true"` only after the repository has several clean runs and the team agrees that medium
findings should become actionable. The current strict flag is passed through in metadata for
compatibility with future detector thresholds.

Recommended rollout:

1. Run on pull requests with SARIF upload and default thresholds.
2. Review medium findings for one or two weeks without blocking merges.
3. Add task text from PR titles, issue summaries, or release notes rather than generic workflow names.
4. Enable strict mode only after noisy detectors have been tuned for the repository.
5. Keep `fetch-depth: 0` for better base diffs, co-change history, and repository intelligence.

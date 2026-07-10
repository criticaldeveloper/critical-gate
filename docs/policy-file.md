# Policy File

Critical Gate reads optional repository policy from `.critical-gate.json` at the repository root.
The policy file is reviewable policy-as-code: it should explain team-specific rollout choices and
normal support-file relationships without hiding risky diffs globally.

Create a starter policy with:

```bash
node dist/cli.js init-policy
git add .critical-gate.json
```

CLI flags still override policy for a single run. For example, `--fail-on blocker` is stricter or
looser than the stored policy only for that invocation.

Markdown and PR-comment reports include a compact "Policy Applied" section showing the effective
fail threshold, observation detectors, blocking detector overrides, and accepted findings applied to
that run.

## Top-Level Keys

### `policy`

Primary review policy for teams.

Fields:

- `failOn`: one of `blocker`, `high`, or `medium`. Defaults to the CLI decision model when omitted.
- `detectorOverrides`: reviewable detector rollout choices.
- `expectedCompanions`: expected support-file rules that can make companion files normal for a
  repository.
- `allowedSupportFiles`: support-file allowances for known operational patterns such as config docs
  or lockfile updates.
- `publicApi`: public API entrypoint policy used by API snapshot generation and unsnapshotted API
  export checks.

Prefer `policy` for durable team defaults.

### `rollout`

Legacy rollout controls still supported for compatibility.

Fields:

- `observationDetectors`: detector ids to keep non-blocking.
- `blockingDetectors`: detector ids to promote when evidence strength and severity allow it.
- `failOn`: one of `blocker`, `high`, or `medium`.

When both `policy` and `rollout` are present, policy helpers merge detector overrides with rollout
lists. `policy.failOn` takes precedence over `rollout.failOn`.

### `learning`

Reviewable local learning entries, usually written by CLI commands.

Fields:

- `acceptedFindings`: exact finding ids accepted after review.
- `expectedSupportFiles`: support-file rules taught with `critical-gate teach`.

Use `learning` for repository-specific exceptions or conventions. Do not use it to hide one-off
risky changes that should be fixed, split, or documented.

### Repository Shape Keys

These keys tune deterministic repository understanding:

- `frameworkPacks`: force framework packs such as `react`, `astro`, `vite`, or `storybook`.
- `patternAliases`: map local path vocabulary to common project concepts.
- `featureRoots`: folders that contain feature-oriented code.
- `serviceRoots`: folders that contain service or backend logic.
- `validatorRoots`: folders that contain validation helpers.
- `excludePatterns`: generated or low-signal path patterns to exclude from repository intelligence.

## Rule Shapes

### Detector Overrides

```json
{
  "detector": "expected-companions",
  "mode": "observation",
  "reason": "Companion findings are useful during rollout but should not block yet."
}
```

Fields:

- `detector`: detector id.
- `mode`: `blocking` or `observation`.
- `reason`: reviewable explanation for the override.

Promotion does not bypass evidence-strength thresholds. A detector still needs a finding with
sufficient severity and evidence strength to fail the gate.

Detector maturity is reported separately from these overrides. A `review` detector is not
automatically blocking in every repository, and an `experimental` detector promoted through policy
still remains labeled experimental until external evidence supports promotion.

Task contracts are supplied per run with `--task-contract <json-file>`, not stored as durable policy.
Use policy for repository-wide defaults and rollouts; use task contracts for the specific diff
boundary, allowed paths, forbidden paths, invariants, and required checks for one agent task.

### Support-File Rules

```json
{
  "id": "docs-for-config",
  "whenChanged": ".github/workflows/**",
  "allow": ["docs/**/*.md", "README.md", "CHANGELOG.md"],
  "reason": "Workflow changes may include visible operational documentation.",
  "createdAt": "2026-06-21T00:00:00.000Z"
}
```

Fields:

- `id`: stable rule id.
- `whenChanged`: changed-file glob that activates the rule.
- `allow`: support-file globs accepted when the rule is active.
- `reason`: reviewable explanation.
- `createdAt`: ISO timestamp.

### Public API Entrypoints

```json
{
  "policy": {
    "publicApi": {
      "entrypoints": ["src/index.ts", "src/testing.ts"]
    }
  }
}
```

Fields:

- `entrypoints`: package public entrypoint files to treat as public API when package metadata is not
  enough or the repository intentionally exposes additional files.

## Example Policies

Validated examples live under `docs/examples/policies/`.

- `conservative-rollout.json`: default-style rollout for early adoption.
- `strict-rollout.json`: stricter policy after dogfooding and clean runs.
- `library-api-snapshot-rollout.json`: library policy for committed public API snapshots.
- `monorepo-ownership-tuning.json`: package/workspace vocabulary and support-file tuning.

These examples are loaded by `tests/config.test.ts`, so docs and parser behavior stay aligned.

## Current Limits

- Policy-defined public API entrypoints are supported through `policy.publicApi.entrypoints`, but
  glob entrypoints are not supported. Use explicit files so the public contract stays reviewable.
- `excludePatterns` tunes repository intelligence. It is not a security boundary and should not be
  used to hide sensitive files from other tools.
- `acceptedFindings` match exact finding ids. They are not broad suppressions.

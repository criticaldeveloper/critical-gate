# mv-ft Dogfood Evidence - 2026-06-19

## Purpose

This dogfood pass tested Critical Gate against `mv-ft`, a real Astro/TypeScript/SCSS project, using
ten realistic agent-development tasks. The goal was to measure whether the gate catches risky
agent-produced diffs, whether repair guidance is actionable, and which misses should become
regression fixtures before release.

The run was intentionally adversarial: each risky scenario implemented a plausible but flawed agent
change, collected the gate result, attempted a scoped repair when useful, then restored the target
repository before moving to the next scenario.

## Method

- Scenario source: `dogfood/scenarios/mv-ft.json`.
- Target repository: `C:/dev/mv-ft`.
- Artifact root: `artifacts/dogfood/mv-ft-2026-06-19`.
- Summary artifacts: `summary.md`, `metrics.json`, `report.html`, and `screenshots/overview.png`.

Each scenario recorded:

- Task prompt.
- Before/after diff.
- Gate JSON, Markdown, and repair output.
- Human label: true positive, true negative, false positive, false negative, or useful observation.
- Repair outcome and evidence quality.

## Initial Dogfood Result

The first pass showed strong precision but weak recall.

| Metric                  | Result |
| ----------------------- | -----: |
| Labeled scenarios       |     10 |
| True positives          |      3 |
| True negatives          |      2 |
| False positives         |      0 |
| False negatives         |      4 |
| Useful observations     |      1 |
| Scenario precision      |   100% |
| Scenario recall         |  42.9% |
| Repair success rate     |    30% |
| Estimated minutes saved |   14.2 |

Interpretation:

- Precision was healthy: no scenario produced a blocking false positive.
- Recall was not release-quality yet: four risky changes passed or stayed observational.
- Repair success was limited by the misses, not by the actionable findings. The three true-positive
  blocking scenarios had specific repair guidance and passed after repair.

## Scenario Outcomes

| ID    | Scenario                                     | Expected              | Initial outcome | Detector signal                   | Result             |
| ----- | -------------------------------------------- | --------------------- | --------------- | --------------------------------- | ------------------ |
| DF-01 | Tiny typography token change                 | Pass                  | Pass            | None                              | True negative      |
| DF-02 | Underimplemented visible feature             | Fail                  | Fail            | `intent-coverage` high            | True positive      |
| DF-03 | Unrelated stylesheet deletion                | Fail                  | Fail            | `scope` high                      | True positive      |
| DF-04 | Large rewrite for copy update                | Fail/high observation | Pass            | `expected-companions` medium only | False negative     |
| DF-05 | Legitimate multi-file works section          | Pass/observation      | Pass            | `blast-radius` low                | Useful observation |
| DF-06 | Test weakening during refactor               | Fail                  | Pass            | `blast-radius` low only           | False negative     |
| DF-07 | Unjustified dependency for simple formatting | Fail                  | Fail            | `dependency-addition` blocker     | True positive      |
| DF-08 | Config drift during UI task                  | Fail                  | Pass            | Low/medium observations only      | False negative     |
| DF-09 | Silent framework contract export change      | Fail                  | Pass            | None                              | False negative     |
| DF-10 | Existing solution duplication                | Pass/observation      | Pass            | None                              | True negative      |

## What Worked

### Intent Undercoverage

For a task asking to add a visible works section, a cosmetic stylesheet-only change failed with a
high-confidence `intent-coverage` finding. The repair loop produced a component plus page wiring,
then the gate passed with only a low observation.

Value: catches agents that make a tiny plausible edit while failing the actual requested outcome.

### Scope Deletion

Deleting `src/styles/reset.scss` during a font task failed with a high-confidence `scope` finding.
Restoring the deletion and keeping the intended typography change passed.

Value: catches unrelated destructive edits during small tasks.

### Dependency Discipline

Adding `dayjs` for simple date formatting failed with a blocker `dependency-addition` finding and a
lockfile companion observation. Replacing the dependency with native `Intl.DateTimeFormat` passed.

Value: prevents unnecessary production dependency drift and gives a clear repair path.

### Clean Passes

Small typography token changes and a non-applicable utility-duplication scenario passed cleanly.

Value: the gate did not punish legitimate narrow work just because it touched source files.

## Misses Converted Into Fixes

The useful outcome of this dogfood pass was not that the first run looked perfect. It did not. The
useful outcome was that each meaningful miss became a deterministic regression case.

| Dogfood miss                                                          | Fix branch                     | Eval case                               | Current behavior                             |
| --------------------------------------------------------------------- | ------------------------------ | --------------------------------------- | -------------------------------------------- |
| DF-04: broad Astro component rewrite for copy-only task passed        | `bugfix/rewrite-role-fallback` | `copy-component-rewrite-001`            | Fails with high `rewrite` finding            |
| DF-06: added skipped test in a new/untracked test file passed         | `bugfix/untracked-file-hunks`  | `skipped-test-added-001`                | Fails with high `test-weakening` finding     |
| DF-08: `.node-version` changed during UI task passed                  | `bugfix/config-drift-intent`   | `config-runtime-pin-drift-001`          | Fails with high `scope` plus config evidence |
| DF-09: Astro `collections` export removal passed without API snapshot | `bugfix/api-contract-fallback` | `framework-contract-export-removed-001` | Fails with high `api-surface` finding        |

## Current Evaluation Baseline

After promoting the dogfood misses into `eval/cases`, the deterministic evaluation harness reports:

| Metric            | Result |
| ----------------- | -----: |
| Cases             |     10 |
| True positives    |      8 |
| True negatives    |      2 |
| False positives   |      0 |
| False negatives   |      0 |
| Case precision    |   100% |
| Case recall       |   100% |
| Finding precision |   100% |
| Finding recall    |   100% |

Current dogfood-derived eval cases:

- `copy-component-rewrite-001`
- `skipped-test-added-001`
- `config-runtime-pin-drift-001`
- `framework-contract-export-removed-001`

This is not a claim that Critical Gate catches every possible risky diff. It means the known
dogfood failures from this run are now preserved as regression cases and pass the deterministic
evaluation suite.

## Repair Loop Value

The clearest cost savings came from findings with concrete repair instructions:

- Remove or justify an unrelated deletion.
- Replace an unnecessary dependency with native/local functionality.
- Implement the requested UI feature instead of a cosmetic substitute.
- Restore a removed framework contract export.

The gate is most valuable when run immediately after an agent finishes a task, before a human spends
time reading the whole diff. A good loop is:

1. Agent implements the task.
2. Critical Gate runs with the task intent and working-tree diff.
3. If the gate fails, pass the repair output back to the agent.
4. Agent repairs only the cited evidence.
5. Critical Gate reruns.

## Remaining Limits

- The dogfood sample is one real Astro/TypeScript repository. More repositories are needed before
  making broader ecosystem claims.
- The current public metrics are deterministic fixtures plus one real dogfood pass, not a large
  benchmark.
- Existing-solution detection needs repositories with richer local utility history to produce useful
  dogfood proof.
- Framework-contract fallback is conservative and should grow through fixtures rather than broad
  guesses.

## Release Implication

This dogfood pass supports publishing the current detector set as useful for TypeScript/JavaScript
and Astro-style repositories, with honest scope:

- Strong for small-task scope drift, dependency additions, skipped/removed/weakened tests, broad
  rewrites, and config/runtime drift.
- Useful but still growing for framework contract and repository-intelligence checks.
- Not a substitute for tests, linters, or human review; it is a cheap pre-review integrity gate.

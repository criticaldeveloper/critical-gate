# criticaldeveloper-ft 2.6.0 Evidence Analysis

Generated from the `criticaldeveloper-ft` evidence run on 2026-06-24 after upgrading that project
to Critical Gate 2.6.0.

## Result

- Aggregated reports: 39 across 3 repositories.
- Aggregator validation errors: 0.
- `criticaldeveloper-ft` reports: 14.
- `criticaldeveloper-ft` missed-finding reviews captured: 8.
- New 2.6.0 FT report:
  `083953-upgrade-critical-gate-dependency-and-evidence-workflow-to-2-6-0`.
- Gate decision: pass.
- Findings: 3 medium observations.
- Reviewed false-positive findings: 3.
- Useful findings: 0.
- Missed findings: 0.

## Remaining 2.6.0 FT Findings

- `intent-verification:missing-config-tooling`
- `expected-companions:bun.lock:src/styles/global.scss`
- `expected-companions:package.json:src/styles/global.scss`

These were reviewed as non-blocking false positives for a narrow Critical Gate package upgrade. The
package and lockfile changed as expected, and no `src/styles/global.scss` companion was required.
The intent-verification observation appears to come from the phrase "evidence workflow", but the task
did not require changing scripts or policy configuration.

## Interpretation

This run does not prove that every historical FT false positive is fixed. It is a new package-upgrade
task, not a replay of the older UI tasks that produced the 2.6.0 calibration fixtures.

What it does show:

- The upgraded FT project can run Critical Gate 2.6.0 and produce valid evidence.
- The run passed with observation-mode findings only.
- The 2.6.0 UI calibration did not introduce blocking regressions in this package-upgrade task.
- A new globally useful calibration candidate exists for package-only Critical Gate upgrades:
  historical expected-companion rules can overreach from `package.json`/lockfile changes to unrelated
  style files.

What still needs proof:

- Replay or re-run equivalent UI tasks under 2.6.0 to measure whether the previous FT UI false
  positives drop in real reports, not only in eval fixtures.
- Add a dependency-upgrade false-positive regression fixture if the package/lockfile to unrelated
  style companion pattern repeats in another project or is easy to generalize safely.
- Continue capturing missed-finding reviews and repair-loop outcomes; this evidence set still has no
  repair attempts or reruns.

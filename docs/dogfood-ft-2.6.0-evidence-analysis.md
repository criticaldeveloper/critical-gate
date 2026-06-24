# criticaldeveloper-ft 2.6.0 Evidence Analysis

Generated from the `criticaldeveloper-ft` evidence runs on 2026-06-24 after upgrading that project
to Critical Gate 2.6.0 and replaying the previous UI false-positive patterns.

## Result

- Aggregated reports: 40 across 3 repositories.
- Aggregator validation errors: 0.
- `criticaldeveloper-ft` reports: 15.
- `criticaldeveloper-ft` missed-finding reviews captured: 9.
- New 2.6.0 FT package-upgrade report:
  `083953-upgrade-critical-gate-dependency-and-evidence-workflow-to-2-6-0`.
- Gate decision: pass.
- Findings: 3 medium observations.
- Reviewed false-positive findings: 3.
- Useful findings: 0.
- Missed findings: 0.
- New 2.6.0 FT UI replay report:
  `090427-replay-about-card-layout-project-arrow-contact-spacing-and-now-playing-vinyl-ui-`.
- UI replay gate decision: pass.
- UI replay findings: 1 medium observation.
- UI replay reviewed false-positive findings: 1.
- UI replay missed findings: 0.

## UI Replay Result

The replay covered the old 2026-06-23 UI false-positive patterns:

- about information cards layout and list-marker removal;
- about-card masonry alignment and project-card arrow treatment;
- about CTA placement and layout stabilization;
- about CTA margin and global consent banner visibility;
- contact card spacing and now-playing vinyl replacement;
- now-playing vinyl spin behavior.

The old UI evidence had 30 false-positive finding instances across those six reports. Under Critical
Gate 2.6.0, the replay produced 1 remaining reviewed false-positive observation:

- `repository-intelligence:src/components/NowPlaying.astro`

The prior rewrite, scope, blast-radius, and expected-companion noise did not recur when the task
explicitly named about cards, project arrow, contact spacing, and now-playing vinyl. This is the
strongest current project-level evidence that the 2.6.0 UI calibration improved the package
generally rather than only changing fixtures.

## Remaining 2.6.0 FT Package-Upgrade Findings

- `intent-verification:missing-config-tooling`
- `expected-companions:bun.lock:src/styles/global.scss`
- `expected-companions:package.json:src/styles/global.scss`

These were reviewed as non-blocking false positives for a narrow Critical Gate package upgrade. The
package and lockfile changed as expected, and no `src/styles/global.scss` companion was required.
The intent-verification observation appears to come from the phrase "evidence workflow", but the task
did not require changing scripts or policy configuration.

## Interpretation

What it does show:

- The upgraded FT project can run Critical Gate 2.6.0 and produce valid evidence.
- Both 2.6.0 FT runs passed with observation-mode findings only.
- The 2.6.0 UI calibration reduced the old FT UI false-positive profile from 30 finding instances
  to 1 remaining observation in a real replay run.
- The remaining UI replay noise is now isolated to `repository-intelligence`, not rewrite, scope,
  blast-radius, or expected-companions.
- A new globally useful calibration candidate exists for package-only Critical Gate upgrades:
  historical expected-companion rules can overreach from `package.json`/lockfile changes to unrelated
  style files.

What still needs proof:

- Convert the remaining UI replay `repository-intelligence` false positive into a fixture if the
  pattern can be generalized safely.
- Add a dependency-upgrade false-positive regression fixture if the package/lockfile to unrelated
  style companion pattern repeats in another project or is easy to generalize safely.
- Continue capturing missed-finding reviews and repair-loop outcomes; this evidence set still has no
  repair attempts or reruns.

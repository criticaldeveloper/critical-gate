# diegolopes-ft 2026-06-30 Evidence Analysis

Generated from the `diegolopes-ft` evidence runs collected through 2026-06-30.

## Result

- `diegolopes-ft` reports: 42.
- Missed-finding reviews captured: 42.
- Missed findings: 0.
- Useful findings: 40.
- False-positive finding instances: 149.
- Fixture-needed reports: 8.
- Repair attempts captured: 4.
- Repair reruns captured: 4.
- Repairs passing rerun: 4.

## Newest Batch

The newest 15 reports added after the previous aggregate covered responsive visual polishing,
section navigation, identity/video layout, SEO/favicon metadata, mobile usability, and README
documentation.

For that newest slice:

- Findings: 91.
- Useful findings: 1.
- False-positive findings: 90.
- Fixture-needed reports: 1.
- Repair attempts: 1.
- Clean runs: 5.

The one useful finding came from
`150916-delay-navigator-labels-during-navigation-update-youtube-layout-and-win-streak`, where
Critical Gate caught an out-of-scope `.env.example` deletion. The repair rerun removed the
unrelated deletion and passed, giving useful repair-loop evidence.

## Dominant False-Positive Pattern

The strongest new package signal is not more generic UI noise. It is a specific repeatable pattern:

- `expected-companions`: 102 false-positive instances across the full `diegolopes-ft` set.
- `scope`: 36 false-positive instances.
- `blast-radius`: 20 false-positive instances.
- `repository-intelligence`: 3 false-positive instances.

Most new false positives come from Astro component-owned visual changes where the task explicitly
names coordinated section, navigator, background, video, favicon, SEO, or mobile layout work.

The current expected-companion suppression handles small focused UI presentation diffs, but the
fresh-site evidence shows that real static Astro work often touches more than six component/style
files in one coherent visual task. Examples:

- `145754-fix-navigator-label-stacking-and-swap-identity-and-end-frame-backgrounds`
- `150916-delay-navigator-labels-during-navigation-update-youtube-layout-and-win-streak`
- `152500-use-tall-final-frame-background-with-left-clip-reveal`
- `160444-update-section-urls-social-layout-and-bottom-note`
- `162050-fix-navigator-hover-state-memory-intro-font-and-final-background-sizing`
- `163951-add-favicon-assets-and-seo-metadata`

These tasks were validated with builds and browser checks. The missing-companion findings were
reviewed as noise because the changed Astro components owned their visual behavior directly, and no
separate style/script/test companion was required by the project structure.

## What This Proves

- Critical Gate can produce durable evidence in a fresh real project, not only mature existing repos.
- Missed-finding review discipline is working in `diegolopes-ft`: every report includes a manual
  missed-finding check.
- Repair-loop capture is now real: the evidence includes repaired findings, reruns, and accepted
  repair outcomes.
- The package still over-reports expected companions for coherent static Astro visual work once the
  diff spans many section/component files.

## What This Does Not Prove Yet

- It does not justify disabling `expected-companions` globally.
- It does not prove all large UI diffs are safe. Vague visual tasks, structural prop/API changes,
  data-hook changes, generated files, config changes, and unrelated deletions still need findings.
- It does not prove the same calibration applies unchanged to React, Angular, backend, or package
  work.

## Next Package Work

1. Convert the Astro multi-section visual false-positive pattern into a generalized eval fixture.
2. Calibrate `expected-companions` so explicitly scoped static Astro visual tasks can touch a larger
   coherent set of component/style files without requiring unrelated style/script companions.
3. Keep findings for broad/vague UI tasks, structural component changes, data-hook changes, config
   drift, package drift, generated files, and unrelated deletions.
4. Add focused tests around the file-count boundary that currently makes the detector noisy.
5. Re-run the `diegolopes-ft` fixture after calibration and compare false-positive count before
   considering another release.

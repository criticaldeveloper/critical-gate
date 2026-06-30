# Evidence Index

This is the source-of-truth map for Critical Gate dogfood evidence, calibration proof, and future
evidence maintenance.

## Current Evidence Flow

Critical Gate evidence is collected from real project-level runs and then summarized in this repo.

1. Dogfood projects generate raw reports under their own `docs/critical-gate-evidence/<date>/`
   folders.
2. Each raw `.json` report must have a neighboring `.labels.json` sidecar with manual review labels.
3. `scripts/aggregate-dogfood-evidence.mjs` reads the configured project evidence folders and writes:
   - `artifacts/dogfood/evidence-summary.json`
   - `docs/dogfood-evidence-summary.md`
4. Repeated false-positive or missed-finding patterns become sanitized regression fixtures in
   `eval/cases/`.
5. Important before/after results get focused analysis docs in `docs/`.

The current aggregate report is `docs/dogfood-evidence-summary.md`.

## Raw Evidence Sources

The aggregator currently reads these local project evidence roots:

| Project                  | Evidence Root                                                | Current Role                                                  |
| ------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------- |
| `critical-components`    | `C:/dev/critical-components/docs/critical-gate-evidence/`    | Useful finding and clean-pass dogfood                         |
| `criticaldeveloper-blog` | `C:/dev/criticaldeveloper-blog/docs/critical-gate-evidence/` | False-positive regression source and fixture backlog          |
| `criticaldeveloper-ft`   | `C:/dev/criticaldeveloper-ft/docs/critical-gate-evidence/`   | UI calibration replay, upgrade evidence, missed-review labels |
| `diegolopes-ft`          | `C:/dev/diegolopes-ft/docs/critical-gate-evidence/`          | Fresh static Astro website dogfood and repair-loop discipline |

Raw evidence stays in the project that produced it. This repo keeps aggregate summaries, analysis
docs, and fixtures so package-level claims are auditable without copying every raw report.

## Core Evidence Documents

| Document                                            | Purpose                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| `docs/dogfood-evidence-summary.md`                  | Generated aggregate metrics across all labeled project reports             |
| `docs/dogfood-ft-2.6.0-evidence-analysis.md`        | Focused before/after analysis for the FT 2.6.0 calibration replay          |
| `docs/dogfood-diegolopes-ft-2026-06-30-analysis.md` | Fresh static Astro site evidence and expected-companion calibration target |
| `docs/dogfood-evidence-plan.md`                     | Evidence strategy, labeling protocol, and repair-loop rubric               |
| `docs/dogfood-mv-ft-2026-06-19.md`                  | Historical manual dogfood report                                           |
| `docs/dogfood-ky-2026-06-18.md`                     | Historical public-repo dogfood report                                      |
| `docs/evaluation-strategy.md`                       | Fixture evaluation strategy and precision/recall reporting                 |
| `docs/detector-quality.md`                          | Detector boundaries, known blind spots, and fixture coverage expectations  |

## Regression Fixtures

`eval/cases/` is the durable package-level proof set. A dogfood finding should become a fixture when
it teaches a general detector behavior, not just one repository policy.

Current fixture categories include:

- false-positive regressions from dogfood projects;
- clean narrow-task passes;
- config drift;
- dependency drift;
- public API changes;
- underimplementation;
- unrelated rewrites;
- weakened tests.

When adding a fixture from dogfood evidence:

1. Sanitize the diff so it does not depend on private project content.
2. Keep `expected-findings.json` traceable with `sourceRepository`, `caseType`, and `labelSource`.
3. Prefer generalized detector behavior over repository-specific path exceptions.
4. Run `pnpm evaluate`.
5. Update detector docs when the behavior boundary changes.

## Legacy Scenario Definitions

`dogfood/scenarios/` is legacy/manual-runner planning material. It is not the current aggregate
evidence source.

The existing `dogfood/scenarios/mv-ft.json` file describes an older controlled scenario matrix for a
single target repository. Keep it for historical context and for future runner work, but do not treat
it as proof that current multi-repo evidence has been collected. Current proof comes from labeled
project reports, aggregate summaries, analysis docs, and eval fixtures.

## Required Label Fields

Every new `.labels.json` sidecar should include:

```json
{
  "schemaVersion": 1,
  "repo": "criticaldeveloper-ft",
  "gateVersion": "2.6.0",
  "reportId": "090427-example",
  "reportPath": "docs/critical-gate-evidence/2026-06-24/090427-example.json",
  "task": "Short task intent",
  "taskType": "ui-calibration-replay",
  "runLabel": "clean|useful|false-positive|pass-with-reviewed-observations",
  "decision": "pass|fail",
  "findingCount": 0,
  "usefulFindingCount": 0,
  "falsePositiveFindingCount": 0,
  "missedFindingCount": 0,
  "detectorsReviewed": [],
  "repairOutcome": "not-needed",
  "fixtureNeeded": false,
  "fixtureCreated": false,
  "notes": ""
}
```

Use these optional fields whenever applicable:

- `repairAttempted`
- `repairPromptCaptured`
- `repairPromptPath`
- `repairDiffPath`
- `rerunReportPath`
- `rerunDecision`
- `repairScopeStayedWithinTask`
- `repairScopeStayedWithinContract`
- `missedFindingsReviewed`
- `missedFindingNotes`
- `findingIdsReviewed`

## Maintenance Checklist

After every new dogfood batch:

1. Validate every new report has a complete `.labels.json` sidecar.
2. Set `missedFindingsReviewed: true` after manual review, including clean reports.
3. Record repair-loop fields when a finding is fed back to an agent or developer.
4. Run `node scripts/aggregate-dogfood-evidence.mjs`.
5. Review `docs/dogfood-evidence-summary.md` for validation errors and changed totals.
6. Add or update focused analysis docs for meaningful before/after results.
7. Convert repeated, generalizable false positives or misses into `eval/cases/` fixtures.
8. Run `pnpm evaluate` after fixture changes.
9. Commit raw evidence fixes in the source project and aggregate/docs changes in this repo.

## Current Open Evidence Gaps

- Repair-loop evidence has started, but the sample is still thin. Keep collecting scoped repair
  prompts, rerun reports, and human-accepted repair outcomes across different task types.
- `diegolopes-ft` has expanded fresh-project static Astro evidence. The strongest current package
  target, expected-companion and scope noise for coherent multi-section Astro visual tasks, is now
  represented by `eval/cases/astro-multisection-visual-001`.
- `criticaldeveloper-ft` has new PageSpeed/accessibility-performance evidence showing scope noise
  for local owner files (`BaseLayout.astro` and `global.scss`) during accessibility and CLS work.
- The remaining FT 2.6.0 UI replay `repository-intelligence` noise has been converted into the
  generalized `eval/cases/explicit-ui-surface-history-001` fixture.
- Package-only Critical Gate upgrades exposed expected-companion noise from package/lockfile changes
  to unrelated style files; add a fixture if the pattern repeats or can be generalized safely.

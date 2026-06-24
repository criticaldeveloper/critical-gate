# Dogfood Directory

This directory contains historical and future-runner dogfood planning assets.

It is not the current source of truth for collected evidence. Current evidence is maintained through:

- raw project reports under each dogfood project's `docs/critical-gate-evidence/` folder;
- `.labels.json` sidecars beside each raw report;
- aggregate output in `docs/dogfood-evidence-summary.md`;
- focused analysis docs such as `docs/dogfood-ft-2.6.0-evidence-analysis.md`;
- package-level regression fixtures under `eval/cases/`.

See `docs/evidence-index.md` for the current evidence map and maintenance checklist.

## Scenarios

`dogfood/scenarios/` contains controlled scenario definitions for manual or future automated dogfood
runners. The existing `mv-ft.json` file is legacy planning material from the earlier single-repo
dogfood phase.

Use scenario files for controlled experiments and repair-loop protocol work. Use labeled project
reports plus aggregate summaries for current proof of real dogfood evidence.

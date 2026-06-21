# Research Follow-Up 004: Coverage And Evaluation Evidence

## Status

Partially done

## Why

The research report's coverage and validation concerns are real, with nuance.

Evidence:

- `vitest.config.ts` configures test inclusion but no coverage provider, report, or threshold.
- `package.json` has no coverage script.
- `eval/cases` currently contains 10 case directories.
- `docs/evaluation-strategy.md` already states the seed corpus intentionally starts small and should grow with real false positives and false negatives.
- `docs/dogfood-mv-ft-2026-06-19.md` explicitly says more repositories are needed before treating the results as a broader benchmark.

The project is transparent about the small corpus, but public confidence would improve with measurable coverage and a larger evaluation set.

## Tasks

1. Add a coverage command for the TypeScript test suite. Done with `pnpm coverage`.
2. Decide initial coverage thresholds that are useful without creating churn in detector-heavy code. Done: 70% lines/statements/functions and 65% branches.
3. Add CI coverage reporting or at least a generated local coverage artifact documented in contributor docs. Done: documented local `coverage/` artifacts in `docs/evaluation-strategy.md`.
4. Expand `eval/cases` beyond the current 10 cases with real false positives, false negatives, and clean diffs from more than one repository. Not done: requires additional real dogfood/evaluation data and should not be fabricated.
5. Separate internal dogfood metrics from any public benchmark language in docs and release notes. Done in `docs/evaluation-strategy.md`.
6. Record per-detector precision/recall where the corpus is large enough; keep smaller detector families labeled as anecdotal. Done in the evaluation harness output.

## Validation

- `pnpm test`
- New coverage script
- `pnpm evaluate`

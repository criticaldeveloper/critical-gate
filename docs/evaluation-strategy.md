# Evaluation Strategy

## Evaluation Goal

Measure whether Critical Gate catches risky agent diffs with low noise and useful repair guidance.

The unit of learning is not whether a comment sounds good. The unit of learning is whether a detector correctly identified a risky diff pattern, missed it, or produced noise.

## Metrics

Track:

- True positives by detector.
- False positives by detector.
- False negatives by detector.
- Finding acceptance rate by humans.
- Repair success rate by agents.
- Runtime.
- LLM token cost when enabled.
- Gate pass/fail stability across repeated runs.

## Initial Dataset

Start with real internal examples before public benchmarks:

- Agent PRs accepted without changes.
- Agent PRs rewritten by humans.
- PRs where dependencies were reverted.
- PRs where config changed without documentation.
- PRs where tests were weakened.
- PRs where public APIs changed silently.
- Small tasks that produced large diffs.

Each case should include:

- Task intent.
- Diff.
- Human label.
- Expected findings.
- Acceptable false-positive notes.

## Fixture Types

Use deterministic fixtures for:

- Package manifest additions.
- Removed assertions.
- Skipped tests.
- Config changes.
- API export changes.
- Hardcoded secrets and absolute paths.
- Unrelated file edits.
- Large rewrites.
- Utility reinvention.

Each fixture should have positive and negative variants.

## Case-Based Harness

Run the case-based harness with:

```bash
pnpm evaluate
```

The command builds the CLI, reads labeled cases from `eval/cases`, runs the deterministic detector
pipeline for each case, and writes:

- `artifacts/evaluation/critical-gate-evaluation.json`
- `artifacts/evaluation/critical-gate-evaluation.md`

Each case directory contains:

```text
task.md
diff.patch
expected-findings.json
notes.md
```

Cases belong to one evaluation set:

- `development`: default. Cases may be inspected and used while implementing detector changes.
- `calibration`: used to tune thresholds and policy after implementation choices are made.
- `holdout`: frozen release-check evidence. Do not tune directly against holdout failures during the
  same release cycle; record the result first, then convert learnings into development cases for a
  later cycle.

Split by repository and team where possible, not by random diff, so near-duplicate local patterns do
not leak across development, calibration, and holdout evidence.

`expected-findings.json` declares whether the case should block and which detector findings are
required:

```json
{
  "evaluationSet": "development",
  "sourceRepository": "example/repo",
  "caseType": "weakened-test",
  "labelSource": "manual-review",
  "shouldBlock": true,
  "expectedFindings": [
    {
      "detector": "test-weakening",
      "severity": "high",
      "file": "tests/login.test.ts"
    }
  ]
}
```

The harness reports:

- True positives.
- True negatives.
- False positives.
- False negatives.
- Case precision and recall.
- Finding precision and recall.
- Development, calibration, and holdout metrics separately.
- Per-detector precision and recall when enough labeled cases exist; smaller detector samples stay
  labeled as anecdotal.
- Noisiest detector based on unexpected blocking findings.
- Best detector based on matched expected findings.

The seed corpus intentionally starts small. Add one case for every real false positive, false
negative, or valuable true positive found during dogfooding.
Do not describe this corpus as an external benchmark until it contains cases from multiple unrelated
repositories with independent labels.

The Phase 3 multilingual seed adds five manually reviewed synthetic/internal cases across the five
dogfood repository profiles: three development cases and two calibration cases. They cover Spanish
Unicode targets, mixed-language component/API tasks, and explicit dependency/config constraints.
Their label source is `manual-phase-3-multilingual-review-2026-07-11`; they are regression and
calibration evidence, not independent external validation.

## Current Baselines

Use these baselines when dogfooding Critical Gate on real repositories:

- Case precision: blocking decisions should stay high before new detectors become default blockers.
- Case recall: known risky diffs should remain blocked.
- Finding precision: unexpected blocking findings should stay low.
- Finding recall: expected detector/file/severity matches should not regress.
- Noisiest detector: prioritize tuning detectors that repeatedly appear here.

The latest tracked real-repository proof report is
`docs/dogfood-mv-ft-2026-06-19.md`. That run started with 10 labeled mv-ft scenarios, 100% scenario
precision, and 42.9% scenario recall. Four meaningful misses were converted into deterministic eval
cases. The current case harness baseline after those fixes is 10 cases, 100% case precision, 100%
case recall, 100% finding precision, and 100% finding recall.

These current baseline numbers are internal regression evidence, not a broad public benchmark. The
next evaluation milestone is to add labeled cases from at least one more real TypeScript/JavaScript
repository, covering false positives, false negatives, and clean diffs.

## Coverage Evidence

Run coverage with:

```bash
pnpm coverage
```

The command runs the TypeScript test suite with V8 coverage and writes:

- `coverage/index.html`
- `coverage/coverage-summary.json`
- terminal coverage summary output

CI uploads `coverage/index.html` and `coverage/coverage-summary.json` as the
`critical-gate-coverage` workflow artifact.

Initial thresholds are deliberately moderate so they catch major coverage regressions without
creating churn while detector heuristics are still changing:

- Lines: 70%
- Statements: 70%
- Functions: 70%
- Branches: 65%

Raise thresholds only after coverage is stable across detector and reporter changes.

## CI Evidence Artifacts

The CI workflow publishes quality evidence without requiring a hosted coverage service:

- `critical-gate-coverage`: `coverage/index.html` and `coverage/coverage-summary.json`.
- `critical-gate-evaluation`: `artifacts/evaluation/critical-gate-evaluation.json` and
  `artifacts/evaluation/critical-gate-evaluation.md`.

These artifacts are the public proof point for the latest test coverage and deterministic evaluation
run. Keep exact coverage percentages out of README unless they are generated automatically.

## Detector Quality Bar

A detector should not become a blocker until:

- It has fixtures.
- It cites concrete evidence.
- It has documented false-positive boundaries.
- It has a repair recommendation.
- It is stable across repeated runs.

## Human Review Loop

For every noisy finding, record:

- Detector name.
- File and line.
- Why the finding was wrong or unhelpful.
- Whether impact severity, evidence strength, or policy decision was the issue.
- Whether repo-specific context would have prevented it.

For every missed issue, record:

- The failure pattern.
- The missing signal.
- Whether deterministic analysis could catch it.
- Whether LLM interpretation is justified.

## Evidence-Strength Calibration

Current evidence-strength values are heuristic ranking signals, not correctness probabilities.
Follow [evidence-strength-calibration.md](evidence-strength-calibration.md) before fitting mappings,
publishing probability-like metrics, or using holdout results to choose policy thresholds. The
protocol defines detector subtypes, grouped dataset splits, minimum sample gates, metrics, and
threshold governance.

## Agent Repair Evaluation

A finding is repair-oriented if Codex or another coding agent can use it to improve the diff without broad rewrites.

Track:

- Did the agent remove unrelated files?
- Did it restore weakened tests?
- Did it remove or justify the dependency?
- Did it document public API or config changes?
- Did the second gate run pass?

## Rollout Strategy

1. Run in report-only mode on historical diffs.
2. Run in warning mode on local branches.
3. Run in CI warning mode.
4. Enable strict blockers for high-evidence detector subtypes that meet their quality bar.
5. Add repair loop once findings are precise.
6. Add editor diagnostics last.

## Observation Mode

New detector families are observation-friendly by default. They can emit findings, evidence, repair
guidance, SARIF, and editor diagnostics without failing the gate solely because they emitted a high
or blocker severity finding.

Default observation detector families:

- `intent-verification`
- `blast-radius`
- `existing-solution`
- `pattern-violation`
- `expected-companions`

Promote a detector family only after the fixture suite and dogfood runs show acceptable precision.
Use `.critical-gate.json`:

```json
{
  "rollout": {
    "blockingDetectors": ["expected-companions"],
    "observationDetectors": ["blast-radius", "existing-solution"]
  }
}
```

`blockingDetectors` takes precedence over `observationDetectors`. Legacy high-evidence detectors,
such as secrets, dependency additions, test weakening, API removals, rewrite risk, and legacy scope
findings, remain blocking unless explicitly added to `observationDetectors`.

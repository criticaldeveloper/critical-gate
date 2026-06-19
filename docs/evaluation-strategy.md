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

`expected-findings.json` declares whether the case should block and which detector findings are
required:

```json
{
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
- Noisiest detector based on unexpected blocking findings.
- Best detector based on matched expected findings.

The seed corpus intentionally starts small. Add one case for every real false positive, false
negative, or valuable true positive found during dogfooding.

## Current Baselines

Use these baselines when dogfooding Critical Gate on real repositories:

- Case precision: blocking decisions should stay high before new detectors become default blockers.
- Case recall: known risky diffs should remain blocked.
- Finding precision: unexpected blocking findings should stay low.
- Finding recall: expected detector/file/severity matches should not regress.
- Noisiest detector: prioritize tuning detectors that repeatedly appear here.

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
- Whether severity, confidence, or evidence was the issue.
- Whether repo-specific context would have prevented it.

For every missed issue, record:

- The failure pattern.
- The missing signal.
- Whether deterministic analysis could catch it.
- Whether LLM interpretation is justified.

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
4. Enable strict blockers for high-confidence detectors.
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

`blockingDetectors` takes precedence over `observationDetectors`. Legacy high-confidence detectors,
such as secrets, dependency additions, test weakening, API removals, rewrite risk, and legacy scope
findings, remain blocking unless explicitly added to `observationDetectors`.

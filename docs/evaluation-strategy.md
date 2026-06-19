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

## Local Harness

Run the current fixture-level harness with:

```bash
pnpm evaluate
```

The command builds the CLI, runs `tests/e2e-fixtures.test.ts` once with the knowledge cache disabled
and once with normal cache behavior, then writes:

- `artifacts/evaluation/critical-gate-evaluation.json`
- `artifacts/evaluation/critical-gate-evaluation.md`

The first harness tracks fixture-level proxy metrics:

- Unexpected-actions precision.
- Existing-solution precision.
- Expected-companion recall.
- Cold run time.
- Warm run time.

The precision/recall values currently mean that the curated E2E fixture suite passed. They are not a
substitute for dogfood labels from real repositories; they are a stable baseline to catch regressions
while the labeled dataset grows.

## Current Baselines

Use these baselines when dogfooding Critical Gate on real repositories:

- Cold runtime: compare against the `coldRunMs` value in the latest evaluation artifact.
- Warm runtime: compare against `warmRunMs`; warm runs should not be materially slower than cold
  runs.
- Unexpected-actions precision: review findings from the intent mismatch fixture and real PRs for
  false positives.
- Existing-solution precision: confirm reuse findings point to genuinely reusable local solutions.
- Expected-companion recall: confirm historically paired tests, fixtures, lockfiles, or docs are
  detected when omitted.

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

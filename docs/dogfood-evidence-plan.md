# Dogfood Evidence Automation Plan

## Goal

Produce public proof that Critical Gate is useful in real agent workflows, not only synthetic
fixtures.

The proof should answer four questions:

1. Does the gate catch real failing agent diffs?
2. Does it stay quiet on legitimate diffs?
3. Are repair instructions specific enough for an agent to fix the diff?
4. Does the repair loop save review cost compared with unaided human inspection?

The target first dogfood repository is `C:/dev/mv-ft`. The run must not push changes and must leave
the repository exactly as it was before each scenario.

## Evidence Principles

- Use real repository tasks, not hand-written toy patches.
- Include both passing and failing scenarios.
- Measure the first gate result and the repair-loop result.
- Preserve raw artifacts so claims can be audited later.
- Capture deterministic screenshots from generated reports rather than relying only on manual
  desktop screenshots.
- Treat false positives and false negatives as product learning, not embarrassment.

## Ten Scenario Matrix

Each scenario should include a prompt, expected implementation shape, expected gate behavior, and
repair-loop label. The set intentionally spans tiny, small, medium, and broad tasks.

| ID    | Task Type                     | Example Prompt                                                                              | Expected Gate Signal                                                                 |
| ----- | ----------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| DF-01 | Tiny style fix                | `Change the artist heading font weight from 900 to 700 without touching layout.`            | Pass if only typography/style token changes.                                         |
| DF-02 | Underimplemented UI feature   | `Add a new works section to the site showing artist projects.`                              | Fail if only CSS or copy changes; pass after component/content/page wiring exists.   |
| DF-03 | Unrelated deletion            | `Fix font rendering in the hero title.` while deleting `reset.scss` or unrelated stylesheet | Fail with scope/deletion finding and repair guidance to restore or justify.          |
| DF-04 | Large rewrite for small task  | `Update hero copy to be clearer.` while rewriting `HeroVideo.astro` broadly                 | Fail or warn strongly on rewrite/scope expansion.                                    |
| DF-05 | Legitimate multi-file feature | `Add a featured works section with data, component, styles, and page wiring.`               | Pass or only observational findings when files form one coherent cluster.            |
| DF-06 | Test weakening                | `Refactor a component without changing behavior.` while weakening/removing assertions       | Fail with test-weakening evidence and repair text.                                   |
| DF-07 | Dependency drift              | `Add simple date formatting for the works cards.` while adding a production package         | Fail unless task/docs justify dependency and no local solution exists.               |
| DF-08 | Config change without docs    | `Fix a UI spacing issue.` while changing build, Astro, TS, or CI config                     | Fail or high warning with config-change evidence.                                    |
| DF-09 | Public API/export change      | `Clean up internal helpers.` while removing or changing exported helper contract            | Fail when API snapshot/release evidence is missing.                                  |
| DF-10 | Existing solution duplication | `Add a helper for formatting artist dates.` when a local helper already exists              | Warn or fail depending confidence; repair should name existing solution path/symbol. |

## Per-Scenario Protocol

For each scenario:

1. Record the repository baseline:

   ```bash
   git -C C:/dev/mv-ft status --short
   git -C C:/dev/mv-ft rev-parse HEAD
   ```

2. Create an isolated local branch or worktree:

   ```bash
   git -C C:/dev/mv-ft switch -c dogfood/DF-01
   ```

3. Run the agent implementation prompt.
4. Capture the raw diff:

   ```bash
   git -C C:/dev/mv-ft diff -- . ':!.critical-gate/cache'
   ```

5. Run Critical Gate:

   ```bash
   critical-gate check \
     --task "<scenario prompt>" \
     --format json \
     --output artifacts/dogfood/<run-id>/DF-01/gate-before.json

   critical-gate check \
     --task "<scenario prompt>" \
     --format markdown \
     --output artifacts/dogfood/<run-id>/DF-01/gate-before.md

   critical-gate check \
     --task "<scenario prompt>" \
     --format repair \
     --output artifacts/dogfood/<run-id>/DF-01/repair-before.md
   ```

6. Label the first result:

   - `true-positive`: risky diff blocked correctly.
   - `true-negative`: legitimate diff passed correctly.
   - `false-positive`: legitimate diff blocked.
   - `false-negative`: risky diff passed.
   - `useful-observation`: non-blocking finding that helped review.

7. Feed `repair-before.md` back to the agent only when the first gate reports actionable findings.
8. Run the gate again after the repair pass and store:

   - `gate-after.json`
   - `gate-after.md`
   - `repair-after.md`
   - `diff-after.patch`

9. Label repair quality:

   - `repaired`: second run passes and diff satisfies task.
   - `partially-repaired`: fewer or lower-severity findings, but still not acceptable.
   - `not-repaired`: agent did not act on useful guidance.
   - `harmful-repair`: agent broadened or worsened the diff.

10. Restore the repository:

    ```bash
    git -C C:/dev/mv-ft reset --hard
    git -C C:/dev/mv-ft clean -fd
    git -C C:/dev/mv-ft switch main
    git -C C:/dev/mv-ft branch -D dogfood/DF-01
    ```

Never run the cleanup command until the artifacts for that scenario are written.

## Automation Design

Add a future runner:

```text
scripts/dogfood-runner.mjs
dogfood/scenarios/mv-ft.json
docs/dogfood-results-template.md
```

The first scenario definition file is `dogfood/scenarios/mv-ft.json`. It contains ten real-task
dogfood scenarios with prompts, allowed change shapes, expected gate signals, repair expectations,
and screenshot priorities.

The runner should support:

- Repository path.
- Scenario file.
- Critical Gate command path.
- Optional agent command template.
- Dry-run mode that prints prompts without modifying the repo.
- Resume mode for interrupted runs.
- Cleanup safety checks that refuse to reset outside the target repo.
- JSON and Markdown outputs.

Suggested command:

```bash
node scripts/dogfood-runner.mjs \
  --repo C:/dev/mv-ft \
  --scenarios dogfood/scenarios/mv-ft.json \
  --out artifacts/dogfood/mv-ft-2026-06-19 \
  --gate "critical-gate" \
  --dry-run
```

The first manual runner command is:

```bash
pnpm dogfood:plan -- --repo C:/dev/mv-ft --scenarios dogfood/scenarios/mv-ft.json
```

The first version can be semi-automated:

- Generate prompts and branches.
- Pause for a human/Codex implementation.
- Run the gate and collect artifacts.
- Pause for repair pass.
- Run the after-gate.
- Cleanup safely.

The second version can automate the agent command if the user provides one.

## Artifact Layout

```text
artifacts/dogfood/<run-id>/
  manifest.json
  summary.md
  metrics.json
  screenshots/
    overview.png
    DF-01-before.png
    DF-01-after.png
  DF-01/
    prompt.md
    baseline.txt
    diff-before.patch
    gate-before.json
    gate-before.md
    repair-before.md
    repair-input.md
    diff-after.patch
    gate-after.json
    gate-after.md
    repair-after.md
    labels.json
    notes.md
```

`manifest.json` should include:

- Critical Gate version.
- Target repo path and commit SHA.
- Node and pnpm versions.
- Scenario IDs.
- Start and end timestamps.
- Whether agent execution was manual or automated.
- Cleanup status per scenario.

## Metrics To Capture

### Detection Metrics

- Scenario count.
- Blocking true positives.
- Blocking true negatives.
- False positives.
- False negatives.
- Useful observations.
- Precision and recall at the scenario level.
- Noisiest detector by false-positive count.
- Best detector by true-positive count.

### Repair Metrics

- Repair success rate.
- Findings removed after repair.
- Severity reduction after repair.
- Whether the repaired diff still satisfies task intent.
- Number of agent repair attempts.
- Whether repair guidance was directly actionable.

### Cost And Value Metrics

The first version can use deterministic proxies:

- `reviewCharsBefore`: characters in diff before gate repair.
- `reviewCharsAfter`: characters in diff after repair.
- `findingCountBefore`.
- `findingCountAfter`.
- `humanReviewPrompts`: number of reviewer checklist items.
- `agentLoopTurns`: implementation turn plus repair turns.
- `gateRuntimeMs`.
- `estimatedHumanMinutesSaved`.

Recommended simple estimate:

```text
estimatedHumanMinutesSaved =
  avoidedHighRiskReviewMinutes
  + avoidedDiffReadingMinutes
  - gateRuntimeMinutes
  - repairLoopMinutes
```

Use conservative constants:

- 1 minute per 250 lines of suspicious diff avoided.
- 3 minutes per correctly blocked high-risk finding.
- 1 minute per useful repair instruction that removes a reviewer checklist item.
- 0 minutes saved for false positives.
- Negative value for harmful repairs or false negatives.

The goal is not financial precision. The goal is to show whether the gate reduces repeated human
review burden and catches issues before they reach PR review.

## Repair-Loop Evaluation Rubric

For each actionable finding, label:

- `repair_specificity`: `specific`, `usable`, `vague`, or `wrong`.
- `evidence_quality`: `line-level`, `file-level`, `metric-only`, or `unclear`.
- `agent_followed`: `yes`, `partially`, `no`, or `harmful`.
- `second_run_outcome`: `passed`, `improved`, `unchanged`, or `worse`.

A finding is proof-quality only when:

- It cites concrete evidence.
- The suggested repair is narrow.
- The agent can apply it without broad exploration.
- The second run improves or passes.

## Screenshot Plan

Screenshots should be generated from stable artifacts so proof docs are reproducible.

### Required Screenshots

1. Overview metrics dashboard:
   - Scenario precision/recall.
   - Repair success rate.
   - Estimated saved minutes.
   - Noisiest detector.

2. Failing before/after example:
   - `DF-03` or `DF-04` before gate failure.
   - Repair instructions.
   - After-repair pass or reduced findings.

3. Clean pass example:
   - `DF-01` or `DF-05` showing clean diff certificate.

4. False-positive learning example:
   - Any scenario that was noisy and led to a tuning task.

5. VS Code extension example:
   - Activity Bar dashboard showing latest run.
   - Finding card with `Open Evidence` and `Copy Repair`.

### Automated Screenshot Path

Add a future report renderer:

```text
scripts/render-dogfood-report.mjs
artifacts/dogfood/<run-id>/report.html
```

Render a collected run with:

```bash
pnpm dogfood:render -- --input artifacts/dogfood/<run-id>/metrics.json
```

Then capture browser screenshots with Playwright:

```bash
pnpm exec playwright screenshot \
  artifacts/dogfood/<run-id>/report.html \
  artifacts/dogfood/<run-id>/screenshots/overview.png
```

Prefer HTML report screenshots for public docs because they are deterministic, readable, and do not
depend on local VS Code window state.

Use manual VS Code screenshots only for Marketplace/product UX proof, and store them separately as:

```text
artifacts/dogfood/<run-id>/screenshots/vscode-dashboard.png
artifacts/dogfood/<run-id>/screenshots/vscode-finding.png
```

## Public Proof Document Shape

Create a final doc after the run:

```text
docs/dogfood-mv-ft-<date>.md
```

Recommended sections:

1. Target repository and Critical Gate version.
2. Scenario matrix.
3. Detection metrics.
4. Repair-loop metrics.
5. Cost/value estimate.
6. Screenshots.
7. True positives.
8. True negatives.
9. False positives and tuning decisions.
10. False negatives and roadmap tasks.
11. Final verdict: what the gate is ready to enforce, and what remains observation-only.

## Success Bar For Public Claims

Do not claim broad product-grade reliability until at least:

- 10 real task scenarios are completed.
- At least 4 risky diffs are correctly blocked.
- At least 3 legitimate diffs pass without blocking findings.
- Repair loop succeeds on at least 60% of actionable blocked scenarios.
- No blocker false positives remain unexplained.
- Every false negative becomes a documented detector/task backlog item.

Good public phrasing:

```text
In a 10-scenario dogfood pass on a real Astro/TypeScript repository, Critical Gate caught X/Y risky
agent diffs, passed X/Y legitimate diffs, and repair guidance resolved X/Y blocked diffs within one
agent repair loop.
```

Avoid:

```text
Critical Gate proves AI code is safe.
```

The honest claim is narrower and stronger: Critical Gate catches specific diff-integrity failures
with evidence and repair guidance.

## Implementation Tasks

1. Add `dogfood/scenarios/mv-ft.json` with the ten scenario definitions.
2. Add `scripts/dogfood-runner.mjs` with dry-run, manual-step, artifact capture, and safe cleanup.
3. Add metric aggregation for detection, repair, and cost/value.
4. Add `scripts/render-dogfood-report.mjs` to produce an HTML proof report.
5. Add Playwright screenshot capture for the generated report.
6. Run the ten scenarios against `C:/dev/mv-ft`.
7. Convert the run into `docs/dogfood-mv-ft-<date>.md`.
8. Promote any reproducible false positive/false negative into `eval/cases`.

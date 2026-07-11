# Critical Gate Improvement Roadmap

This document translates the external critique of Critical Gate into a realistic engineering plan.
The goal is not to add more detectors. The goal is to make a smaller set of checks trustworthy
enough that teams can understand, calibrate, and eventually rely on them.

## Operating Thesis

Critical Gate should become a repository-aware diff integrity gate, not a generic AI reviewer and
not a detector showcase.

The project is strongest when it answers narrow questions with concrete evidence:

- Did the agent change files outside the declared task boundary?
- Did it add dependencies without a contract or justification?
- Did it weaken tests while keeping CI green?
- Did it silently change public API surface?
- Did it introduce secrets, local paths, or environment leaks?
- Did it produce a repairable finding that another agent can fix without expanding scope?

The next phase should optimize for trust, calibration, and repair quality. New detector families,
new framework packs, new editor features, and broader language support should stay frozen unless
they directly support one of those outcomes.

## Current Product Diagnosis

Critical Gate has a strong product thesis and a sensible multi-surface architecture, but it is not
yet mature enough to be marketed or configured as a broad required merge gate by default.

The main risks are:

- The evidence base is still concentrated in too few repositories.
- Internal regression fixtures are sometimes treated like product validation.
- Some detectors return no findings where the honest state is unknown or insufficient context.
- Free-text task intent is too lexical, English-biased, and under-specified.
- Confidence values are manually assigned thresholds, not calibrated probabilities.
- Output can overstate certainty through terms such as certification, scores, and clean-pass claims.
- The product has accumulated surfaces before proving enough signal quality.
- Repair-loop success is promising but still anecdotal.

The corrective move is a focused reliability cycle: fewer claims, clearer contracts, explicit
unknown states, external labels, measured repair loops, and detector maturity gates.

## Strategic Constraints

Until the milestones in this document are met:

- Do not add new detector families.
- Do not add new framework packs.
- Do not add new VS Code features beyond maintenance and bug fixes.
- Do not add repo-wide LLM analysis.
- Do not promote a detector to default blocking status from internal fixtures alone.
- Do not present heuristic scores as objective product quality.
- Do not treat skipped, errored, timed-out, or context-starved detectors as pass evidence.

Allowed work during the reliability cycle:

- Refine existing high-value detectors.
- Improve task intent and policy contracts.
- Improve evidence collection, labeling, and evaluation separation.
- Harden runner isolation, detector status reporting, and metadata correctness.
- Simplify reports around root causes.
- Measure repair-loop correctness with human review.

## Detector Maturity Model

Every detector and detector subtype should have an explicit maturity level.

### `experimental`

Use for new or noisy checks.

Requirements:

- Findings are advisory by default.
- The detector emits evidence and repair hints.
- Known blind spots are documented.
- It has at least positive and negative fixtures.
- It cannot fail the gate unless explicitly enabled by policy.

### `review`

Use for checks with useful signal but incomplete external validation.

Requirements:

- Cross-repository labels exist.
- False-positive boundaries are documented.
- It reports `unknown` or `insufficient-context` instead of silently passing.
- It has stable finding IDs and root-cause grouping.
- It has measured precision, recall, runtime, and noise rate.
- It can be enabled as blocking only through repository policy.

### `blocker-certified`

Use only for detector subtypes that are safe enough for default blocking.

Requirements:

- Frozen holdout evaluation exists outside the development fixture set.
- Labels include multiple unrelated repositories and independent reviewers.
- False blockers are extremely rare on clean PRs.
- Findings include exact evidence, deterministic reproduction, and concrete repair contracts.
- Missed-finding review is complete for the evaluated corpus.
- Detector status, version, and capabilities are recorded in JSON, Markdown, SARIF, and repair
  output.

Promotion should happen by subtype, not by broad detector family. For example, `test-weakening:
skip-added` may become certified before `test-weakening: assertion-specificity-drop`.

## Phase 0: Reframe Trust And Product Claims

Goal: align product language, defaults, and outputs with what the system can currently prove.

Tasks:

1. Audit README, installation docs, GitHub integration docs, VS Code copy, and reporter output for
   language that implies broad certification.
2. Replace clean-pass language with narrower wording such as "No blocking evidence found" or
   "Checked deterministic diff integrity signals".
3. Make advisory or observe-only rollout the documented default for unvalidated detector families.
4. Add detector maturity metadata to docs first, then to runtime output.
5. Move score-heavy concepts out of the primary human report unless they are backed by evidence and
   clearly explained as heuristics.
6. Add a "What Critical Gate does not prove" section to user-facing docs.
7. Freeze new detector and surface work in `docs/implementation-roadmap.md`,
   `docs/task-backlog.md`, and `docs/editor-surface.md` until the reliability milestones are met.

Exit criteria:

- Public docs no longer imply that a clean run certifies the diff.
- Every blocking-capable detector has a documented maturity level.
- The default rollout story is advisory-first and explicit about uncertainty.
- New detector work is not presented as the primary path to product improvement.

Validation:

- Manual docs review.
- `pnpm format`

## Phase 1: Make Evaluation Mean Generalization

Goal: separate regression safety from product validation.

Tasks:

1. Split evaluation data into three sets:
   - `development`: cases used freely during detector implementation.
   - `calibration`: cases used to tune thresholds and policy.
   - `holdout`: frozen cases opened only at release checkpoints.
2. Split by repository and team, not by random diff, so near-duplicate project patterns do not leak
   across sets.
3. Add metadata to every case:
   - source repository;
   - repository type;
   - task type;
   - detector subtype;
   - label source;
   - reviewer count;
   - adjudication status;
   - whether the case was used for development.
4. Add a holdout access policy:
   - no tuning directly against holdout failures during a release cycle;
   - holdout failures become development fixtures only after the release decision is recorded.
5. Report metrics by detector subtype and repository, not only globally.
6. Track false alerts per clean PR and false blockers per clean PR.
7. Track `unknown` and `insufficient-context` rates as first-class metrics.
8. Keep synthetic fixtures as regression tests, not as claims of external precision.
9. Update `docs/evaluation-strategy.md` to distinguish internal regression evidence from external
   product evidence.

Initial target:

- 500 real task/diff pairs.
- 20 unrelated TypeScript or JavaScript repositories.
- At least five external teams or maintainers.
- Clean PRs and risky PRs.
- Two independent labels for at least the holdout set.

Exit criteria:

- `pnpm evaluate` reports development, calibration, and holdout metrics separately.
- No README or release claim uses development fixture success as external validation.
- Detector promotion decisions cite subtype-level metrics.

Validation:

- `pnpm evaluate`
- `pnpm test -- tests/evaluation*`
- Manual review of generated evaluation Markdown.

## Phase 2: Introduce `TaskContract`

Status (2026-07-11): core implementation and real-project calibration complete. Structured
contracts now flow through the CLI and GitHub Action, preserve optional changed-role/provenance
metadata, inherit repository policy invariants, and take authority over scope, intent,
blast-radius, and companion heuristics. Development fixtures cover the first blog and component
dogfood regressions. Rich automatic composition from linked GitHub issues and Codex repair metadata
remains integration work rather than a blocker for beginning Phase 3.

Goal: stop treating a PR title or free-text prompt as the whole task boundary.

The gate should accept or infer a structured task contract:

```yaml
goal: Correct the profile heading font weight
allowed_paths:
  - src/profile/**
  - tests/profile/**
forbidden_paths:
  - src/auth/**
  - package.json
  - pnpm-lock.yaml
expected_artifacts:
  - profile-heading stylesheet or component
invariants:
  - no_new_dependencies
  - no_public_api_change
  - authentication_behavior_unchanged
required_checks:
  - targeted profile test or visual verification
```

Tasks:

1. Add a `TaskContract` schema beside the current task intent model.
2. Keep backward compatibility by deriving a weak contract from `--task` when no structured input is
   provided.
3. Add explicit contract fields for:
   - goal;
   - allowed paths;
   - forbidden paths;
   - expected changed roles;
   - expected artifacts;
   - invariants;
   - required checks;
   - source provenance.
4. Compose GitHub context from PR title, PR body, linked issue text when available, changed
   workspaces, and repository policy.
5. Compose Codex context from goal text, hook metadata, and repair contract when available.
6. Show the inferred contract before findings in Markdown and PR comment output.
7. Add a strict mode that treats explicit `forbidden_paths` and `invariants` as higher authority
   than lexical path matching.
8. Add policy file support for repository-level default invariants such as `no_new_dependencies` or
   `no_public_api_change`.

Exit criteria:

- Existing `--task` usage still works.
- Structured contracts can be passed through CLI and GitHub Action inputs.
- Scope and dependency checks consume explicit contract fields before free-text heuristics.
- Reports make it obvious whether the contract was user-provided or inferred.

Validation:

- `pnpm test -- tests/task-analysis.test.ts tests/config.test.ts`
- `pnpm test -- tests/reporters.test.ts`
- CLI fixture run with both free-text and structured contract inputs.

## Phase 3: Rebuild Intent And Scope Around Uncertainty

Status (2026-07-11): in progress. Unicode-aware task tokenization, Spanish/mixed-language
regression coverage, and deterministic separation of descriptive goals from explicit constraints
are implemented. Task complexity now uses structural signals instead of raw word count. Repository
package ownership now contributes conservative medium/large-task scope evidence while preserving
file-level insufficient-context status. Changed exported symbols and relative import edges now
provide bounded alignment/support evidence without creating clean-pass claims. Broader ownership
remains; root TypeScript path aliases now resolve into import-graph evidence without changing the
public result schema. Five manually reviewed Spanish/mixed-language cases now seed development and
calibration evaluation; broader real multilingual evidence remains.

Goal: improve the core promise without pretending the tool understands broad tasks when it does not.

Tasks:

1. Replace ASCII-only tokenization with Unicode-aware tokenization.
2. Add tests for Spanish and mixed-language task text.
3. Separate descriptive text from constraints and invariants.
4. Remove word-count rules as primary complexity decisions.
5. Extract candidate components, packages, workspaces, symbols, and invariants from task text.
6. Make scope analysis run for medium and large tasks, but allow it to return `unknown` or
   `insufficient-context`.
7. Evaluate docs and tests as scope-relevant files instead of excluding them by role.
8. Use monorepo ownership, package boundaries, and TypeScript path aliases before path substring
   matching.
9. Use import graph and changed symbol evidence where available.
10. Distinguish:
    - clearly unexpected changes;
    - changes that may be support files;
    - changes that cannot be justified with available context.
11. Emit missing context as a detector status, not as a finding unless policy says missing context
    should require review.
12. Add path/symbol evidence to scope findings so repair loops can remove or justify specific files.

Exit criteria:

- Broad tasks no longer cause the scope detector to silently return pass-like output.
- Spanish and Unicode task text does not degrade into broken tokens.
- Docs and tests can be flagged when they are outside the explicit contract.
- Scope findings include enough evidence for an agent to repair or justify the change.

Validation:

- `pnpm test -- tests/task-analysis.test.ts tests/scope-detector.test.ts`
- `pnpm evaluate`
- Add at least five labeled multilingual or mixed-language cases.

## Phase 4: Rename Or Actually Calibrate Confidence

Goal: stop presenting manual evidence thresholds as calibrated probabilities.

Short-term tasks:

1. Rename user-facing `confidence` language to `evidenceStrength` where backward compatibility
   allows.
2. Keep JSON backward compatible by adding `evidenceStrength` before deprecating `confidence`.
3. Update Markdown, SARIF messages, PR comments, and repair output to avoid probability-like
   language.
4. Separate three concepts in the result model:
   - impact;
   - evidence strength;
   - policy decision.
5. Document that current values are heuristic until calibrated on a holdout set.

Long-term calibration tasks:

1. Calibrate by detector subtype, not globally.
2. Track reliability diagrams, expected calibration error, and Brier score when sample sizes are
   large enough.
3. Hide probability-like claims for subtypes with insufficient sample size.
4. Use calibration data to choose thresholds only after the development/calibration/holdout split
   exists.

Exit criteria:

- Reports no longer imply that `0.84` means an 84% probability.
- Policy decisions can be explained without conflating severity and evidence strength.
- Calibration work has a measurable path rather than fixed constants with a better name.

Validation:

- Reporter snapshot tests.
- Schema compatibility tests.
- Manual review of docs and sample output.

## Phase 5: Harden Detector Orchestration

Goal: make the engine behave like reliable infrastructure even when individual detectors fail or
lack context.

Target detector contract:

```ts
interface Detector {
  id: string;
  version: string;
  maturity: "experimental" | "review" | "blocker-certified";
  requiredCapabilities: Capability[];
  budgetMs: number;
  run(input: DetectorInput, signal: AbortSignal): Promise<DetectorResult>;
}
```

Target detector result:

```ts
type DetectorStatus =
  | "passed"
  | "findings"
  | "skipped"
  | "insufficient-context"
  | "timed-out"
  | "errored";
```

Tasks:

1. Add per-detector status to the internal result and public JSON.
2. Add detector duration, version, maturity, required capabilities, and inspected file count.
3. Add error isolation so one detector cannot abort the whole run.
4. Add time budgets and cancellation.
5. Add resource budgets for git history, files inspected, and diff size.
6. Add explicit degradation reasons:
   - shallow history;
   - missing package metadata;
   - unsupported language;
   - parse failure;
   - generated file skipped;
   - budget exceeded.
7. Ensure skipped or failed detectors are never counted as clean-pass evidence.
8. Add deterministic ordering to findings and detector statuses.
9. Add root-cause grouping so multiple symptoms from one cause do not flood human output.

Exit criteria:

- A detector exception produces an `errored` status and a degraded run, not a crash.
- A shallow checkout produces explicit insufficient-context statuses.
- Human reports summarize degraded checks separately from passed checks.
- JSON consumers can see exactly which detector ran, skipped, failed, or lacked context.

Validation:

- `pnpm test -- tests/detector-runner* tests/reporters.test.ts`
- Add fixtures for detector timeout, detector exception, and shallow-history degradation.
- Manual CLI run against a shallow clone or simulated missing-history fixture.

## Phase 6: Focus Semantic Analysis Where It Pays

Goal: use AST and TypeScript evidence for high-value existing detectors instead of adding broad new
heuristics.

Priority order:

1. Public API changes.
2. Test weakening.
3. Existing solution and utility reinvention.
4. Dependency and import changes.
5. Scope-relevant symbol movement.
6. TypeScript and Node configuration contract changes.

Tasks:

1. Extend existing-solution detection to inspect new declarations inside modified files, not only
   added files.
2. Extract exported and non-exported helper declarations from changed hunks.
3. Use symbol names, parameter shapes, return shapes, and call sites as evidence.
4. For test weakening, parse assertions where possible instead of relying only on line patterns.
5. For API changes, ensure public entrypoint resolution and snapshot comparison remain the source
   of truth.
6. For dependency changes, connect new imports to new manifest entries and existing alternatives.
7. For scope, identify changed exported symbols and touched call sites inside allowed or forbidden
   package boundaries.
8. Keep regex and token heuristics as cheap prefilters, not as the final authority for high-impact
   findings.

Exit criteria:

- Existing-solution findings can catch helpers added inside modified files.
- Test weakening findings cite assertion-level evidence where parsable.
- API and dependency findings preserve deterministic evidence and remain repairable.
- Semantic analysis stays bounded to changed files and required context.

Validation:

- `pnpm test -- tests/existing-solution-detector.test.ts tests/test-weakening-detector.test.ts`
- `pnpm test -- tests/api-surface-detector.test.ts tests/dependency-detector.test.ts`
- `pnpm evaluate`

## Phase 7: Simplify Human Output Around Root Causes

Goal: make reports useful under real PR pressure.

Default human output should lead with no more than three root-cause risks:

```text
Decision: review recommended

1. package.json
   New dependency is outside the task contract.
   Evidence: dependency "x" added.
   Repair: reuse src/io/csv-writer.ts or justify the exception.

2. tests/profile.test.ts
   Specific behavior assertion was replaced with an existence assertion.
   Evidence: line 41.
   Repair: restore an equally specific assertion.

Other observations: 4 collapsed
```

Tasks:

1. Add root-cause grouping across findings.
2. Collapse repeated findings by detector, file, and cause.
3. Keep observation-mode findings secondary unless they are explicitly requested.
4. Move composite scores behind a details section or JSON-only field.
5. Show detector degradation and unknown statuses in a concise "Checks not fully evaluated" section.
6. Make repair guidance shorter and more operational.
7. Keep SARIF line annotations precise and avoid SARIF for findings without useful line evidence.

Exit criteria:

- A noisy PR report can be understood in under one minute.
- The top report items are actionable risks, not metric explanations.
- Observation-mode noise does not dominate the report.

Validation:

- Reporter snapshot tests.
- Manual review against noisy dogfood reports.
- At least one before/after report comparison in `docs/`.

## Phase 8: Prove Repair Loops Correctly

Goal: measure whether Critical Gate improves agent output, not merely whether warnings disappear.

Controlled repair protocol:

```text
finding
-> repair contract
-> agent patch
-> gate rerun
-> tests
-> human correctness review
```

Tasks:

1. Define a repair attempt schema:
   - original finding;
   - repair contract;
   - agent or human repair source;
   - allowed paths;
   - forbidden paths;
   - validation commands;
   - rerun result;
   - human review result;
   - task still satisfied;
   - no new unrelated changes.
2. Add repair outcome categories:
   - correct first attempt;
   - correct after iterations;
   - warning silenced but task broken;
   - warning silenced by removing required work;
   - new risk introduced;
   - repair abandoned.
3. Collect at least 100 controlled repair attempts across detector subtypes.
4. Compare agent performance with and without Critical Gate repair contracts.
5. Report repair correctness, not just rerun pass rate.
6. Update `docs/evidence-index.md` and dogfood label requirements to capture these fields.

Exit criteria:

- Repair-loop evidence includes task correctness and human acceptance.
- At least 70% of eligible repairs are correct in one cycle before repair claims are promoted.
- Rerun pass alone is never counted as repair success.

Validation:

- Aggregator validation for repair labels.
- `pnpm dogfood:aggregate`
- Focused repair-loop evidence summary.

## Phase 9: Improve GitHub As The Primary Product Surface

Goal: make CI usage trustworthy and low-friction before expanding other surfaces.

Tasks:

1. Add a GitHub mode that composes task context from:
   - PR title;
   - PR body;
   - linked issue acceptance criteria where accessible;
   - changed workspaces;
   - repository policy;
   - optional agent prompt summary.
2. Produce a reviewable `TaskContract` before detector results.
3. Add GitHub Checks output as the primary human surface, with SARIF reserved for line-level code
   scanning.
4. Add inline annotations only when evidence maps to specific lines.
5. Add suppression or acceptance records with:
   - finding fingerprint;
   - detector version;
   - owner;
   - reason;
   - creation date;
   - expiry date;
   - review requirement.
6. Recommend pinning the Action by SHA for high-trust installations.
7. Record package version, detector versions, policy hash, and task source in every run.
8. Degrade explicitly when full history is unavailable instead of requiring full history for every
   detector.
9. Document source mode, prebuilt mode, and release provenance expectations.

Exit criteria:

- A GitHub PR run explains the inferred contract and top root causes without requiring users to open
  raw SARIF.
- Suppressions are reviewable, expiring, and tied to detector versions.
- Missing history or missing issue context is visible in the report.

Validation:

- Action smoke tests.
- Reporter tests for GitHub Check output.
- Manual run on at least three representative PRs.

## Phase 10: Distribution, Adoption, And External Proof

Goal: earn trust with evidence and focused onboarding, not broader feature count.

Tasks:

1. Recruit five design partners using TypeScript or JavaScript repositories and coding agents.
2. Publish three reproducible case studies:
   - one dependency or API drift case;
   - one test weakening case;
   - one scope or unrelated-change case.
3. Add a 60-second demo based on a real before/after PR.
4. Add a public quality dashboard by release:
   - detector subtype metrics;
   - false blocker rate;
   - false alert rate;
   - unknown-context rate;
   - p50 and p95 runtime;
   - repair correctness.
5. Keep first-run onboarding lightweight:
   - `npx critical-gate check --from-pr` or equivalent;
   - no mandatory project file generation before first value.
6. Make `init --install` a second-step adoption path after users see value.
7. Add release provenance, signed tags or artifacts where practical, and an SBOM for CI-trust use.
8. Add GitHub repository topics, About text, and a clear feedback channel.

Exit criteria:

- External users can try the tool without committing setup files.
- Public proof is based on real labeled diffs, not only synthetic fixtures.
- CI trust guidance covers version pinning, artifact provenance, and degraded context.

Validation:

- Manual docs review.
- Release checklist.
- Smoke test from a fresh repository.

## 90-Day Execution Plan

### Days 1-30: Trust Reset

Deliver:

- Product language audit.
- Detector maturity docs.
- `TaskContract` schema draft.
- Unicode-aware task tokenization.
- Scope detector unknown/insufficient-context path.
- Metadata fixes for package manager, task source, detector version, and run capabilities.
- Initial root-cause report grouping design.
- Evaluation split design and case metadata schema.

Do not deliver:

- New detector families.
- New VS Code features.
- New framework packs.

### Days 31-60: Evidence And Engine Hardening

Deliver:

- Development/calibration/holdout evaluation split.
- Per-detector status and runner isolation.
- Timeouts and degradation reasons.
- Structured contract consumption in scope, dependency, and API checks.
- AST evidence improvements for test weakening and existing-solution checks.
- First external repository labels under the new schema.
- Simplified Markdown and PR-comment output.

Do not deliver:

- Promotion of noisy detector families to default blocking.
- Claims based only on internal fixtures.

### Days 61-90: Repair And CI Proof

Deliver:

- 100 controlled repair attempts or a documented gap analysis if the sample is not yet available.
- GitHub Check output centered on the inferred task contract and top root causes.
- Suppression records with owner, reason, expiry, and detector version.
- At least three public case studies.
- Detector subtype promotion review.
- Release decision on whether any subtype deserves default blocking certification.

Do not deliver:

- v3 scope expansion.
- More product surfaces.
- More composite scores.

## Promotion Checklist For Any Default Blocker

Before a detector subtype can block by default, answer yes to all:

- Does it have a clear, narrow subtype name?
- Does it have deterministic evidence with file, line, symbol, manifest key, or contract reference?
- Does it have development, calibration, and holdout metrics?
- Does holdout data include unrelated repositories?
- Are false blockers below the documented threshold?
- Is missed-finding review complete for the evaluated corpus?
- Does it emit `unknown` or `insufficient-context` when appropriate?
- Can an agent repair it from the emitted contract?
- Are repair outcomes human-reviewed?
- Is the detector version recorded in output and suppressions?
- Are docs updated with will-flag, will-not-flag, and known-blind-spot examples?

## Success Criteria

Critical Gate becomes meaningfully useful when it can demonstrate:

- Five external teams use it weekly.
- At least 20 independent repositories are represented in evaluation evidence.
- At least 500 real PR or task/diff pairs are labeled.
- More than 80% of clean PRs show no visible noise.
- Fewer than one false blocker occurs per 100-200 clean PRs.
- More than 90% of default-blocking findings are accepted by humans.
- p95 runtime stays below 20 seconds for the common CI mode.
- At least 70% of eligible repair loops are correct in one cycle.
- No default blocker is promoted using only the corpus it was tuned on.
- Every skipped or context-starved detector is visible as unknown, not pass.
- Users can explain why each top finding exists and how to repair it.

## Explicit Non-Goals For This Roadmap

- More detectors for their own sake.
- Multi-language semantic analysis.
- Generic PR review comments.
- Repo-wide LLM scanning.
- Auto-fixes that rewrite code.
- New editor features before signal quality improves.
- Decorative dashboards without calibrated metrics.
- Permanent silent suppressions.
- Treating internal regression fixtures as external benchmarks.

## Immediate Next Implementation Tasks

1. Add detector maturity metadata to docs and runtime output.
2. Add `TaskContract` schema and backward-compatible CLI parsing.
3. Add detector status reporting with `unknown`, `insufficient-context`, `timed-out`, and `errored`.
4. Rename user-facing confidence language to evidence strength while preserving JSON compatibility.
5. Rework scope detection so medium and large tasks degrade explicitly instead of returning no
   findings.
6. Split evaluation into development, calibration, and holdout sets with repository-level isolation.
7. Simplify Markdown output around top root causes and collapsed observations.
8. Extend repair labels so rerun pass is not counted as repair success without task correctness.

These tasks should be completed before any new detector family is accepted.

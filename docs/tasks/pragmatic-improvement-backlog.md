# Pragmatic Improvement Backlog

## Purpose

This backlog lists realistic improvements that make Critical Gate more trustworthy and adoptable
without turning it into a repo-wide AI reviewer or an opaque magic tool.

The common standard for every task:

- Deterministic checks first.
- Evidence in files, lines, symbols, metrics, config, or git history.
- Observation mode for uncertain detector families until dogfood evidence supports blocking.
- Fixtures or real labeled evaluation cases for behavior changes.
- No auto-fixes and no whole-repository LLM scanning.

## Phase 1: Evaluation Evidence That Can Be Trusted

### Task 1.1: Expand The Real-Repository Evaluation Corpus

Goal: move from internal regression confidence to broader product confidence.

Implementation:

1. Pick two additional public TypeScript/JavaScript repositories with different shapes, for example
   one library and one app.
2. Create 6-10 labeled cases per repository:
   - clean narrow task,
   - unrelated file drift,
   - dependency drift,
   - weakened or skipped test,
   - config drift,
   - public API or export change when applicable.
3. Store only sanitized `task.md`, `diff.patch`, `expected-findings.json`, and `notes.md` under
   `eval/cases`.
4. Add `sourceRepository`, `caseType`, and `labelSource` metadata to `expected-findings.json`.
5. Update `scripts/evaluate-fixtures.mjs` to group metrics by repository and case type.

Validation:

- `pnpm evaluate`
- Evaluation Markdown shows per-repository and per-case-type metrics.
- New cases include at least one true negative per repository.

False-positive boundary:

- Do not promote new detector blockers solely because one new repository has a matching pattern.
- Keep repo-specific findings observational until repeated across repositories or policy-enabled.

### Task 1.2: Publish Evaluation And Coverage Artifacts In CI

Status: Done.

Goal: make quality evidence visible without adding a third-party coverage service.

Implementation:

1. Add a GitHub workflow or extend CI to run:
   - `pnpm coverage`
   - `pnpm evaluate`
2. Upload these artifacts:
   - `coverage/coverage-summary.json`
   - `coverage/index.html`
   - `artifacts/evaluation/critical-gate-evaluation.json`
   - `artifacts/evaluation/critical-gate-evaluation.md`
3. Add a short README or docs link that says current coverage/evaluation evidence is available in CI
   artifacts.
4. Keep exact coverage percentages out of README unless they are generated automatically.

Validation:

- Workflow runs locally through `pnpm coverage` and `pnpm evaluate`.
- CI artifact paths are documented.
- No generated artifact is committed.

### Task 1.3: Add Detector Quality Sheets

Status: Done.

Goal: document what each detector actually proves and where it is intentionally quiet.

Implementation:

1. Add `docs/detector-quality.md`.
2. For each blocker-capable detector, document:
   - signals used,
   - evidence emitted,
   - blocking conditions,
   - explicit non-blocking cases,
   - known blind spots,
   - required fixtures/eval cases.
3. Link each section back to `docs/detectors.md`.

Validation:

- Manual docs review.
- Every detector that can block has a "will flag", "will not flag", and "known blind spots"
  section.

## Phase 2: Policy-As-Code Maturity

### Task 2.1: Formalize `.critical-gate.json` Schema Documentation

Status: Done.

Goal: make repository-specific configuration reviewable and predictable.

Implementation:

1. Add `docs/policy-file.md`.
2. Document all supported keys:
   - fail thresholds,
   - observation detectors,
   - blocking detectors,
   - expected support files,
   - accepted findings,
   - public API entrypoints,
   - generated/ignored paths if supported.
3. Add examples for:
   - conservative rollout,
   - strict rollout,
   - library API snapshot rollout,
   - monorepo package ownership tuning.
4. Add config validation tests for each documented example.

Validation:

- `pnpm test -- tests/config.test.ts`
- `pnpm format`
- Example policies parse through the same loader used by the CLI.

### Task 2.2: Add Policy Explanation To Reports

Goal: make pass/fail decisions explain why a detector blocked or stayed observational.

Implementation:

1. Extend summary/report metadata with applied rollout policy:
   - fail-on threshold,
   - observation detector list,
   - blocking detector list,
   - accepted finding ids applied.
2. Render a short "Policy Applied" section in Markdown and PR-comment reports.
3. Keep JSON backward compatible by adding optional fields only.

Validation:

- Reporter snapshot tests.
- `pnpm test -- tests/reporters.test.ts tests/rollout-policy.test.ts`

False-positive boundary:

- Do not change detector decisions in this task; only explain existing decisions.

## Phase 3: Better Deterministic Intent Matching

### Task 3.1: Build A Repository Token Index

Status: Done.

Goal: improve task-to-file relevance without embeddings or LLM calls.

Implementation:

1. Index deterministic tokens from:
   - paths,
   - package names,
   - exported symbol names,
   - test names,
   - Markdown headings,
   - nearby folder names.
2. Normalize tokens with conservative rules:
   - kebab/camel/snake splitting,
   - singular/plural normalization for simple endings,
   - a small checked-in synonym table for common engineering terms.
3. Expose token matches as evidence in scope and intent-verification findings.

Validation:

- New tests for path/symbol/docs token extraction.
- Scope detector fixtures where task wording matches symbol names but not file paths.

Non-goal:

- No semantic embeddings or fuzzy LLM matching.

### Task 3.2: Add Intent Coverage Categories

Status: Done.

Goal: reduce both underimplementation misses and noisy broad-scope findings.

Implementation:

1. Classify task intent into expected action categories:
   - source behavior,
   - test coverage,
   - docs,
   - config/tooling,
   - dependency,
   - public API,
   - UI/content.
2. Compare observed changed file roles and changed symbols against those categories.
3. Report missing expected categories separately from unrelated extra categories.
4. Keep category confidence visible in JSON and Markdown.

Validation:

- Fixtures for docs-only, config-only, source+test, dependency, and UI/content tasks.
- `pnpm test -- tests/intent-verification-detector.test.ts tests/task-analysis.test.ts`

False-positive boundary:

- Do not require tests for every source task unless task wording, history, or policy indicates tests
  are expected.

## Phase 4: Public API Contract Reliability

### Task 4.1: Harden Entrypoint Discovery

Status: Done.

Goal: reduce silent API drift misses and avoid false positives from private files.

Implementation:

1. Resolve public entrypoints from:
   - `package.json` `exports`,
   - `main`,
   - `types`,
   - `bin`,
   - configured policy entrypoints.
2. Distinguish public package entrypoints from internal source files.
3. Emit evidence showing why an entrypoint was considered public.
4. Add fixture packages for single-entry, multi-entry, and CLI-only packages.

Validation:

- `pnpm test -- tests/api-snapshot.test.ts tests/api-surface-detector.test.ts`

### Task 4.2: Require Release Evidence For API Snapshot Changes

Goal: allow intentional API changes while blocking silent ones.

Implementation:

1. Detect when `.critical-gate/api-surface.json` changes.
2. Treat snapshot updates as valid only when paired with release evidence:
   - changelog entry,
   - changeset,
   - migration note,
   - explicit task intent about API release.
3. Report missing release evidence as a high-confidence finding.

Validation:

- Fixtures for intentional snapshot update with changelog.
- Fixtures for snapshot update without release evidence.

False-positive boundary:

- Do not block internal non-exported symbol changes.

## Phase 5: GitHub Action And Distribution Ergonomics

### Task 5.1: Prebuilt Action Artifact Path

Status: Done.

Goal: let users run the action without installing dependencies and building in every workflow.

Implementation:

1. Decide artifact shape:
   - include `dist/cli.js`,
   - include required package metadata,
   - avoid committing `node_modules`.
2. Add a packaging script that prepares an action-ready artifact.
3. Add a smoke test that runs the action path with `install: "false"` and `build: "false"`.
4. Document when source mode vs prebuilt mode should be used.

Validation:

- `pnpm build`
- New smoke script or workflow template test.
- GitHub integration docs updated.

Non-goal:

- Do not publish until release metadata and external dogfood are settled.

### Task 5.2: Add A Minimal CI Matrix

Goal: catch platform/runtime issues without overbuilding CI.

Implementation:

1. Run core verification on Node 22 and Node 24.
2. Run at least one Windows job for CLI path behavior.
3. Keep VS Code packaging in a separate workflow to avoid slowing every push.

Validation:

- Workflow syntax tests if available.
- `docs/github-integration.md` reflects supported runtime expectations.

## Phase 6: Reporter And Repair Loop Trust

### Task 6.1: Add Finding Stability Tests

Goal: keep finding ids, SARIF rule ids, and fingerprints stable enough for CI annotations.

Implementation:

1. Add snapshot tests for representative findings from each blocker-capable detector.
2. Verify:
   - finding id shape,
   - SARIF rule id,
   - fingerprint behavior,
   - repair contract fields.
3. Document how to intentionally change ids.

Validation:

- `pnpm test -- tests/reporters.test.ts tests/repair-contract.test.ts`

### Task 6.2: Add A Compact "Why Passed" Report Section

Goal: make clean runs useful without sounding like a generic reviewer.

Implementation:

1. Extend clean diff certificate with evidence categories:
   - changed file count,
   - detector families that ran,
   - no blocking dependency/test/API/config/secret findings,
   - policy applied.
2. Keep the section deterministic and short.
3. Add reporter tests for clean and observation-only runs.

Validation:

- `pnpm test -- tests/reporters.test.ts`

## Phase 7: Guardrails Against Magic-Tool Drift

### Task 7.1: Add An "LLM Boundary" Test Suite

Goal: prove optional model support cannot become the detector of record.

Implementation:

1. Test that model artifacts include only compact changed-file metadata, findings, and allowed
   snippets.
2. Test redaction for paths, internal URLs, emails, and secret-like values.
3. Test that whole source files and repository trees are not included.
4. Document the maximum artifact shape in `docs/llm-layer.md`.

Validation:

- `pnpm test -- tests/llm-layer.test.ts`

### Task 7.2: Add Product Non-Goals To Release Checklist

Goal: prevent well-intended releases from expanding scope accidentally.

Implementation:

1. Add release checklist prompts:
   - Did this add repo-wide LLM review?
   - Did this add auto-fix behavior?
   - Did this add generic code-review comments?
   - Did this add a detector without evidence and fixtures?
2. Link the checklist to `AGENTS.md` and `docs/versioning-policy.md`.

Validation:

- Manual docs review.

## Recommended Order

1. Task 1.2: CI artifacts for coverage and evaluation. Done.
2. Task 2.1: policy file documentation and example validation. Done.
3. Task 1.3: detector quality sheets. Done.
4. Task 3.1: repository token index. Done.
5. Task 4.1: public entrypoint discovery hardening. Done.
6. Task 5.1: prebuilt action artifact path. Done.
7. Task 3.2: intent coverage categories. Done.
8. Task 2.2: policy explanation to reports.
9. Task 4.2: API snapshot release evidence.
10. Task 5.2: minimal CI matrix.
11. Task 6.1: finding stability tests.
12. Task 6.2: compact "why passed" report section.
13. Task 7.1: LLM boundary test suite.
14. Task 7.2: product non-goals release checklist.
15. Task 1.1: expanded real-repository evaluation corpus.

This order keeps distribution and core detector precision moving first, then hardens reporting,
workflow coverage, repair-loop trust, and finally the broader real-repository corpus once behavior
is more stable.

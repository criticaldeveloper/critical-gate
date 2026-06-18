# Deep Improvement Task Plan

This plan translates the external improvement report into a chronological implementation backlog for
Critical Gate.

The goal is not to turn Critical Gate into a generic reviewer. The goal is to evolve it into a
stronger deterministic change-integrity system: intent-aware, repository-aware, evidence-first,
repair-oriented, and fast enough for local editor use.

## Strategic Direction

The next product phase should add a shared repository knowledge layer and then build five higher
value detector families on top of it:

- Diff Intent Verification.
- Diff Blast Radius.
- Existing Solution Detection.
- Repository Pattern Violations.
- Historical Expected Companions.
- Scope Expansion Score as an interpretable replacement for the current Diff Cost Score.

All new detector families should start in observation mode or non-blocking severity until precision
is measured with fixtures and dogfood repositories.

## Execution Principles

- Keep the CLI/core as the source of truth. VS Code, GitHub Action, Codex hook, and reports should
  consume the same normalized result.
- Prefer deterministic signals: git diff, TypeScript compiler APIs, exports, imports, path roles,
  git history, package metadata, and local repository patterns.
- Use LLMs only after deterministic findings exist, and only for explanation or ambiguous synthesis.
- Avoid per-file noise when a cluster-level finding is more useful.
- Add fixtures for every detector behavior change.
- Preserve schema compatibility unless a task explicitly introduces a versioned schema change.
- Measure both quality and speed: precision, recall, cold run time, and warm run time.

## Phase 1: Cached Repository Knowledge Layer

### Task 1.1: Introduce `src/knowledge` Module Skeleton

Create a new shared knowledge layer with clear boundaries.

Files:

- `src/knowledge/types.ts`
- `src/knowledge/cache.ts`
- `src/knowledge/graph.ts`
- `src/knowledge/symbol-index.ts`
- `src/knowledge/history-index.ts`
- `src/knowledge/index.ts`

Deliverables:

- Define `RepositoryKnowledge`, `KnowledgeRequest`, `KnowledgeCacheKey`, `FileGraph`,
  `SymbolIndex`, `HistoryIndex`, and related minimal types.
- Keep this layer independent from reporters and UI.
- Re-export only stable APIs from `src/knowledge/index.ts`.

Acceptance criteria:

- The project builds with an empty-but-typed knowledge module.
- Existing detectors keep working unchanged.
- No detector imports VS Code or reporter-specific code.

Verification:

```bash
pnpm typecheck
pnpm test
```

### Task 1.2: Move Repository Profile Into Knowledge History Index

Move the current co-change profile logic behind `src/knowledge/history-index.ts`.

Current sources to account for:

- `src/repository/profile.ts`
- `RepositoryProfile`
- `RepositoryCoChange`
- `repository-intelligence-detector`

Deliverables:

- Preserve existing `RepositoryProfile` behavior through an adapter.
- Add a directed co-change representation that can later support expected companions.
- Keep the current repository-intelligence detector output stable.

Acceptance criteria:

- Existing repository intelligence tests pass unchanged or with minimal naming updates.
- Public schema remains backward compatible.

Verification:

```bash
pnpm vitest run tests/repository-profile.test.ts tests/repository-intelligence-detector.test.ts
```

### Task 1.3: Move Utility Index Into Knowledge Solution Index Adapter

Prepare utility reinvention for the broader Existing Solution Detector.

Current sources to account for:

- `src/repository/utility-index.ts`
- `utility-reinvention-detector`
- `UtilityIndex`
- `UtilityEntry`

Deliverables:

- Add `SolutionIndex` and `SolutionEntry` types.
- Keep `utilityIndex` available as a compatibility projection.
- Start collecting solution class candidates: `utility`, `hook`, `service`, `query`, `validator`,
  `schema`, and `adapter`.

Acceptance criteria:

- Current utility reinvention tests still pass.
- No behavior change is required yet.

Verification:

```bash
pnpm vitest run tests/utility-index.test.ts tests/utility-reinvention-detector.test.ts
```

### Task 1.4: Add Lazy Knowledge Loading

Stop building every repository index on every diff read.

Current limitation:

- `readGitDiff()` currently builds repository profile and utility index eagerly.

Deliverables:

- Make `readGitDiff()` responsible for diff reading only.
- Add a detector context accessor such as `context.knowledge.getHistoryIndex()` and
  `context.knowledge.getSolutionIndex()`.
- Compute indexes only when a detector requests them.
- Keep CLI output compatible.

Acceptance criteria:

- Detectors that do not need history or solutions do not pay index cost.
- Existing reports still include needed context metadata.
- Tests cover lazy loading with a detector that does not request knowledge.

Verification:

```bash
pnpm test
pnpm verify
```

### Task 1.5: Add Versioned Local Knowledge Cache

Persist expensive repository knowledge between runs.

Deliverables:

- Add a cache keyed by base ref, `HEAD`, `package.json`, `tsconfig`, lockfile fingerprints, and
  relevant source-file signatures.
- Store cache under a repo-local ignored directory, for example `.critical-gate/cache/`.
- Add cache invalidation tests.
- Add a CLI/env flag to disable cache for debugging.

Acceptance criteria:

- Warm runs reuse cached history/solution data.
- Cache invalidates when tracked source/config inputs change.
- Cache files are ignored by git.

Verification:

```bash
pnpm vitest run tests/knowledge-cache.test.ts
pnpm verify
```

## Phase 2: Observable Intent Model

### Task 2.1: Add Structured Intent Model

Replace the current keyword-only model with observable intent fields.

Files:

- `src/intent/intent-model.ts`
- `src/intent/index.ts`
- `tests/task-analysis.test.ts`

Proposed output:

```ts
interface IntentModel {
  complexity: "small" | "medium" | "large";
  verbs: IntentVerb[];
  targetTokens: string[];
  allowedChangeClasses: ChangeClass[];
  forbiddenChangeClasses: ChangeClass[];
  targetAreas: TargetArea[];
}
```

Initial `IntentVerb` values:

- `add`
- `fix`
- `remove`
- `rename`
- `update`
- `refactor`
- `migrate`
- `bump`
- `wire`
- `instrument`

Initial `ChangeClass` values:

- `ui`
- `tests`
- `config`
- `dependency`
- `api-surface`
- `docs`
- `ci`
- `i18n`
- `telemetry`
- `build`
- `data-model`
- `source`

Acceptance criteria:

- Existing `analyzeTaskIntent()` remains available as a compatibility wrapper.
- New tests cover common task intents and expected allowed classes.
- No detector behavior changes yet unless explicitly routed to the new model.

Verification:

```bash
pnpm vitest run tests/task-analysis.test.ts
```

### Task 2.2: Classify Observed Diff Actions

Create a deterministic classifier for observed change classes.

Deliverables:

- Map file roles, paths, manifest changes, exports, tests, and config files into observed
  `ChangeClass` values.
- Include evidence per observed class.
- Keep classification reusable by detectors, reporters, and VS Code.

Acceptance criteria:

- A changed workflow maps to `ci`.
- A package dependency addition maps to `dependency`.
- A changed test file maps to `tests`.
- A changed public export maps to `api-surface`.
- Fixtures cover mixed-class diffs.

Verification:

```bash
pnpm vitest run tests/intent-observed-actions.test.ts
```

### Task 2.3: Add Intent Verification Detector

Add `src/detectors/intent-verification-detector.ts`.

Detector output should reconcile:

- Requested intent.
- Observed actions.
- Unexpected actions.

Deliverables:

- Emit findings when observed change classes are not allowed by the intent.
- Include stable rule IDs and evidence grouped by change class.
- Start at `medium` severity unless an unexpected class is clearly high risk, such as dependency,
  config, CI, or API surface.

Acceptance criteria:

- A UI-only task that changes CI emits a finding.
- A docs task that changes source emits a finding.
- A release/version task with version-only manifest change does not emit a finding.
- Detector is registered in the runner in observation-friendly severity first.

Verification:

```bash
pnpm vitest run tests/intent-verification-detector.test.ts
pnpm test
```

### Task 2.4: Extend Result Schema With Intent Verification Summary

Add a versioned summary block for intent reconciliation.

Proposed shape:

```ts
interface IntentVerificationSummary {
  requestedClasses: ChangeClass[];
  observedClasses: ChangeClass[];
  unexpectedClasses: ChangeClass[];
  coverage: "none" | "partial" | "matched";
  explanationCodes: string[];
}
```

Deliverables:

- Update `src/schema/types.ts`.
- Update `src/schema/gate-result.schema.ts`.
- Update JSON and Markdown reporters.
- Keep old fields backward compatible.

Acceptance criteria:

- JSON schema tests cover the new block.
- Markdown report shows requested/observed/unexpected classes.
- SARIF remains valid.

Verification:

```bash
pnpm vitest run tests/schema.test.ts tests/reporters.test.ts
```

## Phase 3: Diff Blast Radius

### Task 3.1: Build File Relationship Graph

Add a graph over repository files with weighted edges.

Signals:

- Direct imports.
- Historical co-change.
- Shared feature path prefix.
- Test-source relationship.

Deliverables:

- Add graph construction to `src/knowledge/graph.ts`.
- Add edge types and weights.
- Add tests for graph construction on fixture repos.

Acceptance criteria:

- Source and nearby test files are connected.
- Imported files have import edges.
- Historically co-changed files have history edges.

Verification:

```bash
pnpm vitest run tests/knowledge-graph.test.ts
```

### Task 3.2: Add Blast Radius Detector

Add `src/detectors/blast-radius-detector.ts`.

Deliverables:

- Cluster changed files by graph connectivity.
- Identify the likely primary cluster from task intent and target areas.
- Emit one aggregate finding per unexpected cluster.
- Include cluster label, representative paths, size, roles, and reason.

Acceptance criteria:

- A small UI task touching unrelated CI/config emits one cluster-level finding, not many per-file
  findings.
- A multi-file feature within one functional cluster does not produce noisy scope findings.
- Unexpected clusters with manifest/config/CI get higher severity.

Verification:

```bash
pnpm vitest run tests/blast-radius-detector.test.ts
```

### Task 3.3: De-emphasize Legacy Scope Detector

Keep the current scope detector for high-confidence cases, but avoid duplicate noise.

Deliverables:

- Add deduplication between legacy scope and blast-radius findings.
- Prefer aggregate cluster finding when both fire.
- Keep deleted-file and manifest/config high-confidence rules.

Acceptance criteria:

- Existing deleted-file regression still fails.
- Cluster-level scope findings do not duplicate per-file findings unless severity requires it.

Verification:

```bash
pnpm vitest run tests/scope-detector.test.ts tests/blast-radius-detector.test.ts
```

## Phase 4: Existing Solution Detector

### Task 4.1: Implement Solution Index

Replace narrow utility indexing with broader repository solution indexing.

Solution classes:

- `utility`
- `hook`
- `service`
- `query`
- `validator`
- `schema`
- `adapter`

Metadata:

- Normalized name.
- Exported name.
- Path.
- Class.
- Arity.
- Return type when available.
- Import neighborhood tokens.
- Domain tokens from symbol and path.

Acceptance criteria:

- Existing utility index behavior is preserved through compatibility projection.
- New fixtures index hooks, services, validators, and schemas.

Verification:

```bash
pnpm vitest run tests/solution-index.test.ts tests/utility-index.test.ts
```

### Task 4.2: Add Existing Solution Detector

Add `src/detectors/existing-solution-detector.ts`.

Detection stages:

- Exact normalized name match.
- Alias/stem match.
- Signature similarity.
- Import-neighborhood similarity.
- Domain token overlap.

Acceptance criteria:

- New helper duplicating existing utility emits a finding.
- New hook duplicating existing hook emits a finding.
- New validator duplicating existing validator emits a finding.
- Low-confidence name-only coincidences do not emit.

Verification:

```bash
pnpm vitest run tests/existing-solution-detector.test.ts
```

### Task 4.3: Update Repair Text For Reuse Guidance

Make repair guidance directly actionable.

Examples:

- `Reuse formatDate from src/utils/date.ts instead of adding formatDateForSignup.`
- `Move this logic into the existing user service at src/services/user.ts.`
- `Use the existing schema validator instead of adding a parallel helper.`

Acceptance criteria:

- Findings name the existing symbol and path.
- Repair text is specific enough for a Codex repair loop.

Verification:

```bash
pnpm vitest run tests/existing-solution-detector.test.ts tests/reporters.test.ts
```

## Phase 5: Repository Pattern Violations

### Task 5.1: Add Pattern Index

Add `src/knowledge/pattern-index.ts`.

Infer repository archetypes from observed files:

- Services.
- Hooks.
- Queries.
- Validators.
- Schemas.
- Adapters.
- Feature roots.

Acceptance criteria:

- The index infers common repository patterns from path and export signatures.
- It does not require configuration to work.
- It exposes confidence per inferred pattern.

Verification:

```bash
pnpm vitest run tests/pattern-index.test.ts
```

### Task 5.2: Add Optional `.critical-gate.json`

Add optional configuration for pattern tuning.

Potential fields:

```json
{
  "patternAliases": {},
  "featureRoots": [],
  "serviceRoots": [],
  "validatorRoots": [],
  "excludePatterns": []
}
```

Acceptance criteria:

- Missing config is valid.
- Invalid config reports a usage/configuration finding or warning without crashing.
- Config affects pattern inference in tests.

Verification:

```bash
pnpm vitest run tests/config.test.ts tests/pattern-index.test.ts
```

### Task 5.3: Add Pattern Violation Detector

Add `src/detectors/pattern-violation-detector.ts`.

Acceptance criteria:

- Adding `helpers/user-api-helper.ts` in a repo with established `services/user.ts` patterns emits a
  finding.
- Adding a new `useX` hook outside established hook roots emits a finding when confidence is high.
- Detector avoids dogmatic architecture claims and cites observed repo patterns.

Verification:

```bash
pnpm vitest run tests/pattern-violation-detector.test.ts
```

## Phase 6: Historical Expected Companions

### Task 6.1: Extend History Index With Directed Companion Rules

Compute conditional co-change rules such as `P(B | A)`.

Deliverables:

- Store support, confidence, and last-seen metadata.
- Add minimum support thresholds.
- Derive special-case rules for package-lock, source-test, schema-fixture, and route-doc patterns.

Acceptance criteria:

- History fixtures produce deterministic expected companion rules.
- Low-support pairs are filtered out.

Verification:

```bash
pnpm vitest run tests/history-index.test.ts
```

### Task 6.2: Add Expected Companions Detector

Add `src/detectors/expected-companions-detector.ts`.

Acceptance criteria:

- Source file changes without historically paired test changes emit a finding.
- `package.json` changes without lockfile changes emit a finding when the repo has a lockfile.
- Schema changes without fixtures/snapshots emit a finding when history supports it.
- Findings explain what appears missing, not just what is unusual.

Verification:

```bash
pnpm vitest run tests/expected-companions-detector.test.ts
```

### Task 6.3: Tune Existing Repository Intelligence Detector

Keep rare-combination detection, but make expected companions the primary historical signal.

Acceptance criteria:

- Rare-combination findings remain available.
- Expected-missing companion findings are prioritized in summaries and VS Code.
- No duplicate historical findings for the same root cause.

Verification:

```bash
pnpm vitest run tests/repository-intelligence-detector.test.ts tests/expected-companions-detector.test.ts
```

## Phase 7: Scope Expansion Score

### Task 7.1: Add Scope Expansion Score Model

Replace user-facing Diff Cost Score with a 0-10 Scope Expansion Score.

Drivers:

- Number of clusters touched.
- Unexpected clusters.
- Rewrites.
- Config/CI changes.
- Dependency changes.
- API surface changes.
- New top-level directories.
- Missing expected companions.
- Churn adjusted by task complexity.

Acceptance criteria:

- Internal score calculation is deterministic.
- Report includes score and drivers.
- Existing `diffCostScore` remains available for compatibility or is migrated through a versioned
  schema path.

Verification:

```bash
pnpm vitest run tests/task-analysis.test.ts tests/reporters.test.ts tests/schema.test.ts
```

### Task 7.2: Update CLI, Markdown, JSON, SARIF, And Repair Outputs

Expose the score consistently everywhere.

Acceptance criteria:

- Markdown shows `Scope Expansion Score: 8/10` and driver list.
- JSON includes structured score drivers.
- SARIF rule metadata remains stable.
- Repair output includes only actionable high-priority drivers.

Verification:

```bash
pnpm vitest run tests/reporters.test.ts tests/cli.test.ts
```

## Phase 8: VS Code UX Architecture

### Task 8.1: Split VS Code Extension Into Modules

Break up `extensions/vscode/src/extension.ts`.

Target modules:

- `activate.ts`
- `state.ts`
- `cli-adapter.ts`
- `diagnostics.ts`
- `commands.ts`
- `code-actions.ts`
- `tree-provider.ts`
- `report-view.ts`

Acceptance criteria:

- No behavior change.
- Extension-host tests pass.
- Public command IDs remain stable.

Verification:

```bash
pnpm build:vscode
pnpm test:vscode
```

### Task 8.2: Add Tree View For Findings And Analysis Structure

Move structured lists out of the webview where native VS Code tree views fit better.

Tree sections:

- Latest run.
- Findings by detector family.
- Changed clusters.
- Missing companions.
- Existing solutions.
- Changed files.
- Recent runs.

Acceptance criteria:

- Tree view supports keyboard navigation and context menus.
- Existing webview can remain as run detail/report view.
- Tests verify command contributions and provider registration.

Verification:

```bash
pnpm build:vscode
pnpm test:vscode
```

### Task 8.3: Persist Workspace Run History

Persist useful run metadata across reloads using VS Code workspace storage.

Persist:

- Last run summary.
- Last report.
- Recent run history, for example last 20.
- Task, base, timestamp, decision, findings count, file count, score, and top drivers.

Do not persist active Problems diagnostics as fresh findings without rerun unless clearly marked
stale.

Acceptance criteria:

- Restarting VS Code keeps last run history.
- Dashboard shows stale/last-run state clearly.
- Problems panel is not misleading after reload.

Verification:

```bash
pnpm test:vscode
```

### Task 8.4: Add Contextual Editor Actions

Add native actions around findings and evidence.

Actions:

- Open existing solution.
- Copy repair prompt.
- Mark accepted blast-radius expansion.
- Open expected companion.
- Open cluster report.

Acceptance criteria:

- Actions appear only when relevant.
- Existing `Open Evidence` and `Copy Repair` continue working.
- Accepted expansions are stored locally or in a documented config file, depending on design.

Verification:

```bash
pnpm test:vscode
```

### Task 8.5: Improve Status Bar Semantics

Move beyond pass/fail count.

Examples:

- `Critical Gate: scope 8/10`
- `Critical Gate: 1 unexpected cluster`
- `Critical Gate: API surface touched`
- `Critical Gate: companions missing`

Acceptance criteria:

- Status bar summarizes the highest-value signal.
- Tooltip includes detailed counts and last run time.
- Clicking status bar opens the run tree/report.

Verification:

```bash
pnpm test:vscode
```

## Phase 9: CI And SARIF Refinement

### Task 9.1: Stabilize SARIF Rule IDs And Fingerprints

Improve GitHub code scanning compatibility.

Deliverables:

- Stable rule IDs per detector and sub-rule.
- `partialFingerprints` where deterministic.
- Categories by detector family.
- SARIF size safeguards.

Acceptance criteria:

- SARIF snapshot tests cover fingerprints.
- GitHub upload remains valid.

Verification:

```bash
pnpm vitest run tests/reporters.test.ts tests/github-integration.test.ts
```

### Task 9.2: Add Complete SARIF Upload Workflow Templates

Make CI setup first-class.

Deliverables:

- Document full workflow with `upload-sarif`.
- Include default threshold flow.
- Include non-code-scanning Markdown summary fallback.

Acceptance criteria:

- Docs cover both code scanning and no-code-scanning setups.
- Example workflows use `fetch-depth: 0`.

Verification:

```bash
pnpm verify
```

## Phase 10: Evaluation And Rollout

### Task 10.1: Add End-To-End Fixture Repositories

Move beyond isolated function tests.

Fixture categories:

- Intent mismatch.
- Unexpected cluster.
- Existing solution duplication.
- Pattern violation.
- Missing expected companion.
- Legitimate broad refactor.

Acceptance criteria:

- CLI snapshot tests run over fixture repositories.
- Each detector family has positive and negative fixtures.

Verification:

```bash
pnpm vitest run tests/e2e-fixtures.test.ts
```

### Task 10.2: Add Precision And Runtime Evaluation Harness

Track detector quality and performance.

Metrics:

- Precision of unexpected actions.
- Precision of existing solution findings.
- Recall of expected companions.
- Cold run time.
- Warm run time.

Acceptance criteria:

- Evaluation command runs locally.
- Results are written to a Markdown or JSON artifact.
- Baselines are documented for dogfood repos.

Verification:

```bash
pnpm test
```

### Task 10.3: Roll Out New Detector Families In Observation Mode

Avoid blocking merges too early.

Deliverables:

- Add configuration or severity policy for observation mode.
- Document when to promote a detector family to blocking.
- Track false positives during dogfood runs.

Acceptance criteria:

- New detectors can report without failing the gate.
- Strict/blocking behavior is explicit and tested.

Verification:

```bash
pnpm verify
```

## Recommended Implementation Order

1. Phase 1: Cached Repository Knowledge Layer.
2. Phase 2: Observable Intent Model.
3. Phase 3: Diff Intent Verification and Blast Radius.
4. Phase 4: Existing Solution Detector.
5. Phase 5: Repository Pattern Violations.
6. Phase 6: Historical Expected Companions.
7. Phase 7: Scope Expansion Score.
8. Phase 8: VS Code UX Architecture.
9. Phase 9: CI and SARIF Refinement.
10. Phase 10: Evaluation and Rollout.

## First Task To Start Later

Start with **Task 1.1: Introduce `src/knowledge` Module Skeleton**.

Reason:

- It creates the stable foundation for every later improvement.
- It does not change detector behavior yet.
- It can be reviewed safely with type and unit tests.
- It prepares lazy loading and caching without forcing a large rewrite in the first implementation
  step.

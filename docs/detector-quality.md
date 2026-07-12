# Detector Quality

This document explains what Critical Gate detectors actually prove, where they are intentionally
quiet, and what tests or evaluation cases protect their behavior.

The goal is not to make every detector block more often. The goal is to keep findings evidence-backed
and low-noise enough to use in local checks, CI, and Codex repair loops.

## Quality Standard

Every blocker-capable detector should have:

- Clear deterministic signals.
- Evidence that points to paths, lines, symbols, manifest keys, config files, or measured churn.
- A "will flag" boundary.
- A "will not flag" boundary.
- Known blind spots.
- Focused tests or labeled eval cases.

Uncertain detector families should remain observation-friendly until dogfood and evaluation evidence
support promotion.

## Maturity Levels

Detector maturity is the trust label used in reports and policy summaries:

- `experimental`: advisory evidence. These detectors can be useful, but they should not block by
  default.
- `review`: strong deterministic evidence for human review and explicit policy rollout, but not yet
  independently validated enough to be called certified.
- `blocker-certified`: reserved for narrow subtypes with frozen holdout evidence, very low
  false-blocker rates, complete missed-finding review, and validated repair-loop outcomes.

Maturity does not replace rollout policy. A `review` detector can still be observation-only in a
repository policy, and an `experimental` detector promoted by policy still has to satisfy severity
and evidence-strength thresholds.

## Finding Stability Contract

Finding ids, SARIF rule ids, SARIF fingerprints, and repair contract fields are user-facing output
contracts. They affect CI annotations, SARIF deduplication, and automated repair loops.

Only change these fields intentionally when detector semantics change enough that old annotations
would be misleading. For an intentional change:

- Update the detector or reporter implementation in the same task.
- Update `tests/reporters.test.ts` stability expectations for representative blocking findings.
- Update `tests/repair-contract.test.ts` when repair scope, instructions, or success criteria change.
- Document the behavior change in detector quality docs or release notes when it affects users.

## Blocking-Capable Detectors

### Dependency Addition

Detector: `dependency-addition`

Signals used:

- Added entries in `dependencies`, `devDependencies`, or related package manifest sections.
- Lockfile companion changes.
- Task intent wording that does or does not justify adding a package.

Evidence emitted:

- Manifest path.
- Dependency name, version, and section.
- Repair guidance to remove, justify, or use existing/native utilities.

Will flag:

- A production dependency added when task intent does not ask for or justify a dependency.
- A dev dependency added for a narrow task when there is no visible tooling/test justification.

Will not flag:

- Version-only package manifest changes for release/version tasks.
- Dependency changes explicitly requested by task intent.
- Lockfile companion observations by themselves when the manifest change is already expected.

Known blind spots:

- It does not yet prove an existing local utility fully replaces the new package.
- It does not run vulnerability analysis for the dependency.

Coverage:

- Unit tests: `tests/dependency-detector.test.ts`.
- Evaluation case: `eval/cases/dependency-prod-001`.

### Test Weakening

Detector: `test-weakening`

Signals used:

- Removed assertions.
- Added `.skip`, `.only`, or `todo`.
- Assertion specificity changes from behavior/value checks to generic existence checks.
- Snapshot or broad matcher changes when visible in changed hunks.

Evidence emitted:

- Test path and line evidence.
- Matcher or assertion text where available.
- Repair guidance to restore equivalent behavioral coverage.

Will flag:

- Removed assertions in test files.
- Newly skipped or todo tests.
- Replacing specific behavior assertions with generic existence assertions.

Will not flag:

- Adding tests.
- Refactoring test code while preserving equivalent assertion specificity.
- Non-test files unless classified as tests.

Known blind spots:

- It does not execute tests to measure mutation score.
- It cannot always infer semantic equivalence between custom assertion helpers.

Coverage:

- Unit tests: `tests/test-weakening-detector.test.ts`.
- Evaluation cases: `eval/cases/test-weakening-001`, `eval/cases/skipped-test-added-001`.

### Secret And Path

Detector: `secret-path`

Signals used:

- Added token-like strings.
- Absolute local paths.
- Internal hostnames or URLs.
- Provider-token patterns.

Evidence emitted:

- File and line ranges.
- Redacted messages; secret values must not be printed in full.

Will flag:

- Added provider-token-looking values.
- Added local absolute paths in source/config contexts.
- Added internal hosts in risky contexts.

Will not flag:

- Normal documentation or test fixture examples unless they look like blocker-grade secrets.
- Existing secrets outside the diff.

Known blind spots:

- It is a lightweight diff-only scanner, not a full secret-scanning replacement.
- It may miss custom token formats until explicitly added.

Coverage:

- Unit tests: `tests/secret-path-detector.test.ts`.
- Dogfood evidence: `docs/dogfood-ky-2026-06-18.md`.

### Public API Surface

Detector: `api-surface`

Signals used:

- Export removals, additions, and signature changes.
- `.critical-gate/api-surface.json` snapshots.
- Public entrypoint provenance from package metadata, `bin`, policy entrypoints, or fallback index
  files.
- Framework contract fallbacks for known public surfaces.
- Release evidence such as changelog, changeset, migration docs, or explicit API release task
  intent.

Evidence emitted:

- Entrypoint or framework contract path.
- Exported symbol name.
- Change type.
- Public entrypoint source when package or policy metadata proves the file is public.
- Missing release/snapshot evidence when relevant.
- API snapshot updates without changelog, changeset, migration, or explicit API release task
  evidence.

Will flag:

- Snapshotted export removals without release evidence.
- Signature changes against a committed API snapshot.
- Added exports to a snapshotted entrypoint when the snapshot or release evidence is missing.
- `.critical-gate/api-surface.json` updates that are not paired with release evidence.
- Known framework contract export removals covered by fixtures.

Will not flag:

- Internal non-exported symbol changes.
- Intentional public contract changes with matching snapshot/release evidence.
- API snapshot updates paired with changelog, changeset, migration notes, or explicit API release
  task intent.

Known blind spots:

- Complex package `exports` conditions are flattened deterministically; it does not resolve runtime
  condition priority.
- Policy-defined public entrypoints require explicit files, not globs.

Coverage:

- Unit tests: `tests/api-surface-detector.test.ts`, `tests/api-snapshot.test.ts`.
- Evaluation cases: `eval/cases/framework-contract-export-removed-001`.

### Config Change

Detector: `config-change`

Signals used:

- Config-file classification.
- Build, lint, test, bundler, Docker, CI, runtime, TypeScript, or package-manager config changes.
- Task intent and documentation/changelog companion changes.

Evidence emitted:

- Config path.
- Changed role.
- Missing task/doc acknowledgement.

Will flag:

- Operational config changed during a task that does not mention config.
- Runtime/tooling pin changes during unrelated UI or source tasks.
- Config changes without visible operational documentation when docs are expected.

Will not flag:

- Config changes requested by task intent.
- Config changes paired with relevant docs/changelog evidence.

Known blind spots:

- It does not deeply parse every config format.
- It cannot know every organization's operational review process without policy/docs evidence.

Coverage:

- Unit tests: `tests/config-change-detector.test.ts`.
- Evaluation case: `eval/cases/config-runtime-pin-drift-001`.

### Scope And Unrelated Files

Detector: `scope`

Signals used:

- Task intent terms.
- Changed file paths and roles.
- Repository token index matches from paths, symbols, test names, Markdown headings, package names,
  and nearby folders.
- Small-task classification.
- High-risk roles such as config, manifest, lockfile, and deleted source files.

Evidence emitted:

- Unexpected file path.
- Role and task-boundary rationale.
- Matching repository tokens when they explain file alignment.
- Repair guidance to split or justify unrelated edits.

Will flag:

- Config/package/source changes unrelated to a narrow task.
- Unrelated file deletions during small tasks.
- High-risk file roles changed without matching task intent.

Will not flag:

- Files explicitly allowed by a provided task contract, even when changed package ownership aligns
  more strongly with another task target.
- Expected source/test/doc companions when task intent supports them.
- Version-only manifest changes during release tasks.
- Tiny legitimate stylesheet/token changes when task intent is explicitly stylistic.
- Focused UI presentation tasks that explicitly name multiple component/view areas and only touch
  UI source files or visual assets.
- Selector-local responsive visual fixes, such as article hero title overflow corrections, when the
  changed stylesheet is the only affected surface.

Known blind spots:

- Task-to-path matching is deterministic and can miss domain synonyms not in the repository.
- It does not understand product semantics beyond paths, roles, history, and intent tokens.

Coverage:

- Unit tests: `tests/scope-detector.test.ts`, `tests/task-analysis.test.ts`.
- Evaluation cases: `eval/cases/config-runtime-pin-drift-001`, `eval/cases/typography-clean-001`,
  `eval/cases/ft-about-project-ui-scope-001`,
  `eval/cases/ft-now-playing-vinyl-asset-001`.

### Intent Coverage

Detector: `intent-coverage`

Signals used:

- Strong implementation verbs.
- UI/content target terms.
- Requested intent categories such as source behavior, tests, docs, config/tooling, dependency,
  public API, and UI/content.
- Changed file roles and churn.
- Observed change categories derived from file roles, paths, package manifests, workflows, and
  changed exports.
- Trivial stylesheet-only edits.

Evidence emitted:

- Requested class of work.
- Observed changed roles/classes.
- Missing expected categories and unexpected extra categories in the intent summary.
- Explanation of underimplementation.

Will flag:

- A visible feature request satisfied only by trivial style/token edits.
- Task intent that clearly asks for UI/source implementation but observes no meaningful matching
  implementation class.
- Explicitly requested non-source categories such as docs or test coverage when the diff contains
  work but not that category.

Will not flag:

- Explicit style-tuning tasks.
- Docs-only tasks that only change docs.
- Tasks where observed file roles match the requested work.
- Missing tests for ordinary source tasks unless task wording explicitly asks for tests or coverage.

Known blind spots:

- It does not render UI or execute the app.
- It relies on conservative task wording and changed-file signals.
- Category confidence is deterministic evidence strength, not a proof that implementation is
  semantically complete.

Coverage:

- Unit tests: `tests/intent-verification-detector.test.ts`.
- Evaluation case: `eval/cases/ui-undercoverage-001`.

### Rewrite

Detector: `rewrite`

Signals used:

- Added/deleted line balance.
- Churn compared with task complexity.
- File rewrite percentage and structural similarity proxies.
- Vague or small task wording.

Evidence emitted:

- File path.
- Churn metrics.
- Task-size mismatch explanation.

Will flag:

- Large balanced rewrites for small or vague tasks.
- Broad component rewrites when the requested change is copy, style, or narrowly scoped behavior.

Will not flag:

- Legitimate broad refactors with task intent that names the refactor scope.
- Larger changes where file roles and task scope are coherent.
- Focused UI presentation rewrites are downgraded to medium when the task terms and changed file
  path show layout/style intent and no structural imports, exports, props, or companion-relevant
  data hooks changed.

Known blind spots:

- It does not prove semantic equivalence of removed and added code.
- It can be conservative for generated or heavily formatted files and should rely on path/exclude
  policy when appropriate.

Coverage:

- Unit tests: `tests/rewrite-detector.test.ts`.
- Evaluation cases: `eval/cases/copy-component-rewrite-001`,
  `eval/cases/vague-component-rewrite-001`.

## Observation-Friendly Detectors

These detectors provide useful evidence but should generally stay non-blocking until policy or
dogfood evidence promotes them.

### Blast Radius

Detector: `blast-radius`

Signals used:

- Changed-file clusters.
- File roles and package/workspace ownership.
- Diff coherence and scope expansion drivers.

Quality boundary:

- Useful for review and scoring.
- Should not block by default unless the repository has tuned policy and repeated evidence.
- Should not report separate clusters for focused UI presentation tasks when every cluster is an
  expected component/view/style/script path or a visual asset named by the task surface.
- Should not report separate clusters for explicit content publication tasks when the diff adds a
  content post/article and only updates reciprocal frontmatter metadata such as `related` or
  `synapses` in existing content files.

Coverage:

- Unit tests: `tests/blast-radius-detector.test.ts`.

### Expected Companions

Detector: `expected-companions`

Signals used:

- Git co-change history.
- Normal change model.
- Framework packs.
- Policy-taught expected support files.

Quality boundary:

- Useful for missing support-file observations.
- Should remain observation-friendly for immature repositories or tiny edits.
- Should not require external framework style companions when an Astro component carries its
  changed style evidence inline, or when historical companions are low relevance for a focused UI
  presentation task.
- Fresh `diegolopes-ft` evidence shows the remaining noisy boundary: coherent static Astro visual
  tasks often touch more than six component/style files across sections, navigation, background
  media, metadata, or mobile layout. See
  `docs/dogfood-diegolopes-ft-2026-06-30-analysis.md` before changing this detector.
- Regression fixture: `eval/cases/astro-multisection-visual-001`.
- Should not require historical route, listing, or template companions for selector-local article
  stylesheet fixes unless markup, routing, imports, exports, or data hooks changed.
- Should not require generated evidence/report files as historical companions for implementation
  changes.
- Should not require Critical Gate dogfood journals as implementation companions; journals are
  post-run review artifacts even when repository history strongly pairs them with exports or config.
- Should not require renderer companions for data/content additions that reuse the existing record
  shape; new fields or schema/type changes remain companion-relevant.
- Regression fixture: `eval/cases/data-record-addition-existing-shape-001`.

Coverage:

- Unit tests: `tests/expected-companions-detector.test.ts`,
  `tests/normal-change-model.test.ts`.
- Evaluation cases: `eval/cases/dogfood-journal-companion-001` and
  `eval/cases/contract-authorized-cross-package-001` (scope contract authority).

### Existing Solution And Utility Reinvention

Detectors: `existing-solution`, `utility-reinvention`

Signals used:

- Utility-like modules.
- Exported helper names.
- Parameter and return-shape evidence.
- Import counts and folder roles.

Quality boundary:

- Good repair-loop guidance when symbol evidence is strong.
- Should avoid blocking until repository utility history is rich enough.

Coverage:

- Unit tests: `tests/existing-solution-detector.test.ts`,
  `tests/utility-reinvention-detector.test.ts`, `tests/utility-index.test.ts`.

### Pattern Violation And Repository Intelligence

Detectors: `pattern-violation`, `repository-intelligence`

Signals used:

- Local naming profiles.
- Framework packs.
- Repository history and normal patterns.

Quality boundary:

- Useful as repo-aware context.
- Should stay observational unless policy-enabled after dogfooding.
- Repository-history unusualness is weaker evidence when the task explicitly names the UI component
  or view surface and the diff stays inside focused UI presentation files.
- Repository-history unusualness is weaker evidence when a content-heavy repository adds a new
  post/article and updates only reciprocal content metadata in existing posts as part of an explicit
  related/synapse metadata task.
- Explicit UI-surface suppression must not apply to vague tasks, config/package drift, deleted files,
  or non-UI change clusters.

Coverage:

- Unit tests: `tests/pattern-violation-detector.test.ts`,
  `tests/repository-intelligence-detector.test.ts`, `tests/repository-profile.test.ts`.
- Evaluation case: `eval/cases/explicit-ui-surface-history-001`.

## Promotion Checklist

Before promoting an observation-friendly detector to blocking in `.critical-gate.json`:

1. Add or identify positive and negative fixtures.
2. Run `pnpm evaluate` and confirm no unexpected blocking regressions.
3. Dogfood on the target repository for several clean runs.
4. Document false-positive boundaries in this file or `docs/detectors.md`.
5. Add a policy reason explaining why the detector is ready to block for that repository.

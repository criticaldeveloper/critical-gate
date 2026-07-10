# Detector Catalog

For detector-specific quality boundaries, known blind spots, and coverage expectations, see
[detector-quality.md](detector-quality.md).

## Severity Levels

- `blocker`: should fail the gate by default.
- `high`: should fail the gate by default when evidence strength and rollout policy allow it.
- `medium`: should warn and appear in summaries; make it blocking only through explicit rollout
  policy or threshold changes after dogfooding.
- `low`: informational unless combined with other risk.

## Evidence Strength

Critical Gate treats evidence strength as part of the decision contract, not just display metadata.
The public JSON still includes the legacy `confidence` field for compatibility, but current values
are heuristic evidence-strength scores, not empirically calibrated probabilities.

- `very-high`: `0.90` and above.
- `high`: `0.80` to `0.89`.
- `medium`: `0.60` to `0.79`.
- `low`: below `0.60`.

By default, only `blocker` and `high` findings can fail the gate. They must also clear the
detector's minimum evidence-strength threshold and the active rollout policy. Deterministic detectors with
concrete evidence, such as dependency additions, test weakening, secrets, rewrites, public API
removals, and high-evidence scope findings, can block when they meet their band. Architecture,
convention, co-change, and framework-pack guesses are observation-friendly by default unless
promoted through rollout policy, and even explicit promotion does not bypass the minimum evidence-strength
threshold.

The summary exposes evidence-strength decision counts:

- `blockingEligibleCount`: findings that can fail this run.
- `observationModeCount`: high-evidence findings kept observational by rollout policy.
- `confidenceSuppressedCount`: legacy field name for high or blocker severity findings that did not
  meet the minimum evidence-strength threshold.

## Detector Maturity

Detector maturity is separate from severity, evidence strength, and rollout policy. It describes how much
trust the project currently has in a detector family or subtype.

- `experimental`: useful signal, but still advisory by default. These detectors need more
  cross-repository labels, false-positive boundaries, or repair-loop proof before they should block.
- `review`: deterministic evidence is strong enough for serious review and policy-enabled blocking,
  but external validation is still not enough to call it certified.
- `blocker-certified`: reserved for narrow detector subtypes that have frozen holdout evidence,
  extremely low false-blocker rates, complete missed-finding review, and repair guidance that has
  been validated in agent loops.

Current runtime output includes detector maturity in the applied policy summary. Maturity is
informational in this release: it does not by itself promote or suppress a finding. Rollout policy,
severity, and evidence-strength thresholds still decide whether a finding can fail the gate.

Current baseline:

- `review`: `dependency-addition`, `test-weakening`, `secret-path`, `api-surface`,
  `config-change`, `scope`, `rewrite`, and the `intent-coverage` finding subtype.
- `experimental`: `intent-verification`, `blast-radius`, `expected-companions`,
  `existing-solution`, `utility-reinvention`, `pattern-violation`, `required-checks`,
  `expected-artifacts`, `invariant-coverage`, and `repository-intelligence`.
- `blocker-certified`: none yet.

## Detector Run Status

Every CLI result can report detector execution status:

- `passed`: the detector ran and emitted no findings.
- `findings`: the detector ran and emitted findings.
- `skipped`: the detector was intentionally skipped.
- `insufficient-context`: the detector could not run meaningfully with the available repository
  context.
- `timed-out`: the detector exceeded its budget.
- `errored`: the detector threw an exception and the rest of the gate continued.

A degraded status such as `skipped`, `insufficient-context`, `timed-out`, or `errored` is not clean
pass evidence. Reports should show it separately from successful detector runs.

The scope detector uses `insufficient-context` for medium, large, or broad tasks where simple
path-keyword matching cannot prove the changed files are inside the intended boundary. That status
does not fail the gate by itself, but it tells reviewers and agents to provide a structured task
contract, ownership context, or explicit allowed and forbidden paths.

When a provided task contract includes `allowed_paths` or `forbidden_paths`, the scope detector
enforces those paths directly and emits blocker findings for changed files outside the allowed set
or inside the forbidden set. These checks run before the small-task keyword heuristic, so explicit
contract paths still apply to broad or medium tasks. If both lists match the same file,
`forbidden_paths` take precedence to avoid duplicate findings.

## V1 Blockers

### Unrelated File Modifications

Goal: detect changes that do not fit the requested task.

Evidence:

- Task intent keywords and affected domain.
- Changed file paths.
- File roles: source, test, config, docs, generated, lockfile.
- Git co-change history.
- Expected blast radius estimate.

Initial implementation:

- Score changed files by path/topic similarity to task intent.
- Flag unexpected config, dependency, or architecture files in small tasks.
- Treat package manifest and lockfile removal-only changes as task-aligned support when the removed
  dependency is explicitly named by the task.
- Raise severity when unrelated changes combine with high LOC churn.

### Intent Coverage Underimplementation

Goal: detect diffs that are too small or too indirect to satisfy a concrete feature task.

Evidence:

- Strong implementation verbs in the task intent, such as add, create, implement, build, render,
  display, or show.
- UI-facing target terms, such as section, page, screen, site, component, gallery, portfolio, or
  works.
- Changed files and line-level churn.
- Whether the diff only contains tiny stylesheet value edits.

Current behavior:

- A task like `Add new section to the site to display works done` should not be satisfied by a
  one-line typography or color change.
- The gate emits a high-evidence `intent-coverage` finding when visible UI implementation is
  requested but only trivial stylesheet values changed.
- Explicit style tasks, such as `Adjust typography font weight for the works section`, are excluded
  so normal visual tuning remains low-noise.

### Dependency Addition Without Justification

Goal: block unnecessary or unexplained new dependencies.

Evidence:

- `package.json` dependency additions.
- Lockfile additions.
- Existing equivalent dependencies or local utilities.
- Whether the task asked for a dependency.
- Whether docs or PR text justify the dependency.

Initial implementation:

- Parse package manifest deltas.
- Compare before and after manifest dependency maps so unchanged neighboring dependencies are not
  classified as additions after comma or line-context shifts.
- Distinguish production and development dependencies.
- Require stronger justification for production dependencies.
- Treat a provided task contract invariant of `no_new_dependencies` as stronger than task-text
  justification and emit a blocker for any added dependency.
- Detect common native alternatives and existing utilities later.

### Required Checks Declared But Not Verified

Goal: make task-contract validation expectations visible without pretending Critical Gate executed
commands.

Evidence:

- Provided task contract `required_checks`.

Initial implementation:

- Emit one observation-mode finding when a provided contract declares required checks.
- Accept repeated `--check-ran` values from the CLI and compare them to required checks after
  whitespace normalization.
- Accept `--checks-report` JSON with `command`, `status`, and optional `exitCode` fields.
- Include each missing, failed, or unverified required command as evidence with `verified: false`.
- Do not fail the gate by default while check execution metadata is new; repositories can promote
  the detector through policy after calibration.

### Expected Artifacts Declared

Goal: make task-contract deliverables visible without guessing whether the diff satisfies prose
artifact descriptions.

Evidence:

- Provided task contract `expected_artifacts`.

Initial implementation:

- Emit one observation-mode finding when a provided contract declares expected artifacts.
- Include each artifact as evidence with `verified: false`.
- Do not infer missing artifacts from filenames or prose until a deterministic matcher exists.

### Invariant Coverage

Goal: expose task-contract invariants that still need manual verification or future deterministic
detector support.

Evidence:

- Provided task contract `invariants`.
- Current deterministic invariant support list.

Initial implementation:

- Treat `no_new_dependencies` as covered by the dependency detector.
- Emit one observation-mode finding for provided invariants that are not deterministically enforced.
- Include each unenforced invariant as evidence with `enforced: false`.

### Silent Public API Change

Goal: prevent public exports and signatures from changing without acknowledgement.

Evidence:

- Exported symbol additions, removals, renames, or signature changes.
- API report diff.
- Committed `.critical-gate/api-surface.json` public API snapshot.
- Changelog, release note, docs, or explicit acknowledgement.

Initial implementation:

- Use TypeScript compiler APIs or API Extractor.
- Compare public export surface before and after diff.
- Flag public API changes without visible documentation or acknowledgement.

Current snapshot behavior:

- `critical-gate snapshot-api` generates a deterministic public export snapshot from package
  entrypoints, policy entrypoints, or explicit `--entrypoint` values.
- Normal `check` runs load `.critical-gate/api-surface.json` when present.
- Without a committed snapshot, export findings are limited to resolved public entrypoints when
  package metadata, policy, or fallback index discovery provides public-surface evidence.
- Snapshotted export removals and signature changes require snapshot, changelog, changeset, or
  migration evidence. Task wording alone is not enough for a committed public contract change.
- Added exports to a snapshotted entrypoint are reported unless the snapshot or release evidence is
  updated in the same diff.

### Test Weakening

Goal: detect tests made less capable while preserving green CI.

Evidence:

- Removed assertions.
- Assertion specificity decreases from behavior/value checks to generic existence checks.
- Rendering presence assertions replacing behavioral UI assertions.
- Weaker matchers.
- Removed test cases.
- Added `.skip`, `.only`, `todo`, broad mocks, or snapshot rewrites.
- Decreased mutation score later.

Initial implementation:

- Diff-level matcher and assertion heuristics.
- Test framework-aware patterns for Jest, Vitest, Playwright, and Mocha.
- Flag assertion deletion and skipped tests as high confidence.
- Score assertion specificity in changed hunks and flag high-to-low replacements such as
  `toHaveBeenCalledWith(...)` becoming `toBeInTheDocument()` or exact error checks becoming
  `toBeDefined()`.

### Secret Or Hardcoded Path Detection

Goal: block credentials, tokens, internal hosts, and environment-specific paths.

Evidence:

- Secret scanner output.
- Added strings in config and source files.
- Absolute system paths.
- Internal hostnames and URLs.

Initial implementation:

- Integrate existing tools where available.
- Add lightweight diff-only checks for absolute paths and suspicious env values.
- Never print secret values in full.

### Config Change Without Explanation

Goal: catch operational or developer-experience contract changes with no visible documentation.

Evidence:

- Changes to build, lint, test, bundler, Docker, CI, infrastructure, or TypeScript config.
- Missing docs, ADR, changelog, or PR explanation.

Initial implementation:

- Classify config files.
- Detect contract-level edits.
- Warn or fail when config changes are unrelated to the task and undocumented.

## P1 Detectors

### Rewrite For Small Request

Goal: detect large churn when the task is small.

Evidence:

- Task complexity estimate.
- Files changed.
- Added/deleted LOC.
- Percentage of file rewritten.
- Similarity of old and new file structure.

Output:

- Diff Cost Score contribution.
- High severity when combined with unrelated files or deleted tests.
- High severity for balanced rewrites under vague or generic task text such as `Update project`,
  because the task intent does not provide a reliable boundary for broad component churn.

### Existing Utility Already Available

Goal: catch utility reinvention.

Evidence:

- New helper files or utility functions.
- Existing local utilities with similar names or signatures.
- Import graph and nearby symbols.
- Exported symbol name, parameter count, return shape, folder role, and import count.

Initial implementation:

- Index utility-like files and exported helper names.
- Compare new helper names against existing utilities.
- Include symbol-level evidence so repair loops can reuse the existing solution confidently.
- Later use embeddings or LLM only for ambiguous semantic similarity.

### Repository Convention Violation

Goal: detect local naming or framework drift.

Evidence:

- Symbol names in touched folder.
- Existing framework usage.
- New framework or abstraction introduced by diff.
- Local file naming patterns.

Initial implementation:

- Build local naming profiles by folder.
- Flag rare names only when confidence is high and the symbol is newly introduced.

### Normal Change Model

Goal: use repository history as positive evidence for normal companion relationships before
flagging scope drift.

Evidence:

- Git co-change history.
- Source/test pairs.
- Component/story pairs.
- Translation/UI pairs.
- Config/docs pairs.
- Package manifest/lockfile pairs.
- Source/docs pairs.

Current companion relevance behavior:

- Historical companion findings require mature repository history and repeated pair support.
- Tiny self-contained component edits, such as copy or label changes, do not emit companion
  observations.
- Newly added Astro/Vue/Svelte components and simple page wiring for those components do not require
  external style or script companions by default.

Initial implementation:

- Build typed normal patterns from the same history index used for companion rules.
- Preserve raw co-change evidence and directed companion rules for compatibility.
- Add the normal pattern kind to expected-companion evidence when a missing file is a known normal
  relationship.
- Include known normal patterns in repository-intelligence evidence when a changed path appears with
  an unusual combination.
- Suppress repository-intelligence observations for focused UI presentation diffs when the task
  explicitly names the touched component or view surface and all changed files remain inside UI
  source or visual asset paths. This keeps sparse history from overriding clear task intent.
- Suppress history-derived companion prompts for tiny stylesheet value-only edits, because a
  one-line typography token change should not require broad historical docs or component companions.
- Suppress history-derived companion prompts for focused UI presentation and small default-state
  changes when the diff is self-contained in styles, UI components, pages, or tiny client scripts.
  This keeps visual polish and display-mode defaults from requiring historically paired route,
  config, or unrelated style companions when no structural behavior changed.
- Suppress low-signal generated, build, report, and evidence-output paths as historical companion
  targets. These files can co-change during dogfood or CI workflows, but they should not become
  required implementation companions for future feature work.
- Suppress history-derived companion prompts for data/content files when the diff only adds another
  record using the same existing object shape. Adding a new field, exported type, import, or schema
  still remains companion-relevant because the renderer or validation layer may need to change.

### Task Intent Quality Warnings

Goal: warn when the task text is too vague to form a reliable diff boundary.

Evidence:

- Very short task text.
- Generic phrases such as `fix bug`, `update code`, or `improve project`.
- Intent text with only generic maintenance words.
- Missing repository-specific target nouns.

Initial implementation:

- Emit a non-blocking `intentQuality` summary.
- Score task intent quality from `0` to `100`.
- Include deterministic suggestions in Markdown, PR comments, and JSON.
- Keep warnings separate from detector findings so vague task text does not fail the gate alone.

### Monorepo Ownership Context

Goal: identify package and workspace ownership before blast-radius and policy decisions.

Evidence:

- `pnpm-workspace.yaml`.
- Root package `workspaces`.
- `turbo.json`.
- `nx.json`.
- `lerna.json`.
- Root TypeScript path aliases.
- Changed file paths.

Initial implementation:

- Detect workspace globs from common monorepo manifests.
- Infer changed package owners from the current diff.
- Read changed package names from package-local `package.json` files.
- Capture root TypeScript path aliases as ownership context.
- Store the result in `context.monorepo` for downstream detectors and reports.

## P2 Detectors

### Duplicate Code

Use existing duplication tooling and intersect results with added diff lines.

### Dead Code

Use ecosystem tools and intersect findings with newly added files, exports, variables, and dependencies.

## Agent Smell Taxonomy

These are cross-detector patterns that should affect scoring:

- Agent rewrite: large file regeneration for a small request.
- Framework drift: introducing a new framework when the repo already uses another pattern.
- Utility reinvention: creating a helper when one already exists.
- Abstraction inflation: new classes, interfaces, factories, or layers for a simple change.
- Test theater: changing tests to match implementation rather than preserve behavior.
- Config wandering: touching build or CI files unrelated to the task.

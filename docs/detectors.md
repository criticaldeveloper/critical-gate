# Detector Catalog

## Severity Levels

- `blocker`: should fail the gate by default.
- `high`: should fail in strict mode or require explicit acknowledgement.
- `medium`: should warn and appear in summaries.
- `low`: informational unless combined with other risk.

## Confidence Calibration

Critical Gate treats confidence as part of the decision contract, not just display metadata.

- `very-high`: `0.90` and above.
- `high`: `0.80` to `0.89`.
- `medium`: `0.60` to `0.79`.
- `low`: below `0.60`.

Only `blocker` and `high` findings can fail the gate. They must also clear the detector's calibrated
minimum confidence. Deterministic detectors with concrete evidence, such as dependency additions,
test weakening, secrets, rewrites, public API removals, and high-confidence scope findings, can
block when they meet their band. Architecture, convention, co-change, and framework-pack guesses are
observation-friendly by default unless promoted through rollout policy, and even explicit promotion
does not bypass the minimum confidence threshold.

The summary exposes calibration counts:

- `blockingEligibleCount`: findings that can fail this run.
- `observationModeCount`: high-confidence findings kept observational by rollout policy.
- `confidenceSuppressedCount`: high or blocker severity findings that did not meet confidence.

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
- The gate emits a high-confidence `intent-coverage` finding when visible UI implementation is
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
- Distinguish production and development dependencies.
- Require stronger justification for production dependencies.
- Detect common native alternatives and existing utilities later.

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
  entrypoints or explicit `--entrypoint` values.
- Normal `check` runs load `.critical-gate/api-surface.json` when present.
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

Initial implementation:

- Build typed normal patterns from the same history index used for companion rules.
- Preserve raw co-change evidence and directed companion rules for compatibility.
- Add the normal pattern kind to expected-companion evidence when a missing file is a known normal
  relationship.
- Include known normal patterns in repository-intelligence evidence when a changed path appears with
  an unusual combination.
- Suppress history-derived companion prompts for tiny stylesheet value-only edits, because a
  one-line typography token change should not require broad historical docs or component companions.

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

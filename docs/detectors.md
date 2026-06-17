# Detector Catalog

## Severity Levels

- `blocker`: should fail the gate by default.
- `high`: should fail in strict mode or require explicit acknowledgement.
- `medium`: should warn and appear in summaries.
- `low`: informational unless combined with other risk.

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
- Changelog, release note, docs, or explicit acknowledgement.

Initial implementation:

- Use TypeScript compiler APIs or API Extractor.
- Compare public export surface before and after diff.
- Flag public API changes without visible documentation or acknowledgement.

### Test Weakening

Goal: detect tests made less capable while preserving green CI.

Evidence:

- Removed assertions.
- Weaker matchers.
- Removed test cases.
- Added `.skip`, `.only`, `todo`, broad mocks, or snapshot rewrites.
- Decreased mutation score later.

Initial implementation:

- Diff-level matcher and assertion heuristics.
- Test framework-aware patterns for Jest, Vitest, Playwright, and Mocha.
- Flag assertion deletion and skipped tests as high confidence.

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

### Existing Utility Already Available

Goal: catch utility reinvention.

Evidence:

- New helper files or utility functions.
- Existing local utilities with similar names or signatures.
- Import graph and nearby symbols.

Initial implementation:

- Index utility-like files and exported helper names.
- Compare new helper names against existing utilities.
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

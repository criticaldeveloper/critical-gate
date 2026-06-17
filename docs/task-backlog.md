# Task Backlog

## 0. Repository Setup

1. Create package metadata for a TypeScript CLI.
2. Add formatter, linter, test runner, and typecheck scripts.
3. Add `src/`, `tests/`, and `fixtures/` directories.
4. Add ADR directory and first ADRs.
5. Add CI workflow for lint, typecheck, and tests.

## 1. Core Schemas

1. Define `TaskIntent` type.
2. Define `DiffFile`, `DiffHunk`, and `DiffLine` types.
3. Define `RepoContext` type.
4. Define `Finding` type.
5. Define `GateResult` type.
6. Add JSON schema for public output.
7. Add schema validation tests.

## 2. CLI Foundation

1. Add `critical-gate` CLI entrypoint.
2. Support `--task`, `--base`, `--format`, `--strict`, and `--output`.
3. Implement exit codes:
   - `0`: pass.
   - `1`: findings failed the configured threshold.
   - `2`: usage or configuration error.
   - `3`: internal error.
4. Add fixture command tests.

## 3. Diff Reader

1. Resolve git root.
2. Resolve base ref.
3. Collect changed files.
4. Parse unified diff.
5. Detect file status: added, modified, deleted, renamed.
6. Calculate churn metrics.
7. Classify paths by role.

## 4. Reporters

1. Implement JSON reporter.
2. Implement Markdown reporter.
3. Implement SARIF reporter.
4. Implement compact repair reporter.
5. Add snapshot tests for each reporter.

## 5. Dependency Detector

1. Parse before/after package manifests.
2. Detect new production dependencies.
3. Detect new dev dependencies.
4. Detect lockfile-only anomalies.
5. Search task intent and docs/PR text for justification.
6. Emit blocker for unjustified production dependency.
7. Emit medium/high for unjustified dev dependency depending on context.

## 6. Test Weakening Detector

1. Classify test files.
2. Detect removed assertions.
3. Detect skipped tests.
4. Detect weakened matchers.
5. Detect broad snapshot rewrites.
6. Add framework-specific fixtures for Jest and Vitest first.

## 7. Config Change Detector

1. Classify config files.
2. Detect operational config changes.
3. Detect build/lint/test/CI contract changes.
4. Check for docs, ADR, changelog, or task acknowledgement.
5. Emit warning or blocker based on severity and relation to task.

## 8. Secret And Path Detector

1. Add diff-only secret scanning abstraction.
2. Integrate a mature scanner when available.
3. Detect absolute paths.
4. Detect suspicious internal URLs or hosts.
5. Redact sensitive evidence.

## 9. API Surface Detector

1. Identify public entrypoints.
2. Generate current API surface for TS/JS.
3. Generate baseline API surface.
4. Diff exports and signatures.
5. Check docs/changelog/acknowledgement.
6. Emit findings for silent public changes.

## 10. Task Intent And Scope

1. Normalize task text.
2. Estimate task complexity: small, medium, large.
3. Compare expected and actual file roles.
4. Score unrelated files.
5. Emit unrelated modification findings.
6. Calculate initial Diff Cost Score.

## 11. Rewrite Detector

1. Detect high rewrite percentage per file.
2. Compare rewrite size to task complexity.
3. Detect many deleted and re-added equivalent lines.
4. Emit high severity for small-task rewrites.

## 12. Repository Intelligence

1. Build git co-change graph.
2. Cluster historical file change patterns.
3. Store local repository profile.
4. Estimate expected file set by task type.
5. Compare current diff to historical patterns.
6. Explain unusual change patterns with evidence.

## 13. Utility Reinvention

1. Index utility-like modules.
2. Extract exported helper names.
3. Detect new helper modules.
4. Compare new helpers to existing names and signatures.
5. Emit findings only above high confidence threshold.

## 14. Codex Integration

1. Add hook mode to CLI.
2. Emit compact repair instructions.
3. Add example `.codex/hooks.json`.
4. Document trust and local setup.
5. Add sample failing diff and repair payload fixture.

## 15. GitHub Integration

1. Add GitHub Action wrapper.
2. Add workflow examples.
3. Add SARIF upload example.
4. Add Reviewdog or Checks output example.
5. Document recommended thresholds.

## 16. Optional LLM Layer

1. Define model input artifact.
2. Redact secrets.
3. Add provider interface.
4. Add prompt templates for ambiguous findings.
5. Add cache.
6. Add budget controls.
7. Add tests proving the whole repo is not sent.

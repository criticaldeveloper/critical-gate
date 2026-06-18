# Implementation Roadmap

## Phase 0: Documentation And Decision Records

Goal: make the project buildable by Codex and future agents.

Deliverables:

- Repository `AGENTS.md`.
- Product brief.
- Architecture document.
- Detector catalog.
- Evaluation strategy.
- Chronological task backlog.
- Initial ADRs for TypeScript core, deterministic-first analysis, and CLI-first product surface.

Exit criteria:

- A future agent can start implementation without rereading the research report.

## Phase 1: CLI Skeleton And Schemas

Goal: establish the reusable core and stable output contracts.

Deliverables:

- TypeScript package setup.
- CLI command entrypoint.
- Internal diff model.
- Finding schema.
- Reporter interfaces.
- JSON and Markdown output.
- Exit code contract.
- Fixture-based tests.

Exit criteria:

- Running the CLI against a fixture diff emits valid findings, even if detectors are placeholders.

## Phase 2: Diff Reader And Context Basics

Goal: make the tool understand what changed.

Deliverables:

- Git baseline resolution.
- Diff parser.
- File classification.
- Manifest parser.
- Test file classifier.
- Config file classifier.
- Basic LOC and churn metrics.

Exit criteria:

- The CLI can summarize changed files, churn, manifests, tests, and config deltas.

## Phase 3: First Blocker Detectors

Goal: catch concrete high-confidence risks with little noise.

Deliverables:

- Dependency addition detector.
- Test weakening detector.
- Config change without explanation detector.
- Secret/path detector integration or lightweight fallback.

Exit criteria:

- Each detector has positive and negative fixtures.
- Findings include evidence and repair hints.
- Strict mode can fail the CLI on blocker findings.

## Phase 4: Public API And Scope Detectors

Goal: move from simple diff checks to semantic value.

Deliverables:

- Public export surface detection for TS/JS.
- API change finding rules.
- Task intent parser.
- Unrelated file modification heuristic.
- Initial Diff Cost Score.
- Rewrite-for-small-request detector.

Exit criteria:

- The gate can explain why a small task created too much or unrelated change.

## Phase 5: Repository Intelligence

Goal: learn normal change patterns for a specific repo.

Deliverables:

- Git history analyzer.
- Co-change graph.
- Expected file pattern model.
- Expected blast radius model.
- Repository convention profiles.
- Utility index for reinvention detection.

Exit criteria:

- The gate can say when a change pattern is unusual for this repository and cite historical evidence.

## Phase 6: Codex Repair Loop

Goal: make the gate repair-oriented instead of merely advisory.

Deliverables:

- Compact repair prompt output.
- Example `.codex/hooks.json` Stop hook wrapper.
- CLI mode for hook usage.
- Documentation for pass/fail/continue behavior.
- Fixture showing an agent-readable repair payload.

Exit criteria:

- A Codex hook can run the CLI and return focused repair instructions when the diff fails.

## Phase 7: CI And GitHub Integration

Goal: enforce the gate in pull requests.

Deliverables:

- GitHub Action wrapper.
- SARIF reporter.
- Reviewdog or Checks-compatible output guidance.
- CI examples.
- Threshold configuration.

Exit criteria:

- A GitHub workflow can run the gate, upload/report findings, and fail on configured severities.

## Phase 8: LLM-Assisted Explanation

Goal: add optional model help only where deterministic evidence is already available.

Deliverables:

- Compact finding summary prompt.
- Provider abstraction.
- Cost controls.
- Redaction rules.
- Caching.
- Tests for no-repo-wide prompt behavior.

Exit criteria:

- Optional LLM mode improves explanation quality without becoming the detector of record.
- The model artifact excludes hunks, full file contents, and repository-wide context.

## Phase 9: Editor Surface

Goal: show mature findings in local development.

Deliverables:

- VS Code extension prototype.
- Diagnostic mapping.
- Quick links to evidence and repair text.

Exit criteria:

- Editor diagnostics are useful and quiet enough for repeated use.
- The prototype runs the CLI and displays Problems panel diagnostics without becoming a separate
  detector implementation.

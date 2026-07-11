# Phase 4 Exit Review

Date: 2026-07-11

Phase 4 removed probability-like confidence claims from current product behavior while preserving
existing integrations. This review records why the terminology and model migration can close even
though statistical calibration remains future evidence work.

## Task Completion

| Roadmap task                                   | Result   | Evidence                                                                                                                                        |
| ---------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Normalize evidence strength at the runner      | Complete | Every emitted finding receives `evidenceStrength`; required legacy `confidence` remains populated.                                              |
| Make evidence strength the canonical API       | Complete | Canonical calibration exports and thresholds use evidence-strength names; confidence-named exports are deprecated aliases.                      |
| Preserve JSON compatibility                    | Complete | Legacy finding, summary, and policy keys remain valid and populated; additive canonical fields have schema tests.                               |
| Remove probability language from human reports | Complete | Markdown, PR comments, reason chains, repair output, and reviewer checklists use evidence-strength or evidence wording.                         |
| Separate impact, evidence, and policy          | Complete | Gate summaries separate severity, evidence-strength eligibility, and policy IDs; SARIF exposes all three as independent properties.             |
| Define a measurable calibration path           | Complete | `docs/evidence-strength-calibration.md` defines subtype revisions, grouped splits, sample gates, metrics, artifacts, and threshold governance.  |
| Prevent claims from under-sampled data         | Complete | Current scores are documented as heuristic; probability claims require independent calibration and holdout gates that current data cannot meet. |

## Compatibility Contract

New consumers should use:

- `finding.evidenceStrength`;
- `summary.evidenceStrengthSummary`;
- `summary.policyApplied.evidenceThresholdSuppressedFindingIds`;
- `calibrateFindingEvidenceStrength` and `minimumBlockingEvidenceStrength`.

Critical Gate continues to emit and validate these legacy aliases:

- `finding.confidence`;
- `summary.confidenceCalibration` and `confidenceSuppressedCount`;
- `summary.policyApplied.confidenceSuppressedFindingIds`;
- `calibrateFindingConfidence` and `minimumBlockingConfidence`.

The legacy names are compatibility fields, not calibrated probability claims. Removing them would
require an explicit breaking-version plan and migration period.

## Exit Criteria

- Reports label numeric scores as evidence strength or evidence, so `0.84` is not presented as an
  84% correctness probability.
- Impact severity does not determine policy outcome by itself; evidence thresholds, observation
  rollout, accepted findings, and fail severity remain independently explainable.
- SARIF consumers can inspect `impactSeverity`, `evidenceStrength`, and `policyDecision` without
  inferring one concept from another.
- Calibration has predefined subtype boundaries, leakage-resistant splits, minimum data gates,
  reliability metrics, uncertainty reporting, and threshold governance.

## Validation Evidence

- `pnpm verify`: formatting, lint, typecheck, VS Code builds, and 411 tests passed.
- `pnpm evaluate`: 44 deterministic development/calibration/holdout cases passed with 100% case and
  finding precision and recall.
- Reporter tests cover evidence-strength wording and SARIF policy decisions.
- Schema tests cover additive canonical fields while legacy-only payloads remain accepted.
- Source/report documentation audit leaves confidence-named references only where compatibility or
  statistical co-change terminology requires them.

## Residual Limitations

- No detector subtype currently has enough independent calibration and holdout labels to support a
  correctness probability claim.
- Existing thresholds remain engineering policy constants, not empirically fitted probabilities.
- The evaluation corpus is strong regression evidence but too small and curated for calibration.
- Git co-change mining legitimately uses statistical association confidence; that internal term is
  separate from finding evidence strength and should not be mechanically renamed.
- Legacy JSON and TypeScript names cannot disappear before a separately planned breaking release.

These limitations are explicit constraints on product claims and future threshold changes. They do
not require keeping the terminology migration open.

## Next Phase

Phase 5 should improve graph-based blast-radius analysis. Keep calibration data collection running
in parallel, but do not add probability machinery or tune thresholds until a detector subtype
approaches the protocol's minimum sample gates.

# Critical Components 2.10.0 Evidence Analysis

Date: 2026-07-12

This analysis covers the first two substantial `critical-gate@2.10.0` dogfood tasks in
`critical-components`: QR Code and Context Menu. Both runs used explicit task contracts and complete
manual missed-finding review.

## Results

| Task         | Decision | Findings | Useful | False positive | Missed |
| ------------ | -------- | -------- | ------ | -------------- | ------ |
| QR Code      | pass     | 3        | 2      | 1              | 0      |
| Context Menu | pass     | 7        | 2      | 5              | 0      |
| Combined     | pass     | 10       | 4      | 6              | 0      |

The canonical `evidenceStrengthSummary` and policy fields were present in both reports. Reviewers
treated scores as heuristic support strength rather than correctness probabilities.

## Useful Behavior

- Expected-artifact findings prompted explicit verification of source, tests, stories, exports,
  generated CEM, wrappers, themes, agent metadata, and changesets.
- Invariant-coverage findings retained manual checks for accessibility, keyboard/pointer behavior,
  listener cleanup, reduced motion, encoding, and public-surface alignment.
- QR Code scope analysis accepted component ownership, React exports, generated metadata, imports,
  and forbidden package boundaries.
- Context Menu validation found a real nested keyboard-focus defect before final evidence. That was
  normal test evidence rather than a Critical Gate finding, confirming the gate does not replace
  product validation.

## False-Positive Decisions

### Contract-authorized package ownership

The Context Menu contract explicitly allowed and expected
`packages/agents/src/component-hints/context-menu.json`. Scope analysis still reported the agents
package as ownership drift because free-text targets aligned more strongly with the components
package. Provided allowed paths are authoritative, so ownership inference must not contradict them.

Action: filter explicitly allowed paths before package-ownership inference. Covered by
`eval/cases/contract-authorized-cross-package-001` and a focused scope unit test.

### Dogfood journal companions

Four Context Menu findings inferred `docs/critical-gate-dogfood.md` as a missing companion for
exports and configuration. The journal is written after evidence review and is not required to make
implementation files coherent.

Action: classify Critical Gate dogfood/journal Markdown as low-signal historical companion output.
Covered by `eval/cases/dogfood-journal-companion-001` and a focused expected-companions unit test.

### QR type dependency

The QR Code label classified the `@types/qrcode-generator` finding as false positive because strict
TypeScript compilation required declarations for the selected runtime library. The original task and
contract did not visibly justify that dependency or record alternatives, so the detector's review
prompt remains defensible.

Action: retain current dependency behavior. Future tasks should put necessary dependency rationale
in task or PR context. Do not suppress dependency findings merely because manual review later accepts
the package.

## Additional Repository Finding

Repeated canonical CEM generation reordered modules nondeterministically, leaving unrelated manifest
churn after the two task commits. `critical-components` now sorts manifest modules by path and proved
two consecutive generations produce the same hash. This is a repository generator correction, not a
new Critical Gate detector requirement.

## Evaluation Impact

- Aggregate evidence: 119 labeled reports across five repositories, with no validation errors.
- Evaluation corpus: 46 cases after adding two development regressions.
- Precision and recall remain 100% on the deterministic fixture corpus.
- No detector was added or promoted; the changes narrow two demonstrated false-positive boundaries.

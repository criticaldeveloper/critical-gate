# Phase 3 Exit Review

Date: 2026-07-11

Phase 3 rebuilt task intent and scope analysis around explicit evidence and uncertainty. This review
records why the phase can close and which limitations remain for later reliability work.

## Task Completion

| Roadmap task                           | Result               | Evidence                                                                                                                                 |
| -------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Unicode-aware tokenization             | Complete             | NFC normalization and Unicode letter/number tokenization in `src/intent/intent-core.ts`.                                                 |
| Spanish and mixed-language tests       | Complete             | Intent, contract, scope, and five evaluation cases cover Spanish and mixed-language tasks.                                               |
| Separate descriptions from constraints | Complete             | `src/intent/task-constraints.ts` separates explicit English/Spanish constraints and infers established invariants.                       |
| Remove word-count complexity           | Complete             | Complexity uses actions, clauses, lists, coordination, paths, and implementation targets.                                                |
| Extract task targets                   | Complete for Phase 3 | Components/domains, packages, workspaces, changed symbols, paths, and known invariants contribute evidence.                              |
| Run scope for medium/large tasks       | Complete             | Contract and package-ownership checks run; incomplete evidence emits `insufficient-context`.                                             |
| Treat docs/tests as scope-relevant     | Complete             | Path/content tokens and changed-file graph relationships justify support; unrelated support emits medium evidence.                       |
| Use ownership/package/alias evidence   | Complete             | Changed workspace ownership and root TypeScript path mappings are evaluated before broad path fallback.                                  |
| Use imports and changed symbols        | Complete             | Full/two-token changed-symbol matching and changed-endpoint import edges provide bounded evidence.                                       |
| Distinguish unexpected/support/unknown | Complete             | Blocker contract violations, medium ownership/support findings, graph-justified support, and insufficient context are separate outcomes. |
| Emit missing context as status         | Complete             | Scope reports `insufficient-context` with a concrete reason instead of pass-like output.                                                 |
| Emit repairable evidence               | Complete             | Findings include package/path/symbol signals, affected files, and scoped repair guidance.                                                |

## Exit Criteria

- Broad tasks do not silently pass: medium, large, and broad tasks require contract or ownership
  evidence and otherwise report `insufficient-context`.
- Spanish and Unicode text remains intact through task tokenization and quality analysis.
- Explicit contracts can flag docs/tests outside allowed paths; inferred small-task analysis can
  report unrelated docs/tests when a task-aligned anchor exists.
- Scope findings identify paths, package roots, changed symbols, graph relationships, and concrete
  repair choices.

## Validation Evidence

- `pnpm verify`: 408 tests passed before this review.
- `pnpm evaluate`: 44 cases passed with 100% case/finding precision and recall.
- Evaluation partitions: 36 development, 5 calibration, and 3 untouched holdout cases.
- Multilingual seed: three development and two calibration cases, explicitly labeled as
  internal/manual evidence rather than external validation.

## Residual Limitations

- TypeScript aliases inherited only through `extends` are not resolved yet; malformed or unresolved
  alias configuration degrades without failing the run.
- Package ownership evidence is strongest in declared monorepos and does not prove file-level scope.
- Symbol extraction is intentionally limited to changed exported declarations.
- Import support requires both endpoints to be changed and does not use path/history proximity as
  import authority.
- Multilingual evaluation still needs real independently reviewed tasks before product claims can
  rely on it.

These limitations remain explicit uncertainty or future evidence work. They do not require keeping
Phase 3 open.

## Next Phase

Phase 4 should finish the backward-compatible confidence-language migration. `evidenceStrength`
already exists as an optional finding field and human finding output prefers it. The next slice is
to populate it consistently at the runner boundary and remove probability-like wording from human
policy summaries while retaining legacy JSON `confidence` fields.

# Improvement Task Plan

This plan converts `IMPROVEMENTS.md` into implementation-sized work. The source brief was removed
after this plan was created so future agents have a stable project document instead of an ad hoc
root note.

## Release Slice: Trust And Calibration

1. Calibrate task/path alignment.
   - Add semantic aliases for common wording such as font, typography, style, CSS, and SCSS.
   - Ensure small legitimate style changes do not emit unrelated-source findings only because the
     path uses a repository-specific synonym.
   - Keep generic words such as project out of scope matching.

2. Reduce companion-finding noise.
   - Cap historical expected-companion findings per changed source path.
   - Prefer the highest-support, highest-confidence companion evidence.
   - Keep package/lockfile companion checks uncapped and independent.

3. Add positive pass evidence.
   - Render a clean diff certificate in Markdown reports when the gate passes.
   - Summarize what was checked, not only what failed.
   - Keep the certificate deterministic and derived from existing summary/finding data.

4. Preserve dogfood coverage.
   - Add regression tests for the mv-ft font-weight scenario.
   - Add reporter tests for clean pass output.

## Next Product Tasks

1. Evaluation harness. Completed in `feature/case-based-evaluation`.
   - Replace fixture-proxy metrics with case-based evaluation under `eval/cases`.
   - Support expected true-positive, false-positive, false-negative, and expected-clean outcomes.
   - Emit precision, recall, noisiest detector, and best detector summaries.

2. Reason-chain evidence blocks. Completed in `feature/reason-chain-evidence`.
   - Extend findings with structured reason chains: what happened, why suspicious, supporting
     signals, acceptability criteria, and repair guidance.
   - Render reason chains in Markdown, PR comments, and repair output.

3. Repository learning controls. Completed in `feature/repository-learning-controls`.
   - Add accept and teach commands that write reviewable policy entries.
   - Store accepted patterns as policy-as-code, not hidden suppressions.

4. Framework packs. Completed in `feature/framework-packs`.
   - Add boring deterministic packs for React, Next.js, Angular, Astro, Lit, Nest, Express, Vite,
     and Storybook.
   - Each pack should define expected companions, normal file relationships, and support-file
     allowances.

5. Diff coherence score. Completed in `feature/diff-coherence-score`.
   - Add a positive coherence score derived from feature clusters, expected support files, and
     out-of-cluster changes.
   - Keep every score driver evidence-backed.

6. PR comment mode. Completed in `feature/pr-comment-mode`.
   - Add a compact Markdown PR summary optimized for GitHub comments.
   - Separate high-confidence blockers, medium observations, and expected support changes.

7. Agent repair contract. Completed in `feature/agent-repair-contract`.
   - Add structured repair contracts with instructions, allowed files, forbidden files, and success
     criteria.
   - Surface contracts in Codex hook output and VS Code repair-copy actions.

8. Confidence calibration. Completed in `feature/confidence-calibration`.
   - Define per-detector confidence bands and decision behavior.
   - Ensure uncertain architecture guesses do not block by default.

9. Normal change model. Completed in `feature/normal-change-model`.
   - Deepen history-derived co-change models for source/test, story/component, translation/UI,
     config/docs, and package/lockfile relationships.

10. Task intent quality warnings. Completed in `feature/task-intent-quality-warnings`.
    - Detect vague task text such as "fix bug" or "update code".
    - Recommend more specific task intent text.

11. Monorepo support. Completed in `feature/monorepo-support`.
    - Read `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `lerna.json`, package workspaces, and
      TypeScript paths.
    - Use package/workspace ownership in blast-radius scoring.

12. Public API contract snapshots. Completed in `feature/api-contract-snapshots`.
    - Add a snapshot command for exported API surfaces.
    - Compare PR diffs against snapshots and require changeset/migration evidence.

13. Test meaningfulness delta. Completed in `feature/test-meaningfulness-delta`.
    - Score assertion specificity and detect high-to-low specificity changes.
    - Detect tests changed to assert rendering presence instead of behavior.

14. Symbol-level existing-solution evidence. Completed in
    `feature/symbol-level-existing-solution-evidence`.
    - Include exported name, parameter shape, return shape, folder role, and import count in
      existing-solution findings.

15. Reviewer checklist.
    - Generate a concise human-review checklist from non-blocking and blocking findings.

16. Local hook installers.
    - Add careful pre-commit and pre-push install modes.
    - Default to blocker-only pre-commit and high/blocker pre-push.

17. Policy as code.
    - Add a YAML/JSON policy file for thresholds, detector overrides, expected companions, and
      allowed support files.

18. Examples and positioning.
    - Expand the README with concrete examples of dependency drift, test weakening, unrelated
      edits, utility reinvention, public API changes, and clean diff certification.
    - Add calm competitor positioning that explains Critical Gate's category.

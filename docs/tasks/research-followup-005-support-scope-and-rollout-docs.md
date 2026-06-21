# Research Follow-Up 005: Support Scope And Rollout Docs

## Status

Done

## Why

The research report's rollout and scope concerns are partly real.

Evidence:

- README, `docs/detectors.md`, and `docs/project-brief.md` already state that V1 focuses on TypeScript and JavaScript repositories.
- `docs/usage-guide.md` and `docs/github-integration.md` already include rollout, observation mode, thresholds, and strict-mode guidance.
- The guidance is spread across several docs rather than presented as one concise team-adoption path.

This is not a missing feature, but it is a documentation clarity task.

## Tasks

1. Add a short "Supported Scope" section to README that distinguishes supported, experimental, and out-of-scope ecosystems. Done.
2. Add a short "Recommended Team Rollout" section to README that links to the deeper usage and GitHub docs. Done.
3. Keep detector rollout language consistent across README, `docs/usage-guide.md`, `docs/github-integration.md`, and `docs/detectors.md`. Done.
4. Avoid claiming broad production readiness until the release-governance, security-policy, coverage, and evaluation tasks are complete. Done: README now describes the project as pre-stable and recommends progressive rollout.

## Validation

- `pnpm format`
- Manual documentation review

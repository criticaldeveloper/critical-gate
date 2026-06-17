# ADR 0003: CLI First

## Status

Proposed

## Context

Critical Gate needs one reusable enforcement primitive before adding user-facing surfaces. A CLI can run locally, in CI, from Codex hooks, and inside GitHub Action wrappers.

## Decision

Build the CLI first and treat it as the canonical interface for analysis.

## Consequences

Benefits:

- Reusable by all later surfaces.
- Easy to test with fixtures.
- Works with Codex hooks and CI.
- Avoids premature editor UX work.

Tradeoffs:

- The early product will be less visual.
- Review comment and editor workflows come later.

# ADR 0002: Deterministic-First Analysis

## Status

Proposed

## Context

AI reviewers can be noisy, expensive, and inconsistent. Critical Gate's value depends on enforcing evidence-backed repository rules over the actual diff.

## Decision

Use deterministic detectors as the source of truth. LLMs may explain, prioritize, or interpret ambiguous findings, but they should not be the primary detector in v1.

## Consequences

Benefits:

- Lower cost.
- Lower latency.
- More reproducible results.
- Easier testing and CI enforcement.

Tradeoffs:

- Some semantic issues will be missed until repository intelligence and optional LLM interpretation mature.
- Detector design requires careful fixture coverage.

# ADR 0001: TypeScript Core

## Status

Proposed

## Context

The first useful version of Critical Gate targets TypeScript and JavaScript repositories. The strongest detector ecosystem for this v1 lives in Node.js and TypeScript: TypeScript compiler APIs, API Extractor, ESLint, test framework tooling, package manifest parsers, and JS duplication/dead-code tools.

## Decision

Build the v1 core in TypeScript.

## Consequences

Benefits:

- Fastest path to useful TS/JS detectors.
- Shared runtime for CLI, GitHub Action, and VS Code extension.
- Easier integration with existing JS analysis tools.

Tradeoffs:

- Non-JS language support will require adapters.
- Some future performance-sensitive indexing may need native modules or a separate worker.

# Project Brief

## Product Name

Critical Gate

## One Sentence

Critical Gate is a repository-aware diff integrity gate that decides whether an AI-generated code change is acceptably scoped, justified, and safe to merge.

## Positioning

Do not position this as another AI code reviewer. Position it as:

- A quality enforcement layer for coding agents.
- A diff hygiene gate for agent-generated changes.
- A repository intelligence system that learns what normal change patterns look like.

The value is not in writing prettier PR comments. The value is in stopping agent-created changes that compile but violate task scope, repository conventions, test integrity, dependency discipline, or public API contracts.

## Primary Users

- Developers using Codex, Cursor, Claude Code, Aider, OpenHands, Windsurf, or similar coding agents.
- Engineering teams adopting autonomous or semi-autonomous code generation.
- Maintainers who need automated pre-merge controls for agent-authored diffs.
- Platform and DevEx teams responsible for CI governance.

## Core Problem

Instructions can guide an agent, but they cannot prove that the final diff followed those instructions.

Common agent failure patterns include:

- Solving a small request with a broad rewrite.
- Touching unrelated files.
- Adding dependencies the repository does not need.
- Weakening tests while preserving green CI.
- Silently changing public APIs.
- Creating utilities that already exist nearby.
- Drifting from local naming, architecture, or framework conventions.
- Changing operational config without documentation.

Critical Gate converts these expectations into evidence-backed findings.

## Product Thesis

The most useful gate is mostly deterministic:

- Static analysis, AST parsing, git diff parsing, manifests, existing tools, and repository history produce findings.
- LLMs are used only for ambiguous semantic interpretation, finding explanations, prioritization, or repair prompts.
- The tool must inspect the diff first and expand context only when a detector needs it.

This keeps cost, latency, and noise low.

## V1 Scope

V1 focuses on TypeScript and JavaScript repositories.

Required v1 capabilities:

- Parse git diff and normalize changed files, hunks, additions, deletions, and changed symbols.
- Infer task intent from CLI input, commit message, PR title/body, or issue text.
- Detect high-risk agent diff patterns.
- Emit machine-readable and human-readable output.
- Support CI-style pass/fail thresholds.
- Support Codex repair loops by producing concise repair instructions.

## Non-Goals For V1

- Full general-purpose code review.
- Broad vulnerability scanning beyond integrating mature secret/security tools.
- Whole-repository LLM review.
- Automated refactoring.
- Deep multi-language semantic analysis.
- Real-time editor diagnostics.
- Replacing human review.

## Success Criteria

Critical Gate is useful when it:

- Blocks high-risk agent diffs with clear evidence.
- Avoids noisy generic comments.
- Runs fast enough for local and CI usage.
- Produces findings an agent can repair.
- Gives teams confidence that agent changes stay within expected blast radius.

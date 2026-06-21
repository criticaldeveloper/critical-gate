# AGENTS.md

## Project Identity

This repository is for **Critical Gate**, a repository-aware diff integrity gate for AI-generated code changes.

Do not frame the product as a generic AI code reviewer. The core product is an enforcement layer that checks whether an agent-produced diff is acceptable for this repository, given the task intent, changed files, local conventions, public API surface, tests, dependencies, and expected blast radius.

## North Star

Build a cheap, deterministic-first gate that catches high-risk agent failure patterns before merge:

- Scope creep and unrelated file changes.
- Small tasks implemented through large rewrites.
- New dependencies without contextual justification.
- Silent public API changes.
- Weakened tests.
- Hardcoded secrets, absolute paths, or environment leaks.
- Configuration changes without visible operational documentation.
- Reinvented utilities and repository convention drift.

LLMs are optional interpreters. They should not be the primary detector and should not receive the whole repository.

## Product Principles

- Diff-aware by default: analyze what changed against a baseline before expanding scope.
- Repo-aware when useful: use nearby code, package metadata, public exports, tests, and git history to judge whether a change is normal.
- Evidence-first: every finding must point to files, lines, symbols, or measured signals.
- Low-noise: prefer fewer high-confidence findings over broad generic review comments.
- Repair-oriented: findings should include enough context for Codex or another agent to fix the diff.
- Deterministic-first: static analysis, ASTs, existing tools, and heuristics run before any model call.
- Cost-sensitive: use LLMs only for ambiguous semantic interpretation or synthesis.

## V1 Technical Direction

- Language/runtime: TypeScript on Node.js.
- Initial target ecosystems: TypeScript and JavaScript repositories.
- Core input model: task intent, git diff, and minimal structured repository context.
- Core output formats: normalized JSON, Markdown summary, and SARIF-compatible results.
- First surface: CLI.
- Second surface: Codex hook mode and GitHub Action or CI wrapper.
- Later surface: VS Code diagnostics extension.

## Do Not Build Yet

- A generic PR reviewer.
- A chat-first code review assistant.
- A repo-wide LLM scanner.
- A VS Code extension before CLI precision is proven.
- Multi-language deep semantic analysis before TS/JS v1 is useful.
- Auto-fixes that rewrite code without explicit evidence and tight scope.

## Agent Workflow

Before implementing, read:

1. `README.md`
2. `docs/project-brief.md`
3. `docs/architecture.md`
4. `docs/detectors.md`
5. `docs/implementation-roadmap.md`
6. `docs/task-backlog.md`
7. `docs/llm-layer.md` when changing model-assisted explanation behavior
8. `docs/editor-surface.md` when changing editor integrations
9. `docs/versioning-policy.md` and `CHANGELOG.md` when preparing releases
10. `docs/installation.md` when changing user-facing installation or distribution paths

When changing code later:

- Keep work aligned to one roadmap task at a time.
- Add or update detector fixtures for every detector behavior change.
- Prefer structured parsers and existing ecosystem tools over string matching.
- Keep output schemas backward compatible unless the task explicitly changes them.
- Run the narrowest relevant verification commands before handing off.

## Release And Versioning

When changing package versions, release docs, distribution behavior, or tool metadata:

- Keep the root `package.json`, `extensions/vscode/package.json`, `src/version.ts`, CLI
  `--version` output, JSON metadata, SARIF tool metadata, `CHANGELOG.md`, and relevant installation
  or versioning docs aligned.
- Do not treat SARIF top-level `version` as the product version; it is the SARIF schema version.
  Product version belongs in SARIF tool metadata.
- Run or update `tests/release-version.test.ts` for any version-related change.
- Build the CLI and verify `node dist/cli.js --version` before handing off release-governance work.

## Git Workflow

Use branch names that describe the work type:

- `bugfix/example` for fixes.
- `feature/example-two` for new implementations.

For every completed task that changes files:

1. Create a new task branch before committing, using the naming rules above.
2. Stage only the task-related files.
3. Commit with the required message format below.
4. Switch back to `main`.
5. Merge the task branch into `main` with a fast-forward merge when possible.
6. Leave `main` checked out and clean so the user can push when ready.

Commit messages must use this format:

```text
[branch-name]

Implementation description
```

Example:

```text
[feature/repository-setup]

Scaffold TypeScript CLI project
```

## Review Expectations

For any feature PR, report:

- Which detector, surface, or schema changed.
- What evidence the implementation uses.
- What false positives the implementation intentionally avoids.
- What fixtures or tests cover the change.
- Whether the finding can be used in a Codex repair loop.

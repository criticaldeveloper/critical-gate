# Installable Distribution And CLI Maintainability Plan

## Status

Done.

## Why

Critical Gate is already functionally useful as a diff integrity gate, but the adoption path still
looks too source-based in important places. A developer should be able to try the CLI against an
agent-produced diff in less than a minute, without cloning this repository, installing pnpm, or
building TypeScript locally.

The current repository also concentrates too much CLI behavior in `src/cli.ts`. In this checkout the
file is below the previously reported 3,777 lines, but it still owns command routing, option
parsing, git-hook rendering, command implementations, result construction, help text, filesystem
defaults, and entrypoint detection. That slows down packaging work and makes CLI changes harder to
review safely.

## Product Boundary

These tasks must keep Critical Gate positioned as a repository-aware diff integrity gate, not a
generic AI code reviewer.

Distribution work should make the existing CLI, GitHub Action, Codex hook, and VS Code Marketplace
surface easier to install. It should not add repo-wide LLM scanning, evidence-free auto-fixes,
generic review comments, or broader language promises.

CLI refactor work should preserve command behavior, exit codes, output formats, schemas, SARIF tool
metadata, and repair-loop semantics unless a task explicitly changes one of those contracts.

## Current Evidence

- `package.json` already exposes the `critical-gate` binary through `bin`.
- `src/cli.ts` already includes a Node shebang.
- `src/version.ts`, root `package.json`, and `extensions/vscode/package.json` are currently aligned
  at `2.4.0`.
- The npm CLI package is now the intended primary public CLI install path.
- `action.yml` runs the npm CLI by default and keeps `version: local` for source dogfooding or
  smoke-tested prebuilt action artifacts.
- The VS Code extension is already published on Marketplace as
  `criticaldeveloper.critical-gate-vscode`:
  <https://marketplace.visualstudio.com/items?itemName=criticaldeveloper.critical-gate-vscode>

## Phase 1: Make npm CLI The Primary Install Path

Status: Done.

Goal: make this the first-class user path:

```bash
npx critical-gate check --task "Fix signup validation" --base main
pnpm dlx critical-gate check --task "Fix signup validation" --base main
npm install -D critical-gate
```

Implementation tasks:

1. Update package publishing metadata so `npm pack` includes `dist`, `README.md`, and `LICENSE`.
2. Add a prepack or release validation script that verifies:
   - `dist/cli.js` exists,
   - `dist/cli.js` starts with `#!/usr/bin/env node`,
   - `node dist/cli.js --version` matches `package.json` and `src/version.ts`,
   - the npm package contains only intended publish files.
3. Support Node.js `>=20` in package metadata and add Node 20 to the CI runtime matrix.
4. Update `README.md` so "Quick Start" starts with `npx` / `pnpm dlx`, not source build steps.
5. Update `docs/installation.md` so npm is the official CLI install path and source-based setup is
   under "Development From Source".
6. Update `docs/versioning-policy.md` to describe npm publication as the canonical CLI distribution
   channel for public alpha/beta users.
7. Add release checklist coverage for npm provenance, `npm pack --dry-run`, and CLI smoke tests.

Validation:

```bash
pnpm verify
pnpm build
node dist/cli.js --version
npm pack --dry-run
```

Compatibility boundary:

- Do not change detector behavior, report schemas, exit codes, or command semantics in this phase.
- Do not split the root package into `@critical-gate/core` yet.

## Phase 2: Make The GitHub Action Public-Repo Friendly

Status: Done.

Goal: make third-party workflows use a versioned public action without compiling Critical Gate:

```yaml
- uses: criticaldeveloper/critical-gate@v2
  with:
    task: ${{ github.event.pull_request.title }}
    base: ${{ github.event.pull_request.base.sha }}
    format: sarif
    output: critical-gate.sarif
```

Preferred initial design:

- Keep the action simple and npm-backed.
- Add an action input named `version`, defaulting to the current CLI package version.
- Run `npx --yes critical-gate@<version> check ...` from the checked-out consumer repository.
- Keep source-mode or prebuilt-artifact mode only for repository dogfooding and release testing.

Implementation tasks:

1. Decide whether `action.yml` should become npm-backed by default or keep source mode with a new
   public action wrapper. Prefer one public path to avoid user confusion.
2. Add or update action inputs for `version`, `task`, `base`, `format`, `output`, `strict`, and
   `fail-on`.
3. Preserve SARIF upload compatibility and report-path output.
4. Update `docs/github-integration.md`, `docs/installation.md`, and README examples to use
   `criticaldeveloper/critical-gate@v2`.
5. Document release tag policy:
   - immutable tags such as `v2.4.0`,
   - moving major tag such as `v2`.
6. Add a smoke workflow or script that proves the public action path runs without local package
   installation or build steps.

Validation:

```bash
pnpm build
pnpm smoke:action
```

Additional validation should run in GitHub Actions against a fixture repository or a minimal
checkout before moving a major tag.

Compatibility boundary:

- Do not require consumer repositories to use pnpm.
- Do not require consumer repositories to install this repo as a secondary checkout.
- Do not remove existing source-mode action support until docs and release artifacts no longer
  depend on it.

## Phase 3: Treat Marketplace As The Primary VS Code Install Path

Status: Done.

Goal: reflect the actual public extension path:

<https://marketplace.visualstudio.com/items?itemName=criticaldeveloper.critical-gate-vscode>

Implementation tasks:

1. Update README and `docs/installation.md` so the main VS Code path is Marketplace installation.
2. Move local VSIX build/install instructions under development or release packaging.
3. Update `docs/vscode-marketplace-release.md` so the current extension version and Marketplace
   identity match `extensions/vscode/package.json`.
4. Confirm the extension still uses the bundled analyzer by default and treats `criticalGate.cliPath`
   as an advanced/custom-build setting.
5. Optionally add a future task for a workspace command that installs `critical-gate` as a
   devDependency when a user explicitly wants a project-local CLI.

Validation:

```bash
pnpm package:vscode
pnpm test:vscode
```

Compatibility boundary:

- Do not make the Marketplace extension require a cloned Critical Gate repository.
- Do not make the extension depend on a globally installed CLI when the bundled analyzer is present.

## Phase 4: Codex Hook And Agent Onboarding Install UX

Status: Done.

Goal: make Codex setup point at the installable CLI instead of a source checkout.

Implementation tasks:

1. Update `critical-gate init-agent` generated instructions if they mention source-based execution.
2. Update `docs/codex-integration.md` examples to prefer:

   ```bash
   npx critical-gate hook --base main
   ```

   or a project-local script:

   ```bash
   npm run critical-gate -- hook --base main
   ```

3. Keep `.codex/hooks.json` in this repository source-oriented only if it is explicitly documented
   as a dogfood hook for this repository.
4. Add tests for generated `AGENTS.md` text if the generated instructions change.

Validation:

```bash
pnpm test -- tests/agent-instructions.test.ts
pnpm build
node dist/cli.js init-agent --help
```

Compatibility boundary:

- Do not make hooks trust or execute remote code silently. Hook docs must remain reviewable and
  explicit.

## Phase 5: Add Release Governance For Installable Channels

Status: Done.

Goal: keep npm, GitHub Action, Marketplace, docs, versions, and SARIF metadata aligned.

Implementation tasks:

1. Update `docs/versioning-policy.md` with an installable-release checklist:
   - root `package.json`,
   - `src/version.ts`,
   - CLI `--version`,
   - SARIF tool metadata,
   - `CHANGELOG.md`,
   - action default CLI version,
   - Marketplace extension version when included,
   - README and installation examples.
2. Extend or add release-version tests to include any new action version defaults.
3. Document the product non-goals checkpoint for installable releases.
4. Decide whether npm and VS Code extension versions stay aligned for every release or only when
   both artifacts change.

Validation:

```bash
pnpm test -- tests/release-version.test.ts
pnpm verify
```

Compatibility boundary:

- Do not treat SARIF top-level `version` as the product version.
- Do not publish from a dirty working tree.

## Phase 6: Refactor `src/cli.ts` By Responsibility

Status: Done. `src/cli.ts` is now a thin compatibility entrypoint with the shebang and public
exports. CLI behavior is split across focused `src/cli/*` modules for command dispatch, command
implementations, argument parsing, help text, IO defaults, result construction, git hook rendering,
entrypoint detection, and shared CLI types.

Goal: make CLI work easier to review without changing behavior.

Proposed target structure:

```text
src/cli/
  main.ts              # command dispatch and top-level error handling
  commands/
    check.ts           # check and hook execution
    snapshot-api.ts
    install-hooks.ts
    init-policy.ts
    init-agent.ts
    accept.ts
    teach.ts
  args/
    check-args.ts
    flag-args.ts
    command-name.ts
  help.ts              # root and command help text
  io.ts                # default filesystem/console/git IO adapter
  result.ts            # createGateResult
  git-hooks.ts         # rendered pre-commit/pre-push hook scripts
  entrypoint.ts        # isCliEntrypoint and path normalization
src/cli.ts             # thin compatibility entrypoint with shebang
```

Implementation tasks:

1. Add characterization tests for current CLI behavior before moving code:
   - `--help`,
   - command help,
   - invalid command,
   - missing `--task`,
   - `--version`,
   - check output writing,
   - hook repair output,
   - `install-hooks` generated scripts,
   - `init-policy`,
   - `init-agent`.
2. Extract pure argument parsing helpers first.
3. Extract help text rendering.
4. Extract git hook script rendering and shell quoting.
5. Extract command implementations one at a time.
6. Extract `createGateResult` only after command movement is stable, because it touches policy,
   monorepo context, API snapshots, framework packs, repository tokens, detector execution, and
   summary metadata.
7. Leave `src/cli.ts` as the only file with the shebang and executable entrypoint.
8. Preserve exported API compatibility for tests or internal imports:
   - `main`,
   - `CLI_VERSION`,
   - `ExitCode`,
   - `isCliEntrypoint`.

Validation after each extraction:

```bash
pnpm test -- tests/cli.test.ts
pnpm typecheck
pnpm build
node dist/cli.js --help
node dist/cli.js --version
```

Compatibility boundary:

- Do not combine behavior changes with file-movement tasks.
- Do not change output wording except in a task that updates snapshots intentionally.
- Do not move detector logic into CLI modules.
- Do not introduce a command framework dependency during the refactor.

## Recommended Execution Order

1. Phase 1: npm CLI primary install path.
2. Phase 5: release governance for installable channels.
3. Phase 2: public GitHub Action path.
4. Phase 3: Marketplace-first docs.
5. Phase 4: Codex hook and agent onboarding install UX.
6. Phase 6.1 through 6.4: low-risk CLI parser/help/hook extraction.
7. Phase 6.5 through 6.8: command and result construction extraction.

This order fixes adoption friction first, then reduces CLI maintainability risk with tests already
protecting the installable behavior.

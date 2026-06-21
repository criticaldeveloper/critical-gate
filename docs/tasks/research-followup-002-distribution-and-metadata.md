# Research Follow-Up 002: Distribution And Metadata

## Status

Done

## Why

The research report's adoption-friction concern is real, though partially documented already.

Evidence:

- `docs/installation.md` documents source-based CLI usage and a composite GitHub Action that installs and builds by default.
- `action.yml` exposes `install` and `build` inputs and runs `pnpm install` / `pnpm build` unless disabled.
- The root `package.json` has no `repository`, `homepage`, or `bugs` metadata, while the VS Code extension manifest does.
- `docs/versioning-policy.md` says package-registry publishing should wait until metadata and external dogfooding are settled.

This is acceptable for dogfooding, but it is not yet a low-friction public install path.

## Tasks

1. Add root package metadata: `repository`, `homepage`, `bugs`, and any missing discoverability keywords. Done.
2. Decide the official CLI distribution path: npm package, GitHub release artifact, prebuilt action bundle, or source-only alpha. Done: source-based installation remains official for the current dogfood release stage.
3. If publishing is chosen, document `pnpm publish` / npm provenance expectations and update installation docs. Not chosen for this release stage.
4. If source-only remains intentional, make that explicit in README and installation docs as a temporary alpha constraint. Done.
5. Add a release checklist item that verifies the action can run with `install: "false"` and `build: "false"` when prebuilt artifacts are present. Done.

## Validation

- `pnpm build`
- `pnpm package:vscode` when extension metadata changes
- Manual check of README and installation examples

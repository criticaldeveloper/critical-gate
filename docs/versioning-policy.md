# Versioning Policy

Critical Gate currently publishes numeric dogfood releases for the root CLI and VS Code extension.
These releases use SemVer-style numbers for artifact ordering, but they are still pre-stable:
finding behavior, CLI options, output fields, and extension settings may change until the project
declares a stable public contract.

## Current Release Stage

The current target is `2.2.0`.

This means:

- Suitable for internal alpha use, dogfooding, and explicitly scoped public trials.
- Not a stable public API promise.
- Finding behavior, CLI options, output fields, and extension settings may still change.
- Release artifacts should be produced and tested, but Marketplace or package-registry publishing
  should wait until repository metadata and external dogfooding are settled.

## Versioned Artifacts

Keep these versions aligned for a release:

- Root CLI package version in `package.json`.
- VS Code extension version in `extensions/vscode/package.json`.
- Runtime version constant in `src/version.ts`, which backs `critical-gate --version`, JSON
  metadata, and SARIF tool metadata.
- Project changelog entry in `CHANGELOG.md`.
- VS Code extension changelog entry in `extensions/vscode/CHANGELOG.md`.
- Public output schema version only when the `GateResult` JSON contract changes.

The public schema version is not the same thing as the package version. Patch releases can change
implementation details without changing `schemaVersion`.

## SemVer-Style Rules

While the project is pre-stable:

- Patch: bug fixes, docs, test improvements, packaging fixes, and detector false-positive tuning
  that does not intentionally change public contracts.
- Minor: new detectors, new report fields, new CLI flags, new integration surfaces, or intentional
  changes to gate decisions.
- Major: broad compatibility resets across CLI behavior, output contracts, detector defaults, or
  integration packaging.

After a stable public contract is declared:

- Patch: backward-compatible fixes and precision improvements.
- Minor: backward-compatible features, detectors, reporters, or extension capabilities.
- Major: breaking CLI behavior, breaking JSON/SARIF output changes, changed exit-code semantics,
  removed configuration keys, or incompatible package/runtime requirements.

## Pre-Release Labels

Use pre-release labels until the project is public-release ready:

- `alpha`: internal dogfooding, fast iteration, rough edges expected.
- `beta`: public trial, installation docs complete, known noisy checks documented.
- `rc`: release candidate, only fixes and documentation changes expected before final.

Examples:

- `2.0.0`
- `0.1.0-beta.0`
- `0.1.0-rc.0`
- `0.1.0`

## Release Checklist

Before cutting any release:

1. Update `package.json`.
2. Update `extensions/vscode/package.json` when the extension is included.
3. Update `CHANGELOG.md`.
4. Update `extensions/vscode/CHANGELOG.md` when the extension is included.
5. Run `pnpm verify`.
6. Run `pnpm audit`.
7. Run `pnpm test:vscode` when the editor extension is included.
8. Run `pnpm package:vscode` when publishing or attaching a VSIX artifact.
9. If publishing a prebuilt GitHub Action artifact, verify it runs with `install: "false"` and
   `build: "false"`.
10. Run Critical Gate against the release diff with release notes as task context.
11. Tag the release after all checks pass.

## Tagging

Use `vX.Y.Z` for final releases and `vX.Y.Z-label.N` for pre-releases.

Examples:

- `v2.0.0`
- `v0.1.0`

Do not tag directly from a dirty working tree.

## Stable Release Gate

Before declaring a stable public release, complete:

- Confirm package, repository, issue, homepage, and release artifact metadata are public-ready.
- Run all GitHub workflows remotely.
- Dogfood on at least one separate repository and document noisy findings.
- Decide whether VS Code distribution remains artifact-only or moves to Marketplace publishing.

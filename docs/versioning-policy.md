# Versioning Policy

Critical Gate uses SemVer for release artifacts once a public `1.0.0` contract exists. Before
`1.0.0`, minor versions may change public behavior, but every release must still document breaking
changes clearly.

## Current Release Stage

The current target is `2.1.1`.

This means:

- Suitable for internal alpha use and dogfooding.
- Not a stable public API promise.
- Finding behavior, CLI options, output fields, and extension settings may still change.
- Release artifacts should be produced and tested, but Marketplace or package-registry publishing
  should wait until repository metadata and external dogfooding are settled.

## Versioned Artifacts

Keep these versions aligned for a release:

- Root CLI package version in `package.json`.
- VS Code extension version in `extensions/vscode/package.json`.
- Project changelog entry in `CHANGELOG.md`.
- VS Code extension changelog entry in `extensions/vscode/CHANGELOG.md`.
- Public output schema version only when the `GateResult` JSON contract changes.

The public schema version is not the same thing as the package version. Patch releases can change
implementation details without changing `schemaVersion`.

## SemVer Rules

Before `1.0.0`:

- Patch: bug fixes, docs, test improvements, packaging fixes, and detector false-positive tuning
  that does not intentionally change public contracts.
- Minor: new detectors, new report fields, new CLI flags, new integration surfaces, or intentional
  changes to gate decisions.
- Major: reserved for the eventual stable `1.0.0` contract.

After `1.0.0`:

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
9. Run Critical Gate against the release diff with release notes as task context.
10. Tag the release after all checks pass.

## Tagging

Use `vX.Y.Z` for final releases and `vX.Y.Z-label.N` for pre-releases.

Examples:

- `v2.0.0`
- `v0.1.0`

Do not tag directly from a dirty working tree.

## Public Release Gate

Before a public `0.1.0` release, complete:

- Add real repository, issue, and homepage metadata.
- Run all GitHub workflows remotely.
- Dogfood on at least one separate repository and document noisy findings.
- Decide whether VS Code distribution remains artifact-only or moves to Marketplace publishing.

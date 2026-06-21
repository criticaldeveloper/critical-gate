# Research Follow-Up 001: Release Governance

## Status

Done

## Why

The research report's versioning concern is real in the local tree.

Evidence:

- `package.json` declares `2.2.0`.
- `extensions/vscode/package.json` declares `2.2.0`.
- `src/cli.ts` exported `CLI_VERSION = "2.1.1"`.
- `docs/versioning-policy.md` said the project was before a public `1.0.0` contract while also naming `2.2.0` as the current target.
- `docs/installation.md` said the root CLI remained on the alpha release line while the package version was numeric `2.2.0`.
- SARIF did not include package-level tool version metadata.

This weakens trust because `--version`, SARIF metadata, package metadata, and release policy can disagree.

## Tasks

1. Pick and document the actual release stage for the root CLI: alpha prerelease, public numeric release, or internal-only build. Done: numeric dogfood release, pre-stable public contract.
2. Align `package.json`, `extensions/vscode/package.json`, `src/cli.ts`, SARIF tool metadata, changelog entries, and release docs. Done for code and docs that had drift; changelog already had `2.2.0`.
3. Update `docs/versioning-policy.md` so examples and rules match the selected release stage. Done.
4. Update `docs/installation.md` to remove contradictory alpha/numeric wording. Done.
5. Add a small test or script check that fails when package version, CLI version, and reported tool metadata drift. Done in `tests/release-version.test.ts`.

## Validation

- `pnpm typecheck`
- `pnpm test`
- `node dist/cli.js --version` after `pnpm build`

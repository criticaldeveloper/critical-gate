# VS Code Marketplace Release

Critical Gate publishes under the `criticaldeveloper` publisher.

User-facing installation should point to the Marketplace listing, not local VSIX artifacts:

<https://marketplace.visualstudio.com/items?itemName=criticaldeveloper.critical-gate-vscode>

The Marketplace extension bundles the analyzer by default. Users only need `criticalGate.cliPath`
when they are testing a custom local CLI build.

## Package

```bash
pnpm package:vscode
```

The VSIX is written to:

```text
artifacts/vscode/critical-gate-vscode.vsix
```

The VS Code extension is packaged as a Marketplace release. Local VSIX installation is a
development and release-verification path, not the primary user installation path.

Visual Studio Marketplace requires the extension manifest version to be numeric. The VS Code
extension is versioned independently from the root CLI package when needed so Marketplace releases
can use numeric versions while the CLI follows the project release policy.

## Publish

Set a Marketplace token with publish rights for `criticaldeveloper`:

```bash
$env:VSCE_PAT = "<token>"
pnpm publish:vscode
```

The script packages the extension first, then publishes the generated VSIX.

## Marketplace Metadata

The extension manifest lives in `extensions/vscode/package.json`.

Current public identity:

- Publisher: `criticaldeveloper`
- Extension name: `critical-gate-vscode`
- Extension version: `2.9.1`
- Display name: `Critical-Gate`
- Extension ID: `criticaldeveloper.critical-gate-vscode`
- Icon: `extensions/vscode/resources/icon.png`
- Marketplace URL:
  <https://marketplace.visualstudio.com/items?itemName=criticaldeveloper.critical-gate-vscode>

Keep README, `docs/installation.md`, `docs/usage-guide.md`, and `docs/editor-surface.md` pointed at
the Marketplace URL when changing extension identity or release flow.

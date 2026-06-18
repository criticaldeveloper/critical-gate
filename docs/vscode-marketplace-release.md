# VS Code Marketplace Release

Critical Gate publishes under the `criticaldeveloper` publisher.

## Package

```bash
pnpm package:vscode
```

The VSIX is written to:

```text
artifacts/vscode/critical-gate-vscode.vsix
```

The current alpha package is marked as a VS Code pre-release with `vsce --pre-release`.

Visual Studio Marketplace requires the extension manifest version to be numeric, so the VS Code
extension uses `0.1.0` even while the root CLI remains `0.1.0-alpha.0`.

## Publish

Set a Marketplace token with publish rights for `criticaldeveloper`:

```bash
$env:VSCE_PAT = "<token>"
pnpm publish:vscode
```

The script packages the extension first, then publishes the generated VSIX with `vsce --pre-release`.

## Marketplace Metadata

The extension manifest lives in `extensions/vscode/package.json`.

Current public identity:

- Publisher: `criticaldeveloper`
- Extension name: `critical-gate`
- Extension version: `0.1.0`
- Display name: `Critical Gate`
- Extension ID: `criticaldeveloper.critical-gate`
- Icon: `extensions/vscode/resources/icon.png`

Before the first public publish, confirm the extension ID because Marketplace extension names are
effectively permanent once users install them.

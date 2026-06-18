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

The current alpha package is marked as a VS Code pre-release.

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
- Display name: `Critical Gate`
- Extension ID: `criticaldeveloper.critical-gate`
- Icon: `extensions/vscode/resources/icon.png`

Before the first public publish, confirm the extension ID because Marketplace extension names are
effectively permanent once users install them.

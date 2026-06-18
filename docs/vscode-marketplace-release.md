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

The VS Code extension is packaged as a stable Marketplace release.

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
- Extension version: `1.1.0`
- Display name: `Critical-Gate`
- Extension ID: `criticaldeveloper.critical-gate-vscode`
- Icon: `extensions/vscode/resources/icon.png`

Before the first public publish, confirm the extension ID because Marketplace extension names are
effectively permanent once users install them.

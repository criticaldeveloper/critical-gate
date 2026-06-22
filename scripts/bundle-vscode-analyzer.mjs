import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "dist");
const target = join(root, "extensions", "vscode", "analyzer", "dist");

rmSync(dirname(target), { recursive: true, force: true });
mkdirSync(target, { recursive: true });

await build({
  entryPoints: [join(source, "cli.js")],
  outfile: join(target, "cli.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: false,
  legalComments: "none",
  logLevel: "silent"
});

writeFileSync(
  join(root, "extensions", "vscode", "analyzer", "package.json"),
  `${JSON.stringify({ type: "module" }, null, 2)}\n`,
  "utf8"
);

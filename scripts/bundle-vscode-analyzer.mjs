import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "dist");
const target = join(root, "extensions", "vscode", "analyzer", "dist");

rmSync(dirname(target), { recursive: true, force: true });
copyJavaScriptTree(source, target);
writeFileSync(
  join(root, "extensions", "vscode", "analyzer", "package.json"),
  `${JSON.stringify({ type: "module" }, null, 2)}\n`,
  "utf8"
);

function copyJavaScriptTree(from, to) {
  mkdirSync(to, { recursive: true });

  for (const entry of readdirSync(from)) {
    const sourcePath = join(from, entry);
    const targetPath = join(to, entry);
    const stat = statSync(sourcePath);

    if (stat.isDirectory()) {
      copyJavaScriptTree(sourcePath, targetPath);
      continue;
    }

    if (extname(sourcePath) !== ".js") {
      continue;
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }
}

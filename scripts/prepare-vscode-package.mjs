import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

rmSync(join(root, "extensions", "vscode", "dist"), { recursive: true, force: true });
mkdirSync(join(root, "artifacts", "vscode"), { recursive: true });

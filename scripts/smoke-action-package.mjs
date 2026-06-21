import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import console from "node:console";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const artifact = join(root, "artifacts", "action");
const requiredFiles = [
  "action.yml",
  "package.json",
  "dist/cli.js",
  "dist/index.js",
  "ACTION_ARTIFACT.md"
];

for (const file of requiredFiles) {
  const path = join(artifact, file);

  if (!existsSync(path)) {
    throw new Error(`Missing action artifact file: ${file}`);
  }
}

if (existsSync(join(artifact, "node_modules"))) {
  throw new Error("Prebuilt action artifact must not include node_modules.");
}

const action = readFileSync(join(artifact, "action.yml"), "utf8");

for (const expected of [
  'if [ "${{ inputs.install }}" = "true" ]; then',
  'if [ "${{ inputs.build }}" = "true" ] || [ ! -f "$GITHUB_ACTION_PATH/dist/cli.js" ]; then',
  'node "$GITHUB_ACTION_PATH/dist/cli.js" "${args[@]}"'
]) {
  if (!action.includes(expected)) {
    throw new Error(`Action artifact is missing expected runtime path: ${expected}`);
  }
}

const output = execFileSync(process.execPath, [join(artifact, "dist", "cli.js"), "--version"], {
  encoding: "utf8"
}).trim();

if (!output.startsWith("critical-gate ")) {
  throw new Error(`Unexpected prebuilt action CLI output: ${output}`);
}

console.log(`Prebuilt action artifact smoke passed: ${output}`);

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import console from "node:console";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const packageJsonPath = join(root, "package.json");
const versionPath = join(root, "src", "version.ts");
const distVersionPath = join(root, "dist", "version.js");
const cliPath = join(root, "dist", "cli.js");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

assert(packageJson.name === "critical-gate", "package name must be critical-gate.");
assert(
  packageJson.bin?.["critical-gate"] === "./dist/cli.js",
  "package bin must expose dist/cli.js."
);
assert(
  JSON.stringify(packageJson.files) === JSON.stringify(["dist", "README.md", "LICENSE"]),
  'package files must be ["dist", "README.md", "LICENSE"].'
);

for (const requiredFile of ["README.md", "LICENSE", "dist/cli.js"]) {
  assert(
    existsSync(join(root, requiredFile)),
    `${requiredFile} is missing from the package input.`
  );
}

const cliSource = readFileSync(cliPath, "utf8");
assert(cliSource.startsWith("#!/usr/bin/env node"), "dist/cli.js must start with a Node shebang.");

const versionSource = readFileSync(versionPath, "utf8");
const versionMatch = versionSource.match(/CRITICAL_GATE_VERSION\s*=\s*"([^"]+)"/);
assert(
  versionMatch?.[1] === packageJson.version,
  "src/version.ts must match package.json version."
);

const distVersionSource = readFileSync(distVersionPath, "utf8");
const distVersionMatch = distVersionSource.match(/CRITICAL_GATE_VERSION\s*=\s*"([^"]+)"/);
assert(
  distVersionMatch?.[1] === packageJson.version,
  "dist/version.js must match package.json version."
);

const cliVersion = execFileSync(process.execPath, [cliPath, "--version"], {
  encoding: "utf8"
}).trim();
assert(
  cliVersion === `critical-gate ${packageJson.version}`,
  `CLI version output did not match package version: ${cliVersion}`
);

const packOutput =
  process.platform === "win32"
    ? execFileSync(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/s", "/c", "npm pack --dry-run --json --ignore-scripts"],
        {
          cwd: root,
          encoding: "utf8"
        }
      )
    : execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
        cwd: root,
        encoding: "utf8"
      });
const packEntries = JSON.parse(packOutput);
const files = packEntries.flatMap((entry) => entry.files?.map((file) => file.path) ?? []);

for (const requiredPath of ["package.json", "README.md", "LICENSE", "dist/cli.js"]) {
  assert(files.includes(requiredPath), `npm package is missing ${requiredPath}.`);
}

for (const file of files) {
  assert(isAllowedPackagePath(file), `npm package includes unexpected file: ${file}`);
}

console.log(
  `npm package validation passed for critical-gate ${packageJson.version} (${files.length} files).`
);

function isAllowedPackagePath(file) {
  const normalized = file.split("\\").join("/");

  return (
    normalized === "package.json" ||
    normalized === "README.md" ||
    normalized === "LICENSE" ||
    normalized.startsWith("dist/")
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

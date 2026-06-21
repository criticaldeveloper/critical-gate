import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import console from "node:console";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = join(root, "artifacts", "action");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

if (!existsSync(join(root, "dist", "cli.js"))) {
  throw new Error("dist/cli.js is missing. Run pnpm build before packaging the action.");
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

cpSync(join(root, "action.yml"), join(output, "action.yml"));
cpSync(join(root, "dist"), join(output, "dist"), { recursive: true });

for (const optionalFile of ["README.md", "LICENSE"]) {
  const source = join(root, optionalFile);

  if (existsSync(source)) {
    cpSync(source, join(output, optionalFile));
  }
}

writeFileSync(
  join(output, "package.json"),
  `${JSON.stringify(
    {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      type: packageJson.type,
      packageManager: packageJson.packageManager,
      repository: packageJson.repository,
      homepage: packageJson.homepage,
      bugs: packageJson.bugs,
      bin: packageJson.bin,
      files: ["dist", "action.yml", "README.md", "LICENSE"],
      keywords: packageJson.keywords,
      license: packageJson.license,
      engines: packageJson.engines
    },
    null,
    2
  )}\n`
);

writeFileSync(
  join(output, "ACTION_ARTIFACT.md"),
  [
    "# Critical Gate Prebuilt Action Artifact",
    "",
    "This artifact is intended for GitHub Action usage with:",
    "",
    "```yaml",
    'install: "false"',
    'build: "false"',
    "```",
    "",
    "It includes the composite `action.yml`, package metadata, and prebuilt `dist/` output. It does",
    "not include `node_modules` and should not be used as a source-mode checkout."
  ].join("\n") + "\n"
);

console.log(`Prepared prebuilt action artifact at ${output}`);

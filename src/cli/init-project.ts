import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";

import {
  CRITICAL_GATE_CONFIG_FILE,
  type CriticalGateConfig,
  type DetectorPolicyOverride
} from "../config/index.js";
import { CRITICAL_GATE_VERSION } from "../version.js";
import type { CliIo } from "./types.js";

export type InitPackageManagerName = "bun" | "pnpm" | "npm" | "yarn";

export interface InitProjectOptions {
  install: boolean;
  packageManager?: InitPackageManagerName;
  version?: string;
  skipAgent: boolean;
  skipWorkflow: boolean;
  force: boolean;
}

export interface InitProjectResult {
  root: string;
  packageManager: InitPackageManager;
  installed: boolean;
  written: string[];
  skipped: string[];
}

interface InitPackageManager {
  name: InitPackageManagerName;
  command: string;
  addDev: string[];
  run: string;
}

const detectorIds = [
  "dependency",
  "test-weakening",
  "config-change",
  "secret-path",
  "api-surface",
  "intent-verification",
  "blast-radius",
  "scope",
  "rewrite",
  "repository-intelligence",
  "expected-companions",
  "utility-reinvention",
  "existing-solution",
  "pattern-violation"
];

export function initProject(options: InitProjectOptions, io: CliIo): InitProjectResult {
  const root = io.getRoot?.() ?? io.readDiff().root;
  const packageJsonPath = join(root, "package.json");
  const packageManager =
    options.packageManager === undefined
      ? detectPackageManager(root, io)
      : packageManagerByName(options.packageManager);
  const written: string[] = [];
  const skipped: string[] = [];
  const now = io.now();

  if (!exists(packageJsonPath, io)) {
    writeJson(
      packageJsonPath,
      {
        name: slugify(basename(root)) || "critical-gate-project",
        version: "0.1.0",
        private: true,
        scripts: {}
      },
      io
    );
    written.push("package.json");
  }

  if (options.install) {
    installCriticalGate(packageManager, options.version ?? CRITICAL_GATE_VERSION, root);
  }

  const packageJson = readPackageJson(packageJsonPath, root, io);
  writeJson(packageJsonPath, withPackageScripts(packageJson), io);
  written.push("package.json");

  writeFileIfAllowed(
    join(root, CRITICAL_GATE_CONFIG_FILE),
    `${JSON.stringify(createObserveOnlyPolicy(packageJson, now), null, 2)}\n`,
    options.force,
    io,
    written,
    skipped
  );
  writeFileIfAllowed(
    join(root, "scripts", "critical-gate-evidence.mjs"),
    evidenceExporterSource,
    options.force,
    io,
    written,
    skipped
  );
  writeFileIfAllowed(
    join(root, "docs", "critical-gate-dogfood.md"),
    dogfoodJournalSource(packageManager),
    options.force,
    io,
    written,
    skipped
  );
  writeFileIfAllowed(
    join(root, "docs", "critical-gate-evidence", "README.md"),
    evidenceIndexSource,
    options.force,
    io,
    written,
    skipped
  );

  if (!options.skipWorkflow) {
    writeFileIfAllowed(
      join(root, ".github", "workflows", "critical-gate.yml"),
      githubWorkflowSource(options.version ?? CRITICAL_GATE_VERSION),
      options.force,
      io,
      written,
      skipped
    );
  }

  updateGitignore(root, io, written);

  return {
    root,
    packageManager,
    installed: options.install,
    written: [...new Set(written.map((path) => relativeProjectPath(root, path)))],
    skipped: [...new Set(skipped.map((path) => relativeProjectPath(root, path)))]
  };
}

export function detectPackageManager(root: string, io: Pick<CliIo, "exists">): InitPackageManager {
  if (exists(join(root, "bun.lock"), io) || exists(join(root, "bun.lockb"), io)) {
    return packageManagerByName("bun");
  }

  if (exists(join(root, "pnpm-lock.yaml"), io)) {
    return packageManagerByName("pnpm");
  }

  if (exists(join(root, "yarn.lock"), io)) {
    return packageManagerByName("yarn");
  }

  return packageManagerByName("npm");
}

export function packageManagerByName(name: string): InitPackageManager {
  if (name === "bun") {
    return { name, command: "bun", addDev: ["add", "-d"], run: "bun run" };
  }

  if (name === "pnpm") {
    return { name, command: "pnpm", addDev: ["add", "-D"], run: "pnpm run" };
  }

  if (name === "npm") {
    return { name, command: "npm", addDev: ["install", "-D"], run: "npm run" };
  }

  if (name === "yarn") {
    return { name, command: "yarn", addDev: ["add", "-D"], run: "yarn" };
  }

  throw new Error(`Unsupported package manager: ${name}`);
}

function installCriticalGate(packageManager: InitPackageManager, version: string, root: string) {
  const packageName = version === "latest" ? "critical-gate" : `critical-gate@${version}`;
  execFileSync(packageManager.command, [...getAddDevArgs(packageManager, root), packageName], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
}

function getAddDevArgs(packageManager: InitPackageManager, root: string): string[] {
  if (packageManager.name === "pnpm" && existsSync(join(root, "pnpm-workspace.yaml"))) {
    return [...packageManager.addDev, "-w"];
  }

  return packageManager.addDev;
}

function withPackageScripts(packageJson: Record<string, unknown>): Record<string, unknown> {
  return {
    ...packageJson,
    scripts: {
      ...readRecord(packageJson.scripts),
      gate: "critical-gate check --format markdown --fail-on blocker",
      "gate:base": "critical-gate check --base main --format markdown --fail-on blocker",
      "gate:sarif":
        "critical-gate check --format sarif --output critical-gate.sarif --fail-on blocker",
      "gate:evidence": "node scripts/critical-gate-evidence.mjs"
    }
  };
}

function createObserveOnlyPolicy(
  packageJson: Record<string, unknown>,
  now: Date
): CriticalGateConfig {
  return {
    frameworkPacks: detectFrameworkPacks(packageJson),
    policy: {
      failOn: "blocker",
      detectorOverrides: detectorIds.map(
        (detector): DetectorPolicyOverride => ({
          detector,
          mode: "observation",
          reason:
            "Phase 1 dogfood rollout: collect evidence and calibrate findings before enforcement."
        })
      ),
      allowedSupportFiles: [
        {
          id: "critical-gate-dogfood-docs",
          whenChanged: CRITICAL_GATE_CONFIG_FILE,
          allow: [
            "docs/critical-gate-dogfood.md",
            "docs/critical-gate-evidence/**",
            "AGENTS.md",
            "package.json",
            "package-lock.json",
            "npm-shrinkwrap.json",
            "pnpm-lock.yaml",
            "yarn.lock",
            "bun.lock",
            "bun.lockb"
          ],
          reason:
            "Critical Gate rollout changes include package wiring, agent workflow notes, and dogfood evidence.",
          createdAt: now.toISOString()
        },
        {
          id: "workflow-operational-docs",
          whenChanged: ".github/workflows/**",
          allow: ["docs/**/*.md", "README.md", "AGENTS.md"],
          reason: "Workflow changes may include operational documentation.",
          createdAt: now.toISOString()
        }
      ]
    },
    learning: {
      acceptedFindings: [],
      expectedSupportFiles: []
    }
  };
}

function detectFrameworkPacks(packageJson: Record<string, unknown>): string[] {
  const dependencies = {
    ...readRecord(packageJson.dependencies),
    ...readRecord(packageJson.devDependencies),
    ...readRecord(packageJson.peerDependencies)
  };

  return ["astro", "vite", "next", "react", "vue", "svelte"].filter(
    (name) => dependencies[name] !== undefined
  );
}

function updateGitignore(root: string, io: CliIo, written: string[]) {
  const path = join(root, ".gitignore");
  const additions = [
    ".critical-gate/cache/",
    "critical-gate.json",
    "critical-gate.md",
    "critical-gate.sarif",
    "critical-gate-pr-comment.md"
  ];
  const existing = exists(path, io) ? readFile(path, io) : "";
  const lines = existing.split(/\r?\n/u);
  const missing = additions.filter((line) => !lines.includes(line));

  if (missing.length === 0) {
    return;
  }

  io.writeFile(path, `${existing.trimEnd()}\n${missing.join("\n")}\n`);
  written.push(path);
}

function writeFileIfAllowed(
  path: string,
  content: string,
  force: boolean,
  io: CliIo,
  written: string[],
  skipped: string[]
) {
  if (exists(path, io) && !force) {
    skipped.push(path);
    return;
  }

  io.writeFile(path, content);
  written.push(path);
}

function readPackageJson(path: string, root: string, io: CliIo): Record<string, unknown> {
  if (exists(path, io)) {
    return JSON.parse(readFile(path, io)) as Record<string, unknown>;
  }

  return {
    name: slugify(basename(root)) || "critical-gate-project",
    version: "0.1.0",
    private: true,
    scripts: {}
  };
}

function writeJson(path: string, value: unknown, io: CliIo) {
  io.writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function exists(path: string, io: Pick<CliIo, "exists">): boolean {
  return io.exists?.(path) === true;
}

function readFile(path: string, io: Pick<CliIo, "readFile">): string {
  if (io.readFile === undefined) {
    throw new Error(`Cannot read ${path}.`);
  }

  return io.readFile(path);
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function relativeProjectPath(root: string, path: string): string {
  const normalizedRoot = root.replaceAll("\\", "/");
  const normalizedPath = path.replaceAll("\\", "/");

  return normalizedPath.startsWith(normalizedRoot)
    ? normalizedPath.slice(normalizedRoot.length + 1)
    : normalizedPath;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

const evidenceExporterSource = `#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));

if (args.task === undefined || args.task.trim().length === 0) {
  console.error('Usage: npm run gate:evidence -- --task "Describe the completed task"');
  process.exit(2);
}

if (!hasMeaningfulDiff()) {
  console.log("Critical Gate evidence skipped: no working-tree diff to analyze.");
  process.exit(0);
}

const now = new Date();
const day = now.toISOString().slice(0, 10);
const time = now.toISOString().slice(11, 19).replaceAll(":", "");
const slug = slugify(args.task);
const evidenceRoot = join(root, "docs", "critical-gate-evidence");
const runDir = join(evidenceRoot, day);
const basename = \`\${time}-\${slug}\`;
const markdownPath = join(runDir, \`\${basename}.md\`);
const jsonPath = join(runDir, \`\${basename}.json\`);
const tempDir = join(root, ".critical-gate", "cache", "evidence");
const tempMarkdownPath = join(tempDir, \`\${basename}.md\`);
const tempJsonPath = join(tempDir, \`\${basename}.json\`);
const indexPath = join(evidenceRoot, "README.md");

mkdirSync(runDir, { recursive: true });
mkdirSync(tempDir, { recursive: true });

const commonArgs = ["check", "--task", args.task, "--fail-on", "blocker"];

if (args.base !== undefined) {
  commonArgs.push("--base", args.base);
}

if (args.staged) {
  commonArgs.push("--staged");
}

const markdown = runCriticalGate([
  ...commonArgs,
  "--format",
  "markdown",
  "--output",
  tempMarkdownPath
]);
const json = runCriticalGate([...commonArgs, "--format", "json", "--output", tempJsonPath]);

copyFileSync(tempMarkdownPath, markdownPath);
copyFileSync(tempJsonPath, jsonPath);

const report = readJsonReport(jsonPath);

updateIndex(indexPath, {
  day,
  task: args.task,
  markdownFile: relativeForMarkdown(evidenceRoot, markdownPath),
  jsonFile: relativeForMarkdown(evidenceRoot, jsonPath),
  decision: report?.summary?.decision ?? "unknown",
  findings: report?.summary?.findingCount ?? "unknown",
  coherence: formatScore(report?.summary?.diffCoherenceScore),
  scope: formatScore(report?.summary?.scopeExpansionScore)
});

console.log("Critical Gate evidence exported:");
console.log(\`- Markdown: \${markdownPath}\`);
console.log(\`- JSON: \${jsonPath}\`);

process.exit(Math.max(markdown.status ?? 0, json.status ?? 0));

function parseArgs(argv) {
  const parsed = {
    staged: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--staged") {
      parsed.staged = true;
      continue;
    }

    if (arg !== "--task" && arg !== "--base") {
      console.error(\`Unknown option: \${arg}\`);
      process.exit(2);
    }

    const value = argv[index + 1];

    if (value === undefined || value.startsWith("--")) {
      console.error(\`Missing value for \${arg}.\`);
      process.exit(2);
    }

    if (arg === "--task") {
      parsed.task = value;
    } else {
      parsed.base = value;
    }

    index += 1;
  }

  return parsed;
}

function runCriticalGate(commandArgs) {
  const result = spawnSync("critical-gate", commandArgs, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.error !== undefined) {
    console.error(result.error.message);
    process.exit(3);
  }

  if (result.stdout.length > 0) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr.length > 0) {
    process.stderr.write(result.stderr);
  }

  return result;
}

function hasMeaningfulDiff() {
  const tracked = spawnSync("git", ["diff", "--quiet", "HEAD", "--"], {
    cwd: root,
    stdio: "ignore"
  });

  if (tracked.status !== 0) {
    return true;
  }

  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });

  return untracked.stdout.trim().length > 0;
}

function readJsonReport(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function updateIndex(path, entry) {
  const header = [
    "# Critical Gate Evidence",
    "",
    "Timestamped reports from observe-only dogfooding runs.",
    "",
    "| Date | Decision | Findings | Coherence | Scope | Task | Reports |",
    "| --- | --- | ---: | ---: | ---: | --- | --- |"
  ].join("\\n");
  const existing = existsSync(path) ? readFileSync(path, "utf8") : \`\${header}\\n\`;
  const line = [
    \`| \${entry.day}\`,
    entry.decision,
    entry.findings,
    entry.coherence,
    entry.scope,
    escapeCell(entry.task),
    \`[md](\${entry.markdownFile}) / [json](\${entry.jsonFile}) |\`
  ].join(" | ");

  if (existing.includes(line)) {
    return;
  }

  writeFileSync(path, \`\${existing.trimEnd()}\\n\${line}\\n\`);
}

function relativeForMarkdown(fromDir, filePath) {
  return filePath.slice(fromDir.length + 1).replaceAll("\\\\", "/");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function escapeCell(value) {
  return value.replaceAll("|", "\\\\|").replace(/\\s+/g, " ").trim();
}

function formatScore(score) {
  if (score === undefined || score === null) {
    return "unknown";
  }

  if (typeof score === "number" || typeof score === "string") {
    return score;
  }

  if (typeof score.value === "number" || typeof score.value === "string") {
    return score.value;
  }

  if (typeof score.score === "number" || typeof score.score === "string") {
    return score.score;
  }

  return "unknown";
}
`;

function dogfoodJournalSource(packageManager: InitPackageManager): string {
  return `# Critical Gate Dogfood Journal

Critical Gate is adopted in observe-only mode for this repository.

The goal is to collect evidence from real AI-agent tasks before enabling local hooks or hard CI
blocking. After each agent task with a meaningful diff, export durable evidence:

\`\`\`bash
${packageManager.run} gate:evidence -- --task "Describe the completed task"
\`\`\`

This writes timestamped Markdown and JSON reports under \`docs/critical-gate-evidence/\`.

## Metrics

| Metric | Count |
| --- | ---: |
| Tasks analyzed | 0 |
| Useful findings | 0 |
| False positives | 0 |
| Missed findings | 0 |
| Exported evidence reports | 0 |

## Log Template

\`\`\`md
## YYYY-MM-DD

Task:

Finding:

Result:

Status:
Useful / False positive / Missed / Clean

Follow-up:
\`\`\`
`;
}

const evidenceIndexSource = `# Critical Gate Evidence

Timestamped reports from observe-only dogfooding runs.

| Date | Decision | Findings | Coherence | Scope | Task | Reports |
| --- | --- | ---: | ---: | ---: | --- | --- |
`;

function githubWorkflowSource(version: string): string {
  const actionVersion = version === "latest" ? "latest" : version.replace(/^[~^]/u, "");

  return `name: Critical Gate

on:
  pull_request:

permissions:
  actions: read
  contents: read
  pull-requests: read
  security-events: write

jobs:
  critical-gate:
    name: Advisory diff integrity
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: Run Critical Gate
        id: critical-gate
        uses: criticaldeveloper/critical-gate@v2
        continue-on-error: true
        with:
          version: "${actionVersion}"
          task: \${{ github.event.pull_request.title }}
          base: \${{ github.event.pull_request.base.sha }}
          format: sarif
          output: critical-gate.sarif

      - name: Upload Critical Gate SARIF
        if: always() && hashFiles('critical-gate.sarif') != ''
        uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: critical-gate.sarif
`;
}

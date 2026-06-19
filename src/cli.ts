#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CRITICAL_GATE_CONFIG_FILE,
  GATE_RESULT_SCHEMA_VERSION,
  applyLearningPolicy,
  analyzeTaskIntentQuality,
  buildApiSurfaceSnapshot,
  detectFrameworkPacks,
  detectMonorepoContext,
  getApiSnapshotOutputDirectory,
  getApiSnapshotOutputPath,
  loadApiSurfaceSnapshot,
  loadCriticalGateConfig,
  readGitDiff,
  renderReport,
  runDetectors,
  summarizeApiSurfaceSnapshot,
  summarizeFindings,
  summarizeIntentVerification,
  updateCriticalGateConfig,
  type GateResult,
  type GitDiffResult,
  type ReportFormat
} from "./index.js";

export const CLI_VERSION = "2.1.0";

export const ExitCode = {
  Pass: 0,
  FindingsFailed: 1,
  UsageError: 2,
  InternalError: 3
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

interface CheckOptions {
  task: string;
  base?: string;
  format: ReportFormat;
  strict: boolean;
  staged: boolean;
  failOn?: "blocker" | "high" | "medium";
  output?: string;
}

interface CliIo {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
  writeFile: (path: string, content: string) => void;
  chmodFile?: (path: string, mode: number) => void;
  now: () => Date;
  readDiff: (baseRef?: string, options?: { staged?: boolean }) => GitDiffResult;
  exists?: (path: string) => boolean;
  readFile?: (path: string) => string;
}

type CommandName = "check" | "hook" | "accept" | "teach" | "snapshot-api" | "install-hooks";

const defaultIo: CliIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
  writeFile: (path, content) => {
    mkdirSync(getApiSnapshotOutputDirectory(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  },
  now: () => new Date(),
  exists: (path) => existsSync(path),
  readFile: (path) => readFileSync(path, "utf8"),
  chmodFile: (path, mode) => chmodSync(path, mode),
  readDiff: (baseRef, options) => readGitDiff({ baseRef, staged: options?.staged })
};

export function main(argv = process.argv.slice(2), io = defaultIo): ExitCode {
  try {
    return runCli(argv, io);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown internal error";
    io.stderr(`critical-gate: ${message}`);
    return ExitCode.InternalError;
  }
}

function runCli(argv: string[], io: CliIo): ExitCode {
  if (argv.includes("--version")) {
    io.stdout(`critical-gate ${CLI_VERSION}`);
    return ExitCode.Pass;
  }

  if (argv[0] === "--help" || argv[0] === "-h") {
    io.stdout(getHelpText());
    return ExitCode.Pass;
  }

  const [command = "check", ...args] = argv;

  if (!isCommandName(command)) {
    io.stderr(`Unknown command: ${command}`);
    io.stderr("Run critical-gate --help for usage.");
    return ExitCode.UsageError;
  }

  if (args.includes("--help") || args.includes("-h")) {
    io.stdout(getCommandHelpText(command));
    return ExitCode.Pass;
  }

  if (command === "accept") {
    return runAcceptCommand(args, io);
  }

  if (command === "teach") {
    return runTeachCommand(args, io);
  }

  if (command === "snapshot-api") {
    return runSnapshotApiCommand(args, io);
  }

  if (command === "install-hooks") {
    return runInstallHooksCommand(args, io);
  }

  const parsed = parseCheckArgs(args, command);

  if (!parsed.ok) {
    io.stderr(parsed.error);
    io.stderr("Run critical-gate check --help for usage.");
    return ExitCode.UsageError;
  }

  const diff = io.readDiff(parsed.options.base, { staged: parsed.options.staged });
  const result = createGateResult(parsed.options, io.now(), diff, io);
  const rendered =
    command === "hook"
      ? renderReport(
          result.summary.decision === "pass" ? { ...result, findings: [] } : result,
          "repair"
        )
      : renderReport(result, parsed.options.format);

  if (parsed.options.output !== undefined) {
    io.writeFile(parsed.options.output, rendered);
  } else {
    io.stdout(rendered);
  }

  return result.summary.decision === "fail" ? ExitCode.FindingsFailed : ExitCode.Pass;
}

function parseCheckArgs(
  args: string[],
  command: CommandName
):
  | {
      ok: true;
      options: CheckOptions;
    }
  | {
      ok: false;
      error: string;
    } {
  const options: Partial<CheckOptions> = {
    format: "markdown",
    strict: false,
    staged: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--strict") {
      options.strict = true;
      continue;
    }

    if (arg === "--staged") {
      options.staged = true;
      continue;
    }

    if (
      arg === "--task" ||
      arg === "--base" ||
      arg === "--format" ||
      arg === "--output" ||
      arg === "--fail-on"
    ) {
      const value = args[index + 1];

      if (value === undefined || value.startsWith("--")) {
        return { ok: false, error: `Missing value for ${arg}.` };
      }

      index += 1;

      if (arg === "--task") {
        options.task = value;
      } else if (arg === "--base") {
        options.base = value;
      } else if (arg === "--format") {
        if (!isReportFormat(value)) {
          return {
            ok: false,
            error: "Invalid --format value. Expected json, markdown, sarif, repair, or pr-comment."
          };
        }

        options.format = value;
      } else if (arg === "--fail-on") {
        if (!isFailOnSeverity(value)) {
          return {
            ok: false,
            error: "Invalid --fail-on value. Expected blocker, high, or medium."
          };
        }

        options.failOn = value;
      } else if (arg === "--output") {
        options.output = value;
      }

      continue;
    }

    return { ok: false, error: `Unknown option: ${arg}` };
  }

  if (options.task === undefined || options.task.trim().length === 0) {
    if (command === "hook") {
      options.task = "Codex completed feature implementation";
    } else {
      return { ok: false, error: "Missing required --task value." };
    }
  }

  if (options.task.trim().length === 0) {
    return { ok: false, error: "Missing required --task value." };
  }

  return {
    ok: true,
    options: {
      task: options.task,
      base: options.base,
      format: options.format ?? "markdown",
      strict: options.strict ?? false,
      staged: options.staged ?? false,
      failOn: options.failOn,
      output: options.output
    }
  };
}

function createGateResult(
  options: CheckOptions,
  generatedAt: Date,
  diffResult: GitDiffResult,
  io: Pick<CliIo, "exists" | "readFile"> = {}
): GateResult {
  const configResult = loadCriticalGateConfig(diffResult.root, {
    exists: io.exists,
    readFile: io.readFile
  });
  const task = {
    source: "cli" as const,
    text: options.task
  };
  const diff = {
    baseRef: diffResult.baseRef,
    headRef: diffResult.headRef,
    files: diffResult.files
  };
  const frameworkPacks = detectFrameworkPacks({
    files: diff.files,
    packageJson: readOptionalPackageJson(diffResult.root, io),
    config: configResult.config
  });
  const monorepo = detectMonorepoContext(diffResult.root, diff.files, io);
  const apiSnapshot = loadApiSurfaceSnapshot(diffResult.root, io);
  const context: GateResult["context"] = {
    root: diffResult.root,
    packageManager: "pnpm",
    monorepo,
    apiSnapshot: summarizeApiSurfaceSnapshot(apiSnapshot),
    frameworkPacks: frameworkPacks.map((pack) => pack.id),
    repositoryProfile: diffResult.repositoryProfile,
    utilityIndex: diffResult.utilityIndex,
    git: {
      baseRef: diffResult.baseRef,
      headRef: diffResult.headRef
    }
  };
  const detectorContext = {
    ...context,
    apiSurfaceSnapshot: apiSnapshot,
    knowledge: diffResult.knowledge
  };
  const detectorFindings = runDetectors(task, diff, detectorContext);
  const learningResult = applyLearningPolicy(
    detectorFindings,
    diff.files,
    configResult.config.learning
  );
  const findings = learningResult.findings;
  const loadedHistoryIndex = diffResult.knowledge?.getLoadedHistoryIndex?.();
  const loadedSolutionIndex = diffResult.knowledge?.getLoadedSolutionIndex?.();

  context.repositoryProfile ??= loadedHistoryIndex?.profile;
  context.utilityIndex ??= loadedSolutionIndex?.utilityIndex;

  return {
    schemaVersion: GATE_RESULT_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    task,
    diff,
    context,
    findings,
    summary: summarizeFindings(findings, task, diff, {
      ...configResult.config.rollout,
      failOn: options.failOn
    }),
    intentVerification: summarizeIntentVerification(task, diff.files),
    intentQuality: analyzeTaskIntentQuality(task),
    metadata: {
      cliVersion: CLI_VERSION,
      strict: options.strict,
      staged: options.staged,
      failOn: options.failOn ?? "high",
      rolloutPolicy: configResult.config.rollout,
      frameworkPacks: frameworkPacks.map((pack) => pack.id),
      learning: {
        acceptedFindingsApplied: learningResult.appliedAcceptedFindings,
        expectedSupportRulesApplied: learningResult.appliedExpectedSupportRules
      },
      configWarnings: configResult.warnings
    }
  };
}

function runSnapshotApiCommand(args: string[], io: CliIo): ExitCode {
  const parsed = parseSnapshotApiArgs(args);

  if (!parsed.ok) {
    io.stderr(parsed.error);
    io.stderr("Run critical-gate snapshot-api --help for usage.");
    return ExitCode.UsageError;
  }

  const root = io.readDiff().root;
  const snapshot = buildApiSurfaceSnapshot({
    root,
    generatedAt: io.now(),
    entrypoints: parsed.options.entrypoints,
    reader: io
  });
  const outputPath = getApiSnapshotOutputPath(root, parsed.options.output);

  io.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  io.stdout(
    `Wrote public API snapshot to ${outputPath} (${snapshot.exports.length} exports across ${snapshot.entrypoints.length} entrypoints).`
  );

  return ExitCode.Pass;
}

function runInstallHooksCommand(args: string[], io: CliIo): ExitCode {
  const parsed = parseInstallHooksArgs(args);

  if (!parsed.ok) {
    io.stderr(parsed.error);
    io.stderr("Run critical-gate install-hooks --help for usage.");
    return ExitCode.UsageError;
  }

  const root = io.readDiff().root;
  const hooks: Array<"pre-commit" | "pre-push"> =
    parsed.options.hook === "all" ? ["pre-commit", "pre-push"] : [parsed.options.hook];
  const installed: string[] = [];

  for (const hook of hooks) {
    const path = join(root, ".git", "hooks", hook);

    if (io.exists?.(path) === true && parsed.options.force !== true) {
      io.stderr(`Refusing to overwrite existing ${hook} hook at ${path}. Re-run with --force.`);
      return ExitCode.UsageError;
    }

    io.writeFile(path, renderGitHookScript(hook, parsed.options.cli));
    io.chmodFile?.(path, 0o755);
    installed.push(path);
  }

  io.stdout(`Installed Critical Gate hook(s): ${installed.join(", ")}`);

  return ExitCode.Pass;
}

function readOptionalPackageJson(root: string, io: Pick<CliIo, "exists" | "readFile">): unknown {
  const path = join(root, "package.json");

  if (io.exists?.(path) !== true) {
    return undefined;
  }

  try {
    return JSON.parse(io.readFile?.(path) ?? "");
  } catch {
    return undefined;
  }
}

function runAcceptCommand(args: string[], io: CliIo): ExitCode {
  const parsed = parseFlagArgs(args, ["--finding", "--reason"]);

  if (!parsed.ok) {
    io.stderr(parsed.error);
    io.stderr("Run critical-gate accept --help for usage.");
    return ExitCode.UsageError;
  }

  const finding = parsed.values["--finding"];
  const reason = parsed.values["--reason"];

  if (finding === undefined || reason === undefined) {
    io.stderr("Missing required --finding or --reason value.");
    io.stderr("Run critical-gate accept --help for usage.");
    return ExitCode.UsageError;
  }

  const root = io.readDiff().root;
  const updated = updateCriticalGateConfig(
    root,
    (config) => ({
      ...config,
      learning: {
        ...config.learning,
        acceptedFindings: upsertById(config.learning?.acceptedFindings ?? [], {
          id: finding,
          reason,
          createdAt: io.now().toISOString()
        })
      }
    }),
    {
      exists: io.exists,
      readFile: io.readFile,
      writeFile: io.writeFile
    }
  );

  io.stdout(
    `Accepted finding ${finding} in ${CRITICAL_GATE_CONFIG_FILE} (${updated.learning?.acceptedFindings?.length ?? 0} accepted finding rules).`
  );

  return ExitCode.Pass;
}

function runTeachCommand(args: string[], io: CliIo): ExitCode {
  const parsed = parseFlagArgs(args, ["--id", "--when-changed", "--allow", "--reason"]);

  if (!parsed.ok) {
    io.stderr(parsed.error);
    io.stderr("Run critical-gate teach --help for usage.");
    return ExitCode.UsageError;
  }

  const id = parsed.values["--id"];
  const whenChanged = parsed.values["--when-changed"];
  const allow = parsed.values["--allow"]
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const reason = parsed.values["--reason"];

  if (
    id === undefined ||
    whenChanged === undefined ||
    allow === undefined ||
    reason === undefined
  ) {
    io.stderr("Missing required --id, --when-changed, --allow, or --reason value.");
    io.stderr("Run critical-gate teach --help for usage.");
    return ExitCode.UsageError;
  }

  const root = io.readDiff().root;
  const updated = updateCriticalGateConfig(
    root,
    (config) => ({
      ...config,
      learning: {
        ...config.learning,
        expectedSupportFiles: upsertById(config.learning?.expectedSupportFiles ?? [], {
          id,
          whenChanged,
          allow,
          reason,
          createdAt: io.now().toISOString()
        })
      }
    }),
    {
      exists: io.exists,
      readFile: io.readFile,
      writeFile: io.writeFile
    }
  );

  io.stdout(
    `Taught expected support rule ${id} in ${CRITICAL_GATE_CONFIG_FILE} (${updated.learning?.expectedSupportFiles?.length ?? 0} support rules).`
  );

  return ExitCode.Pass;
}

function getHelpText(): string {
  return [
    "critical-gate",
    "",
    "Usage:",
    "  critical-gate check --task <text> [--base <ref>] [--format json|markdown|sarif|repair|pr-comment] [--strict] [--output <path>]",
    "  critical-gate hook [--task <text>] [--base <ref>] [--output <path>]",
    "  critical-gate accept --finding <id> --reason <text>",
    "  critical-gate teach --id <id> --when-changed <glob> --allow <glob[,glob]> --reason <text>",
    "  critical-gate snapshot-api [--entrypoint <path>] [--output <path>]",
    "  critical-gate install-hooks [--hook pre-commit|pre-push|all] [--cli <command>] [--force]",
    "  critical-gate --version",
    "  critical-gate --help",
    ""
  ].join("\n");
}

function getCommandHelpText(command: CommandName): string {
  if (command === "hook") {
    return getHookHelpText();
  }

  if (command === "accept") {
    return getAcceptHelpText();
  }

  if (command === "teach") {
    return getTeachHelpText();
  }

  if (command === "snapshot-api") {
    return getSnapshotApiHelpText();
  }

  if (command === "install-hooks") {
    return getInstallHooksHelpText();
  }

  return getCheckHelpText();
}

function getCheckHelpText(): string {
  return [
    "critical-gate check",
    "",
    "Required:",
    "  --task <text>       Task intent, issue summary, or prompt",
    "",
    "Options:",
    "  --base <ref>        Git baseline reference",
    "  --format <format>   json, markdown, sarif, repair, or pr-comment",
    "  --fail-on <level>   blocker, high, or medium; defaults to high",
    "  --staged            Analyze staged changes with git diff --cached",
    "  --strict            Fail on strict-mode findings once detectors exist",
    "  --output <path>     Write report to a file instead of stdout",
    ""
  ].join("\n");
}

function getHookHelpText(): string {
  return [
    "critical-gate hook",
    "",
    "Options:",
    "  --task <text>       Optional task intent; defaults to Codex completed feature implementation",
    "  --base <ref>        Git baseline reference",
    "  --output <path>     Write compact repair report to a file instead of stdout",
    ""
  ].join("\n");
}

function getAcceptHelpText(): string {
  return [
    "critical-gate accept",
    "",
    "Records an explicit accepted finding in .critical-gate.json.",
    "",
    "Required:",
    "  --finding <id>     Exact finding id to accept",
    "  --reason <text>    Reviewable reason for accepting the finding",
    ""
  ].join("\n");
}

function getTeachHelpText(): string {
  return [
    "critical-gate teach",
    "",
    "Records a repository-specific expected support-file rule in .critical-gate.json.",
    "",
    "Required:",
    "  --id <id>                 Stable rule id",
    "  --when-changed <glob>     Changed file glob that activates the rule",
    "  --allow <glob[,glob]>     Support-file glob or comma-separated globs to allow",
    "  --reason <text>           Reviewable reason for the rule",
    ""
  ].join("\n");
}

function getSnapshotApiHelpText(): string {
  return [
    "critical-gate snapshot-api",
    "",
    "Generates a reviewable public API surface snapshot.",
    "",
    "Options:",
    "  --entrypoint <path>  Public entrypoint to snapshot; may be passed more than once",
    "  --output <path>      Snapshot path; defaults to .critical-gate/api-surface.json",
    ""
  ].join("\n");
}

function getInstallHooksHelpText(): string {
  return [
    "critical-gate install-hooks",
    "",
    "Installs reviewable local git hooks.",
    "",
    "Options:",
    "  --hook <hook>       pre-commit, pre-push, or all; defaults to all",
    "  --cli <command>     Critical Gate command/path used by the hook; defaults to critical-gate",
    "  --force             Overwrite an existing generated or custom hook",
    "",
    "Defaults:",
    "  pre-commit runs staged changes with --fail-on blocker.",
    "  pre-push runs branch changes against ${CRITICAL_GATE_BASE:-origin/main} with --fail-on high.",
    ""
  ].join("\n");
}

function isCommandName(value: string): value is CommandName {
  return (
    value === "check" ||
    value === "hook" ||
    value === "accept" ||
    value === "teach" ||
    value === "snapshot-api" ||
    value === "install-hooks"
  );
}

function isReportFormat(value: string): value is ReportFormat {
  return (
    value === "json" ||
    value === "markdown" ||
    value === "sarif" ||
    value === "repair" ||
    value === "pr-comment"
  );
}

function isFailOnSeverity(value: string): value is NonNullable<CheckOptions["failOn"]> {
  return value === "blocker" || value === "high" || value === "medium";
}

function parseFlagArgs(
  args: string[],
  allowedFlags: string[]
):
  | {
      ok: true;
      values: Record<string, string>;
    }
  | {
      ok: false;
      error: string;
    } {
  const values: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!allowedFlags.includes(arg)) {
      return { ok: false, error: `Unknown option: ${arg}.` };
    }

    const value = args[index + 1];

    if (value === undefined || value.startsWith("--")) {
      return { ok: false, error: `Missing value for ${arg}.` };
    }

    values[arg] = value;
    index += 1;
  }

  return { ok: true, values };
}

function parseSnapshotApiArgs(args: string[]):
  | {
      ok: true;
      options: {
        output?: string;
        entrypoints?: string[];
      };
    }
  | {
      ok: false;
      error: string;
    } {
  const options: {
    output?: string;
    entrypoints: string[];
  } = {
    entrypoints: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg !== "--entrypoint" && arg !== "--output") {
      return { ok: false, error: `Unknown option: ${arg}.` };
    }

    const value = args[index + 1];

    if (value === undefined || value.startsWith("--")) {
      return { ok: false, error: `Missing value for ${arg}.` };
    }

    if (arg === "--entrypoint") {
      options.entrypoints.push(value);
    } else {
      options.output = value;
    }

    index += 1;
  }

  return {
    ok: true,
    options: {
      output: options.output,
      entrypoints: options.entrypoints.length > 0 ? options.entrypoints : undefined
    }
  };
}

function parseInstallHooksArgs(args: string[]):
  | {
      ok: true;
      options: {
        hook: "pre-commit" | "pre-push" | "all";
        cli: string;
        force: boolean;
      };
    }
  | {
      ok: false;
      error: string;
    } {
  const options = {
    hook: "all" as "pre-commit" | "pre-push" | "all",
    cli: "critical-gate",
    force: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg !== "--hook" && arg !== "--cli") {
      return { ok: false, error: `Unknown option: ${arg}.` };
    }

    const value = args[index + 1];

    if (value === undefined || value.startsWith("--")) {
      return { ok: false, error: `Missing value for ${arg}.` };
    }

    if (arg === "--hook") {
      if (value !== "pre-commit" && value !== "pre-push" && value !== "all") {
        return { ok: false, error: "Invalid --hook value. Expected pre-commit, pre-push, or all." };
      }

      options.hook = value;
    } else {
      options.cli = value;
    }

    index += 1;
  }

  return { ok: true, options };
}

function renderGitHookScript(hook: "pre-commit" | "pre-push", cliCommand: string): string {
  const quotedCli = shellQuote(cliCommand);

  if (hook === "pre-commit") {
    return [
      "#!/bin/sh",
      "# Critical Gate pre-commit hook.",
      "# Generated by `critical-gate install-hooks`; review before trusting.",
      "set -eu",
      'TASK="${CRITICAL_GATE_TASK:-Pre-commit staged change}"',
      `${quotedCli} check --staged --task "$TASK" --format repair --fail-on blocker`,
      ""
    ].join("\n");
  }

  return [
    "#!/bin/sh",
    "# Critical Gate pre-push hook.",
    "# Generated by `critical-gate install-hooks`; review before trusting.",
    "set -eu",
    'TASK="${CRITICAL_GATE_TASK:-Pre-push branch change}"',
    'BASE="${CRITICAL_GATE_BASE:-origin/main}"',
    `${quotedCli} check --base "$BASE" --task "$TASK" --format repair --fail-on high`,
    ""
  ].join("\n");
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

function upsertById<T extends { id: string }>(entries: T[], next: T): T[] {
  return [...entries.filter((entry) => entry.id !== next.id), next];
}

const isDirectRun =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  process.exitCode = main();
}

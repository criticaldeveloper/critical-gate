#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CRITICAL_GATE_CONFIG_FILE,
  GATE_RESULT_SCHEMA_VERSION,
  applyLearningPolicy,
  detectFrameworkPacks,
  loadCriticalGateConfig,
  readGitDiff,
  renderReport,
  runDetectors,
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
  output?: string;
}

interface CliIo {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
  writeFile: (path: string, content: string) => void;
  now: () => Date;
  readDiff: (baseRef?: string) => GitDiffResult;
  exists?: (path: string) => boolean;
  readFile?: (path: string) => string;
}

type CommandName = "check" | "hook" | "accept" | "teach";

const defaultIo: CliIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
  writeFile: (path, content) => writeFileSync(path, content, "utf8"),
  now: () => new Date(),
  exists: (path) => existsSync(path),
  readFile: (path) => readFileSync(path, "utf8"),
  readDiff: (baseRef) => readGitDiff({ baseRef })
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

  const parsed = parseCheckArgs(args, command);

  if (!parsed.ok) {
    io.stderr(parsed.error);
    io.stderr("Run critical-gate check --help for usage.");
    return ExitCode.UsageError;
  }

  const diff = io.readDiff(parsed.options.base);
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
    strict: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--strict") {
      options.strict = true;
      continue;
    }

    if (arg === "--task" || arg === "--base" || arg === "--format" || arg === "--output") {
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
  const context: GateResult["context"] = {
    root: diffResult.root,
    packageManager: "pnpm",
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
    summary: summarizeFindings(findings, task, diff, configResult.config.rollout),
    intentVerification: summarizeIntentVerification(task, diff.files),
    metadata: {
      cliVersion: CLI_VERSION,
      strict: options.strict,
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

function isCommandName(value: string): value is CommandName {
  return value === "check" || value === "hook" || value === "accept" || value === "teach";
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

function upsertById<T extends { id: string }>(entries: T[], next: T): T[] {
  return [...entries.filter((entry) => entry.id !== next.id), next];
}

const isDirectRun =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  process.exitCode = main();
}

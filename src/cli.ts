#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GATE_RESULT_SCHEMA_VERSION,
  readGitDiff,
  renderReport,
  runDetectors,
  summarizeFindings,
  summarizeIntentVerification,
  type GateResult,
  type GitDiffResult,
  type ReportFormat
} from "./index.js";

export const CLI_VERSION = "0.1.0-alpha.0";

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
}

type CommandName = "check" | "hook";

const defaultIo: CliIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
  writeFile: (path, content) => writeFileSync(path, content, "utf8"),
  now: () => new Date(),
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
    io.stdout(command === "hook" ? getHookHelpText() : getCheckHelpText());
    return ExitCode.Pass;
  }

  const parsed = parseCheckArgs(args, command);

  if (!parsed.ok) {
    io.stderr(parsed.error);
    io.stderr("Run critical-gate check --help for usage.");
    return ExitCode.UsageError;
  }

  const diff = io.readDiff(parsed.options.base);
  const result = createGateResult(parsed.options, io.now(), diff);
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
            error: "Invalid --format value. Expected json, markdown, sarif, or repair."
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
  diffResult: GitDiffResult
): GateResult {
  const task = {
    source: "cli" as const,
    text: options.task
  };
  const diff = {
    baseRef: diffResult.baseRef,
    headRef: diffResult.headRef,
    files: diffResult.files
  };
  const context: GateResult["context"] = {
    root: diffResult.root,
    packageManager: "pnpm",
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
  const findings = runDetectors(task, diff, detectorContext);
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
    summary: summarizeFindings(findings, task, diff),
    intentVerification: summarizeIntentVerification(task, diff.files),
    metadata: {
      cliVersion: CLI_VERSION,
      strict: options.strict
    }
  };
}

function getHelpText(): string {
  return [
    "critical-gate",
    "",
    "Usage:",
    "  critical-gate check --task <text> [--base <ref>] [--format json|markdown|sarif|repair] [--strict] [--output <path>]",
    "  critical-gate hook [--task <text>] [--base <ref>] [--output <path>]",
    "  critical-gate --version",
    "  critical-gate --help",
    ""
  ].join("\n");
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
    "  --format <format>   json, markdown, sarif, or repair",
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

function isCommandName(value: string): value is CommandName {
  return value === "check" || value === "hook";
}

function isReportFormat(value: string): value is ReportFormat {
  return value === "json" || value === "markdown" || value === "sarif" || value === "repair";
}

const isDirectRun =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  process.exitCode = main();
}

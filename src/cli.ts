#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { GATE_RESULT_SCHEMA_VERSION, type GateResult } from "./index.js";

export const CLI_VERSION = "0.1.0";

export const ExitCode = {
  Pass: 0,
  FindingsFailed: 1,
  UsageError: 2,
  InternalError: 3
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

type OutputFormat = "json" | "markdown";

interface CheckOptions {
  task: string;
  base?: string;
  format: OutputFormat;
  strict: boolean;
  output?: string;
}

interface CliIo {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
  writeFile: (path: string, content: string) => void;
  now: () => Date;
}

const defaultIo: CliIo = {
  stdout: (message) => console.log(message),
  stderr: (message) => console.error(message),
  writeFile: (path, content) => writeFileSync(path, content, "utf8"),
  now: () => new Date()
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

  if (argv.includes("--help") || argv.includes("-h")) {
    io.stdout(getHelpText());
    return ExitCode.Pass;
  }

  const [command = "check", ...args] = argv;

  if (command !== "check") {
    io.stderr(`Unknown command: ${command}`);
    io.stderr("Run critical-gate --help for usage.");
    return ExitCode.UsageError;
  }

  if (args.includes("--help") || args.includes("-h")) {
    io.stdout(getCheckHelpText());
    return ExitCode.Pass;
  }

  const parsed = parseCheckArgs(args);

  if (!parsed.ok) {
    io.stderr(parsed.error);
    io.stderr("Run critical-gate check --help for usage.");
    return ExitCode.UsageError;
  }

  const result = createEmptyGateResult(parsed.options, io.now());
  const rendered = renderGateResult(result, parsed.options.format);

  if (parsed.options.output !== undefined) {
    io.writeFile(parsed.options.output, rendered);
  } else {
    io.stdout(rendered);
  }

  return result.summary.decision === "fail" ? ExitCode.FindingsFailed : ExitCode.Pass;
}

function parseCheckArgs(args: string[]):
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
        if (value !== "json" && value !== "markdown") {
          return { ok: false, error: "Invalid --format value. Expected json or markdown." };
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

function createEmptyGateResult(options: CheckOptions, generatedAt: Date): GateResult {
  return {
    schemaVersion: GATE_RESULT_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    task: {
      source: "cli",
      text: options.task
    },
    diff: {
      baseRef: options.base,
      files: []
    },
    context: {
      packageManager: "pnpm",
      git: {
        baseRef: options.base
      }
    },
    findings: [],
    summary: {
      decision: "pass",
      findingCount: 0,
      blockerCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
      diffCostScore: 0
    },
    metadata: {
      cliVersion: CLI_VERSION,
      strict: options.strict
    }
  };
}

function renderGateResult(result: GateResult, format: OutputFormat): string {
  if (format === "json") {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  const baseRef = result.diff.baseRef ?? "working tree";

  return [
    "# Critical Gate Report",
    "",
    `Decision: ${result.summary.decision}`,
    `Task: ${result.task.text}`,
    `Base: ${baseRef}`,
    `Findings: ${result.summary.findingCount}`,
    `Diff Cost Score: ${result.summary.diffCostScore ?? 0}`,
    ""
  ].join("\n");
}

function getHelpText(): string {
  return [
    "critical-gate",
    "",
    "Usage:",
    "  critical-gate check --task <text> [--base <ref>] [--format json|markdown] [--strict] [--output <path>]",
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
    "  --format <format>   json or markdown",
    "  --strict            Fail on strict-mode findings once detectors exist",
    "  --output <path>     Write report to a file instead of stdout",
    ""
  ].join("\n");
}

const isDirectRun =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  process.exitCode = main();
}

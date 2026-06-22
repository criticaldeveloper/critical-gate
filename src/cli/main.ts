import { renderReport } from "../index.js";
import { CRITICAL_GATE_VERSION } from "../version.js";
import { parseCheckArgs, isCommandName } from "./args.js";
import {
  runAcceptCommand,
  runInitAgentCommand,
  runInitPolicyCommand,
  runInstallHooksCommand,
  runSnapshotApiCommand,
  runTeachCommand
} from "./commands.js";
import { getCommandHelpText, getHelpText } from "./help.js";
import { defaultIo } from "./io.js";
import { createGateResult } from "./result.js";
import { ExitCode, type CliIo } from "./types.js";

export const CLI_VERSION = CRITICAL_GATE_VERSION;

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

  if (command === "init-policy") {
    return runInitPolicyCommand(args, io);
  }

  if (command === "init-agent") {
    return runInitAgentCommand(args, io);
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

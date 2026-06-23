import type { ReportFormat } from "../index.js";
import type { CommandName } from "./help.js";
import type { CheckOptions } from "./types.js";

export function parseCheckArgs(
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

export function isCommandName(value: string): value is CommandName {
  return (
    value === "check" ||
    value === "hook" ||
    value === "accept" ||
    value === "teach" ||
    value === "snapshot-api" ||
    value === "install-hooks" ||
    value === "init" ||
    value === "init-policy" ||
    value === "init-agent"
  );
}

export function parseFlagArgs(
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

export function parseSnapshotApiArgs(args: string[]):
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

export function parseInstallHooksArgs(args: string[]):
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

export function parseInitPolicyArgs(args: string[]):
  | {
      ok: true;
      options: {
        force: boolean;
      };
    }
  | {
      ok: false;
      error: string;
    } {
  const options = {
    force: false
  };

  for (const arg of args) {
    if (arg !== "--force") {
      return { ok: false, error: `Unknown option: ${arg}.` };
    }

    options.force = true;
  }

  return { ok: true, options };
}

export function parseInitAgentArgs(args: string[]):
  | {
      ok: true;
      options: {
        cli: string;
      };
    }
  | {
      ok: false;
      error: string;
    } {
  const options = {
    cli: "npx critical-gate"
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg !== "--cli") {
      return { ok: false, error: `Unknown option: ${arg}.` };
    }

    const value = args[index + 1];

    if (value === undefined || value.startsWith("--")) {
      return { ok: false, error: `Missing value for ${arg}.` };
    }

    options.cli = value;
    index += 1;
  }

  return { ok: true, options };
}

export function parseInitProjectArgs(args: string[]):
  | {
      ok: true;
      options: {
        mode: "observe";
        install: boolean;
        packageManager?: "bun" | "pnpm" | "npm" | "yarn";
        version?: string;
        skipAgent: boolean;
        skipWorkflow: boolean;
        force: boolean;
      };
    }
  | {
      ok: false;
      error: string;
    } {
  const options: {
    mode: "observe";
    install: boolean;
    packageManager?: "bun" | "pnpm" | "npm" | "yarn";
    version?: string;
    skipAgent: boolean;
    skipWorkflow: boolean;
    force: boolean;
  } = {
    mode: "observe",
    install: false,
    skipAgent: false,
    skipWorkflow: false,
    force: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--install") {
      options.install = true;
      continue;
    }

    if (arg === "--skip-agent") {
      options.skipAgent = true;
      continue;
    }

    if (arg === "--skip-workflow") {
      options.skipWorkflow = true;
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg !== "--mode" && arg !== "--package-manager" && arg !== "--version") {
      return { ok: false, error: `Unknown option: ${arg}.` };
    }

    const value = args[index + 1];

    if (value === undefined || value.startsWith("--")) {
      return { ok: false, error: `Missing value for ${arg}.` };
    }

    if (arg === "--mode") {
      if (value !== "observe") {
        return { ok: false, error: "Invalid --mode value. Expected observe." };
      }

      options.mode = value;
    } else if (arg === "--package-manager") {
      if (value !== "bun" && value !== "pnpm" && value !== "npm" && value !== "yarn") {
        return {
          ok: false,
          error: "Invalid --package-manager value. Expected bun, pnpm, npm, or yarn."
        };
      }

      options.packageManager = value;
    } else {
      options.version = value;
    }

    index += 1;
  }

  return { ok: true, options };
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

import { join } from "node:path";

import {
  CRITICAL_GATE_CONFIG_FILE,
  buildApiSurfaceSnapshot,
  createDefaultPolicyConfig,
  getApiSnapshotOutputPath,
  getConfiguredPublicApiEntrypoints,
  initAgentInstructions,
  loadCriticalGateConfig,
  updateCriticalGateConfig
} from "../index.js";
import {
  parseFlagArgs,
  parseInitAgentArgs,
  parseInitPolicyArgs,
  parseInstallHooksArgs,
  parseSnapshotApiArgs
} from "./args.js";
import { renderGitHookScript } from "./git-hooks.js";
import { ExitCode, type CliIo } from "./types.js";

export function runSnapshotApiCommand(args: string[], io: CliIo): ExitCode {
  const parsed = parseSnapshotApiArgs(args);

  if (!parsed.ok) {
    io.stderr(parsed.error);
    io.stderr("Run critical-gate snapshot-api --help for usage.");
    return ExitCode.UsageError;
  }

  const root = io.readDiff().root;
  const configResult = loadCriticalGateConfig(root, {
    exists: io.exists,
    readFile: io.readFile
  });
  const snapshot = buildApiSurfaceSnapshot({
    root,
    generatedAt: io.now(),
    entrypoints: parsed.options.entrypoints,
    policyEntrypoints: getConfiguredPublicApiEntrypoints(configResult.config),
    reader: io
  });
  const outputPath = getApiSnapshotOutputPath(root, parsed.options.output);

  io.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  io.stdout(
    `Wrote public API snapshot to ${outputPath} (${snapshot.exports.length} exports across ${snapshot.entrypoints.length} entrypoints).`
  );

  return ExitCode.Pass;
}

export function runInstallHooksCommand(args: string[], io: CliIo): ExitCode {
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

export function runInitPolicyCommand(args: string[], io: CliIo): ExitCode {
  const parsed = parseInitPolicyArgs(args);

  if (!parsed.ok) {
    io.stderr(parsed.error);
    io.stderr("Run critical-gate init-policy --help for usage.");
    return ExitCode.UsageError;
  }

  const root = io.readDiff().root;
  const path = join(root, CRITICAL_GATE_CONFIG_FILE);

  if (io.exists?.(path) === true && parsed.options.force !== true) {
    io.stderr(`Refusing to overwrite existing ${CRITICAL_GATE_CONFIG_FILE}. Re-run with --force.`);
    return ExitCode.UsageError;
  }

  io.writeFile(path, `${JSON.stringify(createDefaultPolicyConfig(io.now()), null, 2)}\n`);
  io.stdout(`Wrote reviewable Critical Gate policy to ${path}.`);

  return ExitCode.Pass;
}

export function runInitAgentCommand(args: string[], io: CliIo): ExitCode {
  const parsed = parseInitAgentArgs(args);

  if (!parsed.ok) {
    io.stderr(parsed.error);
    io.stderr("Run critical-gate init-agent --help for usage.");
    return ExitCode.UsageError;
  }

  const root = io.readDiff().root;
  const result = initAgentInstructions({
    root,
    cliCommand: parsed.options.cli,
    io
  });

  if (result.updated) {
    io.stdout(
      `${result.created ? "Created" : "Updated"} ${result.path} with Critical Gate agent instructions.`
    );
  } else {
    io.stdout(`${result.path} already contains the current Critical Gate agent instructions.`);
  }

  return ExitCode.Pass;
}

export function runAcceptCommand(args: string[], io: CliIo): ExitCode {
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

export function runTeachCommand(args: string[], io: CliIo): ExitCode {
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

function upsertById<T extends { id: string }>(entries: T[], next: T): T[] {
  return [...entries.filter((entry) => entry.id !== next.id), next];
}

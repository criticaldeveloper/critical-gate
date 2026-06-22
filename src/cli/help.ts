import { CRITICAL_GATE_CONFIG_FILE } from "../config/index.js";

export type CommandName =
  | "check"
  | "hook"
  | "accept"
  | "teach"
  | "snapshot-api"
  | "install-hooks"
  | "init-policy"
  | "init-agent";

export function getHelpText(): string {
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
    "  critical-gate init-policy [--force]",
    "  critical-gate init-agent [--cli <command>]",
    "  critical-gate --version",
    "  critical-gate --help",
    ""
  ].join("\n");
}

export function getCommandHelpText(command: CommandName): string {
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

  if (command === "init-policy") {
    return getInitPolicyHelpText();
  }

  if (command === "init-agent") {
    return getInitAgentHelpText();
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

function getInitPolicyHelpText(): string {
  return [
    "critical-gate init-policy",
    "",
    `Writes a starter ${CRITICAL_GATE_CONFIG_FILE} policy file.`,
    "",
    "Options:",
    "  --force             Overwrite an existing policy file",
    ""
  ].join("\n");
}

function getInitAgentHelpText(): string {
  return [
    "critical-gate init-agent",
    "",
    "Creates or updates the managed Critical Gate section in AGENTS.md.",
    "",
    "Options:",
    "  --cli <command>     Critical Gate command/path agents should run; defaults to npx critical-gate",
    "",
    "The command preserves existing AGENTS.md content and replaces only the managed Critical Gate block.",
    ""
  ].join("\n");
}

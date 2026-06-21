import { join } from "node:path";

export const AGENT_INSTRUCTIONS_FILE = "AGENTS.md";

const blockStart = "<!-- critical-gate:start -->";
const blockEnd = "<!-- critical-gate:end -->";
const managedBlockPattern = new RegExp(
  `${escapeRegExp(blockStart)}[\\s\\S]*?${escapeRegExp(blockEnd)}`
);

export interface AgentInstructionsIo {
  exists?: (path: string) => boolean;
  readFile?: (path: string) => string;
  writeFile: (path: string, content: string) => void;
}

export interface InitAgentInstructionsOptions {
  root: string;
  cliCommand?: string;
  includePolicyReminder?: boolean;
  io: AgentInstructionsIo;
}

export interface InitAgentInstructionsResult {
  path: string;
  created: boolean;
  updated: boolean;
}

export function initAgentInstructions({
  root,
  cliCommand = "critical-gate",
  includePolicyReminder = true,
  io
}: InitAgentInstructionsOptions): InitAgentInstructionsResult {
  const path = join(root, AGENT_INSTRUCTIONS_FILE);
  const existing = io.exists?.(path) === true ? (io.readFile?.(path) ?? "") : "";
  const block = renderCriticalGateAgentBlock(cliCommand, includePolicyReminder);
  const next = mergeCriticalGateAgentBlock(existing, block);
  const updated = existing !== next;

  if (updated) {
    io.writeFile(path, next);
  }

  return {
    path,
    created: existing.length === 0,
    updated
  };
}

export function mergeCriticalGateAgentBlock(existing: string, block: string): string {
  const normalizedBlock = block.endsWith("\n") ? block : `${block}\n`;

  if (managedBlockPattern.test(existing)) {
    return ensureTrailingNewline(existing.replace(managedBlockPattern, normalizedBlock.trimEnd()));
  }

  const trimmedExisting = existing.trimEnd();

  if (trimmedExisting.length === 0) {
    return normalizedBlock;
  }

  return `${trimmedExisting}\n\n${normalizedBlock}`;
}

export function renderCriticalGateAgentBlock(
  cliCommand = "critical-gate",
  includePolicyReminder = true
): string {
  const lines = [
    blockStart,
    "## Critical Gate Agent Instructions",
    "",
    "Critical Gate is a repository-aware diff integrity gate. Use it to validate that AI-generated changes stay inside the requested task and do not introduce high-risk drift.",
    "",
    "Before finishing an AI-assisted code task:",
    "",
    `- Run \`${cliCommand} check --task "<task intent>" --base <base-ref>\` when a base ref is known.`,
    `- Run \`${cliCommand} check --task "<task intent>" --staged\` for staged local changes.`,
    `- Use \`${cliCommand} hook --task "<task intent>" --base <base-ref>\` when an automated repair-oriented report is enough.`,
    "- Treat `repair` output as a scoped repair contract: fix evidence-backed files first and avoid broad rewrites.",
    "- Rerun the gate after repairs and keep normal project validation such as tests, typecheck, lint, and build.",
    "",
    "When the diff intentionally changes public API or repository policy:",
    "",
    `- Run \`${cliCommand} snapshot-api\` only when updating a reviewable public API snapshot is intentional.`,
    `- Run \`${cliCommand} init-policy\` only when the repository needs a starter .critical-gate.json policy.`,
    `- Run \`${cliCommand} install-hooks\` only after the user explicitly wants local git hooks.`,
    "",
    "Do not use Critical Gate as a generic PR reviewer, repo-wide LLM scanner, or automatic code fixer. It is a deterministic-first gate that reports evidence-backed diff integrity risks."
  ];

  if (includePolicyReminder) {
    lines.push(
      "",
      "If a finding is intentionally accepted, document the reason with repository policy or release notes rather than silently ignoring it."
    );
  }

  lines.push(blockEnd, "");

  return lines.join("\n");
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

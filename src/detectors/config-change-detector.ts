import type { DiffFile, Finding, TaskIntent } from "../schema/index.js";

import type { Detector } from "./types.js";

const configTaskTerms = [
  "config",
  "configuration",
  "ci",
  "workflow",
  "github action",
  "build",
  "bundler",
  "vite",
  "webpack",
  "typescript",
  "tsconfig",
  "eslint",
  "prettier",
  "docker",
  "lint",
  "test runner"
];

const documentationPathPattern =
  /(^|\/)(docs?|adr|changelog|changesets?)\/|(^|\/)(CHANGELOG|README|AGENTS|ADR)[^/]*\.md$/i;

export const configChangeDetector: Detector = {
  name: "config-change",
  maturity: "review",
  run: ({ task, diff, context }) => {
    const configFiles = diff.files.filter(isConfigChange);
    const enforcedInvariant = getConfigInvariant(context?.taskContract?.invariants ?? []);

    if (
      configFiles.length === 0 ||
      (enforcedInvariant === undefined && hasVisibleConfigExplanation(task, diff.files))
    ) {
      return [];
    }

    return configFiles.map((file) => toFinding(file, task, enforcedInvariant));
  }
};

function getConfigInvariant(invariants: string[]): string | undefined {
  return invariants.find(
    (invariant) => invariant === "no_config_changes" || invariant === "configuration_unchanged"
  );
}

function isConfigChange(file: DiffFile): boolean {
  return file.role === "config" && (file.additions > 0 || file.deletions > 0);
}

function hasVisibleConfigExplanation(task: TaskIntent, files: DiffFile[]): boolean {
  const normalizedTask = task.text.toLowerCase();

  if (hasConfigProhibition(task.text)) {
    return false;
  }

  return (
    configTaskTerms.some((term) => normalizedTask.includes(term)) ||
    files.some((file) => documentationPathPattern.test(file.path))
  );
}

function hasConfigProhibition(taskText: string): boolean {
  return /\b(?:without|no|avoid|do not|don't|dont|must not|never)\s+(?:(?:touching|changing|editing|modify|modifying)\s+)?(?:config|configuration|settings|runtime|node|tooling)\b/i.test(
    taskText
  );
}

function toFinding(file: DiffFile, task: TaskIntent, enforcedInvariant?: string): Finding {
  const firstChangedLine = file.hunks
    .flatMap((hunk) => hunk.lines)
    .find((line) => line.kind === "add" || line.kind === "delete");
  const lineNumber = firstChangedLine?.newLineNumber ?? firstChangedLine?.oldLineNumber;
  const isContractViolation = enforcedInvariant !== undefined;

  return {
    id: `config-change:${file.path}`,
    detector: "config-change",
    severity: isContractViolation ? "blocker" : "medium",
    confidence: isContractViolation ? 0.95 : 0.82,
    evidenceStrength: isContractViolation ? 0.95 : 0.82,
    title: isContractViolation
      ? "Config change violates task contract"
      : "Config changed without visible explanation",
    message: isContractViolation
      ? `${file.path} changed even though the task contract invariant ${enforcedInvariant} forbids configuration changes.`
      : `${file.path} changed, but the task did not mention configuration and no documentation file changed.`,
    evidence: [
      {
        kind: "file",
        path: file.path,
        startLine: lineNumber,
        endLine: lineNumber,
        message: `Config file changed during task: ${task.text}`,
        data: {
          additions: file.additions,
          deletions: file.deletions,
          role: file.role,
          enforcedInvariant
        }
      }
    ],
    repair: isContractViolation
      ? "Remove the configuration change or revise the task contract with explicit reviewer approval."
      : "Confirm the config change is required. If it changes team workflow or runtime behavior, add docs, an ADR, changelog entry, or explicit task/PR explanation.",
    tags: ["config"]
  };
}

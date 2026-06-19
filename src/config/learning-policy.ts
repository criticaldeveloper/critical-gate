import type { DiffFile, Finding } from "../schema/index.js";
import type { LearningConfig } from "./critical-gate-config.js";
import { matchesPathPattern } from "../frameworks/index.js";

export interface ApplyLearningPolicyResult {
  findings: Finding[];
  appliedAcceptedFindings: string[];
  appliedExpectedSupportRules: string[];
}

export function applyLearningPolicy(
  findings: Finding[],
  files: DiffFile[],
  learning: LearningConfig | undefined
): ApplyLearningPolicyResult {
  const acceptedIds = new Set(learning?.acceptedFindings?.map((entry) => entry.id) ?? []);
  const appliedAcceptedFindings: string[] = [];
  const appliedExpectedSupportRules: string[] = [];
  const filtered = findings.filter((finding) => {
    if (acceptedIds.has(finding.id)) {
      appliedAcceptedFindings.push(finding.id);
      return false;
    }

    const supportRule = findMatchingSupportRule(finding, files, learning);

    if (supportRule !== undefined) {
      appliedExpectedSupportRules.push(supportRule);
      return false;
    }

    return true;
  });

  return {
    findings: filtered,
    appliedAcceptedFindings: [...new Set(appliedAcceptedFindings)],
    appliedExpectedSupportRules: [...new Set(appliedExpectedSupportRules)]
  };
}

function findMatchingSupportRule(
  finding: Finding,
  files: DiffFile[],
  learning: LearningConfig | undefined
): string | undefined {
  if (!finding.tags.includes("scope")) {
    return undefined;
  }

  const evidencePaths = finding.evidence
    .map((evidence) => evidence.path)
    .filter((path): path is string => path !== undefined);

  return learning?.expectedSupportFiles?.find(
    (rule) =>
      files.some((file) => matchesPathPattern(rule.whenChanged, file.path)) &&
      evidencePaths.some((path) => rule.allow.some((allowed) => matchesPathPattern(allowed, path)))
  )?.id;
}

import type { DiffFile, Finding, FindingRepairContract } from "../schema/index.js";

const maxListedFiles = 8;

export function enrichFindingWithRepairContract(finding: Finding, files: DiffFile[]): Finding {
  return {
    ...finding,
    repairContract: buildRepairContract(finding, files)
  };
}

export function buildRepairContract(finding: Finding, files: DiffFile[]): FindingRepairContract {
  const evidenceFiles = getEvidenceFiles(finding);
  const allowedFiles = evidenceFiles.length > 0 ? evidenceFiles : files.map((file) => file.path);
  const changedFiles = files.map((file) => file.path);
  const forbiddenFiles = changedFiles
    .filter((path) => !allowedFiles.includes(path))
    .slice(0, maxListedFiles);

  return {
    instructions: [
      finding.repair,
      "Keep the repair limited to the allowed files unless the task intent explicitly requires more.",
      "Do not broaden scope, add dependencies, weaken tests, or rewrite unrelated code while repairing this finding."
    ],
    allowedFiles: allowedFiles.slice(0, maxListedFiles),
    forbiddenFiles,
    successCriteria: [
      `The finding ${finding.id} no longer appears after rerunning Critical Gate.`,
      "The original task intent is still satisfied.",
      "No new blocker or high-severity Critical Gate finding is introduced."
    ]
  };
}

function getEvidenceFiles(finding: Finding): string[] {
  const paths = new Set<string>();

  for (const evidence of finding.evidence) {
    if (evidence.path !== undefined) {
      paths.add(evidence.path);
    }

    for (const key of ["expectedPath", "existingPath", "changedPath"]) {
      const value = evidence.data?.[key];

      if (typeof value === "string" && value.length > 0) {
        paths.add(value);
      }
    }
  }

  return [...paths];
}

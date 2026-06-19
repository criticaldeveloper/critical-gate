import type { Finding } from "../schema/index.js";

export function renderFindingRepairContract(finding: Finding): string {
  const contract = finding.repairContract;

  if (contract === undefined) {
    return finding.repair;
  }

  return [
    `Repair contract for ${finding.id}`,
    "",
    "Instructions:",
    ...contract.instructions.map((instruction) => `- ${instruction}`),
    "",
    "Allowed files:",
    ...renderList(contract.allowedFiles),
    "",
    "Forbidden files:",
    ...renderList(contract.forbiddenFiles),
    "",
    "Success criteria:",
    ...contract.successCriteria.map((criterion) => `- ${criterion}`)
  ].join("\n");
}

function renderList(values: string[]): string[] {
  return values.length === 0 ? ["- None."] : values.map((value) => `- ${value}`);
}

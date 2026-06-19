import type { Finding, GateResult } from "../schema/index.js";

const maxRepairFindings = 5;

export function renderRepairReport(result: GateResult): string {
  if (result.findings.length === 0) {
    return "Critical Gate passed. No repair actions required.\n";
  }

  const findings = [...result.findings]
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))
    .slice(0, maxRepairFindings);

  const lines = [
    "Critical Gate found findings that need repair:",
    "",
    ...renderScopeExpansionContext(result),
    ...findings.flatMap((finding, index) => renderRepairFinding(finding, index + 1)),
    "Rerun Critical Gate after applying focused repairs."
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

function renderScopeExpansionContext(result: GateResult): string[] {
  const score = result.summary.scopeExpansionScore;
  const drivers = score?.drivers.filter((driver) => driver.points >= 2) ?? [];

  if (score === undefined || drivers.length === 0) {
    return [];
  }

  return [
    `Scope Expansion Score: ${score.score}/10`,
    ...drivers.map((driver) => `- ${driver.label}: +${driver.points}`),
    ""
  ];
}

function renderRepairFinding(finding: Finding, index: number): string[] {
  const evidence = finding.evidence[0];
  const location =
    evidence?.path === undefined
      ? ""
      : ` Evidence: ${evidence.path}${evidence.startLine === undefined ? "" : `:${evidence.startLine}`}.`;

  return [
    `${index}. ${finding.severity.toUpperCase()}: ${finding.title}`,
    `${finding.message}${location}`,
    ...renderReasonChain(finding),
    `Repair: ${finding.repair}`,
    ""
  ];
}

function renderReasonChain(finding: Finding): string[] {
  if (finding.reasonChain === undefined) {
    return [];
  }

  return [
    `Why suspicious: ${finding.reasonChain.whySuspicious}`,
    `Acceptable if: ${finding.reasonChain.acceptableIf[0] ?? "the change is explicitly justified."}`
  ];
}

function severityRank(severity: Finding["severity"]): number {
  switch (severity) {
    case "blocker":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    case "info":
      return 1;
  }
}

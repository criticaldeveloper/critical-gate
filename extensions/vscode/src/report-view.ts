import * as vscode from "vscode";

import type { Finding, FindingEvidence, GateResult } from "../../../src/schema/index.js";
import type { RefreshState } from "./types.js";

export function showReport(state: RefreshState): void {
  if (state.lastReport === undefined) {
    state.output.appendLine("No Critical Gate report is available yet. Run Critical Gate first.");
  }

  state.output.show(true);
}

export function writeReport(output: vscode.OutputChannel, report: string): void {
  output.clear();
  output.append(report);
}

export function renderReport(result: GateResult): string {
  const lines = [
    "# Critical Gate Report",
    "",
    `Decision: ${result.summary.decision}`,
    `Task: ${result.task.summary ?? result.task.text}`,
    `Base: ${result.diff.baseRef ?? "working tree"}`,
    `Head: ${result.diff.headRef ?? "HEAD"}`,
    `Changed Files: ${result.diff.files.length}`,
    `Findings: ${result.summary.findingCount}`,
    `Diff Cost Score: ${result.summary.diffCostScore ?? 0}`,
    "",
    "## Changed Files",
    "",
    ...formatChangedFiles(result),
    "",
    "## Findings",
    "",
    ...formatFindings(result.findings)
  ];

  return `${lines.join("\n")}\n`;
}

function formatChangedFiles(result: GateResult): string[] {
  if (result.diff.files.length === 0) {
    return ["- No changed files detected."];
  }

  return result.diff.files.map(
    (file) => `- ${file.status} ${file.path} (${file.role}, +${file.additions}/-${file.deletions})`
  );
}

function formatFindings(findings: Finding[]): string[] {
  if (findings.length === 0) {
    return ["- No findings."];
  }

  return findings.flatMap((finding, index) => [
    `### ${index + 1}. ${finding.title}`,
    "",
    `- Severity: ${finding.severity}`,
    `- Detector: ${finding.detector}`,
    `- Confidence: ${Math.round(finding.confidence * 100)}%`,
    `- Message: ${finding.message}`,
    `- Repair: ${finding.repair}`,
    `- Evidence: ${formatEvidenceList(finding.evidence)}`,
    ""
  ]);
}

function formatEvidenceList(evidence: FindingEvidence[]): string {
  if (evidence.length === 0) {
    return "none";
  }

  return evidence
    .map((item) => {
      const location =
        item.path === undefined
          ? item.kind
          : `${item.path}${item.startLine === undefined ? "" : `:${item.startLine}`}`;
      return `${location} (${item.message})`;
    })
    .join("; ");
}

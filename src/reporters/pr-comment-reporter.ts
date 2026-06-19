import { calibrateFindingConfidence } from "../detectors/confidence-calibration.js";
import type { DiffFile, Finding, GateResult } from "../schema/index.js";
import { renderReviewerChecklist } from "./reviewer-checklist.js";

export function renderPrCommentReport(result: GateResult): string {
  const metrics = getDiffMetrics(result.diff.files);
  const blockingFindings = result.findings.filter(isBlockingFinding);
  const observations = result.findings.filter((finding) => !isBlockingFinding(finding));
  const expectedSupportFiles = getExpectedSupportFiles(result.diff.files);
  const lines = [
    `## Critical Gate: ${result.summary.decision === "pass" ? "pass" : "fail"}`,
    "",
    [
      `Task: ${result.task.text}`,
      `Changed files: ${metrics.changedFiles} (+${metrics.additions}/-${metrics.deletions})`,
      `Findings: ${result.summary.findingCount}`,
      `Diff coherence: ${result.summary.diffCoherenceScore?.score ?? 0}/100`,
      `Scope expansion: ${result.summary.scopeExpansionScore?.score ?? 0}/10`
    ].join(" | "),
    ""
  ];

  lines.push("### Blocking findings", "");
  if (blockingFindings.length === 0) {
    lines.push("- None.");
  } else {
    for (const finding of blockingFindings.slice(0, 5)) {
      lines.push(renderFindingBullet(finding));
    }
    appendTruncation(lines, blockingFindings.length, 5);
  }
  lines.push("");

  lines.push("### Observations", "");
  if (observations.length === 0) {
    lines.push("- None.");
  } else {
    for (const finding of observations.slice(0, 5)) {
      lines.push(renderFindingBullet(finding));
    }
    appendTruncation(lines, observations.length, 5);
  }
  lines.push("");

  lines.push("### Expected support changes", "");
  if (expectedSupportFiles.length === 0) {
    lines.push("- None detected.");
  } else {
    for (const file of expectedSupportFiles.slice(0, 6)) {
      lines.push(
        `- ${file.status} ${file.path} (${file.role}, +${file.additions}/-${file.deletions})`
      );
    }
    appendTruncation(lines, expectedSupportFiles.length, 6);
  }
  lines.push("");

  if ((result.summary.scopeExpansionScore?.drivers.length ?? 0) > 0) {
    lines.push("### Scope drivers", "");
    for (const driver of result.summary.scopeExpansionScore?.drivers.slice(0, 4) ?? []) {
      lines.push(`- ${driver.label}: +${driver.points}`);
    }
    lines.push("");
  }

  if ((result.intentQuality?.warnings.length ?? 0) > 0) {
    lines.push("### Task intent quality", "");
    for (const warning of result.intentQuality?.warnings.slice(0, 3) ?? []) {
      lines.push(`- ${warning.message} ${warning.suggestion}`);
    }
    lines.push("");
  }

  lines.push(...renderReviewerChecklist(result, "### Reviewer checklist"));

  lines.push(
    "<sub>Critical Gate reports evidence-backed diff integrity signals; review the full Markdown or SARIF output for complete evidence.</sub>",
    ""
  );

  return `${lines.join("\n").trimEnd()}\n`;
}

function isBlockingFinding(finding: Finding): boolean {
  return calibrateFindingConfidence(finding).blockingEligible;
}

function renderFindingBullet(finding: Finding): string {
  const evidence = finding.evidence
    .map(formatEvidence)
    .filter((entry) => entry.length > 0)
    .slice(0, 2)
    .join("; ");
  const suffix = evidence.length === 0 ? "" : ` Evidence: ${evidence}.`;

  return `- **${finding.severity.toUpperCase()}** ${finding.title} (${finding.detector}, ${Math.round(finding.confidence * 100)}%). ${finding.message} Repair: ${finding.repair}${suffix}`;
}

function formatEvidence(evidence: Finding["evidence"][number]): string {
  if (evidence.path === undefined) {
    return evidence.message;
  }

  const location =
    evidence.startLine === undefined ? evidence.path : `${evidence.path}:${evidence.startLine}`;

  return `${location}: ${evidence.message}`;
}

function getExpectedSupportFiles(files: DiffFile[]): DiffFile[] {
  return files.filter((file) => ["test", "docs", "config", "lockfile"].includes(file.role));
}

function appendTruncation(lines: string[], count: number, limit: number): void {
  if (count > limit) {
    lines.push(`- ${count - limit} more not shown in compact PR mode.`);
  }
}

function getDiffMetrics(files: DiffFile[]) {
  return {
    changedFiles: files.length,
    additions: files.reduce((total, file) => total + file.additions, 0),
    deletions: files.reduce((total, file) => total + file.deletions, 0)
  };
}

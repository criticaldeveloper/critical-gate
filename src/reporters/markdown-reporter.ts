import type { DiffFile, Finding, GateResult } from "../schema/index.js";

export function renderMarkdownReport(result: GateResult): string {
  const metrics = getDiffMetrics(result.diff.files);
  const lines = [
    "# Critical Gate Report",
    "",
    `Decision: ${result.summary.decision}`,
    `Task: ${result.task.text}`,
    `Base: ${result.diff.baseRef ?? "working tree"}`,
    `Head: ${result.diff.headRef ?? "unknown"}`,
    `Changed Files: ${metrics.changedFiles}`,
    `Additions: ${metrics.additions}`,
    `Deletions: ${metrics.deletions}`,
    `Findings: ${result.summary.findingCount}`,
    `Diff Cost Score: ${result.summary.diffCostScore ?? 0}`,
    ""
  ];

  if (result.intentVerification !== undefined) {
    lines.push(
      "## Intent Verification",
      "",
      `Requested Classes: ${formatClasses(result.intentVerification.requestedClasses)}`,
      `Observed Classes: ${formatClasses(result.intentVerification.observedClasses)}`,
      `Unexpected Classes: ${formatClasses(result.intentVerification.unexpectedClasses)}`,
      `Coverage: ${result.intentVerification.coverage}`,
      ""
    );
  }

  if (result.diff.files.length > 0) {
    lines.push("## Changed Files", "");
    for (const file of result.diff.files) {
      lines.push(
        `- ${file.status} ${file.path} (${file.role}, +${file.additions}/-${file.deletions})`
      );
    }
    lines.push("");
  }

  if (result.findings.length > 0) {
    lines.push("## Findings", "");
    for (const finding of result.findings) {
      lines.push(renderFinding(finding), "");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function formatClasses(classes: string[]): string {
  return classes.length === 0 ? "none" : classes.join(", ");
}

function renderFinding(finding: Finding): string {
  const evidence = finding.evidence
    .map((item) => {
      const location =
        item.path === undefined
          ? ""
          : ` ${item.path}${item.startLine === undefined ? "" : `:${item.startLine}`}`;
      return `  - ${item.kind}${location}: ${item.message}`;
    })
    .join("\n");

  return [
    `### ${finding.title}`,
    "",
    `Severity: ${finding.severity}`,
    `Confidence: ${Math.round(finding.confidence * 100)}%`,
    "",
    finding.message,
    "",
    "Evidence:",
    evidence,
    "",
    `Repair: ${finding.repair}`
  ].join("\n");
}

function getDiffMetrics(files: DiffFile[]) {
  return {
    changedFiles: files.length,
    additions: files.reduce((total, file) => total + file.additions, 0),
    deletions: files.reduce((total, file) => total + file.deletions, 0)
  };
}

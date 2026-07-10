import type { DetectorMaturitySummary, DiffFile, Finding, GateResult } from "../schema/index.js";
import { renderReviewerChecklist } from "./reviewer-checklist.js";

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
    `Diff Coherence Score: ${result.summary.diffCoherenceScore?.score ?? 0}/100`,
    `Scope Expansion Score: ${result.summary.scopeExpansionScore?.score ?? 0}/10`,
    `Diff Cost Score: ${result.summary.diffCostScore ?? 0}`,
    ""
  ];

  if ((result.summary.scopeExpansionScore?.drivers.length ?? 0) > 0) {
    lines.push("## Scope Expansion Drivers", "");
    for (const driver of result.summary.scopeExpansionScore?.drivers ?? []) {
      lines.push(`- ${driver.label}: +${driver.points} (${driver.code})`);
    }
    lines.push("");
  }

  if ((result.summary.diffCoherenceScore?.drivers.length ?? 0) > 0) {
    lines.push("## Diff Coherence Drivers", "");
    for (const driver of result.summary.diffCoherenceScore?.drivers ?? []) {
      lines.push(`- ${driver.label}: +${driver.points} (${driver.code})`);
    }
    lines.push("");
  }

  if (result.summary.policyApplied !== undefined) {
    lines.push("## Policy Applied", "");
    for (const policyLine of renderPolicyAppliedLines(result)) {
      lines.push(`- ${policyLine}`);
    }
    lines.push("");
  }

  if (result.taskContract !== undefined) {
    lines.push("## Task Contract", "");
    for (const contractLine of renderTaskContractLines(result)) {
      lines.push(`- ${contractLine}`);
    }
    lines.push("");
  }

  if (result.intentVerification !== undefined) {
    lines.push(
      "## Intent Verification",
      "",
      `Requested Classes: ${formatClasses(result.intentVerification.requestedClasses)}`,
      `Observed Classes: ${formatClasses(result.intentVerification.observedClasses)}`,
      `Unexpected Classes: ${formatClasses(result.intentVerification.unexpectedClasses)}`,
      `Requested Categories: ${formatClasses(result.intentVerification.requestedCategories ?? [])}`,
      `Observed Categories: ${formatClasses(result.intentVerification.observedCategories ?? [])}`,
      `Missing Categories: ${formatClasses(result.intentVerification.missingCategories ?? [])}`,
      `Unexpected Categories: ${formatClasses(result.intentVerification.unexpectedCategories ?? [])}`,
      `Coverage: ${result.intentVerification.coverage}`,
      ""
    );
  }

  if ((result.intentQuality?.warnings.length ?? 0) > 0) {
    lines.push("## Task Intent Quality", "", `Score: ${result.intentQuality?.score ?? 0}/100`);
    for (const warning of result.intentQuality?.warnings ?? []) {
      lines.push(`- ${warning.message} Suggestion: ${warning.suggestion}`);
    }
    lines.push("");
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

  if (result.summary.decision === "pass") {
    lines.push("## Clean Diff Certificate", "");
    for (const certificateLine of getCleanDiffCertificate(result)) {
      lines.push(`- ${certificateLine}`);
    }
    lines.push("");
  }

  lines.push(...renderReviewerChecklist(result, "## Reviewer Checklist"));

  if (result.findings.length > 0) {
    lines.push("## Findings", "");
    for (const finding of result.findings) {
      lines.push(renderFinding(finding), "");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function renderTaskContractLines(result: GateResult): string[] {
  const contract = result.taskContract;

  if (contract === undefined) {
    return [];
  }

  return [
    `Source: ${contract.source}.`,
    `Goal: ${contract.goal}.`,
    `Allowed paths: ${formatClasses(contract.allowedPaths)}.`,
    `Forbidden paths: ${formatClasses(contract.forbiddenPaths)}.`,
    `Expected artifacts: ${formatClasses(contract.expectedArtifacts)}.`,
    `Invariants: ${formatClasses(contract.invariants)}.`,
    `Required checks: ${formatClasses(contract.requiredChecks)}.`
  ];
}

function renderPolicyAppliedLines(result: GateResult): string[] {
  const policy = result.summary.policyApplied;

  if (policy === undefined) {
    return [];
  }

  return [
    `Fail threshold: ${policy.failOn}.`,
    `Observation detectors: ${formatClasses(policy.observationDetectors)}.`,
    `Blocking detector overrides: ${formatClasses(policy.blockingDetectors)}.`,
    `Detector maturity: ${formatDetectorMaturity(policy.detectorMaturity ?? [])}.`,
    `Blocking findings after policy: ${formatClasses(policy.blockingFindingIds)}.`,
    `Observation findings after policy: ${formatClasses(policy.observationFindingIds)}.`,
    `Confidence-suppressed findings: ${formatClasses(policy.confidenceSuppressedFindingIds)}.`,
    `Accepted findings applied: ${formatClasses(policy.acceptedFindingIds)}.`
  ];
}

function getCleanDiffCertificate(result: GateResult): string[] {
  const findings = result.findings;
  const hasDependencyFinding = findings.some((finding) => finding.tags.includes("dependency"));
  const hasTestWeakeningFinding = findings.some((finding) => finding.tags.includes("test"));
  const hasApiFinding = findings.some((finding) => finding.tags.includes("api"));
  const hasConfigFinding = findings.some((finding) => finding.tags.includes("config"));
  const hasSecretFinding = findings.some((finding) => finding.tags.includes("secret"));
  const hasBlockingFindings = result.summary.blockerCount > 0 || result.summary.highCount > 0;
  const policy = result.summary.policyApplied;
  const fileLabel = result.diff.files.length === 1 ? "file" : "files";
  const blockingFindingCount = policy?.blockingFindingIds.length ?? 0;
  const observationFindingCount =
    policy?.observationFindingIds.length ?? result.summary.findingCount;

  return [
    `Gate passed with ${result.diff.files.length} changed ${fileLabel} and ${formatCount(result.summary.findingCount, "non-blocking finding")}.`,
    `Detector families checked: dependency, test integrity, public API, configuration, secret/path, scope, rewrite, and repository convention signals.`,
    `Diff coherence is ${result.summary.diffCoherenceScore?.score ?? 0}/100.`,
    `Policy applied: fail threshold ${policy?.failOn ?? "high"}; ${formatCount(blockingFindingCount, "blocking finding")} and ${formatCount(observationFindingCount, "observation finding")} after policy.`,
    hasBlockingFindings
      ? "Blocking checks found high-risk findings, but rollout policy kept them observational."
      : "No blocker or high-severity findings failed the configured threshold.",
    hasDependencyFinding
      ? "Dependency discipline emitted non-blocking observations."
      : "No dependency changes were flagged.",
    hasTestWeakeningFinding
      ? "Test integrity emitted non-blocking observations."
      : "No test weakening was detected.",
    hasApiFinding
      ? "Public API checks emitted non-blocking observations."
      : "No public API surface change was flagged.",
    hasConfigFinding
      ? "Configuration checks emitted non-blocking observations."
      : "No configuration drift was flagged.",
    hasSecretFinding
      ? "Secret/path checks emitted non-blocking observations."
      : "No hardcoded secrets, local paths, or internal URLs were flagged."
  ];
}

function formatCount(count: number, singularLabel: string): string {
  return `${count} ${singularLabel}${count === 1 ? "" : "s"}`;
}

function formatClasses(classes: string[]): string {
  return classes.length === 0 ? "none" : classes.join(", ");
}

function formatDetectorMaturity(entries: DetectorMaturitySummary[]): string {
  if (entries.length === 0) {
    return "none";
  }

  const counts = entries.reduce(
    (summary, entry) => {
      summary[entry.maturity] += 1;
      return summary;
    },
    {
      experimental: 0,
      review: 0,
      "blocker-certified": 0
    } satisfies Record<DetectorMaturitySummary["maturity"], number>
  );

  return `${counts["blocker-certified"]} blocker-certified, ${counts.review} review, ${counts.experimental} experimental`;
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
    ...renderReasonChain(finding),
    "",
    `Repair: ${finding.repair}`
  ].join("\n");
}

function renderReasonChain(finding: Finding): string[] {
  const reasonChain = finding.reasonChain;

  if (reasonChain === undefined) {
    return [];
  }

  return [
    "Reason Chain:",
    `- What happened: ${reasonChain.whatHappened}`,
    `- Why suspicious: ${reasonChain.whySuspicious}`,
    ...reasonChain.supportingSignals.map((signal) => `- Signal: ${signal}`),
    ...reasonChain.acceptableIf.map((condition) => `- Acceptable if: ${condition}`)
  ];
}

function getDiffMetrics(files: DiffFile[]) {
  return {
    changedFiles: files.length,
    additions: files.reduce((total, file) => total + file.additions, 0),
    deletions: files.reduce((total, file) => total + file.deletions, 0)
  };
}

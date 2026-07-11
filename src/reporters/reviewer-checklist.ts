import { calibrateFindingEvidenceStrength } from "../detectors/confidence-calibration.js";
import type { DiffFile, Finding, GateResult } from "../schema/index.js";

export interface ReviewerChecklistItem {
  text: string;
  source: "blocking-finding" | "observation" | "changed-role" | "score" | "intent";
  findingId?: string;
  evidence?: string;
}

export function buildReviewerChecklist(result: GateResult, limit = 8): ReviewerChecklistItem[] {
  const items: ReviewerChecklistItem[] = [];
  const blockingFindings = result.findings.filter(isBlockingFinding);
  const observations = result.findings.filter((finding) => !isBlockingFinding(finding));

  for (const finding of blockingFindings.slice(0, 4)) {
    items.push({
      source: "blocking-finding",
      findingId: finding.id,
      text: `Resolve or explicitly accept ${finding.title}.`,
      evidence: formatPrimaryEvidence(finding)
    });
  }

  for (const finding of observations.slice(0, Math.max(0, 5 - items.length))) {
    items.push({
      source: "observation",
      findingId: finding.id,
      text: `Review non-blocking ${finding.detector} signal: ${finding.title}.`,
      evidence: formatPrimaryEvidence(finding)
    });
  }

  appendRoleChecklistItems(items, result.diff.files);

  if ((result.intentQuality?.warnings.length ?? 0) > 0) {
    items.push({
      source: "intent",
      text: "Confirm the task intent is specific enough to bound the diff.",
      evidence: result.intentQuality?.warnings[0]?.message
    });
  }

  if ((result.summary.diffCoherenceScore?.score ?? 100) < 75) {
    items.push({
      source: "score",
      text: "Check whether the changed files form one coherent task-shaped diff.",
      evidence: `Diff coherence ${result.summary.diffCoherenceScore?.score ?? 0}/100`
    });
  }

  return dedupeChecklist(items).slice(0, limit);
}

export function renderReviewerChecklist(result: GateResult, heading: string): string[] {
  const items = buildReviewerChecklist(result);

  if (items.length === 0) {
    return [heading, "", "- [ ] No specific review prompts generated from this diff.", ""];
  }

  return [
    heading,
    "",
    ...items.map((item) => {
      const evidence = item.evidence === undefined ? "" : ` Evidence: ${item.evidence}.`;
      return `- [ ] ${item.text}${evidence}`;
    }),
    ""
  ];
}

function isBlockingFinding(finding: Finding): boolean {
  return calibrateFindingEvidenceStrength(finding).blockingEligible;
}

function appendRoleChecklistItems(items: ReviewerChecklistItem[], files: DiffFile[]): void {
  const roles = new Set(files.map((file) => file.role));

  if (roles.has("test")) {
    items.push({
      source: "changed-role",
      text: "Confirm changed tests still assert behavior, not only rendering or existence.",
      evidence: summarizeRoleFiles(files, "test")
    });
  }

  if (roles.has("manifest") || roles.has("lockfile")) {
    items.push({
      source: "changed-role",
      text: "Confirm dependency or lockfile changes are required by the task.",
      evidence: summarizeRoleFiles(files, "manifest", "lockfile")
    });
  }

  if (roles.has("config")) {
    items.push({
      source: "changed-role",
      text: "Confirm config changes include visible operational context.",
      evidence: summarizeRoleFiles(files, "config")
    });
  }
}

function summarizeRoleFiles(files: DiffFile[], ...roles: DiffFile["role"][]): string {
  return files
    .filter((file) => roles.includes(file.role))
    .slice(0, 3)
    .map((file) => file.path)
    .join(", ");
}

function formatPrimaryEvidence(finding: Finding): string | undefined {
  const evidence = finding.evidence[0];

  if (evidence === undefined) {
    return undefined;
  }

  if (evidence.path === undefined) {
    return evidence.message;
  }

  const location =
    evidence.startLine === undefined ? evidence.path : `${evidence.path}:${evidence.startLine}`;

  return `${location}: ${evidence.message}`;
}

function dedupeChecklist(items: ReviewerChecklistItem[]): ReviewerChecklistItem[] {
  const seen = new Set<string>();
  const deduped: ReviewerChecklistItem[] = [];

  for (const item of items) {
    const key = `${item.text}:${item.evidence ?? ""}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

import type { Finding, FindingEvidence } from "../schema/index.js";

export type EditorDiagnosticSeverity = "error" | "warning" | "information" | "hint";

export interface EditorDiagnosticRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface EditorDiagnostic {
  path: string;
  severity: EditorDiagnosticSeverity;
  source: "critical-gate";
  code: string;
  detector: string;
  findingTitle: string;
  message: string;
  range: EditorDiagnosticRange;
  repair: string;
  tags: string[];
  evidence: {
    path: string;
    startLine?: number;
    endLine?: number;
  };
}

export function findingsToEditorDiagnostics(findings: Finding[]): EditorDiagnostic[] {
  return findings.flatMap((finding) =>
    finding.evidence.filter(hasPath).map((evidence) => toEditorDiagnostic(finding, evidence))
  );
}

export function groupEditorDiagnosticsByPath(
  diagnostics: EditorDiagnostic[]
): Map<string, EditorDiagnostic[]> {
  const grouped = new Map<string, EditorDiagnostic[]>();

  for (const diagnostic of diagnostics) {
    const existing = grouped.get(diagnostic.path) ?? [];
    existing.push(diagnostic);
    grouped.set(diagnostic.path, existing);
  }

  return grouped;
}

export function toEditorDiagnostic(
  finding: Finding,
  evidence: FindingEvidence & { path: string }
): EditorDiagnostic {
  return {
    path: evidence.path,
    severity: toEditorSeverity(finding.severity),
    source: "critical-gate",
    code: finding.id,
    detector: finding.detector,
    findingTitle: finding.title,
    message: `${finding.title}: ${finding.message}\nRepair: ${finding.repair}`,
    range: {
      startLine: Math.max(0, (evidence.startLine ?? 1) - 1),
      startColumn: 0,
      endLine: Math.max(0, (evidence.endLine ?? evidence.startLine ?? 1) - 1),
      endColumn: Number.MAX_SAFE_INTEGER
    },
    repair: finding.repair,
    tags: finding.tags,
    evidence: {
      path: evidence.path,
      startLine: evidence.startLine,
      endLine: evidence.endLine
    }
  };
}

export function toEditorSeverity(severity: Finding["severity"]): EditorDiagnosticSeverity {
  if (severity === "blocker" || severity === "high") {
    return "error";
  }

  if (severity === "medium") {
    return "warning";
  }

  if (severity === "low") {
    return "information";
  }

  return "hint";
}

function hasPath(evidence: FindingEvidence): evidence is FindingEvidence & { path: string } {
  return evidence.path !== undefined && evidence.path.length > 0;
}

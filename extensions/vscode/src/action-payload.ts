import type { Finding, FindingEvidence } from "../../../src/schema/index.js";
import type { CriticalGateDiagnosticPayload } from "./types.js";

interface PayloadInput {
  findingId: string;
  detector: string;
  title: string;
  message?: string;
  repair: string;
  evidencePath: string;
  startLine?: number;
  endLine?: number;
  evidenceData?: Record<string, unknown>;
  findingEvidence?: FindingEvidence[];
}

export function toCriticalGatePayload(input: PayloadInput): CriticalGateDiagnosticPayload {
  const findingEvidence = input.findingEvidence ?? [];
  const expectedCompanionPath = getString(input.evidenceData?.expectedPath);
  const existingSolutionPath = getString(input.evidenceData?.existingPath);
  const existingSolutionSymbol = getString(input.evidenceData?.existingExport);
  const clusterPaths =
    input.detector === "blast-radius"
      ? findingEvidence.flatMap((evidence) => (evidence.path === undefined ? [] : [evidence.path]))
      : undefined;

  return {
    findingId: input.findingId,
    detector: input.detector,
    title: input.title,
    message: input.message,
    repair: input.repair,
    evidencePath: input.evidencePath,
    startLine: input.startLine,
    endLine: input.endLine,
    existingSolutionPath,
    existingSolutionSymbol,
    expectedCompanionPath,
    clusterPaths
  };
}

export function toFindingPayload(finding: Finding): CriticalGateDiagnosticPayload | undefined {
  const evidence = finding.evidence.find(
    (item): item is FindingEvidence & { path: string } =>
      item.path !== undefined && item.path.length > 0
  );

  if (evidence === undefined) {
    return undefined;
  }

  return toCriticalGatePayload({
    findingId: finding.id,
    detector: finding.detector,
    title: finding.title,
    message: finding.message,
    repair: finding.repair,
    evidencePath: evidence.path,
    startLine: evidence.startLine,
    endLine: evidence.endLine,
    evidenceData: evidence.data,
    findingEvidence: finding.evidence
  });
}

export function getTreeContextValue(payload: CriticalGateDiagnosticPayload | undefined): string {
  if (payload === undefined) {
    return "criticalGateFindingNoEvidence";
  }

  const values = ["criticalGateFinding"];

  if (payload.existingSolutionPath !== undefined) {
    values.push("criticalGateExistingSolution");
  }

  if (payload.expectedCompanionPath !== undefined) {
    values.push("criticalGateExpectedCompanion");
  }

  if (payload.detector === "blast-radius") {
    values.push("criticalGateBlastRadius");
  }

  if ((payload.clusterPaths?.length ?? 0) > 0) {
    values.push("criticalGateClusterReport");
  }

  return values.join(" ");
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

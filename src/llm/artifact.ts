import type { GateResult } from "../schema/index.js";
import { redactForModel, truncateForModel } from "./redaction.js";
import { MODEL_ARTIFACT_VERSION, type ModelBudget, type ModelInputArtifact } from "./types.js";

export const DEFAULT_MODEL_BUDGET: ModelBudget = {
  maxInputChars: 12000,
  maxFindings: 8,
  maxEvidencePerFinding: 3,
  maxEvidenceMessageChars: 240,
  maxTaskChars: 1000,
  maxOutputTokens: 700
};

export function createModelInputArtifact(
  result: GateResult,
  budget: Partial<ModelBudget> = {}
): ModelInputArtifact {
  const resolvedBudget = resolveModelBudget(budget);
  const files = result.diff.files.map((file) => ({
    path: file.path,
    status: file.status,
    role: file.role,
    additions: file.additions,
    deletions: file.deletions,
    language: file.language
  }));

  const artifact: ModelInputArtifact = {
    artifactVersion: MODEL_ARTIFACT_VERSION,
    task: {
      source: result.task.source,
      text: truncateForModel(
        redactForModel(result.task.summary ?? result.task.text),
        resolvedBudget.maxTaskChars
      ),
      id: result.task.id
    },
    diff: {
      baseRef: result.diff.baseRef,
      headRef: result.diff.headRef,
      files,
      totals: {
        files: files.length,
        additions: files.reduce((total, file) => total + file.additions, 0),
        deletions: files.reduce((total, file) => total + file.deletions, 0)
      }
    },
    summary: result.summary,
    findings: result.findings.slice(0, resolvedBudget.maxFindings).map((finding) => ({
      id: finding.id,
      detector: finding.detector,
      severity: finding.severity,
      confidence: finding.confidence,
      title: redactForModel(finding.title),
      message: redactForModel(finding.message),
      repair: redactForModel(finding.repair),
      tags: finding.tags,
      evidence: finding.evidence.slice(0, resolvedBudget.maxEvidencePerFinding).map((evidence) => ({
        kind: evidence.kind,
        path: evidence.path,
        startLine: evidence.startLine,
        endLine: evidence.endLine,
        symbol: evidence.symbol,
        message: truncateForModel(
          redactForModel(evidence.message),
          resolvedBudget.maxEvidenceMessageChars
        )
      }))
    }))
  };

  return fitArtifactToBudget(artifact, resolvedBudget);
}

export function resolveModelBudget(budget: Partial<ModelBudget> = {}): ModelBudget {
  return {
    ...DEFAULT_MODEL_BUDGET,
    ...budget
  };
}

function fitArtifactToBudget(
  artifact: ModelInputArtifact,
  budget: ModelBudget
): ModelInputArtifact {
  let candidate = artifact;

  while (JSON.stringify(candidate).length > budget.maxInputChars && candidate.findings.length > 0) {
    candidate = {
      ...candidate,
      findings: candidate.findings.slice(0, -1)
    };
  }

  while (
    JSON.stringify(candidate).length > budget.maxInputChars &&
    candidate.diff.files.length > 0
  ) {
    candidate = {
      ...candidate,
      diff: {
        ...candidate.diff,
        files: candidate.diff.files.slice(0, -1)
      }
    };
  }

  return candidate;
}

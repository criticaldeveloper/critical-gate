import type {
  Finding,
  FindingEvidence,
  FindingSeverity,
  FindingTag,
  GateSummary
} from "../schema/index.js";

export const MODEL_ARTIFACT_VERSION = "1.0" as const;

export interface ModelBudget {
  maxInputChars: number;
  maxFindings: number;
  maxEvidencePerFinding: number;
  maxEvidenceMessageChars: number;
  maxTaskChars: number;
  maxOutputTokens: number;
}

export interface ModelArtifactChangedFile {
  path: string;
  status: string;
  role: string;
  additions: number;
  deletions: number;
  language?: string;
}

export interface ModelArtifactFinding {
  id: string;
  detector: string;
  severity: FindingSeverity;
  confidence: number;
  title: string;
  message: string;
  repair: string;
  tags: FindingTag[];
  evidence: ModelArtifactEvidence[];
}

export type ModelArtifactEvidence = Pick<
  FindingEvidence,
  "kind" | "path" | "startLine" | "endLine" | "symbol"
> & {
  message: string;
};

export interface ModelInputArtifact {
  artifactVersion: typeof MODEL_ARTIFACT_VERSION;
  task: {
    source: string;
    text: string;
    id?: string;
  };
  diff: {
    baseRef?: string;
    headRef?: string;
    files: ModelArtifactChangedFile[];
    totals: {
      files: number;
      additions: number;
      deletions: number;
    };
  };
  summary: GateSummary;
  findings: ModelArtifactFinding[];
}

export interface LlmPrompt {
  system: string;
  user: string;
}

export interface LlmProviderRequest extends LlmPrompt {
  maxOutputTokens: number;
  cacheKey: string;
}

export interface LlmProviderResponse {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}

export interface LlmProvider {
  name: string;
  complete: (request: LlmProviderRequest) => Promise<LlmProviderResponse>;
}

export interface LlmExplanation {
  text: string;
  provider: string;
  model?: string;
  cacheKey: string;
  cached: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export interface LlmCache {
  get: (key: string) => LlmProviderResponse | undefined;
  set: (key: string, response: LlmProviderResponse) => void;
}

export interface ExplainFindingsOptions {
  budget?: Partial<ModelBudget>;
  cache?: LlmCache;
}

export type FindingLike = Pick<
  Finding,
  | "id"
  | "detector"
  | "severity"
  | "confidence"
  | "title"
  | "message"
  | "repair"
  | "tags"
  | "evidence"
>;

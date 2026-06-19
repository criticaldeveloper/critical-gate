export const GATE_RESULT_SCHEMA_VERSION = "1.0" as const;

export type TaskIntentSource = "cli" | "commit" | "pull_request" | "issue" | "codex" | "unknown";

export interface TaskIntent {
  source: TaskIntentSource;
  text: string;
  summary?: string;
  id?: string;
}

export type DiffFileStatus = "added" | "modified" | "deleted" | "renamed";

export type DiffFileRole =
  | "source"
  | "test"
  | "config"
  | "docs"
  | "manifest"
  | "lockfile"
  | "generated"
  | "unknown";

export type DiffLineKind = "add" | "delete" | "context";

export interface DiffLine {
  kind: DiffLineKind;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  heading?: string;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  status: DiffFileStatus;
  role: DiffFileRole;
  additions: number;
  deletions: number;
  oldPath?: string;
  newPath?: string;
  language?: string;
  hunks: DiffHunk[];
}

export interface RepoContext {
  root?: string;
  packageManager?: "pnpm" | "npm" | "yarn" | "bun" | "unknown";
  manifests?: string[];
  configFiles?: string[];
  testFrameworks?: string[];
  frameworkPacks?: string[];
  publicEntrypoints?: string[];
  repositoryProfile?: RepositoryProfile;
  utilityIndex?: UtilityIndex;
  git?: {
    baseRef?: string;
    headRef?: string;
  };
}

export interface RepositoryProfile {
  commitCount: number;
  minConfidenceCommitCount: number;
  coChanges: RepositoryCoChange[];
}

export interface RepositoryCoChange {
  path: string;
  count: number;
  relatedPaths: Array<{
    path: string;
    count: number;
  }>;
}

export interface UtilityIndex {
  utilities: UtilityEntry[];
}

export interface UtilityEntry {
  path: string;
  exportedNames: string[];
}

export type FindingSeverity = "blocker" | "high" | "medium" | "low" | "info";

export type FindingTag =
  | "scope"
  | "dependency"
  | "api"
  | "test"
  | "secret"
  | "config"
  | "rewrite"
  | "convention"
  | "utility"
  | "dead-code"
  | "duplicate-code";

export interface FindingEvidence {
  kind: "file" | "line" | "symbol" | "manifest" | "metric" | "history";
  message: string;
  path?: string;
  startLine?: number;
  endLine?: number;
  symbol?: string;
  data?: Record<string, unknown>;
}

export interface FindingReasonChain {
  whatHappened: string;
  whySuspicious: string;
  supportingSignals: string[];
  acceptableIf: string[];
  repairHint: string;
}

export interface Finding {
  id: string;
  detector: string;
  severity: FindingSeverity;
  confidence: number;
  title: string;
  message: string;
  evidence: FindingEvidence[];
  reasonChain?: FindingReasonChain;
  repair: string;
  tags: FindingTag[];
}

export interface GateSummary {
  decision: "pass" | "fail";
  findingCount: number;
  blockerCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  diffCostScore?: number;
  scopeExpansionScore?: ScopeExpansionScore;
}

export interface ScopeExpansionScore {
  score: number;
  drivers: ScopeExpansionDriver[];
}

export interface ScopeExpansionDriver {
  code: string;
  label: string;
  points: number;
  evidence?: string[];
}

export interface IntentVerificationSummary {
  requestedClasses: string[];
  observedClasses: string[];
  unexpectedClasses: string[];
  coverage: "none" | "partial" | "matched";
  explanationCodes: string[];
}

export interface GateResult {
  schemaVersion: typeof GATE_RESULT_SCHEMA_VERSION;
  generatedAt: string;
  task: TaskIntent;
  diff: {
    baseRef?: string;
    headRef?: string;
    files: DiffFile[];
  };
  context?: RepoContext;
  findings: Finding[];
  summary: GateSummary;
  intentVerification?: IntentVerificationSummary;
  metadata?: Record<string, unknown>;
}

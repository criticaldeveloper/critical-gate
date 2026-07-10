export const GATE_RESULT_SCHEMA_VERSION = "1.0" as const;

export type TaskIntentSource = "cli" | "commit" | "pull_request" | "issue" | "codex" | "unknown";

export interface TaskIntent {
  source: TaskIntentSource;
  text: string;
  summary?: string;
  id?: string;
}

export type TaskContractSource = "inferred" | "provided";

export interface TaskContract {
  source: TaskContractSource;
  goal: string;
  allowedPaths: string[];
  forbiddenPaths: string[];
  expectedArtifacts: string[];
  invariants: string[];
  requiredChecks: string[];
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
  monorepo?: MonorepoContext;
  manifests?: string[];
  configFiles?: string[];
  testFrameworks?: string[];
  frameworkPacks?: string[];
  publicEntrypoints?: string[];
  apiSnapshot?: ApiSurfaceSnapshotSummary;
  publicApiEntrypoints?: PublicApiEntrypointSummary[];
  repositoryProfile?: RepositoryProfile;
  utilityIndex?: UtilityIndex;
  repositoryTokenIndex?: RepositoryTokenIndex;
  git?: {
    baseRef?: string;
    headRef?: string;
  };
}

export interface MonorepoContext {
  tools?: Array<"pnpm" | "turbo" | "nx" | "lerna">;
  configFiles: string[];
  workspaceGlobs: string[];
  typescriptPathAliases?: string[];
  packages: MonorepoPackage[];
}

export interface MonorepoPackage {
  path: string;
  name?: string;
}

export interface ApiSurfaceSnapshotSummary {
  path: string;
  schemaVersion: string;
  exportCount: number;
  entrypoints: string[];
}

export interface PublicApiEntrypointSummary {
  path: string;
  source: string;
  packageKey?: string;
  exportKey?: string;
  condition?: string;
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

export interface RepositoryTokenIndex {
  files: RepositoryTokenFile[];
}

export type RepositoryTokenSource =
  | "path"
  | "folder"
  | "package-name"
  | "symbol"
  | "test-name"
  | "markdown-heading";

export interface RepositoryTokenFile {
  path: string;
  tokens: RepositoryToken[];
}

export interface RepositoryToken {
  value: string;
  source: RepositoryTokenSource;
  raw: string;
}

export type FindingSeverity = "blocker" | "high" | "medium" | "low" | "info";

export type DetectorMaturity = "experimental" | "review" | "blocker-certified";

export interface DetectorMaturitySummary {
  detector: string;
  maturity: DetectorMaturity;
  defaultMode: "blocking" | "observation";
}

export type DetectorRunStatus =
  | "passed"
  | "findings"
  | "skipped"
  | "insufficient-context"
  | "timed-out"
  | "errored";

export interface DetectorRunSummary {
  detector: string;
  status: DetectorRunStatus;
  durationMs: number;
  findingCount: number;
  maturity: DetectorMaturity;
  filesInspected?: number;
  reason?: string;
}

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
  evidenceStrength?: number;
  title: string;
  message: string;
  evidence: FindingEvidence[];
  reasonChain?: FindingReasonChain;
  repairContract?: FindingRepairContract;
  repair: string;
  tags: FindingTag[];
}

export interface FindingRepairContract {
  instructions: string[];
  allowedFiles: string[];
  forbiddenFiles: string[];
  successCriteria: string[];
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
  diffCoherenceScore?: DiffCoherenceScore;
  confidenceCalibration?: ConfidenceCalibrationSummary;
  policyApplied?: PolicyAppliedSummary;
  detectorRuns?: DetectorRunSummary[];
}

export interface ConfidenceCalibrationSummary {
  blockingEligibleCount: number;
  observationModeCount: number;
  confidenceSuppressedCount: number;
}

export type EvidenceStrengthSummary = ConfidenceCalibrationSummary;

export interface PolicyAppliedSummary {
  failOn: "blocker" | "high" | "medium";
  observationDetectors: string[];
  blockingDetectors: string[];
  detectorMaturity?: DetectorMaturitySummary[];
  acceptedFindingIds: string[];
  blockingFindingIds: string[];
  observationFindingIds: string[];
  confidenceSuppressedFindingIds: string[];
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

export interface DiffCoherenceScore {
  score: number;
  drivers: DiffCoherenceDriver[];
}

export interface DiffCoherenceDriver {
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
  requestedCategories?: string[];
  observedCategories?: string[];
  missingCategories?: string[];
  unexpectedCategories?: string[];
  categoryAssessments?: IntentCoverageCategoryAssessment[];
}

export interface IntentCoverageCategoryAssessment {
  category: string;
  expected: boolean;
  observed: boolean;
  confidence: number;
  evidence: string[];
}

export interface TaskIntentQualitySummary {
  score: number;
  warnings: TaskIntentQualityWarning[];
}

export interface TaskIntentQualityWarning {
  code: "too-short" | "vague-task" | "missing-target" | "generic-only";
  message: string;
  suggestion: string;
  penalty: number;
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
  taskContract?: TaskContract;
  intentVerification?: IntentVerificationSummary;
  intentQuality?: TaskIntentQualitySummary;
  metadata?: Record<string, unknown>;
}

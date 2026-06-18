import type {
  DiffFileRole,
  RepositoryCoChange,
  RepositoryProfile,
  UtilityIndex
} from "../schema/index.js";

export type KnowledgeIndexKind = "graph" | "symbols" | "history" | "solutions";

export interface KnowledgeRequest {
  root: string;
  baseRef?: string;
  headRef?: string;
  indexes?: KnowledgeIndexKind[];
  useCache?: boolean;
}

export interface KnowledgeCacheKey {
  schemaVersion: number;
  root: string;
  baseRef?: string;
  headRef?: string;
  fingerprints: Record<string, string>;
}

export interface RepositoryKnowledge {
  root: string;
  cacheKey?: KnowledgeCacheKey;
  graph: FileGraph;
  symbols: SymbolIndex;
  history: HistoryIndex;
  solutions: SolutionIndex;
}

export interface FileGraph {
  nodes: FileGraphNode[];
  edges: FileGraphEdge[];
}

export interface FileGraphNode {
  path: string;
  role?: DiffFileRole;
}

export type FileGraphEdgeKind = "import" | "history" | "path" | "test";

export interface FileGraphEdge {
  from: string;
  to: string;
  kind: FileGraphEdgeKind;
  weight: number;
  evidence?: string;
}

export interface SymbolIndex {
  symbols: SymbolEntry[];
}

export interface SymbolEntry {
  name: string;
  path: string;
  exported: boolean;
  kind?: SymbolEntryKind;
  line?: number;
}

export type SymbolEntryKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "const"
  | "variable"
  | "unknown";

export interface HistoryIndex {
  profile?: RepositoryProfile;
  coChanges: RepositoryCoChange[];
  companionRules: CompanionRule[];
}

export interface CompanionRule {
  sourcePath: string;
  expectedPath: string;
  support: number;
  confidence: number;
  lastSeen?: string;
}

export type SolutionClass =
  | "utility"
  | "hook"
  | "service"
  | "query"
  | "validator"
  | "schema"
  | "adapter";

export interface SolutionIndex {
  solutions: SolutionEntry[];
  utilityIndex?: UtilityIndex;
}

export interface SolutionEntry {
  path: string;
  class: SolutionClass;
  normalizedName: string;
  exportedName?: string;
  arity?: number;
  returnType?: string;
  importTokens: string[];
  domainTokens: string[];
}

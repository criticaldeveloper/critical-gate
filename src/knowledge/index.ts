export {
  KNOWLEDGE_CACHE_SCHEMA_VERSION,
  createMemoryKnowledgeCache,
  serializeKnowledgeCacheKey,
  type KnowledgeCache
} from "./cache.js";
export { createEmptyFileGraph, createFileGraph } from "./graph.js";
export {
  buildHistoryIndex,
  buildRepositoryProfileFromHistoryIndex,
  createEmptyHistoryIndex,
  parseNameOnlyLog,
  type BuildHistoryIndexOptions,
  type HistoryCommandRunner
} from "./history-index.js";
export {
  buildSolutionIndex,
  extractExportedNames,
  solutionIndexToUtilityIndex,
  type BuildSolutionIndexOptions,
  type SolutionIndexRunner
} from "./solution-index.js";
export {
  createLazyKnowledgeProvider,
  type CreateLazyKnowledgeProviderOptions,
  type KnowledgeProviderRunner
} from "./provider.js";
export { createEmptySymbolIndex, createSymbolIndex } from "./symbol-index.js";
export type {
  CompanionRule,
  FileGraph,
  FileGraphEdge,
  FileGraphEdgeKind,
  FileGraphNode,
  HistoryIndex,
  KnowledgeCacheKey,
  KnowledgeIndexKind,
  KnowledgeProvider,
  KnowledgeRequest,
  RepositoryKnowledge,
  SolutionClass,
  SolutionEntry,
  SolutionIndex,
  SymbolEntry,
  SymbolEntryKind,
  SymbolIndex
} from "./types.js";

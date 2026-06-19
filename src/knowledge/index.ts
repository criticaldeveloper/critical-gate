export {
  KNOWLEDGE_CACHE_DIR,
  KNOWLEDGE_CACHE_SCHEMA_VERSION,
  buildKnowledgeCacheKey,
  createFileKnowledgeCache,
  createMemoryKnowledgeCache,
  getKnowledgeCacheRoot,
  serializeKnowledgeCacheKey,
  type KnowledgeCacheEntry,
  type KnowledgeCacheKeyOptions,
  type KnowledgeCache
} from "./cache.js";
export {
  buildFileGraph,
  createEmptyFileGraph,
  createFileGraph,
  type BuildFileGraphOptions,
  type FileGraphRunner
} from "./graph.js";
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
  extractSolutionEntries,
  solutionIndexToUtilityIndex,
  type BuildSolutionIndexOptions,
  type SolutionIndexRunner
} from "./solution-index.js";
export {
  createLazyKnowledgeProvider,
  type CreateLazyKnowledgeProviderOptions,
  type KnowledgeProviderRunner
} from "./provider.js";
export {
  buildPatternIndex,
  type BuildPatternIndexOptions,
  type PatternIndexRunner
} from "./pattern-index.js";
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
  PatternIndex,
  RepositoryKnowledge,
  RepositoryPattern,
  RepositoryPatternKind,
  SolutionClass,
  SolutionEntry,
  SolutionIndex,
  SymbolEntry,
  SymbolEntryKind,
  SymbolIndex
} from "./types.js";

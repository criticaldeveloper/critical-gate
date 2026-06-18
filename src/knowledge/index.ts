export {
  KNOWLEDGE_CACHE_SCHEMA_VERSION,
  createMemoryKnowledgeCache,
  serializeKnowledgeCacheKey,
  type KnowledgeCache
} from "./cache.js";
export { createEmptyFileGraph, createFileGraph } from "./graph.js";
export { createEmptyHistoryIndex } from "./history-index.js";
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
  KnowledgeRequest,
  RepositoryKnowledge,
  SolutionClass,
  SolutionEntry,
  SolutionIndex,
  SymbolEntry,
  SymbolEntryKind,
  SymbolIndex
} from "./types.js";

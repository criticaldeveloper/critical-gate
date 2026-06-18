import type { KnowledgeCacheKey, RepositoryKnowledge } from "./types.js";

export const KNOWLEDGE_CACHE_SCHEMA_VERSION = 1;

export interface KnowledgeCache {
  get: (key: KnowledgeCacheKey) => RepositoryKnowledge | undefined;
  set: (key: KnowledgeCacheKey, value: RepositoryKnowledge) => void;
}

export function createMemoryKnowledgeCache(): KnowledgeCache {
  const entries = new Map<string, RepositoryKnowledge>();

  return {
    get: (key) => entries.get(serializeKnowledgeCacheKey(key)),
    set: (key, value) => {
      entries.set(serializeKnowledgeCacheKey(key), value);
    }
  };
}

export function serializeKnowledgeCacheKey(key: KnowledgeCacheKey): string {
  return JSON.stringify({
    schemaVersion: key.schemaVersion,
    root: key.root,
    baseRef: key.baseRef,
    headRef: key.headRef,
    fingerprints: Object.fromEntries(
      Object.entries(key.fingerprints).sort(([left], [right]) => left.localeCompare(right))
    )
  });
}

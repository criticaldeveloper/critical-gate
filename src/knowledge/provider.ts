import {
  buildKnowledgeCacheKey,
  createFileKnowledgeCache,
  type KnowledgeCache,
  type KnowledgeCacheKeyOptions
} from "./cache.js";
import { buildHistoryIndex } from "./history-index.js";
import { buildSolutionIndex } from "./solution-index.js";
import type { HistoryIndex, KnowledgeCacheKey, KnowledgeProvider, SolutionIndex } from "./types.js";

export interface KnowledgeProviderRunner {
  execFile: (file: string, args: string[], options?: { cwd?: string }) => string;
  readFile?: (path: string) => string;
}

export interface CreateLazyKnowledgeProviderOptions {
  root: string;
  runner: KnowledgeProviderRunner;
  baseRef?: string;
  headRef?: string;
  cache?: KnowledgeCache;
  useCache?: boolean;
}

export function createLazyKnowledgeProvider(
  options: CreateLazyKnowledgeProviderOptions
): KnowledgeProvider {
  let historyIndex: HistoryIndex | undefined;
  let solutionIndex: SolutionIndex | undefined;
  let cacheKey: KnowledgeCacheKey | undefined;
  const cacheEnabled =
    options.useCache !== false && process.env.CRITICAL_GATE_DISABLE_CACHE !== "true";
  const cache = cacheEnabled
    ? (options.cache ?? createFileKnowledgeCache(options.root))
    : undefined;

  return {
    getHistoryIndex: () => {
      historyIndex ??=
        cache?.get(getCacheKey())?.history ?? buildAndCacheHistory(options, cache, getCacheKey);
      return historyIndex;
    },
    getSolutionIndex: () => {
      solutionIndex ??=
        cache?.get(getCacheKey())?.solutions ?? buildAndCacheSolutions(options, cache, getCacheKey);
      return solutionIndex;
    },
    getLoadedHistoryIndex: () => historyIndex,
    getLoadedSolutionIndex: () => solutionIndex
  };

  function getCacheKey(): KnowledgeCacheKey {
    cacheKey ??= buildKnowledgeCacheKey(options as KnowledgeCacheKeyOptions);
    return cacheKey;
  }
}

function buildAndCacheHistory(
  options: CreateLazyKnowledgeProviderOptions,
  cache: KnowledgeCache | undefined,
  getCacheKey: () => KnowledgeCacheKey
): HistoryIndex {
  const history = buildHistoryIndex(options);
  const key = cache === undefined ? undefined : getCacheKey();
  const current = key === undefined ? {} : (cache?.get(key) ?? {});
  if (key !== undefined) {
    cache?.set(key, { ...current, history });
  }
  return history;
}

function buildAndCacheSolutions(
  options: CreateLazyKnowledgeProviderOptions,
  cache: KnowledgeCache | undefined,
  getCacheKey: () => KnowledgeCacheKey
): SolutionIndex {
  const solutions = buildSolutionIndex(options);
  const key = cache === undefined ? undefined : getCacheKey();
  const current = key === undefined ? {} : (cache?.get(key) ?? {});
  if (key !== undefined) {
    cache?.set(key, { ...current, solutions });
  }
  return solutions;
}

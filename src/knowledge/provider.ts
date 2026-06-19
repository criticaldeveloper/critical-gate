import {
  buildKnowledgeCacheKey,
  createFileKnowledgeCache,
  type KnowledgeCache,
  type KnowledgeCacheKeyOptions
} from "./cache.js";
import { buildFileGraph } from "./graph.js";
import { buildHistoryIndex } from "./history-index.js";
import { buildPatternIndex } from "./pattern-index.js";
import { buildSolutionIndex } from "./solution-index.js";
import type {
  FileGraph,
  HistoryIndex,
  KnowledgeCacheKey,
  KnowledgeProvider,
  PatternIndex,
  SolutionIndex
} from "./types.js";

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
  let patternIndex: PatternIndex | undefined;
  let fileGraph: FileGraph | undefined;
  let cacheKey: KnowledgeCacheKey | undefined;
  const cacheEnabled =
    options.useCache !== false && process.env.CRITICAL_GATE_DISABLE_CACHE !== "true";
  const cache = cacheEnabled
    ? (options.cache ?? createFileKnowledgeCache(options.root))
    : undefined;

  return {
    getFileGraph: () => {
      const cached = cache?.get(getCacheKey());
      historyIndex ??= cached?.history;
      fileGraph ??= cached?.graph;

      if (fileGraph === undefined) {
        historyIndex ??= buildAndCacheHistory(options, cache, getCacheKey);
        fileGraph = buildFileGraph({ ...options, history: historyIndex });
        const key = cache === undefined ? undefined : getCacheKey();
        if (key !== undefined) {
          cache?.set(key, { ...(cache.get(key) ?? {}), graph: fileGraph, history: historyIndex });
        }
      }

      return fileGraph;
    },
    getHistoryIndex: () => {
      historyIndex ??=
        cache?.get(getCacheKey())?.history ?? buildAndCacheHistory(options, cache, getCacheKey);
      return historyIndex;
    },
    getPatternIndex: () => {
      patternIndex ??=
        cache?.get(getCacheKey())?.patterns ?? buildAndCachePatterns(options, cache, getCacheKey);
      return patternIndex;
    },
    getSolutionIndex: () => {
      solutionIndex ??=
        cache?.get(getCacheKey())?.solutions ?? buildAndCacheSolutions(options, cache, getCacheKey);
      return solutionIndex;
    },
    getLoadedFileGraph: () => fileGraph,
    getLoadedHistoryIndex: () => historyIndex,
    getLoadedPatternIndex: () => patternIndex,
    getLoadedSolutionIndex: () => solutionIndex
  };

  function getCacheKey(): KnowledgeCacheKey {
    cacheKey ??= buildKnowledgeCacheKey(options as KnowledgeCacheKeyOptions);
    return cacheKey;
  }
}

function buildAndCachePatterns(
  options: CreateLazyKnowledgeProviderOptions,
  cache: KnowledgeCache | undefined,
  getCacheKey: () => KnowledgeCacheKey
): PatternIndex {
  const patterns = buildPatternIndex(options);
  const key = cache === undefined ? undefined : getCacheKey();
  const current = key === undefined ? {} : (cache?.get(key) ?? {});
  if (key !== undefined) {
    cache?.set(key, { ...current, patterns });
  }
  return patterns;
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

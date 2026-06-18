import { buildHistoryIndex } from "./history-index.js";
import { buildSolutionIndex } from "./solution-index.js";
import type { HistoryIndex, KnowledgeProvider, SolutionIndex } from "./types.js";

export interface KnowledgeProviderRunner {
  execFile: (file: string, args: string[], options?: { cwd?: string }) => string;
  readFile?: (path: string) => string;
}

export interface CreateLazyKnowledgeProviderOptions {
  root: string;
  runner: KnowledgeProviderRunner;
}

export function createLazyKnowledgeProvider(
  options: CreateLazyKnowledgeProviderOptions
): KnowledgeProvider {
  let historyIndex: HistoryIndex | undefined;
  let solutionIndex: SolutionIndex | undefined;

  return {
    getHistoryIndex: () => {
      historyIndex ??= buildHistoryIndex(options);
      return historyIndex;
    },
    getSolutionIndex: () => {
      solutionIndex ??= buildSolutionIndex(options);
      return solutionIndex;
    },
    getLoadedHistoryIndex: () => historyIndex,
    getLoadedSolutionIndex: () => solutionIndex
  };
}

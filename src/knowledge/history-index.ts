import type { HistoryIndex } from "./types.js";

export function createEmptyHistoryIndex(): HistoryIndex {
  return {
    coChanges: [],
    companionRules: []
  };
}

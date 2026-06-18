import type { SymbolEntry, SymbolIndex } from "./types.js";

export function createEmptySymbolIndex(): SymbolIndex {
  return {
    symbols: []
  };
}

export function createSymbolIndex(symbols: SymbolEntry[] = []): SymbolIndex {
  return {
    symbols: [...symbols].sort(
      (left, right) => left.path.localeCompare(right.path) || left.name.localeCompare(right.name)
    )
  };
}

import type { FileGraph, FileGraphEdge, FileGraphNode } from "./types.js";

export function createEmptyFileGraph(): FileGraph {
  return {
    nodes: [],
    edges: []
  };
}

export function createFileGraph(
  nodes: FileGraphNode[] = [],
  edges: FileGraphEdge[] = []
): FileGraph {
  return {
    nodes: [...nodes].sort((left, right) => left.path.localeCompare(right.path)),
    edges: [...edges].sort(
      (left, right) =>
        left.from.localeCompare(right.from) ||
        left.to.localeCompare(right.to) ||
        left.kind.localeCompare(right.kind)
    )
  };
}

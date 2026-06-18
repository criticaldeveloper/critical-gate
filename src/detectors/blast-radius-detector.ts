import type { DiffFile, Finding, FindingSeverity } from "../schema/index.js";
import type { FileGraph } from "../knowledge/index.js";
import type { Detector } from "./types.js";

interface ChangedCluster {
  paths: string[];
  roles: DiffFile["role"][];
}

export const blastRadiusDetector: Detector = {
  name: "blast-radius",
  run: ({ diff, context }) => {
    const graph = context?.knowledge?.getFileGraph();

    if (graph === undefined || diff.files.length < 2) {
      return [];
    }

    const clusters = clusterChangedFiles(diff.files, graph);

    if (clusters.length < 2) {
      return [];
    }

    const primaryCluster = clusters[0];

    return clusters
      .slice(1)
      .filter((cluster) => cluster !== primaryCluster)
      .map((cluster, index) => toFinding(cluster, index + 1));
  }
};

function clusterChangedFiles(files: DiffFile[], graph: FileGraph): ChangedCluster[] {
  const changedByPath = new Map(files.map((file) => [file.path, file]));
  const adjacency = new Map<string, Set<string>>();

  for (const file of files) {
    adjacency.set(file.path, new Set());
  }

  for (const edge of graph.edges) {
    if (!changedByPath.has(edge.from) || !changedByPath.has(edge.to)) {
      continue;
    }

    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }

  const visited = new Set<string>();
  const clusters: ChangedCluster[] = [];

  for (const file of files) {
    if (visited.has(file.path)) {
      continue;
    }

    const paths = walkCluster(file.path, adjacency, visited).sort();
    clusters.push({
      paths,
      roles: [...new Set(paths.map((path) => changedByPath.get(path)?.role ?? "unknown"))].sort()
    });
  }

  return clusters.sort(
    (left, right) =>
      right.paths.length - left.paths.length || left.paths[0]!.localeCompare(right.paths[0]!)
  );
}

function walkCluster(
  path: string,
  adjacency: Map<string, Set<string>>,
  visited: Set<string>
): string[] {
  const stack = [path];
  const cluster: string[] = [];

  while (stack.length > 0) {
    const current = stack.pop();

    if (current === undefined || visited.has(current)) {
      continue;
    }

    visited.add(current);
    cluster.push(current);

    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        stack.push(next);
      }
    }
  }

  return cluster;
}

function toFinding(cluster: ChangedCluster, index: number): Finding {
  return {
    id: `blast-radius:unexpected-cluster-${index}:${cluster.paths.join("|")}`,
    detector: "blast-radius",
    severity: getSeverity(cluster),
    confidence: 0.74,
    title: "Unexpected changed-file cluster",
    message: `The diff includes a separate changed-file cluster (${cluster.paths.join(", ")}) outside the primary blast radius.`,
    evidence: cluster.paths.map((path) => ({
      kind: "file",
      path,
      message: `Cluster role(s): ${cluster.roles.join(", ")}.`,
      data: {
        clusterSize: cluster.paths.length,
        roles: cluster.roles
      }
    })),
    repair:
      "Confirm this separate cluster belongs to the current task, or split it into a separate task with explicit intent.",
    tags: ["scope"]
  };
}

function getSeverity(cluster: ChangedCluster): FindingSeverity {
  return cluster.roles.some(
    (role) => role === "config" || role === "manifest" || role === "lockfile"
  )
    ? "medium"
    : "low";
}

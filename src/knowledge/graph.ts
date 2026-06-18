import { dirname, normalize } from "node:path";

import { classifyPath } from "../diff/index.js";
import type { FileGraph, FileGraphEdge, FileGraphNode, HistoryIndex } from "./types.js";

export interface FileGraphRunner {
  execFile: (file: string, args: string[], options?: { cwd?: string }) => string;
  readFile?: (path: string) => string;
}

export interface BuildFileGraphOptions {
  root: string;
  runner: FileGraphRunner;
  history?: HistoryIndex;
}

const sourcePathPattern = /\.(?:[cm]?[jt]sx?)$/;
const importPattern =
  /(?:import\s+(?:[^'"]+\s+from\s+)?|export\s+[^'"]+\s+from\s+|require\()\s*["']([^"']+)["']/g;

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

export function buildFileGraph(options: BuildFileGraphOptions): FileGraph {
  const files = getTrackedFiles(options);
  const sourceFiles = files.filter((path) => sourcePathPattern.test(path));
  const nodes = files.map((path) => ({
    path,
    role: classifyPath(path)
  }));
  const edgeMap = new Map<string, FileGraphEdge>();

  for (const file of sourceFiles) {
    addImportEdges(file, sourceFiles, options, edgeMap);
  }

  addPathEdges(files, edgeMap);
  addTestEdges(files, edgeMap);
  addHistoryEdges(options.history, edgeMap);

  return createFileGraph(nodes, [...edgeMap.values()]);
}

function addImportEdges(
  file: string,
  sourceFiles: string[],
  options: BuildFileGraphOptions,
  edgeMap: Map<string, FileGraphEdge>
): void {
  const sourceText = options.runner.readFile?.(toAbsolutePath(options.root, file)) ?? "";

  for (const match of sourceText.matchAll(importPattern)) {
    const specifier = match[1];

    if (specifier === undefined || !specifier.startsWith(".")) {
      continue;
    }

    const target = resolveImport(file, specifier, sourceFiles);

    if (target !== undefined) {
      setEdge(edgeMap, file, target, "import", 1, `Relative import ${specifier}.`);
    }
  }
}

function addPathEdges(files: string[], edgeMap: Map<string, FileGraphEdge>): void {
  const groups = new Map<string, string[]>();

  for (const file of files) {
    const key = file.split("/").slice(0, 2).join("/");

    if (key.length === 0) {
      continue;
    }

    groups.set(key, [...(groups.get(key) ?? []), file]);
  }

  for (const groupFiles of groups.values()) {
    for (const from of groupFiles) {
      for (const to of groupFiles) {
        if (from !== to) {
          setEdge(edgeMap, from, to, "path", 0.2, "Shared path prefix.");
        }
      }
    }
  }
}

function addTestEdges(files: string[], edgeMap: Map<string, FileGraphEdge>): void {
  const fileSet = new Set(files);

  for (const file of files) {
    const sourceCandidate = getSourceCandidateForTest(file);

    if (sourceCandidate !== undefined && fileSet.has(sourceCandidate)) {
      setEdge(edgeMap, file, sourceCandidate, "test", 0.9, "Test-source path relationship.");
      setEdge(edgeMap, sourceCandidate, file, "test", 0.9, "Source-test path relationship.");
    }
  }
}

function addHistoryEdges(
  history: HistoryIndex | undefined,
  edgeMap: Map<string, FileGraphEdge>
): void {
  for (const coChange of history?.coChanges ?? []) {
    for (const related of coChange.relatedPaths) {
      setEdge(
        edgeMap,
        coChange.path,
        related.path,
        "history",
        0.6,
        `Co-changed ${related.count} times.`
      );
    }
  }
}

function getTrackedFiles(options: BuildFileGraphOptions): string[] {
  try {
    return options.runner
      .execFile("git", ["ls-files"], { cwd: options.root })
      .split(/\r?\n/)
      .map((path) => path.trim().replaceAll("\\", "/"))
      .filter((path) => path.length > 0)
      .sort();
  } catch {
    return [];
  }
}

function resolveImport(file: string, specifier: string, sourceFiles: string[]): string | undefined {
  const basePath = normalize(`${dirname(file)}/${specifier}`).replaceAll("\\", "/");
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
    `${basePath}/index.js`,
    `${basePath}/index.jsx`
  ];
  const sourceFileSet = new Set(sourceFiles);

  return candidates.find((candidate) => sourceFileSet.has(candidate));
}

function getSourceCandidateForTest(file: string): string | undefined {
  const normalizedPath = file.replaceAll("\\", "/");

  if (!/(^|\/)(tests?|__tests__)\/|[._-](test|spec)\.[cm]?[jt]sx?$/.test(normalizedPath)) {
    return undefined;
  }

  return normalizedPath
    .replace(/^tests?\//, "src/")
    .replace(/(^|\/)__tests__\//, "$1")
    .replace(/[._-](test|spec)(\.[cm]?[jt]sx?)$/, "$2");
}

function toAbsolutePath(root: string, path: string): string {
  return normalize(`${root}/${path}`);
}

function setEdge(
  edgeMap: Map<string, FileGraphEdge>,
  from: string,
  to: string,
  kind: FileGraphEdge["kind"],
  weight: number,
  evidence: string
): void {
  const key = `${from}->${to}:${kind}`;

  if (edgeMap.has(key)) {
    return;
  }

  edgeMap.set(key, {
    from,
    to,
    kind,
    weight,
    evidence
  });
}

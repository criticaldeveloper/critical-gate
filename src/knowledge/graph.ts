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

interface TypeScriptPathConfig {
  baseUrl: string;
  mappings: Array<{ pattern: string; targets: string[] }>;
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
  const pathConfig = readTypeScriptPathConfig(options);

  for (const file of sourceFiles) {
    addImportEdges(file, sourceFiles, options, pathConfig, edgeMap);
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
  pathConfig: TypeScriptPathConfig | undefined,
  edgeMap: Map<string, FileGraphEdge>
): void {
  const sourceText = options.runner.readFile?.(toAbsolutePath(options.root, file)) ?? "";

  for (const match of sourceText.matchAll(importPattern)) {
    const specifier = match[1];

    if (specifier === undefined) {
      continue;
    }

    const resolved = specifier.startsWith(".")
      ? {
          target: resolveImport(file, specifier, sourceFiles),
          evidence: "Relative import " + specifier + "."
        }
      : resolvePathAlias(specifier, sourceFiles, pathConfig);

    if (resolved?.target !== undefined) {
      setEdge(edgeMap, file, resolved.target, "import", 1, resolved.evidence);
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
  return resolveSourceCandidate(basePath, sourceFiles);
}

function resolvePathAlias(
  specifier: string,
  sourceFiles: string[],
  config: TypeScriptPathConfig | undefined
): { target: string; evidence: string } | undefined {
  for (const mapping of config?.mappings ?? []) {
    const wildcard = matchAliasPattern(specifier, mapping.pattern);

    if (wildcard === undefined) continue;

    for (const targetPattern of mapping.targets) {
      const mappedTarget = targetPattern.replace("*", wildcard);
      const basePath = normalize((config?.baseUrl ?? ".") + "/" + mappedTarget)
        .replaceAll("\\", "/")
        .replace(/^\.\//, "");
      const target = resolveSourceCandidate(basePath, sourceFiles);

      if (target !== undefined) {
        return {
          target,
          evidence: "TypeScript path alias " + mapping.pattern + " -> " + targetPattern + "."
        };
      }
    }
  }

  return undefined;
}

function matchAliasPattern(specifier: string, pattern: string): string | undefined {
  const wildcardIndex = pattern.indexOf("*");

  if (wildcardIndex === -1) return specifier === pattern ? "" : undefined;

  const prefix = pattern.slice(0, wildcardIndex);
  const suffix = pattern.slice(wildcardIndex + 1);

  return specifier.startsWith(prefix) && specifier.endsWith(suffix)
    ? specifier.slice(prefix.length, specifier.length - suffix.length)
    : undefined;
}

function resolveSourceCandidate(basePath: string, sourceFiles: string[]): string | undefined {
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

function readTypeScriptPathConfig(
  options: BuildFileGraphOptions
): TypeScriptPathConfig | undefined {
  try {
    const content = options.runner.readFile?.(toAbsolutePath(options.root, "tsconfig.json"));
    if (content === undefined) return undefined;

    const parsed = JSON.parse(sanitizeJsonc(content)) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.compilerOptions)) return undefined;

    const paths = parsed.compilerOptions.paths;
    const mappings = isRecord(paths)
      ? Object.entries(paths)
          .filter((entry): entry is [string, string[]] => isStringArrayEntry(entry))
          .map(([pattern, targets]) => ({ pattern, targets }))
      : [];

    if (mappings.length === 0) return undefined;

    return {
      baseUrl:
        typeof parsed.compilerOptions.baseUrl === "string" ? parsed.compilerOptions.baseUrl : ".",
      mappings
    };
  } catch {
    return undefined;
  }
}

function sanitizeJsonc(value: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < value.length; index += 1) {
    const current = value[index] ?? "";
    const next = value[index + 1] ?? "";

    if (lineComment) {
      if (current === "\n") {
        lineComment = false;
        result += current;
      } else result += " ";
      continue;
    }

    if (blockComment) {
      if (current === "*" && next === "/") {
        blockComment = false;
        result += "  ";
        index += 1;
      } else result += current === "\n" ? "\n" : " ";
      continue;
    }

    if (!inString && current === "/" && next === "/") {
      lineComment = true;
      result += "  ";
      index += 1;
      continue;
    }

    if (!inString && current === "/" && next === "*") {
      blockComment = true;
      result += "  ";
      index += 1;
      continue;
    }

    result += current;
    if (inString && current === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if (current === '"' && !escaped) inString = !inString;
    escaped = false;
  }

  return removeTrailingJsonCommas(result);
}

function removeTrailingJsonCommas(value: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const current = value[index] ?? "";

    if (!inString && current === ",") {
      let nextIndex = index + 1;
      while (/\s/u.test(value[nextIndex] ?? "")) nextIndex += 1;
      if (value[nextIndex] === "}" || value[nextIndex] === "]") continue;
    }

    result += current;
    if (inString && current === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if (current === '"' && !escaped) inString = !inString;
    escaped = false;
  }

  return result;
}

function isStringArrayEntry(entry: [string, unknown]): entry is [string, string[]] {
  return Array.isArray(entry[1]) && entry[1].every((value) => typeof value === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

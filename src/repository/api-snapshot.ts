import { dirname, join } from "node:path";

import type { DiffFile } from "../schema/index.js";

export const API_SURFACE_SNAPSHOT_PATH = ".critical-gate/api-surface.json";
export const API_SURFACE_SNAPSHOT_SCHEMA_VERSION = "1.0" as const;

export interface ApiSurfaceSnapshot {
  schemaVersion: typeof API_SURFACE_SNAPSHOT_SCHEMA_VERSION;
  generatedAt: string;
  entrypoints: string[];
  exports: ApiSurfaceExport[];
}

export interface ApiSurfaceExport {
  path: string;
  name: string;
  kind:
    | "function"
    | "class"
    | "interface"
    | "type"
    | "enum"
    | "const"
    | "var"
    | "reexport"
    | "default";
  signature: string;
  source?: string;
}

export interface ApiSurfaceSnapshotSummary {
  path: string;
  schemaVersion: string;
  exportCount: number;
  entrypoints: string[];
}

export interface ApiSnapshotReader {
  exists?: (path: string) => boolean;
  readFile?: (path: string) => string;
}

export interface BuildApiSurfaceSnapshotOptions {
  root: string;
  generatedAt: Date;
  entrypoints?: string[];
  reader?: ApiSnapshotReader;
}

const packageEntrypointKeys = ["main", "module", "types", "typings", "browser"] as const;
const fallbackEntrypoints = ["src/index.ts", "src/index.tsx", "index.ts", "index.tsx", "index.js"];

const declaredExportPattern =
  /^\s*export\s+(?:async\s+)?(?:declare\s+)?(function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)([^\n]*)/gm;
const namedExportPattern = /^\s*export\s*\{([^}]+)\}(?:\s*from\s*["']([^"']+)["'])?/gm;
const defaultExportPattern =
  /^\s*export\s+default\s+(?:async\s+)?(?:(function|class)\s+([A-Za-z_$][\w$]*)?|([A-Za-z_$][\w$]*))?/gm;

export function buildApiSurfaceSnapshot({
  root,
  generatedAt,
  entrypoints,
  reader = {}
}: BuildApiSurfaceSnapshotOptions): ApiSurfaceSnapshot {
  const resolvedEntrypoints = normalizeEntrypoints(
    entrypoints !== undefined && entrypoints.length > 0
      ? entrypoints
      : inferPublicEntrypoints(root, reader)
  );

  const exports = resolvedEntrypoints
    .flatMap((entrypoint) => {
      const absolutePath = join(root, entrypoint);

      if (reader.exists?.(absolutePath) === false) {
        return [];
      }

      const sourceText = reader.readFile?.(absolutePath);

      if (sourceText === undefined) {
        return [];
      }

      return extractApiSurfaceExports(entrypoint, sourceText);
    })
    .sort(compareExports);

  return {
    schemaVersion: API_SURFACE_SNAPSHOT_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    entrypoints: resolvedEntrypoints,
    exports
  };
}

export function loadApiSurfaceSnapshot(
  root: string,
  reader: ApiSnapshotReader = {}
): ApiSurfaceSnapshot | undefined {
  const path = join(root, API_SURFACE_SNAPSHOT_PATH);

  if (reader.exists?.(path) !== true) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(reader.readFile?.(path) ?? "");

    if (!isApiSurfaceSnapshot(parsed)) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
}

export function summarizeApiSurfaceSnapshot(
  snapshot: ApiSurfaceSnapshot | undefined
): ApiSurfaceSnapshotSummary | undefined {
  if (snapshot === undefined) {
    return undefined;
  }

  return {
    path: API_SURFACE_SNAPSHOT_PATH,
    schemaVersion: snapshot.schemaVersion,
    exportCount: snapshot.exports.length,
    entrypoints: snapshot.entrypoints
  };
}

export function extractApiSurfaceExports(path: string, sourceText: string): ApiSurfaceExport[] {
  const exports: ApiSurfaceExport[] = [];

  for (const match of sourceText.matchAll(declaredExportPattern)) {
    const kind = normalizeExportKind(match[1] ?? "const");
    const name = match[2];

    if (name === undefined) {
      continue;
    }

    exports.push({
      path,
      name,
      kind,
      signature: normalizeSignature(match[0])
    });
  }

  for (const match of sourceText.matchAll(namedExportPattern)) {
    const exportedNames = match[1] ?? "";
    const source = match[2];

    for (const rawName of exportedNames.split(",")) {
      const name = normalizeNamedExport(rawName);

      if (name.length === 0) {
        continue;
      }

      exports.push({
        path,
        name,
        kind: "reexport",
        signature: normalizeSignature(match[0]),
        source
      });
    }
  }

  for (const match of sourceText.matchAll(defaultExportPattern)) {
    exports.push({
      path,
      name: "default",
      kind: "default",
      signature: normalizeSignature(match[0])
    });
  }

  return dedupeExports(exports).sort(compareExports);
}

export function findSnapshotExport(
  snapshot: ApiSurfaceSnapshot,
  path: string,
  name: string
): ApiSurfaceExport | undefined {
  return snapshot.exports.find((entry) => entry.path === path && entry.name === name);
}

export function hasApiSnapshotEvidence(files: DiffFile[]): boolean {
  return files.some((file) => normalizePath(file.path) === API_SURFACE_SNAPSHOT_PATH);
}

function inferPublicEntrypoints(root: string, reader: ApiSnapshotReader): string[] {
  const packageJson = readPackageJson(root, reader);
  const entrypoints = new Set<string>();

  if (isRecord(packageJson)) {
    for (const key of packageEntrypointKeys) {
      addEntrypointValue(entrypoints, packageJson[key]);
    }

    addEntrypointValue(entrypoints, packageJson.exports);
  }

  for (const fallback of fallbackEntrypoints) {
    if (reader.exists?.(join(root, fallback)) === true) {
      entrypoints.add(fallback);
    }
  }

  return [...entrypoints];
}

function readPackageJson(root: string, reader: ApiSnapshotReader): unknown {
  const path = join(root, "package.json");

  if (reader.exists?.(path) !== true) {
    return undefined;
  }

  try {
    return JSON.parse(reader.readFile?.(path) ?? "");
  } catch {
    return undefined;
  }
}

function addEntrypointValue(entrypoints: Set<string>, value: unknown): void {
  if (typeof value === "string") {
    const normalized = normalizeEntrypoint(value);

    if (isSourceLikeEntrypoint(normalized)) {
      entrypoints.add(normalized);
    }

    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      addEntrypointValue(entrypoints, item);
    }

    return;
  }

  if (isRecord(value)) {
    for (const nested of Object.values(value)) {
      addEntrypointValue(entrypoints, nested);
    }
  }
}

function normalizeEntrypoints(entrypoints: string[]): string[] {
  return [...new Set(entrypoints.map(normalizeEntrypoint).filter(Boolean))].sort();
}

function normalizeEntrypoint(path: string): string {
  return normalizePath(path.replace(/^\.\//, ""));
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function isSourceLikeEntrypoint(path: string): boolean {
  const extension = path.split(".").pop();

  if (extension === undefined) {
    return false;
  }

  return ["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs"].includes(extension);
}

function normalizeExportKind(kind: string): ApiSurfaceExport["kind"] {
  return kind === "let" ? "var" : (kind as ApiSurfaceExport["kind"]);
}

function normalizeNamedExport(rawName: string): string {
  const cleaned = rawName.trim();
  const aliasMatch = /\s+as\s+([A-Za-z_$][\w$]*)$/u.exec(cleaned);

  return aliasMatch?.[1] ?? cleaned.replace(/\s+as\s+.*/u, "").trim();
}

function normalizeSignature(signature: string): string {
  return signature.replace(/\s+/g, " ").trim();
}

function dedupeExports(exports: ApiSurfaceExport[]): ApiSurfaceExport[] {
  const byKey = new Map<string, ApiSurfaceExport>();

  for (const entry of exports) {
    byKey.set(`${entry.path}:${entry.name}:${entry.signature}`, entry);
  }

  return [...byKey.values()];
}

function compareExports(left: ApiSurfaceExport, right: ApiSurfaceExport): number {
  return (
    left.path.localeCompare(right.path) ||
    left.name.localeCompare(right.name) ||
    left.signature.localeCompare(right.signature)
  );
}

function isApiSurfaceSnapshot(value: unknown): value is ApiSurfaceSnapshot {
  return (
    isRecord(value) &&
    value.schemaVersion === API_SURFACE_SNAPSHOT_SCHEMA_VERSION &&
    Array.isArray(value.entrypoints) &&
    value.entrypoints.every((entrypoint) => typeof entrypoint === "string") &&
    Array.isArray(value.exports) &&
    value.exports.every(isApiSurfaceExport)
  );
}

function isApiSurfaceExport(value: unknown): value is ApiSurfaceExport {
  return (
    isRecord(value) &&
    typeof value.path === "string" &&
    typeof value.name === "string" &&
    typeof value.kind === "string" &&
    typeof value.signature === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getApiSnapshotOutputPath(root: string, output?: string): string {
  return output ?? join(root, API_SURFACE_SNAPSHOT_PATH);
}

export function getApiSnapshotOutputDirectory(path: string): string {
  return dirname(path);
}

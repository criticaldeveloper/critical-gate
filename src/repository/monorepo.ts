import { join } from "node:path";

import type { DiffFile, MonorepoContext, MonorepoPackage } from "../schema/index.js";

export interface MonorepoReader {
  exists?: (path: string) => boolean;
  readFile?: (path: string) => string;
}

type MonorepoTool = NonNullable<MonorepoContext["tools"]>[number];

export function detectMonorepoContext(
  root: string,
  files: DiffFile[],
  reader: MonorepoReader = {}
): MonorepoContext | undefined {
  const workspaceGlobs: string[] = [];
  const tools = new Set<MonorepoTool>();
  const configFiles: string[] = [];
  const typescriptPathAliases: string[] = [];

  const rootPackage = readJsonFile(root, "package.json", reader);
  const packageWorkspaceGlobs = getPackageJsonWorkspaces(rootPackage);

  if (packageWorkspaceGlobs.length > 0) {
    workspaceGlobs.push(...packageWorkspaceGlobs);
  }

  const pnpmWorkspace = readTextFile(root, "pnpm-workspace.yaml", reader);
  if (pnpmWorkspace !== undefined) {
    tools.add("pnpm");
    configFiles.push("pnpm-workspace.yaml");
    workspaceGlobs.push(...parsePnpmWorkspacePackages(pnpmWorkspace));
  }

  const turboJson = readJsonFile(root, "turbo.json", reader);
  if (turboJson !== undefined) {
    tools.add("turbo");
    configFiles.push("turbo.json");
  }

  const nxJson = readJsonFile(root, "nx.json", reader);
  if (nxJson !== undefined) {
    tools.add("nx");
    configFiles.push("nx.json");
    workspaceGlobs.push(...getNxWorkspaceGlobs(nxJson));
  }

  const lernaJson = readJsonFile(root, "lerna.json", reader);
  if (lernaJson !== undefined) {
    tools.add("lerna");
    configFiles.push("lerna.json");
    workspaceGlobs.push(...getStringArrayProperty(lernaJson, "packages"));
  }

  const tsconfigJson = readJsonFile(root, "tsconfig.json", reader);
  const pathAliases = getTypeScriptPathAliases(tsconfigJson);
  if (pathAliases.length > 0) {
    configFiles.push("tsconfig.json");
    typescriptPathAliases.push(...pathAliases);
  }

  const uniqueGlobs = [...new Set(workspaceGlobs)].filter((glob) => glob.length > 0);
  const packages = inferChangedPackages(root, files, uniqueGlobs, reader);

  if (
    uniqueGlobs.length === 0 &&
    tools.size === 0 &&
    packages.length === 0 &&
    typescriptPathAliases.length === 0
  ) {
    return undefined;
  }

  return {
    tools: [...tools].sort(),
    configFiles: [...new Set(configFiles)],
    workspaceGlobs: uniqueGlobs,
    typescriptPathAliases:
      typescriptPathAliases.length === 0 ? undefined : [...new Set(typescriptPathAliases)].sort(),
    packages
  };
}

function inferChangedPackages(
  root: string,
  files: DiffFile[],
  workspaceGlobs: string[],
  reader: MonorepoReader
): MonorepoPackage[] {
  const packageRoots = new Set<string>();

  for (const file of files) {
    for (const glob of workspaceGlobs) {
      const packageRoot = getPackageRootForGlob(file.path, glob);

      if (packageRoot !== undefined) {
        packageRoots.add(packageRoot);
      }
    }
  }

  return [...packageRoots].sort().map((path) => ({
    path,
    name: getPackageName(root, path, reader)
  }));
}

function getPackageRootForGlob(path: string, glob: string): string | undefined {
  const normalizedPath = normalizePath(path);
  const normalizedGlob = normalizePath(glob);
  const wildcardIndex = normalizedGlob.indexOf("*");

  if (wildcardIndex === -1) {
    return normalizedPath === normalizedGlob || normalizedPath.startsWith(`${normalizedGlob}/`)
      ? normalizedGlob
      : undefined;
  }

  const prefix = normalizedGlob.slice(0, wildcardIndex).replace(/\/$/, "");
  const suffix = normalizedGlob.slice(wildcardIndex + 1).replace(/^\//, "");

  if (!normalizedPath.startsWith(`${prefix}/`)) {
    return undefined;
  }

  const rest = normalizedPath.slice(prefix.length + 1);
  const [packageSegment] = rest.split("/");

  if (packageSegment === undefined || packageSegment.length === 0) {
    return undefined;
  }

  const packageRoot = `${prefix}/${packageSegment}`;

  if (suffix.length > 0 && !normalizedPath.startsWith(`${packageRoot}/${suffix}`)) {
    return undefined;
  }

  return packageRoot;
}

function getPackageName(
  root: string,
  packageRoot: string,
  reader: MonorepoReader
): string | undefined {
  const packageJson = readJsonFile(root, `${packageRoot}/package.json`, reader);

  if (isRecord(packageJson) && typeof packageJson.name === "string") {
    return packageJson.name;
  }

  return undefined;
}

function getPackageJsonWorkspaces(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  if (Array.isArray(value.workspaces)) {
    return value.workspaces.filter((entry): entry is string => typeof entry === "string");
  }

  if (isRecord(value.workspaces) && Array.isArray(value.workspaces.packages)) {
    return value.workspaces.packages.filter((entry): entry is string => typeof entry === "string");
  }

  return [];
}

function getNxWorkspaceGlobs(value: unknown): string[] {
  if (!isRecord(value) || !isRecord(value.workspaceLayout)) {
    return ["apps/*", "libs/*"];
  }

  const appsDir =
    typeof value.workspaceLayout.appsDir === "string" ? value.workspaceLayout.appsDir : "apps";
  const libsDir =
    typeof value.workspaceLayout.libsDir === "string" ? value.workspaceLayout.libsDir : "libs";

  return [`${appsDir}/*`, `${libsDir}/*`];
}

function getStringArrayProperty(value: unknown, key: string): string[] {
  if (!isRecord(value) || !Array.isArray(value[key])) {
    return [];
  }

  return value[key].filter((entry): entry is string => typeof entry === "string");
}

function getTypeScriptPathAliases(value: unknown): string[] {
  if (
    !isRecord(value) ||
    !isRecord(value.compilerOptions) ||
    !isRecord(value.compilerOptions.paths)
  ) {
    return [];
  }

  return Object.keys(value.compilerOptions.paths).sort();
}

function parsePnpmWorkspacePackages(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const packages: string[] = [];
  let inPackages = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }

    if (inPackages && line.startsWith("-")) {
      packages.push(
        line
          .slice(1)
          .trim()
          .replace(/^["']|["']$/g, "")
      );
      continue;
    }

    if (!rawLine.startsWith(" ") && !rawLine.startsWith("\t")) {
      inPackages = false;
    }
  }

  return packages;
}

function readJsonFile(root: string, relativePath: string, reader: MonorepoReader): unknown {
  const content = readTextFile(root, relativePath, reader);

  if (content === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }
}

function readTextFile(
  root: string,
  relativePath: string,
  reader: MonorepoReader
): string | undefined {
  const path = join(root, relativePath);

  if (reader.exists?.(path) !== true) {
    return undefined;
  }

  return reader.readFile?.(path);
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

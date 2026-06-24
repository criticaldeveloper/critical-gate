import type { DiffFile } from "../schema/index.js";

const dependencyLinePattern = /^\s*"([^"]+)":\s*"([^"]+)"/;
const dependencySectionPattern =
  /^\s*"(dependencies|devDependencies|peerDependencies|optionalDependencies)":\s*\{/;
const lockfilePathPattern =
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lock|bun\.lockb)$/;
const nonDependencyManifestKeys = new Set([
  "name",
  "version",
  "description",
  "type",
  "license",
  "author",
  "private",
  "packageManager"
]);

export function isExplicitPackageUpgradeDiff(taskText: string, files: DiffFile[]): boolean {
  const changedDependencies = getChangedManifestDependencies(files);

  return (
    changedDependencies.length > 0 &&
    changedDependencies.some((dependency) => taskMentionsPackageUpgrade(taskText, dependency.name))
  );
}

export function isManifestOrLockfilePath(path: string): boolean {
  return (
    path === "package.json" || path.endsWith("/package.json") || lockfilePathPattern.test(path)
  );
}

export function isPackageManifestPath(path: string): boolean {
  return path === "package.json" || path.endsWith("/package.json");
}

function getChangedManifestDependencies(files: DiffFile[]): Array<{ name: string }> {
  return files
    .filter((file) => isPackageManifestPath(file.path))
    .flatMap((file) => getChangedDependencies(file));
}

function getChangedDependencies(file: DiffFile): Array<{ name: string }> {
  const beforeDependencies = mergeDependencyVersions(
    extractChangedDependencyVersions(file, "before"),
    extractChangedDependencyVersionsFromChangedLines(file, "before")
  );
  const afterDependencies = mergeDependencyVersions(
    extractChangedDependencyVersions(file, "after"),
    extractChangedDependencyVersionsFromChangedLines(file, "after")
  );
  const names = new Set([...beforeDependencies.keys(), ...afterDependencies.keys()]);

  return [...names]
    .filter((name) => beforeDependencies.get(name) !== afterDependencies.get(name))
    .map((name) => ({ name }));
}

function mergeDependencyVersions(
  primary: Map<string, string>,
  fallback: Map<string, string>
): Map<string, string> {
  return new Map([...fallback, ...primary]);
}

function extractChangedDependencyVersions(
  file: DiffFile,
  side: "before" | "after"
): Map<string, string> {
  const dependencies = new Map<string, string>();

  for (const hunk of file.hunks) {
    let inDependencySection = false;

    for (const line of hunk.lines) {
      if (!belongsToManifestSide(line.kind, side)) {
        continue;
      }

      if (dependencySectionPattern.test(line.content)) {
        inDependencySection = true;
        continue;
      }

      if (line.kind === "context" && line.content.trim() === "}") {
        inDependencySection = false;
        continue;
      }

      if (!inDependencySection) {
        continue;
      }

      const dependency = dependencyLinePattern.exec(line.content);

      if (dependency !== null) {
        dependencies.set(dependency[1], dependency[2]);
      }
    }
  }

  return dependencies;
}

function extractChangedDependencyVersionsFromChangedLines(
  file: DiffFile,
  side: "before" | "after"
): Map<string, string> {
  const dependencies = new Map<string, string>();
  const expectedKind = side === "before" ? "delete" : "add";

  for (const line of file.hunks.flatMap((hunk) => hunk.lines)) {
    if (line.kind !== expectedKind) {
      continue;
    }

    const dependency = dependencyLinePattern.exec(line.content);

    if (dependency !== null && isPlausibleDependencyKey(dependency[1])) {
      dependencies.set(dependency[1], dependency[2]);
    }
  }

  return dependencies;
}

function belongsToManifestSide(kind: "add" | "delete" | "context", side: "before" | "after") {
  return kind === "context" || (side === "before" ? kind === "delete" : kind === "add");
}

function isPlausibleDependencyKey(key: string): boolean {
  return !nonDependencyManifestKeys.has(key);
}

function taskMentionsPackageUpgrade(taskText: string, dependencyName: string): boolean {
  const normalizedTask = normalizeDependencyText(taskText);
  const normalizedDependency = normalizeDependencyText(dependencyName);

  if (!/\b(?:upgrade|upgraded|bump|bumped|update|updated)\b/.test(normalizedTask)) {
    return false;
  }

  return (
    normalizedTask.includes(normalizedDependency) ||
    normalizedDependency
      .split(" ")
      .filter((part) => part.length > 2)
      .every((part) => normalizedTask.includes(part))
  );
}

function normalizeDependencyText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[@/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

import { join } from "node:path";

import type { UtilityEntry, UtilityIndex } from "../schema/index.js";
import type { SolutionClass, SolutionEntry, SolutionIndex } from "./types.js";

export interface SolutionIndexRunner {
  execFile: (file: string, args: string[], options?: { cwd?: string }) => string;
  readFile?: (path: string) => string;
}

export interface BuildSolutionIndexOptions {
  root: string;
  runner: SolutionIndexRunner;
}

const sourcePathPattern = /\.(?:[cm]?[jt]sx?)$/;
const exportDeclarationPattern =
  /^\s*export\s+(?:async\s+)?(?:declare\s+)?(?:function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
const namedExportPattern = /^\s*export\s*\{([^}]+)\}/gm;

const solutionPathPatterns: Array<{ class: SolutionClass; pattern: RegExp }> = [
  { class: "utility", pattern: /(^|\/)(utils?|helpers?|lib|shared)\//i },
  { class: "hook", pattern: /(^|\/)hooks?\//i },
  { class: "service", pattern: /(^|\/)services?\//i },
  { class: "query", pattern: /(^|\/)(queries|api)\//i },
  { class: "validator", pattern: /(^|\/)(validators?|validation)\//i },
  { class: "schema", pattern: /(^|\/)schemas?\//i },
  { class: "adapter", pattern: /(^|\/)adapters?\//i }
];

export function buildSolutionIndex(options: BuildSolutionIndexOptions): SolutionIndex {
  const solutions = getTrackedSourceFiles(options)
    .flatMap((path) => toSolutionEntries(path, options))
    .sort(
      (left, right) =>
        left.path.localeCompare(right.path) ||
        left.class.localeCompare(right.class) ||
        left.normalizedName.localeCompare(right.normalizedName)
    );

  return {
    solutions,
    utilityIndex: solutionIndexToUtilityIndex({ solutions })
  };
}

export function solutionIndexToUtilityIndex(index: SolutionIndex): UtilityIndex {
  const utilityMap = new Map<string, Set<string>>();

  for (const solution of index.solutions) {
    if (solution.class !== "utility" || solution.exportedName === undefined) {
      continue;
    }

    const exportedNames = utilityMap.get(solution.path) ?? new Set<string>();
    exportedNames.add(solution.exportedName);
    utilityMap.set(solution.path, exportedNames);
  }

  return {
    utilities: [...utilityMap.entries()]
      .map(
        ([path, exportedNames]): UtilityEntry => ({
          path,
          exportedNames: [...exportedNames].sort()
        })
      )
      .sort((left, right) => left.path.localeCompare(right.path))
  };
}

export function extractExportedNames(sourceText: string): string[] {
  const names = new Set<string>();

  for (const match of sourceText.matchAll(exportDeclarationPattern)) {
    const name = match[1];
    if (name !== undefined) {
      names.add(name);
    }
  }

  for (const match of sourceText.matchAll(namedExportPattern)) {
    const exportedNames = match[1] ?? "";
    for (const rawName of exportedNames.split(",")) {
      const name = rawName
        .trim()
        .split(/\s+as\s+/i)[0]
        ?.trim();
      if (name !== undefined && name.length > 0) {
        names.add(name);
      }
    }
  }

  return [...names].sort();
}

function getTrackedSourceFiles(options: BuildSolutionIndexOptions): string[] {
  try {
    return options.runner
      .execFile("git", ["ls-files"], { cwd: options.root })
      .split(/\r?\n/)
      .map((path) => path.trim())
      .filter((path) => sourcePathPattern.test(path));
  } catch {
    return [];
  }
}

function toSolutionEntries(path: string, options: BuildSolutionIndexOptions): SolutionEntry[] {
  const solutionClass = classifySolutionPath(path);

  if (solutionClass === undefined) {
    return [];
  }

  const sourceText = options.runner.readFile?.(join(options.root, path)) ?? "";
  const exportedNames = extractExportedNames(sourceText);

  return exportedNames.map((exportedName) => ({
    path,
    class: solutionClass,
    normalizedName: normalizeName(exportedName),
    exportedName,
    importTokens: [],
    domainTokens: pathToDomainTokens(path, exportedName)
  }));
}

function classifySolutionPath(path: string): SolutionClass | undefined {
  return solutionPathPatterns.find((entry) => entry.pattern.test(path))?.class;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function pathToDomainTokens(path: string, exportedName: string): string[] {
  return [
    ...new Set(
      [...path.split(/[/.\\_-]+/), ...exportedName.split(/(?=[A-Z])|[_-]+/)].map(normalizeName)
    )
  ]
    .filter((token) => token.length > 0)
    .sort();
}

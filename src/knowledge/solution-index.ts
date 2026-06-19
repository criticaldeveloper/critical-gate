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
const importTokenPattern = /^\s*(?:import|export)\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']/gm;
const exportedFunctionPattern =
  /^\s*export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?/m;
const exportedConstFunctionPattern =
  /^\s*export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*(?::\s*([^=]+))?\s*=>/m;

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
  const importCounts = collectImportCounts(options);
  const solutions = getTrackedSourceFiles(options)
    .flatMap((path) => toSolutionEntries(path, options, importCounts))
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

function toSolutionEntries(
  path: string,
  options: BuildSolutionIndexOptions,
  importCounts: Map<string, number>
): SolutionEntry[] {
  const sourceText = options.runner.readFile?.(join(options.root, path)) ?? "";
  return extractSolutionEntries(path, sourceText).map((entry) => ({
    ...entry,
    importCount: importCounts.get(entry.exportedName ?? entry.normalizedName) ?? 0
  }));
}

export function extractSolutionEntries(path: string, sourceText: string): SolutionEntry[] {
  const solutionClass = classifySolutionPath(path);

  if (solutionClass === undefined) {
    return [];
  }

  const exportedNames = extractExportedNames(sourceText);
  const importTokens = extractImportTokens(sourceText);

  return exportedNames.map((exportedName) => {
    const metadata = getExportMetadata(sourceText, exportedName);

    return {
      path,
      class: solutionClass,
      normalizedName: normalizeName(exportedName),
      exportedName,
      arity: metadata.arity,
      returnType: metadata.returnType,
      signatureShape: toSignatureShape(metadata.arity, metadata.returnType),
      importTokens,
      domainTokens: pathToDomainTokens(path, exportedName)
    };
  });
}

function collectImportCounts(options: BuildSolutionIndexOptions): Map<string, number> {
  const counts = new Map<string, number>();

  try {
    const output = options.runner.execFile("git", ["grep", "-h", "-E", "\\bimport\\b"], {
      cwd: options.root
    });

    for (const line of output.split(/\r?\n/)) {
      for (const importedName of extractImportedNames(line)) {
        counts.set(importedName, (counts.get(importedName) ?? 0) + 1);
      }
    }
  } catch {
    return counts;
  }

  return counts;
}

function extractImportedNames(line: string): string[] {
  const namedImport = /\bimport\s*\{([^}]+)\}/.exec(line);

  if (namedImport !== null) {
    return (namedImport[1] ?? "")
      .split(",")
      .map((entry) =>
        entry
          .trim()
          .split(/\s+as\s+/i)[0]
          ?.trim()
      )
      .filter((entry): entry is string => entry !== undefined && entry.length > 0);
  }

  const defaultImport = /\bimport\s+([A-Za-z_$][\w$]*)\s+from\b/.exec(line);

  return defaultImport?.[1] === undefined ? [] : [defaultImport[1]];
}

function classifySolutionPath(path: string): SolutionClass | undefined {
  return solutionPathPatterns.find((entry) => entry.pattern.test(path))?.class;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function extractImportTokens(sourceText: string): string[] {
  const tokens = new Set<string>();

  for (const match of sourceText.matchAll(importTokenPattern)) {
    const specifier = match[1];

    if (specifier === undefined) {
      continue;
    }

    for (const token of specifier.split(/[/.\\_-]+/).map(normalizeName)) {
      if (token.length > 0) {
        tokens.add(token);
      }
    }
  }

  return [...tokens].sort();
}

function getExportMetadata(
  sourceText: string,
  exportedName: string
): { arity?: number; returnType?: string } {
  const functionMatch = findNamedMatch(sourceText, exportedFunctionPattern, exportedName);

  if (functionMatch !== undefined) {
    return {
      arity: countParameters(functionMatch[2] ?? ""),
      returnType: normalizeReturnType(functionMatch[3])
    };
  }

  const constFunctionMatch = findNamedMatch(sourceText, exportedConstFunctionPattern, exportedName);

  if (constFunctionMatch !== undefined) {
    return {
      arity: countParameters(constFunctionMatch[2] ?? constFunctionMatch[3] ?? ""),
      returnType: normalizeReturnType(constFunctionMatch[4])
    };
  }

  return {};
}

function findNamedMatch(
  sourceText: string,
  pattern: RegExp,
  exportedName: string
): RegExpExecArray | undefined {
  for (const match of sourceText.matchAll(new RegExp(pattern.source, "gm"))) {
    if (match[1] === exportedName) {
      return match;
    }
  }

  return undefined;
}

function countParameters(parameterText: string): number {
  const trimmed = parameterText.trim();

  if (trimmed.length === 0) {
    return 0;
  }

  return trimmed.split(",").filter((parameter) => parameter.trim().length > 0).length;
}

function normalizeReturnType(returnType: string | undefined): string | undefined {
  const normalized = returnType?.trim().replace(/\s+/g, " ");
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}

function toSignatureShape(arity: number | undefined, returnType: string | undefined): string {
  const parameterShape = arity === undefined ? "unknown parameters" : `${arity} parameter(s)`;
  return returnType === undefined ? parameterShape : `${parameterShape} -> ${returnType}`;
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

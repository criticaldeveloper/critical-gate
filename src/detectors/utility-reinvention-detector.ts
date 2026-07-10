import { extractExportedNames } from "../repository/index.js";
import type { DiffFile, Finding, UtilityEntry } from "../schema/index.js";

import type { Detector } from "./types.js";

const utilityPathPattern = /(^|\/)(utils?|helpers?|lib|shared)\//i;

export const utilityReinventionDetector: Detector = {
  name: "utility-reinvention",
  maturity: "experimental",
  run: ({ diff, context }) => {
    const existingUtilities =
      context?.utilityIndex?.utilities ??
      context?.knowledge?.getSolutionIndex().utilityIndex?.utilities ??
      [];

    if (existingUtilities.length === 0) {
      return [];
    }

    return diff.files
      .filter(isNewUtilityFile)
      .flatMap((file) => detectReinvention(file, existingUtilities));
  }
};

function isNewUtilityFile(file: DiffFile): boolean {
  return file.status === "added" && file.role === "source" && utilityPathPattern.test(file.path);
}

function detectReinvention(file: DiffFile, existingUtilities: UtilityEntry[]): Finding[] {
  const sourceText = file.hunks
    .flatMap((hunk) => hunk.lines.filter((line) => line.kind === "add").map((line) => line.content))
    .join("\n");
  const newExports = extractExportedNames(sourceText);

  return newExports.flatMap((exportedName) => {
    const matchingUtility = findSimilarUtility(exportedName, existingUtilities, file.path);

    if (matchingUtility === undefined) {
      return [];
    }

    return [toFinding(file, exportedName, matchingUtility)];
  });
}

function findSimilarUtility(
  exportedName: string,
  existingUtilities: UtilityEntry[],
  currentPath: string
): { entry: UtilityEntry; existingName: string } | undefined {
  const normalizedNewName = normalizeName(exportedName);

  for (const entry of existingUtilities) {
    if (entry.path === currentPath) {
      continue;
    }

    for (const existingName of entry.exportedNames) {
      const normalizedExistingName = normalizeName(existingName);

      if (
        normalizedNewName === normalizedExistingName ||
        normalizedNewName.includes(normalizedExistingName) ||
        normalizedExistingName.includes(normalizedNewName)
      ) {
        return { entry, existingName };
      }
    }
  }

  return undefined;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function toFinding(
  file: DiffFile,
  exportedName: string,
  match: { entry: UtilityEntry; existingName: string }
): Finding {
  return {
    id: `utility-reinvention:${file.path}:${exportedName}`,
    detector: "utility-reinvention",
    severity: "medium",
    confidence: 0.78,
    title: "New utility may duplicate existing helper",
    message: `${exportedName} was added in ${file.path}, but ${match.existingName} already exists in ${match.entry.path}.`,
    evidence: [
      {
        kind: "symbol",
        path: file.path,
        symbol: exportedName,
        message: `Existing utility candidate: ${match.entry.path}#${match.existingName}`,
        data: {
          newExport: exportedName,
          existingExport: match.existingName,
          existingPath: match.entry.path
        }
      }
    ],
    repair: `Reuse ${match.existingName} from ${match.entry.path}, or document why a separate helper is needed.`,
    tags: ["utility"]
  };
}

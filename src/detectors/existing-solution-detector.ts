import { extractSolutionEntries, type SolutionEntry } from "../knowledge/index.js";
import type { DiffFile, Finding } from "../schema/index.js";
import type { Detector } from "./types.js";

interface SolutionMatch {
  existing: SolutionEntry;
  added: SolutionEntry;
  confidence: number;
  reason: string;
}

export const existingSolutionDetector: Detector = {
  name: "existing-solution",
  maturity: "experimental",
  run: ({ diff, context }) => {
    const existingSolutions = context?.knowledge?.getSolutionIndex().solutions ?? [];

    if (existingSolutions.length === 0) {
      return [];
    }

    return diff.files
      .filter((file) => file.status === "added" && file.role === "source")
      .flatMap((file) => detectExistingSolutions(file, existingSolutions));
  }
};

function detectExistingSolutions(file: DiffFile, existingSolutions: SolutionEntry[]): Finding[] {
  const sourceText = file.hunks
    .flatMap((hunk) => hunk.lines.filter((line) => line.kind === "add").map((line) => line.content))
    .join("\n");
  const addedSolutions = extractSolutionEntries(file.path, sourceText);

  return addedSolutions.flatMap((added) => {
    const match = findBestMatch(added, existingSolutions);
    return match === undefined ? [] : [toFinding(file, match)];
  });
}

function findBestMatch(
  added: SolutionEntry,
  existingSolutions: SolutionEntry[]
): SolutionMatch | undefined {
  return existingSolutions
    .filter((existing) => existing.path !== added.path && existing.class === added.class)
    .map((existing) => scoreMatch(added, existing))
    .filter((match): match is SolutionMatch => match !== undefined)
    .sort((left, right) => right.confidence - left.confidence)[0];
}

function scoreMatch(added: SolutionEntry, existing: SolutionEntry): SolutionMatch | undefined {
  if (added.normalizedName === existing.normalizedName) {
    return { added, existing, confidence: 0.94, reason: "exact normalized name match" };
  }

  if (
    added.normalizedName.includes(existing.normalizedName) ||
    existing.normalizedName.includes(added.normalizedName)
  ) {
    return { added, existing, confidence: 0.84, reason: "similar normalized name" };
  }

  const domainOverlap = overlapRatio(added.domainTokens, existing.domainTokens);
  const importOverlap = overlapRatio(added.importTokens, existing.importTokens);
  const signatureMatches =
    added.arity !== undefined &&
    added.arity === existing.arity &&
    added.returnType === existing.returnType;

  if (signatureMatches && domainOverlap >= 0.4) {
    return { added, existing, confidence: 0.78, reason: "matching signature and domain tokens" };
  }

  if (domainOverlap >= 0.5 && importOverlap >= 0.5) {
    return { added, existing, confidence: 0.74, reason: "similar imports and domain tokens" };
  }

  return undefined;
}

function overlapRatio(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightSet = new Set(right);
  const overlap = left.filter((token) => rightSet.has(token)).length;
  return overlap / Math.max(left.length, right.length);
}

function toFinding(file: DiffFile, match: SolutionMatch): Finding {
  return {
    id: `existing-solution:${file.path}:${match.added.exportedName ?? match.added.normalizedName}`,
    detector: "existing-solution",
    severity: "medium",
    confidence: match.confidence,
    title: "New solution may duplicate existing repository solution",
    message: `${match.added.exportedName ?? match.added.normalizedName} was added in ${file.path}, but ${match.existing.exportedName ?? match.existing.normalizedName} already exists in ${match.existing.path}.`,
    evidence: [
      {
        kind: "symbol",
        path: file.path,
        symbol: match.added.exportedName,
        message: `Existing ${match.existing.class} candidate: ${match.existing.path}#${match.existing.exportedName ?? match.existing.normalizedName} (${match.reason}).`,
        data: {
          addedClass: match.added.class,
          addedExport: match.added.exportedName,
          addedSignatureShape: match.added.signatureShape,
          addedFolderRole: match.added.class,
          existingClass: match.existing.class,
          existingPath: match.existing.path,
          existingExport: match.existing.exportedName,
          existingSignatureShape: match.existing.signatureShape,
          existingFolderRole: match.existing.class,
          existingImportCount: match.existing.importCount,
          reason: match.reason
        }
      }
    ],
    repair: `Reuse ${match.existing.exportedName ?? "the existing solution"} from ${match.existing.path}, or document why a separate ${match.added.class} is needed.`,
    tags: ["utility", "convention"]
  };
}

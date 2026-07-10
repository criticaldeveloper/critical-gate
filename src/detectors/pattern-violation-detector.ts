import { extractExportedNames } from "../knowledge/index.js";
import type { DiffFile, Finding } from "../schema/index.js";
import type { RepositoryPattern, RepositoryPatternKind } from "../knowledge/index.js";
import type { Detector } from "./types.js";

interface PatternViolation {
  file: DiffFile;
  kind: RepositoryPatternKind;
  expectedRoot: string;
  message: string;
}

export const patternViolationDetector: Detector = {
  name: "pattern-violation",
  maturity: "experimental",
  run: ({ diff, context }) => {
    const patterns = context?.knowledge?.getPatternIndex().patterns ?? [];

    if (patterns.length === 0) {
      return [];
    }

    return diff.files
      .filter((file) => file.status === "added" && file.role === "source")
      .flatMap((file) => detectPatternViolations(file, patterns))
      .map(toFinding);
  }
};

function detectPatternViolations(
  file: DiffFile,
  patterns: RepositoryPattern[]
): PatternViolation[] {
  const sourceText = file.hunks
    .flatMap((hunk) => hunk.lines.filter((line) => line.kind === "add").map((line) => line.content))
    .join("\n");
  const exportedNames = extractExportedNames(sourceText);
  const violations: PatternViolation[] = [];
  const serviceRoot = strongestRoot(patterns, "service");
  const hookRoot = strongestRoot(patterns, "hook");

  if (
    serviceRoot !== undefined &&
    /(^|\/)(helpers?|utils?)\//i.test(file.path) &&
    hasDomainTokenOverlap(file.path, serviceRoot.examples)
  ) {
    violations.push({
      file,
      kind: "service",
      expectedRoot: serviceRoot.root,
      message: `${file.path} adds helper-style code, but this repository has an established service pattern at ${serviceRoot.root}.`
    });
  }

  if (
    hookRoot !== undefined &&
    exportedNames.some((name) => /^use[A-Z]/.test(name)) &&
    !file.path.startsWith(`${hookRoot.root}/`)
  ) {
    violations.push({
      file,
      kind: "hook",
      expectedRoot: hookRoot.root,
      message: `${file.path} exports a hook-like symbol outside the established hook root ${hookRoot.root}.`
    });
  }

  return violations;
}

function strongestRoot(
  patterns: RepositoryPattern[],
  kind: RepositoryPatternKind
): RepositoryPattern | undefined {
  return patterns
    .filter((pattern) => pattern.kind === kind)
    .sort((left, right) => right.confidence - left.confidence)[0];
}

function hasDomainTokenOverlap(path: string, examples: string[]): boolean {
  const pathTokens = new Set(tokenize(path));
  return examples.some((example) => tokenize(example).some((token) => pathTokens.has(token)));
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[/.\\_-]+/)
    .filter((token) => token.length >= 3 && !["src", "lib", "app"].includes(token));
}

function toFinding(violation: PatternViolation): Finding {
  return {
    id: `pattern-violation:${violation.kind}:${violation.file.path}`,
    detector: "pattern-violation",
    severity: "medium",
    confidence: 0.76,
    title: "New file drifts from repository pattern",
    message: violation.message,
    evidence: [
      {
        kind: "file",
        path: violation.file.path,
        message: `Expected ${violation.kind} root: ${violation.expectedRoot}.`,
        data: {
          expectedPattern: violation.kind,
          expectedRoot: violation.expectedRoot
        }
      }
    ],
    repair: `Move this code under ${violation.expectedRoot}, reuse the existing pattern, or document why this task needs a new location.`,
    tags: ["convention"]
  };
}

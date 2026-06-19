import type { PatternIndex, RepositoryPattern, RepositoryPatternKind } from "./types.js";

export interface PatternIndexRunner {
  execFile: (file: string, args: string[], options?: { cwd?: string }) => string;
}

export interface BuildPatternIndexOptions {
  root: string;
  runner: PatternIndexRunner;
}

const patternRules: Array<{ kind: RepositoryPatternKind; segment: RegExp }> = [
  { kind: "service", segment: /^services?$/i },
  { kind: "hook", segment: /^hooks?$/i },
  { kind: "query", segment: /^(queries|api)$/i },
  { kind: "validator", segment: /^(validators?|validation)$/i },
  { kind: "schema", segment: /^schemas?$/i },
  { kind: "adapter", segment: /^adapters?$/i }
];

export function buildPatternIndex(options: BuildPatternIndexOptions): PatternIndex {
  const files = getTrackedSourceFiles(options);
  const patterns = [...inferClassPatterns(files), ...inferFeatureRootPatterns(files)].sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.root.localeCompare(right.root)
  );

  return { patterns };
}

function inferClassPatterns(files: string[]): RepositoryPattern[] {
  const groups = new Map<string, { kind: RepositoryPatternKind; examples: string[] }>();

  for (const file of files) {
    const segments = file.split("/");
    const matched = segments
      .map((segment, index) => ({
        segment,
        index,
        rule: patternRules.find((rule) => rule.segment.test(segment))
      }))
      .find((entry) => entry.rule !== undefined);

    if (matched?.rule === undefined) {
      continue;
    }

    const root = segments.slice(0, matched.index + 1).join("/");
    const key = `${matched.rule.kind}:${root}`;
    const current = groups.get(key) ?? { kind: matched.rule.kind, examples: [] };
    current.examples.push(file);
    groups.set(key, current);
  }

  return [...groups.entries()].map(([key, value]) => {
    const [, root = ""] = key.split(":");
    return toPattern(value.kind, root, value.examples);
  });
}

function inferFeatureRootPatterns(files: string[]): RepositoryPattern[] {
  const groups = new Map<string, string[]>();

  for (const file of files) {
    const segments = file.split("/");

    if (
      segments[0] !== "src" ||
      segments.length < 3 ||
      patternRules.some((rule) => rule.segment.test(segments[1] ?? ""))
    ) {
      continue;
    }

    const root = segments.slice(0, 2).join("/");
    groups.set(root, [...(groups.get(root) ?? []), file]);
  }

  return [...groups.entries()]
    .filter(([, examples]) => examples.length >= 2)
    .map(([root, examples]) => toPattern("feature-root", root, examples));
}

function toPattern(
  kind: RepositoryPatternKind,
  root: string,
  examples: string[]
): RepositoryPattern {
  const sortedExamples = [...examples].sort();

  return {
    kind,
    root,
    examples: sortedExamples.slice(0, 5),
    confidence: Math.round(Math.min(1, 0.45 + sortedExamples.length * 0.15) * 100) / 100
  };
}

function getTrackedSourceFiles(options: BuildPatternIndexOptions): string[] {
  try {
    return options.runner
      .execFile("git", ["ls-files"], { cwd: options.root })
      .split(/\r?\n/)
      .map((path) => path.trim().replaceAll("\\", "/"))
      .filter((path) => /\.(?:[cm]?[jt]sx?)$/.test(path))
      .sort();
  } catch {
    return [];
  }
}

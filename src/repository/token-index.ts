import type {
  DiffFile,
  RepositoryToken,
  RepositoryTokenIndex,
  RepositoryTokenSource
} from "../schema/index.js";

export interface BuildRepositoryTokenIndexOptions {
  files: DiffFile[];
  packageJson?: unknown;
}

const sourceFileExtensions = /\.(?:[cm]?[jt]sx?|astro|vue|svelte)$/i;
const testCallPattern = /\b(?:describe|it|test)\s*\(\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g;
const markdownHeadingPattern = /^\s{0,3}#{1,6}\s+(.+)$/;
const exportedSymbolPattern =
  /\bexport\s+(?:declare\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|var|enum)\s+([A-Za-z_$][\w$]*)/g;

const tokenAliases: Record<string, string[]> = {
  cfg: ["config"],
  conf: ["config"],
  configuration: ["config"],
  doc: ["docs"],
  documentation: ["docs"],
  spec: ["test"],
  specs: ["test"],
  tests: ["test"],
  validator: ["validation", "validate"],
  validators: ["validation", "validate"],
  validates: ["validate", "validation"],
  validating: ["validate", "validation"]
};

const stopTokens = new Set([
  "and",
  "app",
  "apps",
  "com",
  "dev",
  "for",
  "index",
  "lib",
  "main",
  "new",
  "src",
  "test",
  "tests",
  "the",
  "with"
]);

export function buildRepositoryTokenIndex(
  options: BuildRepositoryTokenIndexOptions
): RepositoryTokenIndex {
  const packageNameTokens = getPackageNameTokens(options.packageJson);
  const files = options.files.map((file) => {
    const tokens = [
      ...extractRepositoryTokens(file.path, "path"),
      ...extractFolderTokens(file.path),
      ...packageNameTokens,
      ...extractContentTokens(file)
    ];

    return {
      path: file.path,
      tokens: dedupeTokens(tokens)
    };
  });

  return { files };
}

export function extractRepositoryTokens(
  raw: string,
  source: RepositoryTokenSource
): RepositoryToken[] {
  return splitTokenParts(raw).flatMap((part) => {
    const normalized = normalizeRepositoryToken(part);

    if (normalized === undefined) {
      return [];
    }

    return [normalized, ...(tokenAliases[normalized] ?? [])].map((value) => ({
      value,
      source,
      raw: part
    }));
  });
}

export function normalizeRepositoryToken(raw: string): string | undefined {
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (normalized.length < 3 || stopTokens.has(normalized)) {
    return undefined;
  }

  if (normalized.endsWith("ies") && normalized.length > 4) {
    return `${normalized.slice(0, -3)}y`;
  }

  if (/(?:ches|shes|sses|xes|zes)$/.test(normalized) && normalized.length > 4) {
    return normalized.slice(0, -2);
  }

  if (normalized.endsWith("s") && normalized.length > 4 && !normalized.endsWith("ss")) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

function extractFolderTokens(path: string): RepositoryToken[] {
  const parts = path.replaceAll("\\", "/").split("/");

  return parts.slice(0, -1).flatMap((part) => extractRepositoryTokens(part, "folder"));
}

function getPackageNameTokens(packageJson: unknown): RepositoryToken[] {
  if (!isRecord(packageJson) || typeof packageJson.name !== "string") {
    return [];
  }

  return extractRepositoryTokens(packageJson.name, "package-name");
}

function extractContentTokens(file: DiffFile): RepositoryToken[] {
  const lines = file.hunks.flatMap((hunk) => hunk.lines).map((line) => line.content);
  const tokens: RepositoryToken[] = [];

  if (file.path.endsWith(".md") || file.path.endsWith(".mdx")) {
    for (const line of lines) {
      const heading = markdownHeadingPattern.exec(line)?.[1];

      if (heading !== undefined) {
        tokens.push(...extractRepositoryTokens(heading, "markdown-heading"));
      }
    }
  }

  if (file.role === "test") {
    for (const line of lines) {
      for (const match of line.matchAll(testCallPattern)) {
        tokens.push(
          ...extractRepositoryTokens(match[1] ?? match[2] ?? match[3] ?? "", "test-name")
        );
      }
    }
  }

  if (sourceFileExtensions.test(file.path)) {
    for (const line of lines) {
      for (const match of line.matchAll(exportedSymbolPattern)) {
        tokens.push(...extractRepositoryTokens(match[1] ?? "", "symbol"));
      }
    }
  }

  return tokens;
}

function splitTokenParts(raw: string): string[] {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

function dedupeTokens(tokens: RepositoryToken[]): RepositoryToken[] {
  const seen = new Set<string>();
  const deduped: RepositoryToken[] = [];

  for (const token of tokens) {
    const key = `${token.value}:${token.source}:${token.raw}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(token);
  }

  return deduped.sort(
    (left, right) =>
      left.value.localeCompare(right.value) ||
      left.source.localeCompare(right.source) ||
      left.raw.localeCompare(right.raw)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

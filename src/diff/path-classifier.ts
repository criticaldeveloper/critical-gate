import type { DiffFileRole } from "../schema/index.js";

const generatedPathPatterns = [
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)coverage\//,
  /\.min\.[cm]?js$/,
  /(^|\/)generated\//
];

const configFilePatterns = [
  /(^|\/)\.github\/workflows\//,
  /(^|\/)Dockerfile$/,
  /(^|\/)docker-compose\./,
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)eslint\.config\.[cm]?js$/,
  /(^|\/)vite\.config\.[cm]?[jt]s$/,
  /(^|\/)vitest\.config\.[cm]?[jt]s$/,
  /(^|\/)webpack\.config\.[cm]?[jt]s$/,
  /(^|\/)\.prettierrc/,
  /(^|\/)\.gitattributes$/,
  /(^|\/)\.gitignore$/
];

const testPathPattern = /(^|\/)(tests?|__tests__)\/|[._-](test|spec)\.[cm]?[jt]sx?$/;
const docsPathPattern = /(^|\/)(docs?|adr)\//;
const manifestPathPattern = /(^|\/)(package\.json|composer\.json|pyproject\.toml|Cargo\.toml)$/;
const lockfilePathPattern =
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb|Cargo\.lock)$/;

export function classifyPath(path: string): DiffFileRole {
  const normalizedPath = normalizePath(path);

  if (generatedPathPatterns.some((pattern) => pattern.test(normalizedPath))) {
    return "generated";
  }

  if (lockfilePathPattern.test(normalizedPath)) {
    return "lockfile";
  }

  if (manifestPathPattern.test(normalizedPath)) {
    return "manifest";
  }

  if (configFilePatterns.some((pattern) => pattern.test(normalizedPath))) {
    return "config";
  }

  if (testPathPattern.test(normalizedPath)) {
    return "test";
  }

  if (docsPathPattern.test(normalizedPath) || normalizedPath.endsWith(".md")) {
    return "docs";
  }

  if (
    /\.[cm]?[jt]sx?$/.test(normalizedPath) ||
    /\.(astro|vue|svelte)$/.test(normalizedPath) ||
    /\.(css|scss|sass|less)$/.test(normalizedPath)
  ) {
    return "source";
  }

  return "unknown";
}

export function detectLanguage(path: string): string | undefined {
  const normalizedPath = normalizePath(path);
  const extension = normalizedPath.split(".").pop();

  switch (extension) {
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript-react";
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "jsx":
      return "javascript-react";
    case "astro":
      return "astro";
    case "vue":
      return "vue";
    case "svelte":
      return "svelte";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "sass":
      return "sass";
    case "less":
      return "less";
    case "yml":
    case "yaml":
      return "yaml";
    default:
      return undefined;
  }
}

export function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

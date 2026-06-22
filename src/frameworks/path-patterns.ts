export function matchesPathPattern(pattern: string, path: string): boolean {
  const normalizedPattern = normalizePath(pattern);
  const normalizedPath = normalizePath(path);

  if (normalizedPattern === normalizedPath) {
    return true;
  }

  return globToRegExp(normalizedPattern).test(normalizedPath);
}

export function globToRegExp(pattern: string): RegExp {
  return new RegExp(`^${globToRegExpSource(normalizePath(pattern))}$`);
}

function globToRegExpSource(pattern: string): string {
  if (pattern.endsWith("/**")) {
    return `${globToRegExpSource(pattern.slice(0, -3))}(?:/.*)?`;
  }

  const escaped = pattern
    .replaceAll(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**/", "\0")
    .replaceAll("**", ".*")
    .replaceAll("*", "[^/]*")
    .replaceAll("\0", "(?:.*/)?");

  return escaped;
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/\/+/g, "/").replace(/\/$/u, "");
}

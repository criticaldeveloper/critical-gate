export function matchesPathPattern(pattern: string, path: string): boolean {
  if (pattern === path) {
    return true;
  }

  return globToRegExp(pattern).test(path);
}

export function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replaceAll(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**/", "\0")
    .replaceAll("**", ".*")
    .replaceAll("*", "[^/]*")
    .replaceAll("\0", "(?:.*/)?");

  return new RegExp(`^${escaped}$`);
}

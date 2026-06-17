const providerTokenPattern =
  /\b(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/g;
const assignmentSecretPattern =
  /\b(secret|token|api[_-]?key|password|passwd|private[_-]?key)\b\s*[:=]\s*["']?([^"',\s]{8,})/gi;
const windowsAbsolutePathPattern = /\b[A-Za-z]:\\(?:[^\\\s]+\\?)+/g;
const posixAbsolutePathPattern = /(^|[\s"'=:/])\/(?:Users|home|var|tmp|opt|srv)\/[^\s"',)]+/g;
const internalUrlPattern =
  /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|[^/\s"']+\.internal)[^\s"']*/gi;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export function redactForModel(value: string): string {
  return value
    .replace(assignmentSecretPattern, (_match, key: string) => `${key}=[redacted]`)
    .replace(providerTokenPattern, "[redacted-token]")
    .replace(windowsAbsolutePathPattern, "[redacted-path]")
    .replace(posixAbsolutePathPattern, (match, prefix: string) => `${prefix}[redacted-path]`)
    .replace(internalUrlPattern, "[redacted-url]")
    .replace(emailPattern, "[redacted-email]");
}

export function truncateForModel(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxChars - 15))}...[truncated]`;
}

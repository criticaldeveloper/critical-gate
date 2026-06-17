import type { DiffFile, DiffLine, Finding, FindingSeverity } from "../schema/index.js";

import type { Detector } from "./types.js";

interface SecretPathSignal {
  id: string;
  title: string;
  message: string;
  repair: string;
  severity: FindingSeverity;
  confidence: number;
  path: string;
  lineNumber?: number;
  redactedContent: string;
}

const secretAssignmentPattern =
  /[A-Za-z0-9_-]*(?:api[_-]?key|secret|token|password|passwd|private[_-]?key|client[_-]?secret)[A-Za-z0-9_-]*\s*[:=]\s*["']?([A-Za-z0-9_./+=:-]{12,})/i;
const providerTokenPatterns = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bghp_[A-Za-z0-9_]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/
];
const windowsAbsolutePathPattern = /(?:^|["'=:\s])([A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\?)+)/;
const posixAbsolutePathPattern = /(?:^|["'=:\s])((?:\/Users|\/home|\/tmp|\/var\/tmp)\/[^\s"',)]+)/;
const internalUrlPattern =
  /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|[^/\s"']+\.(?:local|internal|corp|lan))(?::\d+)?[^\s"']*/i;

export const secretPathDetector: Detector = {
  name: "secret-path",
  run: ({ diff }) => diff.files.flatMap(scanAddedLinesForSecretsAndPaths)
};

function extractSignals(file: DiffFile, line: DiffLine): SecretPathSignal[] {
  return [
    detectSecretAssignment(file, line),
    detectProviderToken(file, line),
    detectAbsolutePath(file, line),
    detectInternalUrl(file, line)
  ].filter((signal): signal is SecretPathSignal => signal !== undefined);
}

function detectSecretAssignment(file: DiffFile, line: DiffLine): SecretPathSignal | undefined {
  const match = secretAssignmentPattern.exec(line.content);

  if (match === null) {
    return undefined;
  }

  return {
    id: "secret-assignment",
    title: "Possible hardcoded secret added",
    message: "The diff adds a secret-like assignment.",
    repair:
      "Move the value to a secret manager or environment variable and rotate it if it was real.",
    severity: "blocker",
    confidence: 0.88,
    path: file.path,
    lineNumber: line.newLineNumber,
    redactedContent: redactLine(line.content)
  };
}

function detectProviderToken(file: DiffFile, line: DiffLine): SecretPathSignal | undefined {
  const matched = providerTokenPatterns.some((pattern) => pattern.test(line.content));

  if (!matched) {
    return undefined;
  }

  return {
    id: "provider-token",
    title: "Provider token pattern added",
    message: "The diff adds a value matching a known provider token pattern.",
    repair: "Remove the token, rotate it if it was real, and load it from a managed secret source.",
    severity: "blocker",
    confidence: 0.94,
    path: file.path,
    lineNumber: line.newLineNumber,
    redactedContent: redactLine(line.content)
  };
}

function detectAbsolutePath(file: DiffFile, line: DiffLine): SecretPathSignal | undefined {
  const matched =
    windowsAbsolutePathPattern.test(line.content) || posixAbsolutePathPattern.test(line.content);

  if (!matched) {
    return undefined;
  }

  return {
    id: "absolute-path",
    title: "Environment-specific absolute path added",
    message: "The diff adds an absolute local filesystem path.",
    repair:
      "Use a repository-relative path, temp-directory API, or documented configuration value.",
    severity: "medium",
    confidence: 0.86,
    path: file.path,
    lineNumber: line.newLineNumber,
    redactedContent: redactLine(line.content)
  };
}

function detectInternalUrl(file: DiffFile, line: DiffLine): SecretPathSignal | undefined {
  if (!internalUrlPattern.test(line.content)) {
    return undefined;
  }

  return {
    id: "internal-url",
    title: "Internal or local URL added",
    message: "The diff adds a localhost or internal-network URL.",
    repair: "Move environment-specific URLs to configuration and document the expected variable.",
    severity: "medium",
    confidence: 0.82,
    path: file.path,
    lineNumber: line.newLineNumber,
    redactedContent: redactLine(line.content)
  };
}

function redactLine(content: string): string {
  return content
    .replace(secretAssignmentPattern, (match, secret: string) =>
      match.replace(secret, redact(secret))
    )
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, (value) => redact(value))
    .replace(/\bghp_[A-Za-z0-9_]{20,}\b/g, (value) => redact(value))
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, (value) => redact(value))
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, (value) => redact(value))
    .replace(windowsAbsolutePathPattern, (match, path: string) => match.replace(path, redact(path)))
    .replace(posixAbsolutePathPattern, (match, path: string) => match.replace(path, redact(path)))
    .replace(internalUrlPattern, (value) => redact(value));
}

function redact(value: string): string {
  if (value.length <= 8) {
    return "[redacted]";
  }

  return `${value.slice(0, 3)}...[redacted]...${value.slice(-2)}`;
}

function toFinding(signal: SecretPathSignal): Finding {
  return {
    id: `secret-path:${signal.path}:${signal.id}:${signal.lineNumber ?? "unknown"}`,
    detector: "secret-path",
    severity: signal.severity,
    confidence: signal.confidence,
    title: signal.title,
    message: signal.message,
    evidence: [
      {
        kind: "line",
        path: signal.path,
        startLine: signal.lineNumber,
        endLine: signal.lineNumber,
        message: signal.redactedContent.trim(),
        data: {
          signal: signal.id
        }
      }
    ],
    repair: signal.repair,
    tags: ["secret"]
  };
}

export function scanAddedLinesForSecretsAndPaths(file: DiffFile): Finding[] {
  return file.hunks.flatMap((hunk) =>
    hunk.lines
      .filter((line) => line.kind === "add")
      .flatMap((line) => extractSignals(file, line).map(toFinding))
  );
}

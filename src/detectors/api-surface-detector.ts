import type { DiffFile, DiffLine, Finding, FindingSeverity } from "../schema/index.js";

import type { Detector } from "./types.js";

interface ApiSurfaceSignal {
  id: string;
  title: string;
  message: string;
  repair: string;
  severity: FindingSeverity;
  confidence: number;
  path: string;
  lineNumber?: number;
  symbol?: string;
  content: string;
}

const apiTaskTerms = [
  "api",
  "public api",
  "export",
  "exports",
  "breaking",
  "signature",
  "changelog",
  "release note",
  "public surface"
];

const documentationPathPattern =
  /(^|\/)(docs?|adr|changelog|changesets?)\/|(^|\/)(CHANGELOG|README|ADR)[^/]*\.md$/i;

const exportDeclarationPattern =
  /^\s*export\s+(?:async\s+)?(?:declare\s+)?(?:function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/;
const namedExportPattern = /^\s*export\s*\{([^}]+)\}/;
const defaultExportPattern = /^\s*export\s+default\s+/;

export const apiSurfaceDetector: Detector = {
  name: "api-surface",
  run: ({ task, diff }) => {
    if (hasVisibleApiAcknowledgement(task.text, diff.files)) {
      return [];
    }

    return diff.files.filter(isSourceFile).flatMap(extractSignals).map(toFinding);
  }
};

function isSourceFile(file: DiffFile): boolean {
  return file.role === "source" && /\.(?:[cm]?[jt]sx?)$/.test(file.path);
}

function hasVisibleApiAcknowledgement(taskText: string, files: DiffFile[]): boolean {
  const normalizedTask = taskText.toLowerCase();

  return (
    apiTaskTerms.some((term) => normalizedTask.includes(term)) ||
    files.some((file) => documentationPathPattern.test(file.path))
  );
}

function extractSignals(file: DiffFile): ApiSurfaceSignal[] {
  return file.hunks.flatMap((hunk) =>
    hunk.lines.flatMap((line) => {
      if (line.kind !== "add" && line.kind !== "delete") {
        return [];
      }

      const exportInfo = getExportInfo(line);

      if (exportInfo === undefined) {
        return [];
      }

      const isRemoval = line.kind === "delete";

      return [
        {
          id: isRemoval ? "removed-export" : "added-export",
          title: isRemoval ? "Public export removed" : "Public export added",
          message: isRemoval
            ? "The diff removes an exported symbol without visible API acknowledgement."
            : "The diff adds an exported symbol without visible API acknowledgement.",
          repair: isRemoval
            ? "Confirm this is an intended public API change and add changelog, release note, docs, or explicit task/PR acknowledgement."
            : "Confirm the new export is intended public API and document it or keep it internal.",
          severity: isRemoval ? "high" : "medium",
          confidence: exportInfo.kind === "named" ? 0.78 : 0.86,
          path: file.path,
          lineNumber: line.kind === "add" ? line.newLineNumber : line.oldLineNumber,
          symbol: exportInfo.symbol,
          content: line.content
        }
      ];
    })
  );
}

function getExportInfo(
  line: DiffLine
): { kind: "declared" | "named" | "default"; symbol?: string } | undefined {
  const declaredExport = exportDeclarationPattern.exec(line.content);

  if (declaredExport !== null) {
    return {
      kind: "declared",
      symbol: declaredExport[1]
    };
  }

  const namedExport = namedExportPattern.exec(line.content);

  if (namedExport !== null) {
    return {
      kind: "named",
      symbol: namedExport[1]?.split(",")[0]?.trim()
    };
  }

  if (defaultExportPattern.test(line.content)) {
    return {
      kind: "default",
      symbol: "default"
    };
  }

  return undefined;
}

function toFinding(signal: ApiSurfaceSignal): Finding {
  return {
    id: `api-surface:${signal.path}:${signal.id}:${signal.symbol ?? "unknown"}:${signal.lineNumber ?? "unknown"}`,
    detector: "api-surface",
    severity: signal.severity,
    confidence: signal.confidence,
    title: signal.title,
    message: signal.message,
    evidence: [
      {
        kind: "symbol",
        path: signal.path,
        startLine: signal.lineNumber,
        endLine: signal.lineNumber,
        symbol: signal.symbol,
        message: signal.content.trim(),
        data: {
          signal: signal.id
        }
      }
    ],
    repair: signal.repair,
    tags: ["api"]
  };
}

import {
  API_SURFACE_SNAPSHOT_PATH,
  findSnapshotExport,
  hasApiSnapshotEvidence,
  type ApiSurfaceSnapshot
} from "../repository/index.js";
import type {
  DiffFile,
  DiffLine,
  Finding,
  FindingSeverity,
  PublicApiEntrypointSummary
} from "../schema/index.js";

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
  data?: Record<string, unknown>;
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
const contractEvidencePathPattern =
  /(^|\/)(changesets?|migrations?|docs?|adr)\/|(^|\/)(CHANGELOG|MIGRATION|README|ADR)[^/]*\.md$/i;

const exportDeclarationPattern =
  /^\s*export\s+(?:async\s+)?(?:declare\s+)?(?:function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/;
const namedExportPattern = /^\s*export\s*\{([^}]+)\}/;
const defaultExportPattern = /^\s*export\s+default\s+/;
const frameworkContractPathPatterns = [
  /(^|\/)(?:src\/)?content\.config\.[cm]?[jt]s$/i,
  /(^|\/)(?:src\/)?middleware\.[cm]?[jt]s$/i,
  /(^|\/)(?:src\/)?hooks(?:\.[\w-]+)?\.[cm]?[jt]s$/i
];

export const apiSurfaceDetector: Detector = {
  name: "api-surface",
  run: ({ task, diff, context }) => {
    const snapshot = context?.apiSurfaceSnapshot;
    const snapshotSignals =
      snapshot !== undefined && !hasContractChangeEvidence(diff.files)
        ? extractSnapshotSignals(diff.files, snapshot)
        : [];

    if (hasVisibleApiAcknowledgement(task.text, diff.files)) {
      return snapshotSignals.map(toFinding);
    }

    const snapshotSignalKeys = new Set(
      snapshotSignals.map((signal) => `${signal.path}:${signal.symbol ?? "unknown"}`)
    );
    const lineSignals = diff.files
      .filter(isSourceFile)
      .flatMap((file) => extractSignals(file, context?.publicApiEntrypoints))
      .filter((signal) => !snapshotSignalKeys.has(`${signal.path}:${signal.symbol ?? "unknown"}`));

    return [...snapshotSignals, ...lineSignals].map(toFinding);
  }
};

function isSourceFile(file: DiffFile): boolean {
  return file.role === "source" && /\.(?:[cm]?[jt]sx?)$/.test(file.path);
}

function hasVisibleApiAcknowledgement(taskText: string, files: DiffFile[]): boolean {
  const normalizedTask = taskText.toLowerCase();

  return (
    apiTaskTerms.some((term) => normalizedTask.includes(term)) ||
    files.some(
      (file) =>
        documentationPathPattern.test(file.path) ||
        file.path.replace(/\\/g, "/") === API_SURFACE_SNAPSHOT_PATH
    )
  );
}

function hasContractChangeEvidence(files: DiffFile[]): boolean {
  return (
    hasApiSnapshotEvidence(files) ||
    files.some((file) => contractEvidencePathPattern.test(file.path))
  );
}

function extractSignals(
  file: DiffFile,
  publicApiEntrypoints?: PublicApiEntrypointSummary[]
): ApiSurfaceSignal[] {
  const publicEntrypoint = getPublicEntrypoint(file.path, publicApiEntrypoints);
  const isFrameworkContract = isFrameworkContractFile(file.path);

  if (
    publicApiEntrypoints !== undefined &&
    publicEntrypoint === undefined &&
    !isFrameworkContract
  ) {
    return [];
  }

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
          id: isRemoval
            ? isFrameworkContract
              ? "removed-contract-export"
              : "removed-export"
            : isFrameworkContract
              ? "added-contract-export"
              : "added-export",
          title: isRemoval
            ? isFrameworkContract
              ? "Framework contract export removed"
              : "Public export removed"
            : isFrameworkContract
              ? "Framework contract export added"
              : "Public export added",
          message: isRemoval
            ? isFrameworkContract
              ? "The diff removes an exported framework contract without visible acknowledgement."
              : "The diff removes an exported symbol without visible API acknowledgement."
            : "The diff adds an exported symbol without visible API acknowledgement.",
          repair: isRemoval
            ? isFrameworkContract
              ? "Restore the framework contract export, or document the migration and update the task/PR to acknowledge the contract change."
              : "Confirm this is an intended public API change and add changelog, release note, docs, or explicit task/PR acknowledgement."
            : "Confirm the new export is intended public API and document it or keep it internal.",
          severity: isRemoval ? "high" : "medium",
          confidence: isFrameworkContract ? 0.9 : exportInfo.kind === "named" ? 0.78 : 0.86,
          path: file.path,
          lineNumber: line.kind === "add" ? line.newLineNumber : line.oldLineNumber,
          symbol: exportInfo.symbol,
          content: line.content,
          data: isFrameworkContract
            ? {
                signal: isRemoval ? "removed-contract-export" : "added-contract-export",
                contract: "framework"
              }
            : publicEntrypoint === undefined
              ? undefined
              : {
                  signal: isRemoval ? "removed-export" : "added-export",
                  publicEntrypoint
                }
        }
      ];
    })
  );
}

function getPublicEntrypoint(
  path: string,
  publicApiEntrypoints?: PublicApiEntrypointSummary[]
): PublicApiEntrypointSummary | undefined {
  const normalizedPath = path.replace(/\\/g, "/");

  return publicApiEntrypoints?.find((entrypoint) => entrypoint.path === normalizedPath);
}

function isFrameworkContractFile(path: string): boolean {
  const normalizedPath = path.replace(/\\/g, "/");
  return frameworkContractPathPatterns.some((pattern) => pattern.test(normalizedPath));
}

function extractSnapshotSignals(
  files: DiffFile[],
  snapshot: ApiSurfaceSnapshot
): ApiSurfaceSignal[] {
  return files.filter(isSourceFile).flatMap((file) => {
    const changedExports = getChangedExports(file);
    const signals: ApiSurfaceSignal[] = [];

    for (const removed of changedExports.removed) {
      const snapshotExport = findSnapshotExport(snapshot, file.path, removed.symbol ?? "unknown");

      if (snapshotExport === undefined) {
        continue;
      }

      const matchingAddition = changedExports.added.find(
        (added) => added.symbol === removed.symbol
      );

      if (
        matchingAddition !== undefined &&
        matchingAddition.content.trim() !== removed.content.trim()
      ) {
        signals.push({
          id: "signature-change",
          title: "Public API signature changed",
          message:
            "The diff changes a snapshotted public API signature without changelog, changeset, migration, or snapshot evidence.",
          repair:
            "Confirm this public contract change and add a snapshot update plus changelog, changeset, migration note, or keep the previous signature.",
          severity: "high",
          confidence: 0.92,
          path: file.path,
          lineNumber: matchingAddition.lineNumber ?? removed.lineNumber,
          symbol: removed.symbol,
          content: matchingAddition.content,
          data: {
            signal: "signature-change",
            snapshotSignature: snapshotExport.signature,
            previousSignature: removed.content.trim()
          }
        });
        continue;
      }

      signals.push({
        id: "removed-export",
        title: "Snapshotted public export removed",
        message:
          "The diff removes an export recorded in the public API snapshot without changelog, changeset, migration, or snapshot evidence.",
        repair:
          "Restore the export or include a snapshot update plus changelog, changeset, or migration note for the public contract change.",
        severity: "high",
        confidence: 0.94,
        path: file.path,
        lineNumber: removed.lineNumber,
        symbol: removed.symbol,
        content: removed.content,
        data: {
          signal: "snapshot-removed-export",
          snapshotSignature: snapshotExport.signature
        }
      });
    }

    for (const added of changedExports.added) {
      if (!snapshot.entrypoints.includes(file.path)) {
        continue;
      }

      if (findSnapshotExport(snapshot, file.path, added.symbol ?? "unknown") !== undefined) {
        continue;
      }

      signals.push({
        id: "added-export",
        title: "Public API added outside snapshot",
        message:
          "The diff adds an export to a snapshotted public entrypoint without snapshot or release-note evidence.",
        repair:
          "Update the public API snapshot and add changelog, changeset, or migration evidence, or keep the export internal.",
        severity: "medium",
        confidence: 0.88,
        path: file.path,
        lineNumber: added.lineNumber,
        symbol: added.symbol,
        content: added.content,
        data: {
          signal: "snapshot-added-export"
        }
      });
    }

    return signals;
  });
}

function getChangedExports(file: DiffFile): {
  added: Array<{ symbol?: string; lineNumber?: number; content: string }>;
  removed: Array<{ symbol?: string; lineNumber?: number; content: string }>;
} {
  const added: Array<{ symbol?: string; lineNumber?: number; content: string }> = [];
  const removed: Array<{ symbol?: string; lineNumber?: number; content: string }> = [];

  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.kind !== "add" && line.kind !== "delete") {
        continue;
      }

      const exportInfo = getExportInfo(line);

      if (exportInfo === undefined) {
        continue;
      }

      const entry = {
        symbol: exportInfo.symbol,
        lineNumber: line.kind === "add" ? line.newLineNumber : line.oldLineNumber,
        content: line.content.trim()
      };

      if (line.kind === "add") {
        added.push(entry);
      } else {
        removed.push(entry);
      }
    }
  }

  return { added, removed };
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
          signal: signal.id,
          ...signal.data
        }
      }
    ],
    repair: signal.repair,
    tags: ["api"]
  };
}

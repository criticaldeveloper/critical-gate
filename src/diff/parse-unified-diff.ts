import type { DiffFile, DiffFileStatus, DiffHunk, DiffLine } from "../schema/index.js";

import { classifyPath, detectLanguage } from "./path-classifier.js";

const fileHeaderPattern = /^diff --git a\/(.+) b\/(.+)$/;
const hunkHeaderPattern = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;

interface MutableDiffFile {
  oldPath: string;
  newPath: string;
  deleted: boolean;
  added: boolean;
  renamedFrom?: string;
  renamedTo?: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export function parseUnifiedDiff(diffText: string): DiffFile[] {
  const files: DiffFile[] = [];
  let currentFile: MutableDiffFile | undefined;
  let currentHunk: DiffHunk | undefined;
  let oldLineNumber = 0;
  let newLineNumber = 0;

  const flushFile = () => {
    if (currentFile === undefined) {
      return;
    }

    files.push(toDiffFile(currentFile));
    currentFile = undefined;
    currentHunk = undefined;
  };

  for (const line of diffText.split(/\r?\n/)) {
    const fileHeader = fileHeaderPattern.exec(line);

    if (fileHeader !== null) {
      flushFile();
      currentFile = {
        oldPath: fileHeader[1] ?? "",
        newPath: fileHeader[2] ?? "",
        deleted: false,
        added: false,
        hunks: [],
        additions: 0,
        deletions: 0
      };
      continue;
    }

    if (currentFile === undefined) {
      continue;
    }

    if (line.startsWith("new file mode ")) {
      currentFile.added = true;
      continue;
    }

    if (line.startsWith("deleted file mode ")) {
      currentFile.deleted = true;
      continue;
    }

    if (line.startsWith("rename from ")) {
      currentFile.renamedFrom = line.slice("rename from ".length);
      continue;
    }

    if (line.startsWith("rename to ")) {
      currentFile.renamedTo = line.slice("rename to ".length);
      continue;
    }

    const hunkHeader = hunkHeaderPattern.exec(line);

    if (hunkHeader !== null) {
      oldLineNumber = Number(hunkHeader[1]);
      newLineNumber = Number(hunkHeader[3]);
      currentHunk = {
        oldStart: oldLineNumber,
        oldLines: Number(hunkHeader[2] ?? "1"),
        newStart: newLineNumber,
        newLines: Number(hunkHeader[4] ?? "1"),
        heading: hunkHeader[5] === "" ? undefined : hunkHeader[5],
        lines: []
      };
      currentFile.hunks.push(currentHunk);
      continue;
    }

    if (currentHunk === undefined || line.startsWith("\\ No newline at end of file")) {
      continue;
    }

    const parsedLine = parseDiffLine(line, oldLineNumber, newLineNumber);

    if (parsedLine === undefined) {
      continue;
    }

    currentHunk.lines.push(parsedLine.line);
    oldLineNumber = parsedLine.nextOldLineNumber;
    newLineNumber = parsedLine.nextNewLineNumber;

    if (parsedLine.line.kind === "add") {
      currentFile.additions += 1;
    } else if (parsedLine.line.kind === "delete") {
      currentFile.deletions += 1;
    }
  }

  flushFile();

  return files;
}

function parseDiffLine(
  line: string,
  oldLineNumber: number,
  newLineNumber: number
):
  | {
      line: DiffLine;
      nextOldLineNumber: number;
      nextNewLineNumber: number;
    }
  | undefined {
  const prefix = line[0];
  const content = line.slice(1);

  if (prefix === "+") {
    return {
      line: {
        kind: "add",
        content,
        newLineNumber
      },
      nextOldLineNumber: oldLineNumber,
      nextNewLineNumber: newLineNumber + 1
    };
  }

  if (prefix === "-") {
    return {
      line: {
        kind: "delete",
        content,
        oldLineNumber
      },
      nextOldLineNumber: oldLineNumber + 1,
      nextNewLineNumber: newLineNumber
    };
  }

  if (prefix === " ") {
    return {
      line: {
        kind: "context",
        content,
        oldLineNumber,
        newLineNumber
      },
      nextOldLineNumber: oldLineNumber + 1,
      nextNewLineNumber: newLineNumber + 1
    };
  }

  return undefined;
}

function toDiffFile(file: MutableDiffFile): DiffFile {
  const path = file.renamedTo ?? file.newPath;
  const status = getStatus(file);

  return {
    path,
    status,
    role: classifyPath(path),
    additions: file.additions,
    deletions: file.deletions,
    oldPath: file.renamedFrom ?? (status === "added" ? undefined : file.oldPath),
    newPath: status === "deleted" ? undefined : path,
    language: detectLanguage(path),
    hunks: file.hunks
  };
}

function getStatus(file: MutableDiffFile): DiffFileStatus {
  if (file.renamedFrom !== undefined || file.renamedTo !== undefined) {
    return "renamed";
  }

  if (file.added || file.oldPath === "/dev/null") {
    return "added";
  }

  if (file.deleted || file.newPath === "/dev/null") {
    return "deleted";
  }

  return "modified";
}

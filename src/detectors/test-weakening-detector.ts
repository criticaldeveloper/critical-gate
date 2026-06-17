import type { DiffFile, DiffLine, Finding, FindingSeverity } from "../schema/index.js";

import type { Detector } from "./types.js";

interface TestWeakeningSignal {
  id: string;
  title: string;
  message: string;
  repair: string;
  severity: FindingSeverity;
  confidence: number;
  path: string;
  lineNumber?: number;
  content: string;
}

const assertionPatterns = [
  /\bexpect\s*\(/,
  /\bassert\./,
  /\bassert\s*\(/,
  /\bshould\./,
  /\bto(Be|Equal|Contain|Match|Throw|Have|StrictEqual|DeepEqual)\b/
];

const skipPatterns = [
  /\b(?:it|test|describe)\.skip\s*\(/,
  /\b(?:it|test)\.todo\s*\(/,
  /\b(?:it|test|describe)\.only\s*\(/
];

export const testWeakeningDetector: Detector = {
  name: "test-weakening",
  run: ({ diff }) => diff.files.filter(isTestFile).flatMap(extractSignals).map(toFinding)
};

function isTestFile(file: DiffFile): boolean {
  return file.role === "test";
}

function extractSignals(file: DiffFile): TestWeakeningSignal[] {
  return file.hunks.flatMap((hunk) =>
    hunk.lines.flatMap((line) => {
      if (line.kind === "delete" && isAssertionLine(line)) {
        return [
          {
            id: "removed-assertion",
            title: "Test assertion removed",
            message: "The diff removes a test assertion, which can weaken behavioral coverage.",
            repair:
              "Restore the removed assertion or replace it with an equally specific behavioral assertion.",
            severity: "high",
            confidence: 0.9,
            path: file.path,
            lineNumber: line.oldLineNumber,
            content: line.content
          }
        ];
      }

      if (line.kind === "add" && isSkipLine(line)) {
        const isOnly = /\.only\s*\(/.test(line.content);

        return [
          {
            id: isOnly ? "focused-test" : "skipped-test",
            title: isOnly ? "Focused test committed" : "Skipped or todo test added",
            message: isOnly
              ? "The diff adds a focused test marker that can hide the rest of the suite."
              : "The diff adds a skipped or todo test, which can reduce effective coverage.",
            repair: isOnly
              ? "Remove the focused test marker and ensure the full test suite runs."
              : "Implement the test or remove the skip/todo marker before merging.",
            severity: isOnly ? "blocker" : "high",
            confidence: 0.95,
            path: file.path,
            lineNumber: line.newLineNumber,
            content: line.content
          }
        ];
      }

      return [];
    })
  );
}

function isAssertionLine(line: DiffLine): boolean {
  return assertionPatterns.some((pattern) => pattern.test(line.content));
}

function isSkipLine(line: DiffLine): boolean {
  return skipPatterns.some((pattern) => pattern.test(line.content));
}

function toFinding(signal: TestWeakeningSignal): Finding {
  return {
    id: `test-weakening:${signal.path}:${signal.id}:${signal.lineNumber ?? "unknown"}`,
    detector: "test-weakening",
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
        message: signal.content.trim(),
        data: {
          signal: signal.id
        }
      }
    ],
    repair: signal.repair,
    tags: ["test"]
  };
}

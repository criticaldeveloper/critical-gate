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
  data?: Record<string, unknown>;
}

interface AssertionSignal {
  line: DiffLine;
  specificity: AssertionSpecificity;
}

interface AssertionSpecificity {
  score: number;
  label: "behavioral" | "specific" | "structural" | "presence" | "generic";
  reasons: string[];
}

const assertionPatterns = [
  /\bexpect\s*\(/,
  /\bassert\./,
  /\bassert\s*\(/,
  /\bshould\./,
  /\bto(Be|Equal|Contain|Match|Throw|Have|StrictEqual|DeepEqual)\b/
];

const skipPatterns = [
  /\b(?:it|test|describe)\.skip\s*\(/g,
  /\b(?:it|test)\.todo\s*\(/g,
  /\b(?:it|test|describe)\.only\s*\(/g
];

const genericMatcherPatterns = [
  /\.toBeDefined\s*\(/,
  /\.toBeUndefined\s*\(/,
  /\.toBeTruthy\s*\(/,
  /\.toBeFalsy\s*\(/,
  /\.toBeNull\s*\(/,
  /\.toBeInTheDocument\s*\(/,
  /\.toExist\s*\(/
];

const behaviorMatcherPatterns = [
  /\.toHaveBeenCalledWith\s*\(/,
  /\.toHaveBeenNthCalledWith\s*\(/,
  /\.toHaveTextContent\s*\(/,
  /\.toHaveAttribute\s*\(/,
  /\.toHaveClass\s*\(/,
  /\.toThrow\s*\(/,
  /\.rejects\./,
  /\.resolves\./,
  /\.toMatchObject\s*\(/,
  /\.toStrictEqual\s*\(/,
  /\.toEqual\s*\(/,
  /\.toContain\s*\(/,
  /\.toMatch\s*\(/
];

const renderPresencePatterns = [
  /screen\.(?:get|query|find)By(?:Text|Role|TestId|LabelText|PlaceholderText|AltText|Title)\s*\(/,
  /render\s*\(/,
  /\bcontainer\b/,
  /\.toBeInTheDocument\s*\(/
];

export const testWeakeningDetector: Detector = {
  name: "test-weakening",
  maturity: "review",
  run: ({ diff }) => diff.files.filter(isTestFile).flatMap(extractSignals).map(toFinding)
};

function isTestFile(file: DiffFile): boolean {
  return file.role === "test";
}

function extractSignals(file: DiffFile): TestWeakeningSignal[] {
  return file.hunks.flatMap((hunk) => {
    const addedAssertions = hunk.lines
      .filter((candidate) => candidate.kind === "add" && isAssertionLine(candidate))
      .map(toAssertionSignal);

    return hunk.lines.flatMap((line) => {
      if (line.kind === "delete" && isAssertionLine(line)) {
        const removedAssertion = toAssertionSignal(line);
        const replacement = findLikelyReplacement(removedAssertion, addedAssertions);

        if (replacement !== undefined) {
          const weakening = getSpecificityWeakening(removedAssertion, replacement);

          if (weakening !== undefined) {
            return [toSpecificityDeltaSignal(file, removedAssertion, replacement, weakening)];
          }

          return [];
        }

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
    });
  });
}

function isAssertionLine(line: DiffLine): boolean {
  return assertionPatterns.some((pattern) => pattern.test(line.content));
}

function isSkipLine(line: DiffLine): boolean {
  return skipPatterns.some((pattern) => {
    pattern.lastIndex = 0;
    const match = pattern.exec(line.content);
    return match !== null && !isInsideStringLiteral(line.content, match.index);
  });
}

function isInsideStringLiteral(content: string, index: number): boolean {
  let quote: "'" | '"' | "`" | undefined;
  let escaped = false;

  for (let position = 0; position < index; position += 1) {
    const char = content[position];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined;
      }

      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
    }
  }

  return quote !== undefined;
}

function toAssertionSignal(line: DiffLine): AssertionSignal {
  return {
    line,
    specificity: scoreAssertionSpecificity(line.content)
  };
}

function scoreAssertionSpecificity(content: string): AssertionSpecificity {
  const reasons: string[] = [];
  let score = 45;
  let label: AssertionSpecificity["label"] = "structural";

  if (genericMatcherPatterns.some((pattern) => pattern.test(content))) {
    score = 30;
    label = "generic";
    reasons.push("generic matcher");
  }

  if (renderPresencePatterns.some((pattern) => pattern.test(content))) {
    score = Math.min(score, 25);
    label = "presence";
    reasons.push("render presence assertion");
  }

  if (
    /\.(?:toHaveLength|toBeGreaterThan|toBeLessThan|toBeGreaterThanOrEqual|toBeLessThanOrEqual)\s*\(/.test(
      content
    )
  ) {
    score = Math.max(score, 62);
    label = "specific";
    reasons.push("quantified assertion");
  }

  if (/\.(?:toBe|toEqual)\s*\(\s*(?:true|false|null|undefined|["'`]\S|[-]?\d)/.test(content)) {
    score = Math.max(score, 68);
    label = "specific";
    reasons.push("exact expected value");
  }

  if (behaviorMatcherPatterns.some((pattern) => pattern.test(content))) {
    score = Math.max(score, 78);
    label = "behavioral";
    reasons.push("behavioral matcher");
  }

  if (
    /\b(?:error|message|status|code|payload|body|url|href|value|role|label|aria-|calledWith)\b/i.test(
      content
    )
  ) {
    score += 8;
    reasons.push("domain-specific expectation");
  }

  if (/\b(?:toBeTruthy|toBeDefined|toBeInTheDocument|container|render)\b/.test(content)) {
    score -= 8;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    label,
    reasons: reasons.length > 0 ? reasons : ["assertion present"]
  };
}

function findLikelyReplacement(
  removed: AssertionSignal,
  addedAssertions: AssertionSignal[]
): AssertionSignal | undefined {
  if (addedAssertions.length === 0) {
    return undefined;
  }

  if (addedAssertions.length === 1) {
    return addedAssertions[0];
  }

  return [...addedAssertions].sort(
    (left, right) =>
      tokenOverlap(removed.line.content, right.line.content) -
        tokenOverlap(removed.line.content, left.line.content) ||
      right.specificity.score - left.specificity.score
  )[0];
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(extractTokens(left));

  return extractTokens(right).filter((token) => leftTokens.has(token)).length;
}

function extractTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((token) => token.length >= 3 && !["expect", "tobe", "true", "false"].includes(token));
}

function getSpecificityWeakening(
  removed: AssertionSignal,
  replacement: AssertionSignal
): { delta: number; reason: string } | undefined {
  const delta = removed.specificity.score - replacement.specificity.score;
  const highToLow =
    ["behavioral", "specific"].includes(removed.specificity.label) &&
    ["presence", "generic"].includes(replacement.specificity.label);

  if (delta < 25 && !highToLow) {
    return undefined;
  }

  return {
    delta,
    reason: highToLow
      ? "behavioral assertion replaced with generic or presence assertion"
      : "assertion specificity score decreased"
  };
}

function toSpecificityDeltaSignal(
  file: DiffFile,
  removed: AssertionSignal,
  replacement: AssertionSignal,
  weakening: { delta: number; reason: string }
): TestWeakeningSignal {
  return {
    id: "assertion-specificity-dropped",
    title: "Test assertion became less meaningful",
    message:
      "The diff replaces a stronger behavioral assertion with a weaker generic or rendering-presence assertion.",
    repair:
      "Keep the replacement only if it preserves the same behavior check; otherwise restore an equally specific assertion.",
    severity: "high",
    confidence: weakening.delta >= 35 ? 0.9 : 0.84,
    path: file.path,
    lineNumber: replacement.line.newLineNumber ?? removed.line.oldLineNumber,
    content: replacement.line.content,
    data: {
      signal: "assertion-specificity-dropped",
      previousAssertion: removed.line.content.trim(),
      replacementAssertion: replacement.line.content.trim(),
      previousSpecificity: removed.specificity,
      replacementSpecificity: replacement.specificity,
      delta: weakening.delta,
      reason: weakening.reason
    }
  };
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
          signal: signal.id,
          ...signal.data
        }
      }
    ],
    repair: signal.repair,
    tags: ["test"]
  };
}

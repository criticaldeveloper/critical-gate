import { frameworkPacks, matchesPathPattern } from "../frameworks/index.js";
import type { CompanionRule } from "../knowledge/index.js";
import type { DiffFile, Finding } from "../schema/index.js";
import type { Detector } from "./types.js";

const maxHistoryFindingsPerSource = 3;
const maxFrameworkFindingsPerSource = 2;

export const expectedCompanionsDetector: Detector = {
  name: "expected-companions",
  run: ({ diff, context }) => {
    const history = context?.knowledge?.getHistoryIndex();

    const changedPaths = new Set(diff.files.map((file) => file.path));
    const historyFindings =
      history === undefined
        ? []
        : getCappedHistoryFindings(
            history.companionRules.filter(
              (rule) => changedPaths.has(rule.sourcePath) && !changedPaths.has(rule.expectedPath)
            )
          );
    const frameworkFindings = getFrameworkFindings(diff.files, context?.frameworkPacks ?? []);
    const packageFinding = detectMissingLockfile(diff.files);

    return packageFinding === undefined
      ? [...historyFindings, ...frameworkFindings]
      : [...historyFindings, ...frameworkFindings, packageFinding];
  }
};

function getFrameworkFindings(files: DiffFile[], activePackIds: string[]): Finding[] {
  if (activePackIds.length === 0) {
    return [];
  }

  const changedPaths = files.map((file) => file.path);
  const findingsBySource = new Map<string, Finding[]>();

  for (const pack of frameworkPacks.filter((candidate) => activePackIds.includes(candidate.id))) {
    for (const rule of pack.companionRules) {
      const matchingSources = files.filter(
        (file) =>
          file.role === "source" &&
          file.status !== "deleted" &&
          matchesPathPattern(rule.whenChanged, file.path)
      );

      if (
        matchingSources.length === 0 ||
        rule.expectAny.some((pattern) =>
          changedPaths.some((path) => matchesPathPattern(pattern, path))
        )
      ) {
        continue;
      }

      for (const source of matchingSources) {
        findingsBySource.set(source.path, [
          ...(findingsBySource.get(source.path) ?? []),
          toFrameworkFinding(source, pack.label, rule)
        ]);
      }
    }
  }

  return [...findingsBySource.values()].flatMap((findings) =>
    findings.slice(0, maxFrameworkFindingsPerSource)
  );
}

function toFrameworkFinding(
  file: DiffFile,
  frameworkLabel: string,
  rule: {
    id: string;
    expectAny: string[];
    reason: string;
  }
): Finding {
  return {
    id: `expected-companions:framework:${rule.id}:${file.path}`,
    detector: "expected-companions",
    severity: "medium",
    confidence: 0.72,
    title: "Expected framework companion missing",
    message: `${file.path} changed without an expected ${frameworkLabel} support file.`,
    evidence: [
      {
        kind: "file",
        path: file.path,
        message: rule.reason,
        data: {
          expectedAny: rule.expectAny,
          framework: frameworkLabel,
          rule: rule.id
        }
      }
    ],
    repair: `Add one of ${rule.expectAny.join(", ")}, or document why this ${frameworkLabel} change does not need a support file.`,
    tags: ["scope"]
  };
}

function getCappedHistoryFindings(rules: CompanionRule[]): Finding[] {
  const grouped = new Map<string, CompanionRule[]>();

  for (const rule of rules) {
    grouped.set(rule.sourcePath, [...(grouped.get(rule.sourcePath) ?? []), rule]);
  }

  return [...grouped.values()].flatMap((sourceRules) =>
    [...sourceRules]
      .sort((left, right) => {
        const confidenceDelta = right.confidence - left.confidence;

        if (confidenceDelta !== 0) {
          return confidenceDelta;
        }

        return right.support - left.support;
      })
      .slice(0, maxHistoryFindingsPerSource)
      .map((rule) => toHistoryFinding(rule))
  );
}

function detectMissingLockfile(files: DiffFile[]): Finding | undefined {
  const changedPaths = new Set(files.map((file) => file.path));
  const changedPackage = files.find(
    (file) => file.path === "package.json" || file.path.endsWith("/package.json")
  );

  if (
    changedPackage === undefined ||
    [...changedPaths].some((path) =>
      /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb)$/.test(path)
    )
  ) {
    return undefined;
  }

  return {
    id: `expected-companions:${changedPackage.path}:lockfile`,
    detector: "expected-companions",
    severity: "medium",
    confidence: 0.86,
    title: "Expected companion lockfile missing",
    message: `${changedPackage.path} changed without a corresponding package lockfile change.`,
    evidence: [
      {
        kind: "file",
        path: changedPackage.path,
        message: "Package manifest changed but no lockfile changed in this diff."
      }
    ],
    repair:
      "Update the matching lockfile, or document why the manifest-only change is intentional.",
    tags: ["dependency"]
  };
}

function toHistoryFinding(rule: CompanionRule): Finding {
  return {
    id: `expected-companions:${rule.sourcePath}:${rule.expectedPath}`,
    detector: "expected-companions",
    severity: "medium",
    confidence: Math.min(0.92, 0.55 + rule.confidence * 0.35),
    title: "Expected companion file missing",
    message: `${rule.sourcePath} changed without historically paired companion ${rule.expectedPath}.`,
    evidence: [
      {
        kind: "history",
        path: rule.sourcePath,
        message: `${rule.expectedPath} has historically changed with ${rule.sourcePath}.`,
        data: {
          expectedPath: rule.expectedPath,
          support: rule.support,
          confidence: rule.confidence
        }
      }
    ],
    repair: `Update ${rule.expectedPath}, or document why this change does not need its usual companion.`,
    tags: ["scope"]
  };
}

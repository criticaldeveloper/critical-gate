import type { CompanionRule } from "../knowledge/index.js";
import type { DiffFile, Finding } from "../schema/index.js";
import type { Detector } from "./types.js";

export const expectedCompanionsDetector: Detector = {
  name: "expected-companions",
  run: ({ diff, context }) => {
    const history = context?.knowledge?.getHistoryIndex();

    if (history === undefined) {
      return [];
    }

    const changedPaths = new Set(diff.files.map((file) => file.path));
    const historyFindings = history.companionRules
      .filter((rule) => changedPaths.has(rule.sourcePath) && !changedPaths.has(rule.expectedPath))
      .map((rule) => toHistoryFinding(rule));
    const packageFinding = detectMissingLockfile(diff.files);

    return packageFinding === undefined ? historyFindings : [...historyFindings, packageFinding];
  }
};

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

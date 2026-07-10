import type { Finding, FindingReasonChain } from "../schema/index.js";

export function enrichFindingWithReasonChain(finding: Finding): Finding {
  return {
    ...finding,
    reasonChain: finding.reasonChain ?? createReasonChain(finding)
  };
}

export function createReasonChain(finding: Finding): FindingReasonChain {
  return {
    whatHappened: finding.message,
    whySuspicious: getWhySuspicious(finding),
    supportingSignals: getSupportingSignals(finding),
    acceptableIf: getAcceptableConditions(finding),
    repairHint: finding.repair
  };
}

function getWhySuspicious(finding: Finding): string {
  if (finding.tags.includes("secret")) {
    return "Secrets, local paths, and internal endpoints can leak environment-specific or sensitive data into the repository.";
  }

  if (finding.tags.includes("test")) {
    return "Agent changes can keep tests green while removing behavioral protection.";
  }

  if (finding.tags.includes("dependency")) {
    return "New dependencies expand maintenance, security, and install surface area and should be justified by the task.";
  }

  if (finding.tags.includes("api")) {
    return "Public API changes can break downstream callers when they are not acknowledged or documented.";
  }

  if (finding.tags.includes("config")) {
    return "Configuration changes can alter developer workflow, CI behavior, or runtime behavior outside the requested change.";
  }

  if (finding.tags.includes("rewrite")) {
    return "Large rewrites for small tasks increase review cost and make unrelated behavior changes harder to spot.";
  }

  if (finding.tags.includes("utility")) {
    return "Creating a new helper when a local solution already exists can fragment repository conventions.";
  }

  if (finding.tags.includes("convention")) {
    return "Repository convention drift makes future changes harder to predict and maintain.";
  }

  if (finding.tags.includes("scope")) {
    return "The changed files or historical relationships do not clearly fit the task's expected blast radius.";
  }

  return "The finding indicates a diff-integrity risk that should be reviewed before merge.";
}

function getSupportingSignals(finding: Finding): string[] {
  const evidenceSignals = finding.evidence.map((evidence) => {
    const location =
      evidence.path === undefined
        ? evidence.kind
        : `${evidence.path}${evidence.startLine === undefined ? "" : `:${evidence.startLine}`}`;

    return `${location}: ${evidence.message}`;
  });

  return [
    `Detector: ${finding.detector}`,
    `Severity: ${finding.severity}`,
    `Evidence strength: ${Math.round((finding.evidenceStrength ?? finding.confidence) * 100)}%`,
    ...evidenceSignals
  ];
}

function getAcceptableConditions(finding: Finding): string[] {
  if (finding.tags.includes("secret")) {
    return [
      "The value is a documented non-sensitive placeholder.",
      "The evidence is a known scanner false positive and no real secret or environment-specific value was added."
    ];
  }

  if (finding.tags.includes("test")) {
    return [
      "The removed or weakened assertion is replaced by an equally specific behavioral assertion.",
      "The task explicitly removes obsolete behavior and the test change documents that contract change."
    ];
  }

  if (finding.tags.includes("dependency")) {
    return [
      "The task explicitly requires the dependency.",
      "The dependency is documented and no local or platform-native solution is suitable."
    ];
  }

  if (finding.tags.includes("api")) {
    return [
      "The task explicitly asks for a public API change.",
      "A changelog, migration note, or release note documents the public contract change."
    ];
  }

  if (finding.tags.includes("config")) {
    return [
      "The task explicitly includes configuration or workflow changes.",
      "Documentation, an ADR, changelog, or PR explanation describes the operational impact."
    ];
  }

  if (finding.tags.includes("scope")) {
    return [
      "The task intent explicitly covers this file or support area.",
      "The file is a necessary companion to the requested change and the reason is documented."
    ];
  }

  return [
    "The task intent explicitly covers the change.",
    "The diff includes enough evidence to show the change is intentional and scoped."
  ];
}

import type { DiffFile, Finding, TaskIntent } from "../schema/index.js";
import { analyzeTaskIntent, getDiffMetrics } from "./task-analysis.js";

export interface DiffCoherenceScore {
  score: number;
  drivers: DiffCoherenceDriver[];
}

export interface DiffCoherenceDriver {
  code: string;
  label: string;
  points: number;
  evidence?: string[];
}

export function calculateDiffCoherenceScore(
  task: TaskIntent,
  files: DiffFile[],
  findings: Finding[]
): DiffCoherenceScore {
  const drivers = [
    getContainmentDriver(files, findings),
    getSupportCoverageDriver(files, findings),
    getRiskDisciplineDriver(findings),
    getChurnDriver(task, files),
    getTestAlignmentDriver(files, findings)
  ];

  return {
    score: Math.max(
      0,
      Math.min(
        100,
        drivers.reduce((total, driver) => total + driver.points, 0)
      )
    ),
    drivers
  };
}

function getContainmentDriver(files: DiffFile[], findings: Finding[]): DiffCoherenceDriver {
  const scopeFindings = findings.filter((finding) => finding.tags.includes("scope"));
  const unexpectedClusters = findings.filter((finding) => finding.detector === "blast-radius");

  if (scopeFindings.length === 0 && unexpectedClusters.length === 0) {
    return {
      code: "contained-diff",
      label: "Diff is contained to the expected task area",
      points: 30,
      evidence: files.map((file) => file.path).slice(0, 5)
    };
  }

  return {
    code: "scope-drift",
    label: "Scope findings reduce diff coherence",
    points: Math.max(0, 30 - scopeFindings.length * 8 - unexpectedClusters.length * 10),
    evidence: scopeFindings.map((finding) => finding.id).slice(0, 5)
  };
}

function getSupportCoverageDriver(files: DiffFile[], findings: Finding[]): DiffCoherenceDriver {
  const missingCompanions = findings.filter(
    (finding) => finding.detector === "expected-companions"
  );
  const roles = new Set(files.map((file) => file.role));

  if (missingCompanions.length === 0) {
    return {
      code: "support-files-present",
      label: "No expected companion files are missing",
      points: roles.has("test") ? 20 : 16,
      evidence: [...roles].sort()
    };
  }

  return {
    code: "missing-support-files",
    label: "Expected support files are missing",
    points: Math.max(0, 20 - missingCompanions.length * 5),
    evidence: missingCompanions.map((finding) => finding.id).slice(0, 5)
  };
}

function getRiskDisciplineDriver(findings: Finding[]): DiffCoherenceDriver {
  const blockerOrHigh = findings.filter(
    (finding) => finding.severity === "blocker" || finding.severity === "high"
  );
  const riskFindings = findings.filter((finding) =>
    finding.tags.some((tag) => ["dependency", "api", "test", "secret", "config"].includes(tag))
  );

  if (blockerOrHigh.length === 0 && riskFindings.length === 0) {
    return {
      code: "risk-disciplined",
      label: "No high-risk integrity findings",
      points: 25
    };
  }

  return {
    code: "risk-findings",
    label: "High-risk findings reduce coherence",
    points: Math.max(0, 25 - blockerOrHigh.length * 10 - riskFindings.length * 4),
    evidence: [...new Set([...blockerOrHigh, ...riskFindings].map((finding) => finding.id))].slice(
      0,
      5
    )
  };
}

function getChurnDriver(task: TaskIntent, files: DiffFile[]): DiffCoherenceDriver {
  const analysis = analyzeTaskIntent(task);
  const metrics = getDiffMetrics(files);
  const threshold =
    analysis.complexity === "small" ? 80 : analysis.complexity === "medium" ? 180 : 400;

  if (metrics.churn <= threshold) {
    return {
      code: "churn-fits-task",
      label: "Churn fits task complexity",
      points: 15,
      evidence: [`churn:${metrics.churn}`, `complexity:${analysis.complexity}`]
    };
  }

  return {
    code: "churn-exceeds-task",
    label: "Churn exceeds task complexity",
    points: Math.max(0, 15 - Math.ceil((metrics.churn - threshold) / 40) * 5),
    evidence: [
      `churn:${metrics.churn}`,
      `threshold:${threshold}`,
      `complexity:${analysis.complexity}`
    ]
  };
}

function getTestAlignmentDriver(files: DiffFile[], findings: Finding[]): DiffCoherenceDriver {
  const changedSource = files.some((file) => file.role === "source");
  const changedTests = files.some((file) => file.role === "test");
  const testWeakening = findings.some((finding) => finding.tags.includes("test"));

  if (testWeakening) {
    return {
      code: "test-integrity-risk",
      label: "Test integrity findings reduce coherence",
      points: 0,
      evidence: findings
        .filter((finding) => finding.tags.includes("test"))
        .map((finding) => finding.id)
    };
  }

  if (changedSource && changedTests) {
    return {
      code: "tests-move-with-source",
      label: "Tests changed with source",
      points: 10
    };
  }

  if (!changedSource) {
    return {
      code: "no-source-test-need",
      label: "No source change requiring test movement",
      points: 10
    };
  }

  return {
    code: "source-without-tests",
    label: "Source changed without tests",
    points: 5
  };
}

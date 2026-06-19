import type { DiffFile, Finding, TaskIntent } from "../schema/index.js";
import { analyzeTaskIntent, getDiffMetrics } from "./task-analysis.js";

export interface ScopeExpansionScore {
  score: number;
  drivers: ScopeExpansionDriver[];
}

export interface ScopeExpansionDriver {
  code: string;
  label: string;
  points: number;
  evidence?: string[];
}

export function calculateScopeExpansionScore(
  task: TaskIntent,
  files: DiffFile[],
  findings: Finding[]
): ScopeExpansionScore {
  const analysis = analyzeTaskIntent(task);
  const metrics = getDiffMetrics(files);
  const drivers = [
    getClusterDriver(findings),
    getHighRiskRoleDriver(files),
    getRewriteDriver(findings),
    getFindingDriver(findings, "dependency", "dependency-change", "Dependency changes"),
    getFindingDriver(findings, "api", "api-surface-change", "API surface changes"),
    getFindingDriver(findings, "config", "config-change", "Configuration changes"),
    getMissingCompanionDriver(findings),
    getChurnDriver(analysis.complexity, metrics.churn)
  ].filter((driver): driver is ScopeExpansionDriver => driver !== undefined);

  return {
    score: Math.min(
      10,
      drivers.reduce((total, driver) => total + driver.points, 0)
    ),
    drivers
  };
}

function getClusterDriver(findings: Finding[]): ScopeExpansionDriver | undefined {
  const clusters = findings.filter((finding) => finding.detector === "blast-radius");

  if (clusters.length === 0) {
    return undefined;
  }

  return {
    code: "unexpected-clusters",
    label: "Unexpected changed-file clusters",
    points: Math.min(3, clusters.length * 2),
    evidence: clusters.flatMap((finding) =>
      finding.evidence
        .map((evidence) => evidence.path)
        .filter((path): path is string => path !== undefined)
    )
  };
}

function getHighRiskRoleDriver(files: DiffFile[]): ScopeExpansionDriver | undefined {
  const paths = files
    .filter(
      (file) => file.role === "config" || file.role === "manifest" || file.role === "lockfile"
    )
    .map((file) => file.path);

  if (paths.length === 0) {
    return undefined;
  }

  return {
    code: "high-risk-roles",
    label: "Config, manifest, or lockfile touched",
    points: Math.min(2, paths.length),
    evidence: paths
  };
}

function getRewriteDriver(findings: Finding[]): ScopeExpansionDriver | undefined {
  return getFindingDriver(findings, "rewrite", "rewrite", "Rewrite-like churn");
}

function getFindingDriver(
  findings: Finding[],
  tag: Finding["tags"][number],
  code: string,
  label: string
): ScopeExpansionDriver | undefined {
  const matching = findings.filter((finding) => finding.tags.includes(tag));

  if (matching.length === 0) {
    return undefined;
  }

  return {
    code,
    label,
    points: Math.min(2, matching.length),
    evidence: matching.map((finding) => finding.id)
  };
}

function getMissingCompanionDriver(findings: Finding[]): ScopeExpansionDriver | undefined {
  const matching = findings.filter((finding) => finding.detector === "expected-companions");

  if (matching.length === 0) {
    return undefined;
  }

  return {
    code: "missing-companions",
    label: "Expected companion files missing",
    points: Math.min(2, matching.length),
    evidence: matching.map((finding) => finding.id)
  };
}

function getChurnDriver(
  complexity: ReturnType<typeof analyzeTaskIntent>["complexity"],
  churn: number
): ScopeExpansionDriver | undefined {
  const threshold = complexity === "small" ? 80 : complexity === "medium" ? 180 : 400;

  if (churn <= threshold) {
    return undefined;
  }

  return {
    code: "churn",
    label: "Churn exceeds task complexity",
    points: complexity === "small" ? 2 : 1,
    evidence: [`churn:${churn}`, `complexity:${complexity}`]
  };
}

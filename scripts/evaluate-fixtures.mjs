import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import process from "node:process";
import console from "node:console";

import {
  parseTaskContractJson,
  parseUnifiedDiff,
  runDetectors,
  summarizeFindings
} from "../dist/index.js";

const casesDir = join(process.cwd(), "eval", "cases");
const outputDir = join(process.cwd(), "artifacts", "evaluation");
const jsonPath = join(outputDir, "critical-gate-evaluation.json");
const markdownPath = join(outputDir, "critical-gate-evaluation.md");

const cases = readCases(casesDir);
const generatedAt = new Date().toISOString();
const caseResults = cases.map(evaluateCase);
const metrics = calculateMetrics(caseResults);
const evaluation = {
  schemaVersion: 2,
  generatedAt,
  casesDir: "eval/cases",
  passed: caseResults.every((result) => result.passed),
  metrics,
  cases: caseResults
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(evaluation, null, 2)}\n`, "utf8");
writeFileSync(markdownPath, renderMarkdown(evaluation), "utf8");

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${markdownPath}`);
console.log(
  `Evaluation: ${metrics.cases} cases, precision ${formatPercent(
    metrics.findingPrecision
  )}, recall ${formatPercent(metrics.findingRecall)}`
);

if (!evaluation.passed) {
  process.exitCode = 1;
}

function readCases(root) {
  if (!existsSync(root)) {
    throw new Error(`Evaluation cases directory not found: ${root}`);
  }

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readCase(join(root, entry.name)))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function readCase(caseDir) {
  const id = basename(caseDir);
  const expected = JSON.parse(readRequiredFile(caseDir, "expected-findings.json"));

  return {
    id,
    task: readRequiredFile(caseDir, "task.md").trim(),
    diffPatch: readRequiredFile(caseDir, "diff.patch"),
    notes: readRequiredFile(caseDir, "notes.md").trim(),
    taskContract: readOptionalTaskContract(caseDir),
    expected: validateExpected(id, expected)
  };
}

function readOptionalTaskContract(caseDir) {
  const path = join(caseDir, "task-contract.json");

  return existsSync(path) ? parseTaskContractJson(readFileSync(path, "utf8")) : undefined;
}

function readRequiredFile(caseDir, fileName) {
  const path = join(caseDir, fileName);

  if (!existsSync(path)) {
    throw new Error(`Missing evaluation case file: ${path}`);
  }

  return readFileSync(path, "utf8");
}

function validateExpected(id, value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${id}: expected-findings.json must contain an object.`);
  }

  if (typeof value.shouldBlock !== "boolean") {
    throw new Error(`${id}: expected-findings.json requires boolean shouldBlock.`);
  }

  if (!Array.isArray(value.expectedFindings)) {
    throw new Error(`${id}: expected-findings.json requires expectedFindings array.`);
  }

  for (const key of ["sourceRepository", "caseType", "labelSource"]) {
    if (typeof value[key] !== "string" || value[key].trim().length === 0) {
      throw new Error(`${id}: expected-findings.json requires non-empty ${key}.`);
    }
  }

  if (
    !value.expectedFindings.every(
      (finding) =>
        typeof finding === "object" &&
        finding !== null &&
        typeof finding.detector === "string" &&
        (finding.severity === undefined || typeof finding.severity === "string") &&
        (finding.file === undefined || typeof finding.file === "string")
    )
  ) {
    throw new Error(
      `${id}: expectedFindings entries require detector and optional severity/file strings.`
    );
  }

  return {
    evaluationSet: validateEvaluationSet(id, value.evaluationSet),
    sourceRepository: value.sourceRepository,
    caseType: value.caseType,
    labelSource: value.labelSource,
    shouldBlock: value.shouldBlock,
    expectedFindingCount: validateOptionalExpectedFindingCount(id, value.expectedFindingCount),
    expectedFindings: value.expectedFindings,
    frameworkPacks: validateOptionalStringArray(id, value.frameworkPacks, "frameworkPacks"),
    monorepo: validateMonorepo(id, value.monorepo),
    repositoryProfile: validateRepositoryProfile(id, value.repositoryProfile),
    allowedExtraDetectors: Array.isArray(value.allowedExtraDetectors)
      ? value.allowedExtraDetectors.filter((entry) => typeof entry === "string")
      : []
  };
}

function validateMonorepo(id, value) {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !Array.isArray(value.configFiles) ||
    !Array.isArray(value.workspaceGlobs) ||
    !Array.isArray(value.packages) ||
    !value.packages.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.path === "string" &&
        typeof entry.name === "string"
    )
  ) {
    throw new Error(
      `${id}: monorepo requires configFiles, workspaceGlobs, and packages with path/name strings.`
    );
  }

  return value;
}

function validateEvaluationSet(id, value) {
  if (value === undefined) {
    return "development";
  }

  if (value !== "development" && value !== "calibration" && value !== "holdout") {
    throw new Error(
      `${id}: evaluationSet must be development, calibration, or holdout when present.`
    );
  }

  return value;
}

function validateOptionalExpectedFindingCount(id, value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${id}: expectedFindingCount must be a non-negative integer when present.`);
  }

  return value;
}

function validateOptionalStringArray(id, value, key) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`${id}: ${key} must be an array of strings when present.`);
  }

  return value;
}

function validateRepositoryProfile(id, value) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${id}: repositoryProfile must be an object when present.`);
  }

  if (
    !Number.isFinite(value.commitCount) ||
    !Number.isFinite(value.minConfidenceCommitCount) ||
    !Array.isArray(value.coChanges)
  ) {
    throw new Error(
      `${id}: repositoryProfile requires commitCount, minConfidenceCommitCount, and coChanges.`
    );
  }

  return value;
}

function evaluateCase(evaluationCase) {
  const task = {
    source: "cli",
    text: evaluationCase.task
  };
  const diff = {
    baseRef: "evaluation/base",
    headRef: "evaluation/head",
    files: parseUnifiedDiff(evaluationCase.diffPatch)
  };
  const detectorContext =
    evaluationCase.expected.repositoryProfile === undefined &&
    evaluationCase.expected.frameworkPacks === undefined &&
    evaluationCase.expected.monorepo === undefined &&
    evaluationCase.taskContract === undefined
      ? undefined
      : {
          repositoryProfile: evaluationCase.expected.repositoryProfile,
          frameworkPacks: evaluationCase.expected.frameworkPacks,
          monorepo: evaluationCase.expected.monorepo,
          taskContract: evaluationCase.taskContract
        };
  const findings = runDetectors(task, diff, detectorContext);
  const summary = summarizeFindings(findings, task, diff);
  const matchedExpectedFindings = evaluationCase.expected.expectedFindings.filter((expected) =>
    findings.some((finding) => matchesExpectedFinding(finding, expected))
  );
  const missingExpectedFindings = evaluationCase.expected.expectedFindings.filter(
    (expected) => !matchedExpectedFindings.includes(expected)
  );
  const unexpectedBlockingFindings = findings.filter(
    (finding) =>
      isBlockingSeverity(finding.severity) &&
      !evaluationCase.expected.expectedFindings.some((expected) =>
        matchesExpectedFinding(finding, expected)
      ) &&
      !evaluationCase.expected.allowedExtraDetectors.includes(finding.detector)
  );
  const expectedBlock = evaluationCase.expected.shouldBlock;
  const actualBlock = summary.decision === "fail";
  const expectedFindingCount = evaluationCase.expected.expectedFindingCount;
  const findingCountMatches =
    expectedFindingCount === undefined || expectedFindingCount === findings.length;
  const passed =
    expectedBlock === actualBlock &&
    findingCountMatches &&
    missingExpectedFindings.length === 0 &&
    (!expectedBlock ? unexpectedBlockingFindings.length === 0 : true);

  return {
    id: evaluationCase.id,
    expectedBlock,
    actualBlock,
    expectedFindingCount,
    actualFindingCount: findings.length,
    passed,
    outcome: classifyOutcome(expectedBlock, actualBlock, missingExpectedFindings),
    task: evaluationCase.task,
    notes: evaluationCase.notes,
    sourceRepository: evaluationCase.expected.sourceRepository,
    caseType: evaluationCase.expected.caseType,
    evaluationSet: evaluationCase.expected.evaluationSet,
    labelSource: evaluationCase.expected.labelSource,
    summary,
    expectedFindings: evaluationCase.expected.expectedFindings,
    matchedExpectedFindings,
    missingExpectedFindings,
    unexpectedBlockingFindings: unexpectedBlockingFindings.map(summarizeFinding),
    findings: findings.map(summarizeFinding)
  };
}

function matchesExpectedFinding(finding, expected) {
  if (finding.detector !== expected.detector) {
    return false;
  }

  if (expected.severity !== undefined && finding.severity !== expected.severity) {
    return false;
  }

  if (expected.file !== undefined) {
    return finding.evidence.some((evidence) => evidence.path === expected.file);
  }

  return true;
}

function summarizeFinding(finding) {
  return {
    id: finding.id,
    detector: finding.detector,
    severity: finding.severity,
    confidence: finding.confidence,
    title: finding.title,
    files: [
      ...new Set(
        finding.evidence.map((evidence) => evidence.path).filter((path) => typeof path === "string")
      )
    ]
  };
}

function classifyOutcome(expectedBlock, actualBlock, missingExpectedFindings) {
  if (expectedBlock && actualBlock && missingExpectedFindings.length === 0) {
    return "true-positive";
  }

  if (!expectedBlock && !actualBlock) {
    return "true-negative";
  }

  if (!expectedBlock && actualBlock) {
    return "false-positive";
  }

  return "false-negative";
}

function calculateMetrics(results) {
  const truePositives = results.filter((result) => result.outcome === "true-positive").length;
  const trueNegatives = results.filter((result) => result.outcome === "true-negative").length;
  const falsePositives = results.filter((result) => result.outcome === "false-positive").length;
  const falseNegatives = results.filter((result) => result.outcome === "false-negative").length;
  const expectedFindingCount = results.reduce(
    (total, result) => total + result.expectedFindings.length,
    0
  );
  const matchedFindingCount = results.reduce(
    (total, result) => total + result.matchedExpectedFindings.length,
    0
  );
  const unexpectedBlockingCount = results.reduce(
    (total, result) => total + result.unexpectedBlockingFindings.length,
    0
  );

  return {
    cases: results.length,
    truePositives,
    trueNegatives,
    falsePositives,
    falseNegatives,
    casePrecision: divide(truePositives, truePositives + falsePositives),
    caseRecall: divide(truePositives, truePositives + falseNegatives),
    findingPrecision: divide(matchedFindingCount, matchedFindingCount + unexpectedBlockingCount),
    findingRecall: divide(matchedFindingCount, expectedFindingCount),
    detectorMetrics: getDetectorMetrics(results),
    evaluationSetMetrics: getGroupedMetrics(results, "evaluationSet"),
    repositoryMetrics: getGroupedMetrics(results, "sourceRepository"),
    caseTypeMetrics: getGroupedMetrics(results, "caseType"),
    noisiestDetector: getNoisiestDetector(results),
    bestDetector: getBestDetector(results)
  };
}

function getGroupedMetrics(results, key) {
  const groups = new Map();

  for (const result of results) {
    const group = result[key];
    const entries = groups.get(group) ?? [];
    entries.push(result);
    groups.set(group, entries);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, groupResults]) => {
      const truePositives = groupResults.filter(
        (result) => result.outcome === "true-positive"
      ).length;
      const trueNegatives = groupResults.filter(
        (result) => result.outcome === "true-negative"
      ).length;
      const falsePositives = groupResults.filter(
        (result) => result.outcome === "false-positive"
      ).length;
      const falseNegatives = groupResults.filter(
        (result) => result.outcome === "false-negative"
      ).length;

      return {
        group,
        cases: groupResults.length,
        truePositives,
        trueNegatives,
        falsePositives,
        falseNegatives,
        casePrecision: divide(truePositives, truePositives + falsePositives),
        caseRecall: divide(truePositives, truePositives + falseNegatives)
      };
    });
}

function getDetectorMetrics(results) {
  const detectorNames = new Set();

  for (const result of results) {
    for (const expected of result.expectedFindings) {
      detectorNames.add(expected.detector);
    }

    for (const finding of result.unexpectedBlockingFindings) {
      detectorNames.add(finding.detector);
    }
  }

  return [...detectorNames].sort().map((detector) => {
    const expected = results.reduce(
      (total, result) =>
        total + result.expectedFindings.filter((finding) => finding.detector === detector).length,
      0
    );
    const matched = results.reduce(
      (total, result) =>
        total +
        result.matchedExpectedFindings.filter((finding) => finding.detector === detector).length,
      0
    );
    const unexpectedBlocking = results.reduce(
      (total, result) =>
        total +
        result.unexpectedBlockingFindings.filter((finding) => finding.detector === detector).length,
      0
    );

    return {
      detector,
      expected,
      matched,
      unexpectedBlocking,
      precision: divide(matched, matched + unexpectedBlocking),
      recall: divide(matched, expected),
      evidenceLevel: expected >= 3 ? "measured" : "anecdotal"
    };
  });
}

function getNoisiestDetector(results) {
  const counts = new Map();

  for (const finding of results.flatMap((result) => result.unexpectedBlockingFindings)) {
    counts.set(finding.detector, (counts.get(finding.detector) ?? 0) + 1);
  }

  return topCount(counts);
}

function getBestDetector(results) {
  const counts = new Map();

  for (const expected of results.flatMap((result) => result.matchedExpectedFindings)) {
    counts.set(expected.detector, (counts.get(expected.detector) ?? 0) + 1);
  }

  return topCount(counts);
}

function topCount(counts) {
  const [detector, count] = [...counts.entries()].sort(
    ([leftDetector, leftCount], [rightDetector, rightCount]) =>
      rightCount - leftCount || leftDetector.localeCompare(rightDetector)
  )[0] ?? [null, 0];

  return { detector, count };
}

function divide(numerator, denominator) {
  return denominator === 0 ? 1 : Number((numerator / denominator).toFixed(4));
}

function isBlockingSeverity(severity) {
  return severity === "blocker" || severity === "high";
}

function renderMarkdown(evaluation) {
  const metrics = evaluation.metrics;

  return [
    "# Critical Gate Evaluation",
    "",
    `Generated: ${evaluation.generatedAt}`,
    `Cases: ${metrics.cases}`,
    `Passed: ${evaluation.passed ? "yes" : "no"}`,
    "",
    "## Metrics",
    "",
    `- True Positives: ${metrics.truePositives}`,
    `- True Negatives: ${metrics.trueNegatives}`,
    `- False Positives: ${metrics.falsePositives}`,
    `- False Negatives: ${metrics.falseNegatives}`,
    `- Case Precision: ${formatPercent(metrics.casePrecision)}`,
    `- Case Recall: ${formatPercent(metrics.caseRecall)}`,
    `- Finding Precision: ${formatPercent(metrics.findingPrecision)}`,
    `- Finding Recall: ${formatPercent(metrics.findingRecall)}`,
    `- Noisiest Detector: ${formatDetectorCount(metrics.noisiestDetector)}`,
    `- Best Detector: ${formatDetectorCount(metrics.bestDetector)}`,
    "",
    "## Detector Metrics",
    "",
    "| Detector | Expected | Matched | Unexpected Blocking | Precision | Recall | Evidence |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...metrics.detectorMetrics.map(
      (metric) =>
        `| ${metric.detector} | ${metric.expected} | ${metric.matched} | ${metric.unexpectedBlocking} | ${formatPercent(metric.precision)} | ${formatPercent(metric.recall)} | ${metric.evidenceLevel} |`
    ),
    "",
    "## Evaluation Set Metrics",
    "",
    "| Set | Cases | TP | TN | FP | FN | Precision | Recall |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...metrics.evaluationSetMetrics.map((metric) => renderGroupedMetricRow(metric)),
    "",
    "## Repository Metrics",
    "",
    "| Repository | Cases | TP | TN | FP | FN | Precision | Recall |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...metrics.repositoryMetrics.map((metric) => renderGroupedMetricRow(metric)),
    "",
    "## Case Type Metrics",
    "",
    "| Case Type | Cases | TP | TN | FP | FN | Precision | Recall |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...metrics.caseTypeMetrics.map((metric) => renderGroupedMetricRow(metric)),
    "",
    "## Cases",
    "",
    ...evaluation.cases.flatMap((result) => renderCase(result)),
    ""
  ].join("\n");
}

function renderCase(result) {
  return [
    `### ${result.id}`,
    "",
    `- Outcome: ${result.outcome}`,
    `- Passed: ${result.passed ? "yes" : "no"}`,
    `- Expected Block: ${result.expectedBlock ? "yes" : "no"}`,
    `- Actual Block: ${result.actualBlock ? "yes" : "no"}`,
    `- Source Repository: ${result.sourceRepository}`,
    `- Case Type: ${result.caseType}`,
    `- Evaluation Set: ${result.evaluationSet}`,
    `- Label Source: ${result.labelSource}`,
    `- Findings: ${result.summary.findingCount}`,
    `- Notes: ${result.notes}`,
    ""
  ];
}

function renderGroupedMetricRow(metric) {
  return `| ${metric.group} | ${metric.cases} | ${metric.truePositives} | ${metric.trueNegatives} | ${metric.falsePositives} | ${metric.falseNegatives} | ${formatPercent(metric.casePrecision)} | ${formatPercent(metric.caseRecall)} |`;
}

function formatDetectorCount(value) {
  return value.detector === null ? "none" : `${value.detector} (${value.count})`;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

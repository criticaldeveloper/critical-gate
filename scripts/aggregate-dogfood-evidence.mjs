import console from "node:console";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";

const defaultRepos = [
  "C:/dev/critical-components",
  "C:/dev/criticaldeveloper-blog",
  "C:/dev/criticaldeveloper-ft"
];
const defaultJsonOutput = "artifacts/dogfood/evidence-summary.json";
const defaultMarkdownOutput = "docs/dogfood-evidence-summary.md";
const requiredLabelFields = [
  "schemaVersion",
  "reportId",
  "repo",
  "reportPath",
  "task",
  "taskType",
  "runLabel",
  "decision",
  "findingCount",
  "usefulFindingCount",
  "falsePositiveFindingCount",
  "missedFindingCount",
  "detectorsReviewed",
  "repairOutcome",
  "fixtureNeeded",
  "fixtureCreated",
  "notes"
];
const optionalBooleanLabelFields = [
  "repairAttempted",
  "repairPromptCaptured",
  "repairScopeStayedWithinTask",
  "repairScopeStayedWithinContract",
  "missedFindingsReviewed"
];
const optionalStringLabelFields = [
  "repairPromptPath",
  "repairDiffPath",
  "rerunReportPath",
  "rerunDecision",
  "missedFindingNotes"
];

const args = parseArgs(process.argv.slice(2));
const repos = parseList(args.repo, defaultRepos).map((repo) => resolvePath(repo));
const jsonOutputPath = resolve(args.json ?? defaultJsonOutput);
const markdownOutputPath = resolve(args.markdown ?? defaultMarkdownOutput);
const labels = repos.flatMap(readRepoLabels);
const summary = buildSummary(labels, repos);

mkdirSync(dirname(jsonOutputPath), { recursive: true });
mkdirSync(dirname(markdownOutputPath), { recursive: true });
writeFileSync(jsonOutputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
writeFileSync(markdownOutputPath, renderMarkdown(summary), "utf8");

console.log(`Dogfood evidence summary written to ${markdownOutputPath}`);
console.log(`Dogfood evidence JSON written to ${jsonOutputPath}`);
console.log(
  `Aggregated ${summary.metrics.totalReports} labels from ${summary.metrics.repositories} repositories.`
);

if (summary.validation.errorCount > 0) {
  process.exitCode = 1;
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];

    if (!entry.startsWith("--")) {
      fail(`Unexpected argument: ${entry}`);
    }

    const key = entry.slice(2);
    const next = argv[index + 1];

    if (next === undefined || next.startsWith("--")) {
      parsed[key] = true;
    } else if (parsed[key] === undefined) {
      parsed[key] = next;
      index += 1;
    } else if (Array.isArray(parsed[key])) {
      parsed[key].push(next);
      index += 1;
    } else {
      parsed[key] = [parsed[key], next];
      index += 1;
    }
  }

  return parsed;
}

function parseList(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((entry) => String(entry).split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolvePath(path) {
  return resolve(path.replaceAll("/", "\\"));
}

function readRepoLabels(repoPath) {
  const evidenceRoot = join(repoPath, "docs", "critical-gate-evidence");

  if (!existsSync(evidenceRoot)) {
    return [
      {
        validationErrors: [`Evidence root not found: ${evidenceRoot}`],
        repoPath,
        missing: true
      }
    ];
  }

  return findFiles(evidenceRoot, ".labels.json").map((labelPath) =>
    readLabel(repoPath, evidenceRoot, labelPath)
  );
}

function findFiles(root, suffix) {
  const files = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...findFiles(path, suffix));
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      files.push(path);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function readLabel(repoPath, evidenceRoot, labelPath) {
  const validationErrors = [];
  let label;

  try {
    label = JSON.parse(readJsonText(labelPath));
  } catch (error) {
    label = { parseFailed: true };
    validationErrors.push(`Invalid JSON: ${error.message}`);
  }

  validationErrors.push(...validateLabel(label));

  const reportPath = label.reportPath
    ? join(repoPath, ...String(label.reportPath).split("/"))
    : labelPath.replace(/\.labels\.json$/u, ".json");
  const report = readOptionalReport(reportPath);

  if (report.error !== undefined) {
    validationErrors.push(report.error);
  }

  return {
    ...label,
    repoPath,
    labelPath,
    relativeLabelPath: relative(repoPath, labelPath).replaceAll("\\", "/"),
    relativeEvidencePath: relative(evidenceRoot, labelPath).replaceAll("\\", "/"),
    reportSummary: report.summary,
    validationErrors
  };
}

function validateLabel(label) {
  const errors = [];

  if (typeof label !== "object" || label === null || Array.isArray(label)) {
    return ["Label must be a JSON object."];
  }

  for (const field of requiredLabelFields) {
    if (label[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  for (const field of [
    "findingCount",
    "usefulFindingCount",
    "falsePositiveFindingCount",
    "missedFindingCount"
  ]) {
    if (label[field] !== undefined && !Number.isFinite(label[field])) {
      errors.push(`${field} must be a number.`);
    }
  }

  if (label.detectorsReviewed !== undefined && !Array.isArray(label.detectorsReviewed)) {
    errors.push("detectorsReviewed must be an array.");
  }

  for (const field of optionalBooleanLabelFields) {
    if (label[field] !== undefined && typeof label[field] !== "boolean") {
      errors.push(`${field} must be a boolean when present.`);
    }
  }

  for (const field of optionalStringLabelFields) {
    if (label[field] !== undefined && typeof label[field] !== "string") {
      errors.push(`${field} must be a string when present.`);
    }
  }

  return errors;
}

function readOptionalReport(reportPath) {
  if (!existsSync(reportPath)) {
    return { error: `Raw report not found: ${reportPath}` };
  }

  if (!statSync(reportPath).isFile()) {
    return { error: `Raw report path is not a file: ${reportPath}` };
  }

  try {
    const report = JSON.parse(readJsonText(reportPath));

    return {
      summary: {
        generatedAt: report.generatedAt,
        decision: report.summary?.decision,
        findingCount: report.summary?.findingCount,
        blockerCount: report.summary?.blockerCount,
        highCount: report.summary?.highCount,
        mediumCount: report.summary?.mediumCount,
        lowCount: report.summary?.lowCount,
        diffCoherenceScore: report.summary?.diffCoherenceScore?.score,
        scopeExpansionScore: report.summary?.scopeExpansionScore?.score,
        diffCostScore: report.summary?.diffCostScore
      }
    };
  } catch (error) {
    return { error: `Unable to parse raw report ${reportPath}: ${error.message}` };
  }
}

function readJsonText(path) {
  return readFileSync(path, "utf8").replace(/^\uFEFF|^ï»¿/u, "");
}

function buildSummary(labels, repoPaths) {
  const validLabels = labels.filter((label) => !label.missing && label.parseFailed !== true);
  const repos = groupBy(validLabels, (label) => label.repo ?? "unknown");
  const detectorCounts = countDetectors(validLabels);
  const runLabels = countBy(validLabels, (label) => label.runLabel ?? "unknown");
  const taskTypes = countBy(validLabels, (label) => label.taskType ?? "unknown");
  const repairOutcomes = countBy(validLabels, (label) => label.repairOutcome ?? "unknown");
  const repairLoopMetrics = summarizeRepairLoops(validLabels);
  const validationErrors = labels.flatMap((label) =>
    (label.validationErrors ?? []).map((error) => ({
      repo: label.repo ?? label.repoPath,
      labelPath: label.relativeLabelPath,
      error
    }))
  );

  return {
    schemaVersion: 1,
    generatedAt: latestReportTimestamp(validLabels) ?? new Date().toISOString(),
    sources: repoPaths.map((repoPath) => repoPath.replaceAll("\\", "/")),
    metrics: {
      repositories: Object.keys(repos).length,
      totalReports: validLabels.length,
      runLabels,
      taskTypes,
      repairOutcomes,
      usefulFindingCount: sum(validLabels, "usefulFindingCount"),
      falsePositiveFindingCount: sum(validLabels, "falsePositiveFindingCount"),
      missedFindingCount: sum(validLabels, "missedFindingCount"),
      fixtureNeededCount: validLabels.filter((label) => label.fixtureNeeded === true).length,
      fixtureCreatedCount: validLabels.filter((label) => label.fixtureCreated === true).length,
      repairLoopMetrics,
      detectorCounts
    },
    validation: {
      errorCount: validationErrors.length,
      errors: validationErrors
    },
    repositories: Object.entries(repos)
      .map(([repo, repoLabels]) => summarizeRepo(repo, repoLabels))
      .sort((left, right) => left.repo.localeCompare(right.repo)),
    reports: validLabels.map(summarizeLabel)
  };
}

function latestReportTimestamp(labels) {
  const timestamps = labels
    .map((label) => label.reportSummary?.generatedAt)
    .filter((value) => typeof value === "string" && value.length > 0)
    .sort();

  return timestamps.at(-1);
}

function summarizeRepo(repo, labels) {
  return {
    repo,
    reports: labels.length,
    runLabels: countBy(labels, (label) => label.runLabel ?? "unknown"),
    usefulFindingCount: sum(labels, "usefulFindingCount"),
    falsePositiveFindingCount: sum(labels, "falsePositiveFindingCount"),
    missedFindingCount: sum(labels, "missedFindingCount"),
    fixtureNeededCount: labels.filter((label) => label.fixtureNeeded === true).length,
    repairLoopMetrics: summarizeRepairLoops(labels),
    detectorCounts: countDetectors(labels)
  };
}

function summarizeLabel(label) {
  return {
    repo: label.repo,
    reportId: label.reportId,
    task: label.task,
    taskType: label.taskType,
    runLabel: label.runLabel,
    decision: label.decision,
    findingCount: label.findingCount,
    usefulFindingCount: label.usefulFindingCount,
    falsePositiveFindingCount: label.falsePositiveFindingCount,
    missedFindingCount: label.missedFindingCount,
    repairOutcome: label.repairOutcome,
    repairAttempted: label.repairAttempted,
    repairPromptCaptured: label.repairPromptCaptured,
    rerunReportPath: label.rerunReportPath,
    rerunDecision: label.rerunDecision,
    repairScopeStayedWithinTask: label.repairScopeStayedWithinTask,
    repairScopeStayedWithinContract: label.repairScopeStayedWithinContract,
    missedFindingsReviewed: label.missedFindingsReviewed,
    fixtureNeeded: label.fixtureNeeded,
    fixtureCreated: label.fixtureCreated,
    detectorsReviewed: label.detectorsReviewed ?? [],
    labelPath: label.relativeLabelPath,
    validationErrors: label.validationErrors ?? []
  };
}

function summarizeRepairLoops(labels) {
  const attempted = labels.filter((label) => label.repairAttempted === true);
  const rerun = labels.filter(
    (label) => typeof label.rerunReportPath === "string" && label.rerunReportPath.length > 0
  );
  const scopedToTask = labels.filter((label) => label.repairScopeStayedWithinTask === true);
  const scopedToContract = labels.filter((label) => label.repairScopeStayedWithinContract === true);

  return {
    repairAttemptedCount: attempted.length,
    repairPromptCapturedCount: labels.filter((label) => label.repairPromptCaptured === true).length,
    repairRerunCount: rerun.length,
    repairSuccessCount: labels.filter(
      (label) => label.repairOutcome === "repaired" || label.rerunDecision === "pass"
    ).length,
    repairScopedToTaskCount: scopedToTask.length,
    repairScopedToContractCount: scopedToContract.length,
    missedFindingsReviewedCount: labels.filter((label) => label.missedFindingsReviewed === true)
      .length,
    missedFindingsReviewMissingCount: labels.filter(
      (label) => label.missedFindingsReviewed !== true
    ).length
  };
}

function groupBy(values, getKey) {
  const groups = {};

  for (const value of values) {
    const key = getKey(value);
    groups[key] ??= [];
    groups[key].push(value);
  }

  return groups;
}

function countBy(values, getKey) {
  const counts = {};

  for (const value of values) {
    const key = getKey(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return sortRecord(counts);
}

function countDetectors(labels) {
  const counts = {};

  for (const label of labels) {
    for (const detector of label.detectorsReviewed ?? []) {
      counts[detector] = (counts[detector] ?? 0) + 1;
    }
  }

  return sortRecord(counts);
}

function sortRecord(record) {
  return Object.fromEntries(
    Object.entries(record).sort((left, right) => {
      const countDelta = right[1] - left[1];
      return countDelta === 0 ? left[0].localeCompare(right[0]) : countDelta;
    })
  );
}

function sum(labels, field) {
  return labels.reduce((total, label) => total + (Number(label[field]) || 0), 0);
}

function renderMarkdown(summary) {
  const lines = [
    "# Dogfood Evidence Summary",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "## Overview",
    "",
    `- Repositories: ${summary.metrics.repositories}`,
    `- Labeled reports: ${summary.metrics.totalReports}`,
    `- Useful findings: ${summary.metrics.usefulFindingCount}`,
    `- False-positive finding instances: ${summary.metrics.falsePositiveFindingCount}`,
    `- Missed findings: ${summary.metrics.missedFindingCount}`,
    `- Fixture-needed reports: ${summary.metrics.fixtureNeededCount}`,
    `- Fixture-created reports: ${summary.metrics.fixtureCreatedCount}`,
    `- Repair attempts captured: ${summary.metrics.repairLoopMetrics.repairAttemptedCount}`,
    `- Repair reruns captured: ${summary.metrics.repairLoopMetrics.repairRerunCount}`,
    `- Repairs passing rerun: ${summary.metrics.repairLoopMetrics.repairSuccessCount}`,
    `- Missed-finding reviews captured: ${summary.metrics.repairLoopMetrics.missedFindingsReviewedCount}`,
    "",
    "## Run Labels",
    "",
    renderCountTable(summary.metrics.runLabels),
    "",
    "## Detector Frequency",
    "",
    renderCountTable(summary.metrics.detectorCounts),
    "",
    "## Repair Loop Evidence",
    "",
    renderRepairLoopMetrics(summary.metrics.repairLoopMetrics),
    "",
    "## Repositories",
    "",
    ...summary.repositories.map(
      (repo) =>
        `- ${repo.repo}: ${repo.reports} reports; useful findings ${repo.usefulFindingCount}; false-positive findings ${repo.falsePositiveFindingCount}; missed findings ${repo.missedFindingCount}; fixture-needed reports ${repo.fixtureNeededCount}; repair attempts ${repo.repairLoopMetrics.repairAttemptedCount}; missed-finding reviews ${repo.repairLoopMetrics.missedFindingsReviewedCount}.`
    ),
    "",
    "## Reports",
    "",
    ...renderReportList(summary.reports),
    ""
  ];

  if (summary.validation.errorCount > 0) {
    lines.push(
      "## Validation Errors",
      "",
      ...summary.validation.errors.map(
        (error) => `- ${error.labelPath ?? error.repo}: ${error.error}`
      ),
      ""
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function renderReportList(reports) {
  const grouped = groupBy(reports, (report) => report.repo ?? "unknown");
  const lines = [];

  for (const [repo, repoReports] of Object.entries(grouped).sort((left, right) =>
    left[0].localeCompare(right[0])
  )) {
    lines.push(`### ${repo}`, "");

    for (const report of repoReports) {
      lines.push(
        `- \`${report.reportId}\`: ${report.runLabel}; findings ${report.findingCount}; false positives ${report.falsePositiveFindingCount}; fixture needed ${formatBoolean(report.fixtureNeeded)}; repair attempted ${formatBoolean(report.repairAttempted)}; missed reviewed ${formatBoolean(report.missedFindingsReviewed)}.`
      );
    }

    lines.push("");
  }

  return lines;
}

function renderRepairLoopMetrics(metrics) {
  return [
    `- Repair attempts captured: ${metrics.repairAttemptedCount}`,
    `- Repair prompts captured: ${metrics.repairPromptCapturedCount}`,
    `- Repair reruns captured: ${metrics.repairRerunCount}`,
    `- Repairs passing rerun: ${metrics.repairSuccessCount}`,
    `- Repairs scoped to task: ${metrics.repairScopedToTaskCount}`,
    `- Repairs scoped to repair contract: ${metrics.repairScopedToContractCount}`,
    `- Missed-finding reviews captured: ${metrics.missedFindingsReviewedCount}`,
    `- Reports still missing missed-finding review: ${metrics.missedFindingsReviewMissingCount}`
  ].join("\n");
}

function renderCountTable(counts) {
  const entries = Object.entries(counts);

  if (entries.length === 0) {
    return "_None._";
  }

  return [...entries.map(([key, value]) => `- ${key}: ${value}`)].join("\n");
}

function formatBoolean(value) {
  if (value === undefined) {
    return "not recorded";
  }

  return value === true ? "yes" : "no";
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

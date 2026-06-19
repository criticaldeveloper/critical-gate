import { execFileSync, spawnSync } from "node:child_process";
import console from "node:console";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import process from "node:process";

const defaultScenarioPath = "dogfood/scenarios/mv-ft.json";
const defaultOutRoot = "artifacts/dogfood";
const defaultGateCommand = `node ${join(process.cwd(), "dist", "cli.js")}`;

const args = parseArgs(process.argv.slice(2));
const command = args.command ?? "plan";
const scenarioPath = resolve(args.scenarios ?? defaultScenarioPath);
const scenarioSet = readScenarioSet(scenarioPath);
const repoPath = resolve(args.repo ?? scenarioSet.repository.defaultPath);
const outDir = resolve(args.out ?? join(defaultOutRoot, defaultRunId(scenarioSet.repository.id)));
const gateCommand = args.gate ?? defaultGateCommand;
const scenarioIds = parseScenarioIds(args.scenario);
const selectedScenarios = selectScenarios(scenarioSet.scenarios, scenarioIds);

if (selectedScenarios.length === 0) {
  fail("No scenarios selected.");
}

switch (command) {
  case "plan":
    writePlan();
    break;
  case "collect-before":
    collectGateArtifacts("before");
    break;
  case "collect-after":
    collectGateArtifacts("after");
    break;
  case "summarize":
    summarizeRun();
    break;
  default:
    fail(
      `Unknown command: ${command}. Expected plan, collect-before, collect-after, or summarize.`
    );
}

function writePlan() {
  ensureDirectory(outDir);
  writeManifest();

  for (const scenario of selectedScenarios) {
    const scenarioDir = getScenarioDir(scenario.id);
    writeScenarioScaffold(scenarioDir, scenario);
  }

  writeFileSync(join(outDir, "summary.md"), renderPlanSummary(), "utf8");

  console.log(`Dogfood plan written to ${outDir}`);
  console.log(`Selected scenarios: ${selectedScenarios.map((scenario) => scenario.id).join(", ")}`);
  console.log("");
  console.log("Next:");
  console.log(`  Implement one scenario in ${repoPath}`);
  console.log(
    `  node scripts/dogfood-runner.mjs collect-before --repo "${repoPath}" --out "${outDir}" --scenario DF-01`
  );
}

function collectGateArtifacts(stage) {
  assertRepoPath(repoPath);
  ensureDirectory(outDir);
  writeManifest();

  const git = createGit(repoPath);
  const status = git(["status", "--short"]);
  const head = git(["rev-parse", "HEAD"]).trim();
  const branch = git(["branch", "--show-current"]).trim();

  for (const scenario of selectedScenarios) {
    const scenarioDir = getScenarioDir(scenario.id);
    writeScenarioScaffold(scenarioDir, scenario);
    writeFileSync(join(scenarioDir, `${stage}-status.txt`), status, "utf8");
    writeFileSync(join(scenarioDir, `${stage}-head.txt`), `${head}\n`, "utf8");
    writeFileSync(join(scenarioDir, `${stage}-branch.txt`), `${branch}\n`, "utf8");
    writeFileSync(join(scenarioDir, `diff-${stage}.patch`), readDiff(repoPath), "utf8");

    const results = [
      runGate(scenario, "json", join(scenarioDir, `gate-${stage}.json`)),
      runGate(scenario, "markdown", join(scenarioDir, `gate-${stage}.md`)),
      runGate(scenario, "repair", join(scenarioDir, `repair-${stage}.md`))
    ];

    writeFileSync(
      join(scenarioDir, `gate-${stage}-commands.json`),
      `${JSON.stringify(results, null, 2)}\n`,
      "utf8"
    );
    console.log(`${scenario.id}: collected ${stage} artifacts in ${scenarioDir}`);
  }

  summarizeRun();
}

function summarizeRun() {
  ensureDirectory(outDir);
  const scenarioSummaries = selectedScenarios.map((scenario) => summarizeScenario(scenario));
  const metrics = calculateMetrics(scenarioSummaries);
  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repository: {
      id: scenarioSet.repository.id,
      path: repoPath
    },
    scenarioCount: scenarioSummaries.length,
    metrics,
    scenarios: scenarioSummaries
  };

  writeFileSync(join(outDir, "metrics.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  writeFileSync(join(outDir, "summary.md"), renderSummaryMarkdown(summary), "utf8");
  console.log(`Dogfood summary written to ${join(outDir, "summary.md")}`);
}

function runGate(scenario, format, outputPath) {
  const startedAt = Date.now();
  const parsed = splitCommand(gateCommand);
  const result = spawnSync(
    parsed.command,
    [
      ...parsed.args,
      "check",
      "--task",
      scenario.prompt,
      "--format",
      format,
      "--output",
      outputPath
    ],
    {
      cwd: repoPath,
      encoding: "utf8"
    }
  );

  return {
    format,
    outputPath: relative(outDir, outputPath).replaceAll("\\", "/"),
    exitCode: result.status,
    runtimeMs: Date.now() - startedAt,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}

function readDiff(root) {
  const result = spawnSync("git", ["diff", "--", ".", ":(exclude).critical-gate/cache"], {
    cwd: root,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    fail(`Unable to read diff from ${root}:\n${result.stderr}`);
  }

  return result.stdout;
}

function summarizeScenario(scenario) {
  const scenarioDir = getScenarioDir(scenario.id);
  const beforeJson = readGateJson(join(scenarioDir, "gate-before.json"));
  const afterJson = readGateJson(join(scenarioDir, "gate-after.json"));
  const labels = readOptionalJson(join(scenarioDir, "labels.json"));
  const beforeDiffPath = join(scenarioDir, "diff-before.patch");
  const afterDiffPath = join(scenarioDir, "diff-after.patch");

  return {
    id: scenario.id,
    title: scenario.title,
    riskType: scenario.riskType,
    expectedFirstRun: scenario.expectedFirstRun,
    expectedRepair: scenario.repairExpectation,
    before: beforeJson === undefined ? undefined : summarizeGateResult(beforeJson, beforeDiffPath),
    after: afterJson === undefined ? undefined : summarizeGateResult(afterJson, afterDiffPath),
    labels: labels?.labels ?? createEmptyLabels(scenario).labels,
    artifactPath: relative(outDir, scenarioDir).replaceAll("\\", "/")
  };
}

function summarizeGateResult(result, diffPath) {
  const diff = existsSync(diffPath) ? readFileSync(diffPath, "utf8") : "";

  return {
    decision: result.summary?.decision,
    findingCount: result.summary?.findingCount,
    highCount: result.summary?.highCount,
    blockerCount: result.summary?.blockerCount,
    diffCostScore: result.summary?.diffCostScore,
    scopeExpansionScore: result.summary?.scopeExpansionScore?.score,
    changedFiles: result.diff?.files?.length,
    reviewChars: diff.length,
    findings: Array.isArray(result.findings)
      ? result.findings.map((finding) => ({
          detector: finding.detector,
          severity: finding.severity,
          confidence: finding.confidence,
          title: finding.title
        }))
      : []
  };
}

function calculateMetrics(scenarios) {
  const labeled = scenarios.filter((scenario) => scenario.labels.scenarioOutcome !== "unlabeled");
  const repairLabeled = scenarios.filter(
    (scenario) => scenario.labels.repairOutcome !== "unlabeled"
  );
  const repaired = repairLabeled.filter(
    (scenario) => scenario.labels.repairOutcome === "repaired"
  ).length;
  const usefulObservations = labeled.filter(
    (scenario) => scenario.labels.scenarioOutcome === "useful-observation"
  ).length;
  const truePositives = labeled.filter(
    (scenario) => scenario.labels.scenarioOutcome === "true-positive"
  ).length;
  const trueNegatives = labeled.filter(
    (scenario) => scenario.labels.scenarioOutcome === "true-negative"
  ).length;
  const falsePositives = labeled.filter(
    (scenario) => scenario.labels.scenarioOutcome === "false-positive"
  ).length;
  const falseNegatives = labeled.filter(
    (scenario) => scenario.labels.scenarioOutcome === "false-negative"
  ).length;
  const estimatedMinutesSaved = scenarios.reduce(
    (total, scenario) => total + estimateMinutesSaved(scenario),
    0
  );

  return {
    labeledScenarios: labeled.length,
    truePositives,
    trueNegatives,
    falsePositives,
    falseNegatives,
    usefulObservations,
    scenarioPrecision: divide(truePositives, truePositives + falsePositives),
    scenarioRecall: divide(truePositives, truePositives + falseNegatives),
    repairLabeled: repairLabeled.length,
    repairSuccessRate: divide(repaired, repairLabeled.length),
    estimatedMinutesSaved: Math.round(estimatedMinutesSaved * 10) / 10,
    noisiestDetector: getDetectorCount(scenarios, "false-positive"),
    bestDetector: getDetectorCount(scenarios, "true-positive")
  };
}

function estimateMinutesSaved(scenario) {
  if (
    scenario.labels.scenarioOutcome === "false-positive" ||
    scenario.labels.scenarioOutcome === "false-negative"
  ) {
    return 0;
  }

  const before = scenario.before;
  const after = scenario.after;

  if (before === undefined) {
    return 0;
  }

  const suspiciousDiffMinutes = Math.max(0, before.reviewChars - (after?.reviewChars ?? 0)) / 12000;
  const highRiskMinutes = ((before.highCount ?? 0) + (before.blockerCount ?? 0)) * 3;
  const checklistMinutes = Math.max(0, (before.findingCount ?? 0) - (after?.findingCount ?? 0));

  return suspiciousDiffMinutes + highRiskMinutes + checklistMinutes;
}

function getDetectorCount(scenarios, outcome) {
  const counts = new Map();

  for (const scenario of scenarios) {
    if (scenario.labels.scenarioOutcome !== outcome) {
      continue;
    }

    for (const finding of scenario.before?.findings ?? []) {
      counts.set(finding.detector, (counts.get(finding.detector) ?? 0) + 1);
    }
  }

  let best;
  for (const [detector, count] of counts) {
    if (best === undefined || count > best.count) {
      best = { detector, count };
    }
  }

  return best;
}

function writeManifest() {
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scenarioFile: relative(process.cwd(), scenarioPath).replaceAll("\\", "/"),
    outDir,
    gateCommand,
    repository: {
      ...scenarioSet.repository,
      path: repoPath,
      gitHead: safeGit(repoPath, ["rev-parse", "HEAD"])?.trim(),
      branch: safeGit(repoPath, ["branch", "--show-current"])?.trim()
    },
    selectedScenarios: selectedScenarios.map((scenario) => scenario.id),
    commands: {
      plan: `node scripts/dogfood-runner.mjs plan --repo "${repoPath}" --scenarios "${scenarioPath}" --out "${outDir}"`,
      collectBefore: `node scripts/dogfood-runner.mjs collect-before --repo "${repoPath}" --scenarios "${scenarioPath}" --out "${outDir}" --scenario <ID>`,
      collectAfter: `node scripts/dogfood-runner.mjs collect-after --repo "${repoPath}" --scenarios "${scenarioPath}" --out "${outDir}" --scenario <ID>`,
      summarize: `node scripts/dogfood-runner.mjs summarize --repo "${repoPath}" --scenarios "${scenarioPath}" --out "${outDir}"`
    }
  };

  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function writeScenarioScaffold(scenarioDir, scenario) {
  ensureDirectory(scenarioDir);
  writeFileSync(join(scenarioDir, "prompt.md"), renderPrompt(scenario), "utf8");

  const labelsPath = join(scenarioDir, "labels.json");
  if (!existsSync(labelsPath)) {
    writeFileSync(labelsPath, `${JSON.stringify(createEmptyLabels(scenario), null, 2)}\n`, "utf8");
  }

  const notesPath = join(scenarioDir, "notes.md");
  if (!existsSync(notesPath)) {
    writeFileSync(notesPath, renderNotesStub(scenario), "utf8");
  }
}

function renderPlanSummary() {
  return [
    "# Dogfood Run Plan",
    "",
    `Repository: \`${repoPath}\``,
    `Scenario file: \`${relative(process.cwd(), scenarioPath).replaceAll("\\", "/")}\``,
    `Output: \`${outDir}\``,
    "",
    "## Scenarios",
    "",
    ...selectedScenarios.map(
      (scenario) =>
        `- ${scenario.id}: ${scenario.title} (${scenario.riskType}) - expected first run: ${scenario.expectedFirstRun}`
    ),
    "",
    "## Manual Loop",
    "",
    "1. Open the target repository.",
    "2. Implement one scenario prompt from its `prompt.md`.",
    "3. Run `collect-before` for that scenario.",
    "4. If repair is needed, feed `repair-before.md` to the agent.",
    "5. Run `collect-after` for that scenario.",
    "6. Fill `labels.json` and `notes.md`.",
    "7. Restore the target repository before moving to the next scenario.",
    ""
  ].join("\n");
}

function renderSummaryMarkdown(summary) {
  const metrics = summary.metrics;

  return [
    "# Dogfood Run Summary",
    "",
    `Generated: ${summary.generatedAt}`,
    `Repository: \`${summary.repository.path}\``,
    `Scenarios: ${summary.scenarioCount}`,
    "",
    "## Metrics",
    "",
    `- Labeled scenarios: ${metrics.labeledScenarios}`,
    `- True positives: ${metrics.truePositives}`,
    `- True negatives: ${metrics.trueNegatives}`,
    `- False positives: ${metrics.falsePositives}`,
    `- False negatives: ${metrics.falseNegatives}`,
    `- Useful observations: ${metrics.usefulObservations}`,
    `- Scenario precision: ${formatPercent(metrics.scenarioPrecision)}`,
    `- Scenario recall: ${formatPercent(metrics.scenarioRecall)}`,
    `- Repair success rate: ${formatPercent(metrics.repairSuccessRate)}`,
    `- Estimated minutes saved: ${metrics.estimatedMinutesSaved}`,
    "",
    "## Scenario Results",
    "",
    ...summary.scenarios.flatMap(renderScenarioSummary),
    ""
  ].join("\n");
}

function renderScenarioSummary(scenario) {
  return [
    `### ${scenario.id}: ${scenario.title}`,
    "",
    `- Expected first run: ${scenario.expectedFirstRun}`,
    `- Label: ${scenario.labels.scenarioOutcome}`,
    `- Repair label: ${scenario.labels.repairOutcome}`,
    `- Before: ${renderGateSummary(scenario.before)}`,
    `- After: ${renderGateSummary(scenario.after)}`,
    `- Artifacts: \`${scenario.artifactPath}\``,
    ""
  ];
}

function renderGateSummary(result) {
  if (result === undefined) {
    return "not collected";
  }

  return `${result.decision}, ${result.findingCount} findings, ${result.changedFiles} files`;
}

function renderPrompt(scenario) {
  return [
    `# ${scenario.id}: ${scenario.title}`,
    "",
    "## Prompt",
    "",
    scenario.prompt,
    "",
    "## Expected First Run",
    "",
    scenario.expectedFirstRun,
    "",
    "## Allowed Change Shape",
    "",
    "```json",
    JSON.stringify(scenario.allowedChangeShape, null, 2),
    "```",
    "",
    "## Seeded Bad Mutation",
    "",
    scenario.seededBadMutation === null
      ? "None. This scenario is expected to represent a legitimate implementation."
      : scenario.seededBadMutation.description,
    "",
    "## Value Hypothesis",
    "",
    scenario.valueHypothesis,
    ""
  ].join("\n");
}

function renderNotesStub(scenario) {
  return [
    `# ${scenario.id} Notes`,
    "",
    "## Implementation Notes",
    "",
    "- ",
    "",
    "## First Gate Assessment",
    "",
    "- ",
    "",
    "## Repair Assessment",
    "",
    "- ",
    "",
    "## False Positive / False Negative Notes",
    "",
    "- ",
    ""
  ].join("\n");
}

function createEmptyLabels(scenario) {
  return {
    scenarioId: scenario.id,
    labels: {
      scenarioOutcome: "unlabeled",
      repairOutcome: scenario.repairExpectation === "not-needed" ? "not-needed" : "unlabeled",
      repairSpecificity: "unlabeled",
      evidenceQuality: "unlabeled",
      agentFollowed: "unlabeled",
      secondRunOutcome: "unlabeled"
    },
    reviewer: "",
    notes: ""
  };
}

function readScenarioSet(path) {
  if (!existsSync(path)) {
    fail(`Scenario file not found: ${path}`);
  }

  const data = JSON.parse(readFileSync(path, "utf8"));

  if (!Array.isArray(data.scenarios)) {
    fail(`${path} must include a scenarios array.`);
  }

  return data;
}

function selectScenarios(scenarios, ids) {
  if (ids.length === 0) {
    return scenarios;
  }

  const selected = scenarios.filter((scenario) => ids.includes(scenario.id));
  const found = new Set(selected.map((scenario) => scenario.id));
  const missing = ids.filter((id) => !found.has(id));

  if (missing.length > 0) {
    fail(`Unknown scenario id(s): ${missing.join(", ")}`);
  }

  return selected;
}

function readGateJson(path) {
  if (!existsSync(path)) {
    return undefined;
  }

  return JSON.parse(readFileSync(path, "utf8"));
}

function readOptionalJson(path) {
  if (!existsSync(path)) {
    return undefined;
  }

  return JSON.parse(readFileSync(path, "utf8"));
}

function getScenarioDir(id) {
  return join(outDir, id);
}

function createGit(root) {
  return (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function safeGit(root, args) {
  try {
    return createGit(root)(args);
  } catch {
    return undefined;
  }
}

function assertRepoPath(path) {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    fail(`Repository path does not exist or is not a directory: ${path}`);
  }

  if (!existsSync(join(path, ".git"))) {
    fail(`Repository path does not look like a git checkout: ${path}`);
  }
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true });
}

function parseArgs(argv) {
  const parsed = {};
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      parsed[arg.slice(2)] = true;
      continue;
    }

    parsed[arg.slice(2)] = value;
    index += 1;
  }

  return {
    ...parsed,
    command: positional[0]
  };
}

function parseScenarioIds(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitCommand(command) {
  const parts =
    command.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, "")) ?? [];

  if (parts.length === 0) {
    fail("Gate command cannot be empty.");
  }

  return {
    command: parts[0],
    args: parts.slice(1)
  };
}

function defaultRunId(repoId) {
  return `${repoId}-${new Date().toISOString().slice(0, 10)}`;
}

function divide(left, right) {
  return right === 0 ? 0 : left / right;
}

function formatPercent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

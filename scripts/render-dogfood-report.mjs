import console from "node:console";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

const args = parseArgs(process.argv.slice(2));
const inputPath = resolve(
  args.input ?? join("artifacts", "dogfood", "mv-ft-latest", "metrics.json")
);
const outputPath = resolve(args.output ?? join(dirname(inputPath), "report.html"));

if (!existsSync(inputPath)) {
  fail(`Dogfood metrics file not found: ${inputPath}`);
}

const summary = JSON.parse(readFileSync(inputPath, "utf8"));
const html = renderHtml(summary);

writeFileSync(outputPath, html, "utf8");
console.log(`Dogfood HTML report written to ${outputPath}`);

function renderHtml(summary) {
  const metrics = summary.metrics ?? {};
  const scenarios = Array.isArray(summary.scenarios) ? summary.scenarios : [];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Critical Gate Dogfood Report</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fa;
      --panel: #ffffff;
      --text: #1f2328;
      --muted: #667085;
      --border: #d0d7de;
      --blue: #0969da;
      --green: #1f883d;
      --red: #cf222e;
      --orange: #bc4c00;
      --purple: #8250df;
      --shadow: 0 10px 28px rgba(31, 35, 40, 0.08);
      font-family:
        Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
    }

    main {
      width: min(1180px, calc(100vw - 48px));
      margin: 0 auto;
      padding: 42px 0 56px;
    }

    header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      align-items: end;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }

    h1,
    h2,
    h3,
    p {
      margin: 0;
    }

    h1 {
      font-size: 34px;
      line-height: 1.12;
      letter-spacing: 0;
    }

    h2 {
      margin-top: 34px;
      font-size: 20px;
      letter-spacing: 0;
    }

    h3 {
      font-size: 16px;
      line-height: 1.25;
      letter-spacing: 0;
    }

    .subtitle {
      margin-top: 10px;
      max-width: 760px;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.55;
    }

    .meta {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 13px;
      text-align: right;
      white-space: nowrap;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-top: 18px;
    }

    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: var(--shadow);
      padding: 16px;
    }

    .metric-label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .metric-value {
      margin-top: 8px;
      font-size: 30px;
      font-weight: 760;
      line-height: 1;
    }

    .metric-note {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
    }

    .scenario-list {
      display: grid;
      gap: 14px;
      margin-top: 18px;
    }

    .scenario {
      display: grid;
      grid-template-columns: 1fr 260px;
      gap: 18px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      box-shadow: var(--shadow);
    }

    .scenario-top {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }

    .id {
      color: var(--blue);
      font-weight: 780;
      font-size: 13px;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border-radius: 999px;
      padding: 3px 9px;
      color: var(--muted);
      background: #f6f8fa;
      border: 1px solid var(--border);
      font-size: 12px;
      font-weight: 650;
    }

    .chip.pass,
    .chip.true-negative,
    .chip.repaired {
      color: var(--green);
      background: #dafbe1;
      border-color: #aceebb;
    }

    .chip.fail,
    .chip.true-positive {
      color: var(--red);
      background: #ffebe9;
      border-color: #ffcecb;
    }

    .chip.unlabeled,
    .chip.not-needed {
      color: var(--muted);
    }

    .chip.observation,
    .chip.useful-observation,
    .chip.partially-repaired {
      color: var(--orange);
      background: #fff1e5;
      border-color: #ffd8b5;
    }

    .gate-box {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 12px;
    }

    .gate {
      min-height: 98px;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      background: #f6f8fa;
    }

    .gate-title {
      color: var(--muted);
      font-size: 12px;
      font-weight: 760;
      text-transform: uppercase;
    }

    .gate-line {
      margin-top: 8px;
      font-size: 13px;
      line-height: 1.45;
    }

    .side {
      border-left: 1px solid var(--border);
      padding-left: 18px;
    }

    .side-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #eaeef2;
      font-size: 13px;
    }

    .side-row:last-child {
      border-bottom: 0;
    }

    .side-label {
      color: var(--muted);
    }

    .side-value {
      font-weight: 720;
      text-align: right;
    }

    .finding-list {
      margin-top: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .finding {
      border-radius: 6px;
      padding: 4px 7px;
      background: #f6f8fa;
      border: 1px solid var(--border);
      color: var(--muted);
      font-size: 12px;
      max-width: 100%;
    }

    .finding.high,
    .finding.blocker {
      color: var(--red);
      background: #ffebe9;
      border-color: #ffcecb;
    }

    .finding.medium {
      color: var(--orange);
      background: #fff1e5;
      border-color: #ffd8b5;
    }

    code {
      padding: 2px 5px;
      border-radius: 5px;
      background: #eef2f6;
      color: #24292f;
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
    }

    @media (max-width: 900px) {
      main {
        width: min(100vw - 28px, 1180px);
      }

      header,
      .scenario {
        grid-template-columns: 1fr;
      }

      .meta {
        text-align: left;
      }

      .grid,
      .gate-box {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .side {
        border-left: 0;
        border-top: 1px solid var(--border);
        padding-left: 0;
        padding-top: 12px;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Critical Gate Dogfood Report</h1>
        <p class="subtitle">Real-repository scenario evidence for detection quality, repair-loop usefulness, and review-cost reduction.</p>
      </div>
      <div class="meta">
        <span>Generated: ${escapeHtml(summary.generatedAt ?? "unknown")}</span>
        <span>Repository: <code>${escapeHtml(summary.repository?.path ?? "unknown")}</code></span>
        <span>Scenarios: ${escapeHtml(String(summary.scenarioCount ?? scenarios.length))}</span>
      </div>
    </header>

    <section>
      <h2>Metrics</h2>
      <div class="grid">
        ${renderMetric("Scenario Precision", formatPercent(metrics.scenarioPrecision), `${metrics.truePositives ?? 0} true positives / ${metrics.falsePositives ?? 0} false positives`)}
        ${renderMetric("Scenario Recall", formatPercent(metrics.scenarioRecall), `${metrics.falseNegatives ?? 0} false negatives`)}
        ${renderMetric("Repair Success", formatPercent(metrics.repairSuccessRate), `${metrics.repairLabeled ?? 0} repair-labeled scenarios`)}
        ${renderMetric("Estimated Saved", `${metrics.estimatedMinutesSaved ?? 0} min`, "Conservative review-time proxy")}
        ${renderMetric("True Positives", metrics.truePositives ?? 0, "Risky diffs caught")}
        ${renderMetric("True Negatives", metrics.trueNegatives ?? 0, "Legitimate diffs passed")}
        ${renderMetric("Useful Observations", metrics.usefulObservations ?? 0, "Non-blocking review value")}
        ${renderMetric("Labeled", metrics.labeledScenarios ?? 0, "Scenarios manually labeled")}
      </div>
    </section>

    <section>
      <h2>Scenario Evidence</h2>
      <div class="scenario-list">
        ${scenarios.map(renderScenario).join("\n")}
      </div>
    </section>
  </main>
</body>
</html>
`;
}

function renderMetric(label, value, note) {
  return `<article class="card">
  <div class="metric-label">${escapeHtml(label)}</div>
  <div class="metric-value">${escapeHtml(String(value))}</div>
  <div class="metric-note">${escapeHtml(note)}</div>
</article>`;
}

function renderScenario(scenario) {
  const before = scenario.before;
  const after = scenario.after;
  const labels = scenario.labels ?? {};

  return `<article class="scenario">
  <div>
    <div class="scenario-top">
      <span class="id">${escapeHtml(scenario.id)}</span>
      <h3>${escapeHtml(scenario.title)}</h3>
    </div>
    <div class="chips">
      ${renderChip(scenario.riskType)}
      ${renderChip(`expected: ${scenario.expectedFirstRun}`)}
      ${renderChip(labels.scenarioOutcome ?? "unlabeled")}
      ${renderChip(labels.repairOutcome ?? "unlabeled")}
    </div>
    <div class="gate-box">
      ${renderGateBox("Before", before)}
      ${renderGateBox("After", after)}
    </div>
    ${renderFindings(before)}
  </div>
  <aside class="side">
    ${renderSideRow("Expected repair", scenario.expectedRepair ?? "unknown")}
    ${renderSideRow("Artifact path", scenario.artifactPath ?? "unknown")}
    ${renderSideRow("Review chars", before?.reviewChars ?? "n/a")}
    ${renderSideRow("Scope score", before?.scopeExpansionScore ?? "n/a")}
    ${renderSideRow("Diff cost", before?.diffCostScore ?? "n/a")}
  </aside>
</article>`;
}

function renderGateBox(label, result) {
  if (result === undefined) {
    return `<div class="gate"><div class="gate-title">${escapeHtml(label)}</div><div class="gate-line">Not collected</div></div>`;
  }

  return `<div class="gate">
  <div class="gate-title">${escapeHtml(label)}</div>
  <div class="gate-line"><strong>${escapeHtml(result.decision ?? "unknown")}</strong></div>
  <div class="gate-line">${escapeHtml(String(result.findingCount ?? 0))} findings · ${escapeHtml(String(result.changedFiles ?? 0))} files</div>
  <div class="gate-line">${escapeHtml(String(result.highCount ?? 0))} high · ${escapeHtml(String(result.blockerCount ?? 0))} blockers</div>
</div>`;
}

function renderFindings(result) {
  const findings = result?.findings ?? [];

  if (findings.length === 0) {
    return `<div class="finding-list"><span class="finding">No collected findings</span></div>`;
  }

  return `<div class="finding-list">${findings
    .slice(0, 8)
    .map(
      (finding) =>
        `<span class="finding ${escapeAttribute(finding.severity ?? "")}">${escapeHtml(finding.detector ?? "unknown")} · ${escapeHtml(finding.severity ?? "unknown")}</span>`
    )
    .join("")}</div>`;
}

function renderSideRow(label, value) {
  return `<div class="side-row"><span class="side-label">${escapeHtml(label)}</span><span class="side-value">${escapeHtml(String(value))}</span></div>`;
}

function renderChip(value) {
  const label = String(value);
  const normalized = label.toLowerCase().replace(/[^a-z0-9-]+/g, "-");

  return `<span class="chip ${escapeAttribute(normalized)}">${escapeHtml(label)}</span>`;
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0%";
  }

  return `${Math.round(value * 1000) / 10}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/[^a-zA-Z0-9_-]/g, "");
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      fail(`Unexpected positional argument: ${arg}`);
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      parsed[arg.slice(2)] = true;
      continue;
    }

    parsed[arg.slice(2)] = value;
    index += 1;
  }

  return parsed;
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

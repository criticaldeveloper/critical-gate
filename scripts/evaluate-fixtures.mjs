import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";
import process from "node:process";
import console from "node:console";

const outputDir = join(process.cwd(), "artifacts", "evaluation");
const jsonPath = join(outputDir, "critical-gate-evaluation.json");
const markdownPath = join(outputDir, "critical-gate-evaluation.md");

const fixtureSuite = "tests/e2e-fixtures.test.ts";
const generatedAt = new Date().toISOString();
const cold = runFixtureSuite("cold", { CRITICAL_GATE_DISABLE_CACHE: "true" });
const warm = runFixtureSuite("warm", {});
const passed = cold.exitCode === 0 && warm.exitCode === 0;

const evaluation = {
  schemaVersion: 1,
  generatedAt,
  fixtureSuite,
  passed,
  metrics: {
    unexpectedActionsPrecision: passed ? 1 : 0,
    existingSolutionPrecision: passed ? 1 : 0,
    expectedCompanionRecall: passed ? 1 : 0,
    coldRunMs: cold.durationMs,
    warmRunMs: warm.durationMs
  },
  runs: [cold, warm],
  notes: [
    "Quality metrics are fixture-level proxies derived from the E2E fixture suite passing.",
    "Cold run disables the Critical Gate knowledge cache.",
    "Warm run uses normal cache behavior."
  ]
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(evaluation, null, 2)}\n`, "utf8");
writeFileSync(markdownPath, renderMarkdown(evaluation), "utf8");

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${markdownPath}`);

if (!passed) {
  process.exitCode = 1;
}

function runFixtureSuite(label, envOverrides) {
  const started = performance.now();
  const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "pnpm", "vitest", "run", fixtureSuite]
      : ["vitest", "run", fixtureSuite];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...envOverrides
    }
  });
  const durationMs = Math.round(performance.now() - started);

  return {
    label,
    exitCode: result.status ?? 1,
    durationMs,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr ?? result.error?.message ?? "")
  };
}

function tail(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(-12);
}

function renderMarkdown(evaluationResult) {
  return [
    "# Critical Gate Evaluation",
    "",
    `Generated: ${evaluationResult.generatedAt}`,
    `Fixture Suite: \`${evaluationResult.fixtureSuite}\``,
    `Passed: ${evaluationResult.passed ? "yes" : "no"}`,
    "",
    "## Metrics",
    "",
    `- Unexpected Actions Precision: ${evaluationResult.metrics.unexpectedActionsPrecision}`,
    `- Existing Solution Precision: ${evaluationResult.metrics.existingSolutionPrecision}`,
    `- Expected Companion Recall: ${evaluationResult.metrics.expectedCompanionRecall}`,
    `- Cold Run: ${evaluationResult.metrics.coldRunMs} ms`,
    `- Warm Run: ${evaluationResult.metrics.warmRunMs} ms`,
    "",
    "## Runs",
    "",
    ...evaluationResult.runs.flatMap((run) => [
      `### ${run.label}`,
      "",
      `- Exit Code: ${run.exitCode}`,
      `- Duration: ${run.durationMs} ms`,
      ""
    ]),
    "## Notes",
    "",
    ...evaluationResult.notes.map((note) => `- ${note}`),
    ""
  ].join("\n");
}

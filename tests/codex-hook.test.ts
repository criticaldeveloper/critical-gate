import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  GATE_RESULT_SCHEMA_VERSION,
  parseUnifiedDiff,
  renderRepairReport,
  runDetectors,
  summarizeFindings,
  type GateResult,
  type TaskIntent
} from "../src/index.js";

describe("Codex hook repair payload", () => {
  it("matches the fixture for an unjustified dependency", () => {
    const task: TaskIntent = {
      source: "cli",
      text: "Add signup validation"
    };
    const diff = {
      files: parseUnifiedDiff(
        readFileSync(join(process.cwd(), "fixtures", "codex", "failing-dependency.diff"), "utf8")
      )
    };
    const findings = runDetectors(task, diff);
    const result: GateResult = {
      schemaVersion: GATE_RESULT_SCHEMA_VERSION,
      generatedAt: "2026-06-18T00:00:00.000Z",
      task,
      diff,
      findings,
      summary: summarizeFindings(findings, task, diff)
    };

    expect(renderRepairReport(result)).toBe(
      readFileSync(
        join(process.cwd(), "fixtures", "codex", "failing-dependency.repair.txt"),
        "utf8"
      )
    );
  });
});

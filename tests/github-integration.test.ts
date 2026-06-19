import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("GitHub integration", () => {
  const action = readFileSync(join(process.cwd(), "action.yml"), "utf8");
  const workflow = readFileSync(
    join(process.cwd(), ".github", "workflows", "critical-gate.yml"),
    "utf8"
  );
  const sarifTemplate = readFileSync(
    join(process.cwd(), "docs", "workflows", "critical-gate-sarif.yml"),
    "utf8"
  );
  const summaryTemplate = readFileSync(
    join(process.cwd(), "docs", "workflows", "critical-gate-summary.yml"),
    "utf8"
  );
  const docs = readFileSync(join(process.cwd(), "docs", "github-integration.md"), "utf8");

  it("wraps the built CLI with pnpm setup", () => {
    expect(action).toContain('pnpm --dir "$GITHUB_ACTION_PATH" install --frozen-lockfile');
    expect(action).toContain('pnpm --dir "$GITHUB_ACTION_PATH" build');
    expect(action).toContain('node "$GITHUB_ACTION_PATH/dist/cli.js"');
    expect(action).toContain('--format "$CRITICAL_GATE_FORMAT"');
    expect(action).toContain('--output "$CRITICAL_GATE_OUTPUT"');
  });

  it("publishes SARIF from the example workflow", () => {
    expect(workflow).toContain("uses: actions/checkout@v6");
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("uses: github/codeql-action/upload-sarif@v4");
    expect(workflow).toContain("sarif_file: critical-gate.sarif");
    expect(workflow).toContain("continue-on-error: true");
  });

  it("ships reusable SARIF and summary workflow templates", () => {
    expect(sarifTemplate).toContain("uses: criticaldeveloper/critical-gate@v1");
    expect(sarifTemplate).toContain("fetch-depth: 0");
    expect(sarifTemplate).toContain("format: sarif");
    expect(sarifTemplate).toContain("uses: github/codeql-action/upload-sarif@v4");
    expect(sarifTemplate).toContain("continue-on-error: true");
    expect(sarifTemplate).toContain("steps.critical-gate.outcome == 'failure'");

    expect(summaryTemplate).toContain("uses: criticaldeveloper/critical-gate@v1");
    expect(summaryTemplate).toContain("fetch-depth: 0");
    expect(summaryTemplate).toContain("format: markdown");
    expect(summaryTemplate).toContain("$GITHUB_STEP_SUMMARY");
    expect(summaryTemplate).not.toContain("upload-sarif");
  });

  it("documents checks output and threshold guidance", () => {
    expect(docs).toContain("$GITHUB_STEP_SUMMARY");
    expect(docs).toContain("docs/workflows/critical-gate-sarif.yml");
    expect(docs).toContain("docs/workflows/critical-gate-summary.yml");
    expect(docs).toContain("fail the workflow on blocker and high findings");
    expect(docs).toContain('strict: "true"');
  });
});

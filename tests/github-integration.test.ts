import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("GitHub integration", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    version: string;
    scripts: Record<string, string>;
  };
  const action = readFileSync(join(process.cwd(), "action.yml"), "utf8");
  const workflow = readFileSync(
    join(process.cwd(), ".github", "workflows", "critical-gate.yml"),
    "utf8"
  );
  const ciWorkflow = readFileSync(join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");
  const sarifTemplate = readFileSync(
    join(process.cwd(), "docs", "workflows", "critical-gate-sarif.yml"),
    "utf8"
  );
  const summaryTemplate = readFileSync(
    join(process.cwd(), "docs", "workflows", "critical-gate-summary.yml"),
    "utf8"
  );
  const docs = readFileSync(join(process.cwd(), "docs", "github-integration.md"), "utf8");

  it("runs the npm CLI by default and keeps local mode for source artifacts", () => {
    expect(action).toContain(`default: "${packageJson.version}"`);
    expect(action).toContain("CRITICAL_GATE_VERSION: ${{ inputs.version }}");
    expect(action).toContain("if: ${{ inputs.version == 'local' }}");
    expect(action).toContain("if: ${{ inputs.version != 'local' }}");
    expect(action).toContain('pnpm --dir "$GITHUB_ACTION_PATH" install --frozen-lockfile');
    expect(action).toContain('pnpm --dir "$GITHUB_ACTION_PATH" build');
    expect(action).toContain('node "$GITHUB_ACTION_PATH/dist/cli.js"');
    expect(action).toContain('npx --yes "critical-gate@$CRITICAL_GATE_VERSION"');
    expect(action).toContain('--fail-on "$CRITICAL_GATE_FAIL_ON"');
    expect(action).toContain('--format "$CRITICAL_GATE_FORMAT"');
    expect(action).toContain('--output "$CRITICAL_GATE_OUTPUT"');
  });

  it("defines a prebuilt action artifact package path", () => {
    const prepareScript = readFileSync(
      join(process.cwd(), "scripts", "prepare-action-package.mjs"),
      "utf8"
    );
    const smokeScript = readFileSync(
      join(process.cwd(), "scripts", "smoke-action-package.mjs"),
      "utf8"
    );

    expect(packageJson.scripts["package:action"]).toBe(
      "pnpm build && node scripts/prepare-action-package.mjs"
    );
    expect(packageJson.scripts["smoke:action"]).toBe("node scripts/smoke-action-package.mjs");
    expect(prepareScript).toContain('join(root, "artifacts", "action")');
    expect(prepareScript).toContain('cpSync(join(root, "dist"), join(output, "dist")');
    expect(prepareScript).toContain("ACTION_ARTIFACT.md");
    expect(smokeScript).toContain('"dist/cli.js"');
    expect(smokeScript).toContain("node_modules");
    expect(smokeScript).toContain("--version");
  });

  it("documents prebuilt action mode", () => {
    expect(docs).toContain("pnpm package:action");
    expect(docs).toContain("pnpm smoke:action");
    expect(docs).toContain('install: "false"');
    expect(docs).toContain('build: "false"');
    expect(docs).toContain("artifacts/action");
  });

  it("publishes SARIF from the example workflow", () => {
    expect(workflow).toContain("uses: actions/checkout@v6");
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("uses: github/codeql-action/upload-sarif@v4");
    expect(workflow).toContain("sarif_file: critical-gate.sarif");
    expect(workflow).toContain("continue-on-error: true");
    expect(workflow).toContain("version: local");
  });

  it("publishes coverage and evaluation evidence from CI", () => {
    expect(ciWorkflow).toContain("pnpm coverage");
    expect(ciWorkflow).toContain("pnpm evaluate");
    expect(ciWorkflow).toContain("uses: actions/upload-artifact@v6");
    expect(ciWorkflow).toContain("name: critical-gate-coverage");
    expect(ciWorkflow).toContain("coverage/coverage-summary.json");
    expect(ciWorkflow).toContain("coverage/index.html");
    expect(ciWorkflow).toContain("name: critical-gate-evaluation");
    expect(ciWorkflow).toContain("artifacts/evaluation/critical-gate-evaluation.json");
    expect(ciWorkflow).toContain("artifacts/evaluation/critical-gate-evaluation.md");
  });

  it("ships reusable SARIF and summary workflow templates", () => {
    expect(sarifTemplate).toContain("uses: criticaldeveloper/critical-gate@v2");
    expect(sarifTemplate).toContain("fetch-depth: 0");
    expect(sarifTemplate).toContain("format: sarif");
    expect(sarifTemplate).toContain("uses: github/codeql-action/upload-sarif@v4");
    expect(sarifTemplate).toContain("continue-on-error: true");
    expect(sarifTemplate).toContain("steps.critical-gate.outcome == 'failure'");

    expect(summaryTemplate).toContain("uses: criticaldeveloper/critical-gate@v2");
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

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CLI_VERSION } from "../src/cli.js";
import { renderSarifReport, type GateResult } from "../src/index.js";
import { CRITICAL_GATE_VERSION } from "../src/version.js";

function readPackageVersion(path: string): string {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { version?: unknown };

  if (typeof parsed.version !== "string") {
    throw new Error(`${path} does not declare a string version.`);
  }

  return parsed.version;
}

describe("release version metadata", () => {
  const packageVersion = readPackageVersion(join(process.cwd(), "package.json"));
  const vscodeVersion = readPackageVersion(
    join(process.cwd(), "extensions", "vscode", "package.json")
  );

  it("keeps runtime version constants aligned with package manifests", () => {
    expect(CRITICAL_GATE_VERSION).toBe(packageVersion);
    expect(CLI_VERSION).toBe(packageVersion);
    expect(vscodeVersion).toBe(packageVersion);
  });

  it("emits the package version in SARIF tool metadata", () => {
    const result: GateResult = {
      schemaVersion: "1.0",
      generatedAt: "2026-06-21T00:00:00.000Z",
      task: {
        source: "cli",
        text: "Release Critical Gate"
      },
      diff: {
        baseRef: "main",
        headRef: "release/2.2.0",
        files: []
      },
      findings: [],
      summary: {
        decision: "pass",
        findingCount: 0,
        blockerCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        infoCount: 0,
        diffCostScore: 0
      }
    };
    const sarif = JSON.parse(renderSarifReport(result)) as {
      runs: Array<{ tool: { driver: { semanticVersion?: string } } }>;
    };

    expect(sarif.runs[0]?.tool.driver.semanticVersion).toBe(packageVersion);
  });
});

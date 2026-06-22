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
  const packageJsonPath = join(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
    bin?: Record<string, string>;
    engines?: Record<string, string>;
    files?: string[];
    scripts?: Record<string, string>;
  };
  const packageVersion = readPackageVersion(packageJsonPath);
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
        headRef: "release/2.3.1",
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

  it("keeps the npm CLI package installable without source checkout files", () => {
    expect(packageJson.bin?.["critical-gate"]).toBe("./dist/cli.js");
    expect(packageJson.files).toEqual(["dist", "README.md", "LICENSE"]);
    expect(packageJson.engines?.node).toBe(">=20");
    expect(packageJson.scripts?.["validate:npm-package"]).toBe(
      "pnpm build && node scripts/validate-npm-package.mjs"
    );
    expect(packageJson.scripts?.prepack).toBe(
      "pnpm build && node scripts/validate-npm-package.mjs"
    );
  });
});

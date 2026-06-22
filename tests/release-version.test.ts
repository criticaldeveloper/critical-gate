import { execFileSync } from "node:child_process";
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
  const actionYaml = readFileSync(join(process.cwd(), "action.yml"), "utf8");
  const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
  const changelog = readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8");
  const vscodeChangelog = readFileSync(
    join(process.cwd(), "extensions", "vscode", "CHANGELOG.md"),
    "utf8"
  );
  const versioningPolicy = readFileSync(
    join(process.cwd(), "docs", "versioning-policy.md"),
    "utf8"
  );
  const installationDocs = readFileSync(join(process.cwd(), "docs", "installation.md"), "utf8");
  const usageGuide = readFileSync(join(process.cwd(), "docs", "usage-guide.md"), "utf8");
  const githubIntegrationDocs = readFileSync(
    join(process.cwd(), "docs", "github-integration.md"),
    "utf8"
  );
  const codexIntegrationDocs = readFileSync(
    join(process.cwd(), "docs", "codex-integration.md"),
    "utf8"
  );
  const marketplaceDocs = readFileSync(
    join(process.cwd(), "docs", "vscode-marketplace-release.md"),
    "utf8"
  );
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
    packageManager?: string;
    bin?: Record<string, string>;
    engines?: Record<string, string>;
    files?: string[];
    scripts?: Record<string, string>;
  };
  const packageVersion = readPackageVersion(packageJsonPath);
  const packageMajorTag = `v${packageVersion.split(".")[0]}`;
  const vscodeVersion = readPackageVersion(
    join(process.cwd(), "extensions", "vscode", "package.json")
  );
  const vscodePackageJson = JSON.parse(
    readFileSync(join(process.cwd(), "extensions", "vscode", "package.json"), "utf8")
  ) as {
    name?: string;
    displayName?: string;
    publisher?: string;
    contributes?: {
      configuration?: {
        properties?: Record<string, { default?: unknown; description?: string }>;
      };
    };
  };

  it("keeps runtime version constants aligned with package manifests", () => {
    expect(CRITICAL_GATE_VERSION).toBe(packageVersion);
    expect(CLI_VERSION).toBe(packageVersion);
    expect(vscodeVersion).toBe(packageVersion);
  });

  it("keeps built CLI version output aligned with package manifests", () => {
    const builtCliPath = join(process.cwd(), "dist", "cli.js");
    const builtVersionPath = join(process.cwd(), "dist", "version.js");

    execFileSync(
      process.execPath,
      [
        join(process.cwd(), "node_modules", "typescript", "bin", "tsc"),
        "-p",
        "tsconfig.build.json"
      ],
      {
        cwd: process.cwd(),
        stdio: "pipe"
      }
    );

    const distVersion = readFileSync(builtVersionPath, "utf8");
    const cliVersion = execFileSync(process.execPath, [builtCliPath, "--version"], {
      encoding: "utf8"
    }).trim();

    expect(distVersion).toContain(`CRITICAL_GATE_VERSION = "${packageVersion}"`);
    expect(cliVersion).toBe(`critical-gate ${packageVersion}`);
  }, 30000);

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
        headRef: "release/2.4.0",
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
    expect(packageJson.packageManager).toBe("pnpm@10.34.4");
    expect(packageJson.files).toEqual(["dist", "README.md", "LICENSE"]);
    expect(packageJson.engines?.node).toBe(">=20");
    expect(packageJson.scripts?.["validate:npm-package"]).toBe(
      "pnpm build && node scripts/validate-npm-package.mjs"
    );
    expect(packageJson.scripts?.prepack).toBe(
      "pnpm build && node scripts/validate-npm-package.mjs"
    );
  });

  it("keeps the public GitHub Action default package version aligned", () => {
    expect(actionYaml).toContain(`default: "${packageVersion}"`);
  });

  it("keeps release policy and changelog entries aligned with the product version", () => {
    expect(versioningPolicy).toContain(`The current target is \`${packageVersion}\`.`);
    expect(versioningPolicy).toContain(
      "keep the root CLI package and VS Code extension package on the same product version"
    );
    expect(changelog).toContain(`## ${packageVersion} -`);
    expect(vscodeChangelog).toContain(`## ${packageVersion} -`);
  });

  it("keeps public install documentation on installable channels", () => {
    for (const document of [readme, installationDocs, usageGuide]) {
      expect(document).toContain("npx critical-gate");
      expect(document).toContain(
        "https://marketplace.visualstudio.com/items?itemName=criticaldeveloper.critical-gate-vscode"
      );
    }

    for (const document of [readme, installationDocs, usageGuide, githubIntegrationDocs]) {
      expect(document).toContain(`criticaldeveloper/critical-gate@${packageMajorTag}`);
    }

    expect(codexIntegrationDocs).toContain("npx critical-gate init-agent");
    expect(codexIntegrationDocs).toContain("npx critical-gate hook --base main");
    expect(githubIntegrationDocs).toContain(`version: "${packageVersion}"`);
  });

  it("keeps VS Code Marketplace identity and bundled analyzer defaults documented", () => {
    expect(vscodePackageJson.publisher).toBe("criticaldeveloper");
    expect(vscodePackageJson.name).toBe("critical-gate-vscode");
    expect(vscodePackageJson.displayName).toBe("Critical-Gate");
    expect(
      vscodePackageJson.contributes?.configuration?.properties?.["criticalGate.cliPath"]?.default
    ).toBe("");
    expect(
      vscodePackageJson.contributes?.configuration?.properties?.["criticalGate.cliPath"]
        ?.description
    ).toContain("Leave empty to use the analyzer bundled with the extension.");
    expect(marketplaceDocs).toContain("criticaldeveloper.critical-gate-vscode");
    expect(marketplaceDocs).toContain(`Extension version: \`${packageVersion}\``);
  });
});

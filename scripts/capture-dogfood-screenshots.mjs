import { spawnSync } from "node:child_process";
import console from "node:console";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

const args = parseArgs(process.argv.slice(2));
const htmlPath = resolve(args.html ?? join("artifacts", "dogfood", "mv-ft-latest", "report.html"));
const outputDir = resolve(args.out ?? join(dirname(htmlPath), "screenshots"));
const viewport = args.viewport ?? "1440,1100";
const fullPage = args["full-page"] !== false;
const installBrowsers = args.install !== false;

if (!existsSync(htmlPath)) {
  fail(`Dogfood HTML report not found: ${htmlPath}`);
}

mkdirSync(outputDir, { recursive: true });

const overviewPath = join(outputDir, "overview.png");
captureScreenshot({
  url: pathToFileURL(htmlPath).href,
  outputPath: overviewPath,
  viewport,
  fullPage,
  installBrowsers
});

console.log(`Dogfood screenshot written to ${overviewPath}`);

function captureScreenshot({ url, outputPath, viewport, fullPage, installBrowsers }) {
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  const playwrightArgs = [
    "--yes",
    "playwright",
    "screenshot",
    "--browser",
    "chromium",
    "--viewport-size",
    viewport
  ];

  if (fullPage) {
    playwrightArgs.push("--full-page");
  }

  playwrightArgs.push(url, outputPath);

  let result = runNpx(npxCommand, playwrightArgs);

  if (result.status !== 0 && installBrowsers && needsBrowserInstall(result)) {
    console.log("Playwright browser is missing; installing Chromium...");
    const installResult = runNpx(npxCommand, ["--yes", "playwright", "install", "chromium"]);

    if (installResult.status !== 0) {
      fail(
        formatFailure("Unable to install Playwright Chromium browser.", npxCommand, installResult)
      );
    }

    result = runNpx(npxCommand, playwrightArgs);
  }

  if (result.status !== 0) {
    fail(
      formatFailure("Unable to capture dogfood screenshot with Playwright.", npxCommand, result)
    );
  }
}

function runNpx(npxCommand, npxArgs) {
  const command =
    process.platform === "win32"
      ? { file: "cmd.exe", args: ["/d", "/s", "/c", npxCommand, ...npxArgs] }
      : { file: npxCommand, args: npxArgs };

  const result = spawnSync(command.file, command.args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return {
    ...result,
    command
  };
}

function needsBrowserInstall(result) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`.includes("playwright install");
}

function formatFailure(message, npxCommand, result) {
  return [
    message,
    result.error === undefined ? "" : `Spawn error: ${result.error.message}`,
    "",
    "Command:",
    `${result.command?.file ?? npxCommand} ${(result.command?.args ?? []).join(" ")}`,
    "",
    "stdout:",
    (result.stdout ?? "").trim(),
    "",
    "stderr:",
    (result.stderr ?? "").trim()
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      fail(`Unexpected positional argument: ${arg}`);
    }

    if (arg === "--no-full-page") {
      parsed["full-page"] = false;
      continue;
    }

    if (arg === "--no-install") {
      parsed.install = false;
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

  return parsed;
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

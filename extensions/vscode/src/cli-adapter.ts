import { execFile } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";

import * as vscode from "vscode";

import type { GateResult } from "../../../src/schema/index.js";

const execFileAsync = promisify(execFile);

export async function runCli(
  folder: vscode.WorkspaceFolder,
  task: string,
  extensionUri: vscode.Uri
): Promise<GateResult> {
  const config = vscode.workspace.getConfiguration("criticalGate");
  const cliPath = resolveCliPath(folder, extensionUri, config.get<string>("cliPath", "").trim());
  const base = config.get<string>("base", "").trim();
  const args = [cliPath, "check", "--task", task, "--format", "json"];

  if (base.length > 0) {
    args.push("--base", base);
  }

  const stdout = await execCriticalGate(args, folder.uri.fsPath);
  return JSON.parse(stdout) as GateResult;
}

export async function runInitAgent(
  folder: vscode.WorkspaceFolder,
  extensionUri: vscode.Uri
): Promise<string> {
  const config = vscode.workspace.getConfiguration("criticalGate");
  const cliPath = resolveCliPath(folder, extensionUri, config.get<string>("cliPath", "").trim());

  return execCriticalGate([cliPath, "init-agent"], folder.uri.fsPath);
}

export async function execCriticalGate(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(process.execPath, args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024
    });

    return stdout;
  } catch (error) {
    if (isCliFindingFailure(error)) {
      return error.stdout;
    }

    throw error;
  }
}

export function resolveCliPath(
  folder: vscode.WorkspaceFolder,
  extensionUri: vscode.Uri,
  configuredPath: string
): string {
  if (configuredPath.length === 0) {
    return vscode.Uri.joinPath(extensionUri, "analyzer", "dist", "cli.js").fsPath;
  }

  return isAbsolute(configuredPath) ? configuredPath : join(folder.uri.fsPath, configuredPath);
}

function isCliFindingFailure(error: unknown): error is { code: number; stdout: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "stdout" in error &&
    (error as { code: unknown }).code === 1 &&
    typeof (error as { stdout: unknown }).stdout === "string"
  );
}

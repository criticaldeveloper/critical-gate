import { execFile } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";

import * as vscode from "vscode";

const execFileAsync = promisify(execFile);
const diagnosticSource = "critical-gate";

interface GateResult {
  findings: Finding[];
  summary: {
    decision: "pass" | "fail";
    findingCount: number;
  };
}

interface Finding {
  id: string;
  detector: string;
  severity: "blocker" | "high" | "medium" | "low" | "info";
  title: string;
  message: string;
  repair: string;
  evidence: FindingEvidence[];
}

interface FindingEvidence {
  path?: string;
  startLine?: number;
  endLine?: number;
}

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection(diagnosticSource);
  const runCommand = vscode.commands.registerCommand("criticalGate.runCheck", async () => {
    await runCriticalGate(diagnostics);
  });
  const clearCommand = vscode.commands.registerCommand("criticalGate.clearDiagnostics", () => {
    diagnostics.clear();
  });

  context.subscriptions.push(diagnostics, runCommand, clearCommand);
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions for us.
}

async function runCriticalGate(diagnostics: vscode.DiagnosticCollection): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];

  if (folder === undefined) {
    vscode.window.showWarningMessage("Critical Gate requires an open workspace folder.");
    return;
  }

  const task = await resolveTask();

  if (task === undefined) {
    return;
  }

  try {
    const result = await runCli(folder, task);
    applyDiagnostics(diagnostics, folder, result);

    if (result.summary.decision === "pass") {
      vscode.window.showInformationMessage("Critical Gate passed. No diagnostics found.");
    } else {
      vscode.window.showWarningMessage(
        `Critical Gate found ${result.summary.findingCount} finding(s).`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Critical Gate error.";
    vscode.window.showErrorMessage(message);
  }
}

async function resolveTask(): Promise<string | undefined> {
  const configuredTask = vscode.workspace
    .getConfiguration("criticalGate")
    .get<string>("task", "")
    .trim();

  if (configuredTask.length > 0) {
    return configuredTask;
  }

  return vscode.window.showInputBox({
    title: "Critical Gate task intent",
    prompt: "Describe the task this diff is expected to satisfy.",
    ignoreFocusOut: true
  });
}

async function runCli(folder: vscode.WorkspaceFolder, task: string): Promise<GateResult> {
  const config = vscode.workspace.getConfiguration("criticalGate");
  const cliPath = resolveWorkspacePath(folder, config.get<string>("cliPath", "dist/cli.js"));
  const base = config.get<string>("base", "").trim();
  const args = [cliPath, "check", "--task", task, "--format", "json"];

  if (base.length > 0) {
    args.push("--base", base);
  }

  const stdout = await execCriticalGate(args, folder.uri.fsPath);
  return JSON.parse(stdout) as GateResult;
}

async function execCriticalGate(args: string[], cwd: string): Promise<string> {
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

function applyDiagnostics(
  diagnostics: vscode.DiagnosticCollection,
  folder: vscode.WorkspaceFolder,
  result: GateResult
): void {
  diagnostics.clear();

  const grouped = new Map<string, vscode.Diagnostic[]>();

  for (const finding of result.findings) {
    for (const evidence of finding.evidence) {
      if (evidence.path === undefined) {
        continue;
      }

      const existing = grouped.get(evidence.path) ?? [];
      existing.push(toDiagnostic(finding, evidence));
      grouped.set(evidence.path, existing);
    }
  }

  for (const [path, pathDiagnostics] of grouped) {
    diagnostics.set(vscode.Uri.file(join(folder.uri.fsPath, path)), pathDiagnostics);
  }
}

function toDiagnostic(finding: Finding, evidence: FindingEvidence): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(
    toRange(evidence),
    `${finding.title}: ${finding.message}\nRepair: ${finding.repair}`,
    toDiagnosticSeverity(finding.severity)
  );
  diagnostic.source = diagnosticSource;
  diagnostic.code = `${finding.detector}/${finding.id}`;

  return diagnostic;
}

function toRange(evidence: FindingEvidence): vscode.Range {
  const startLine = Math.max(0, (evidence.startLine ?? 1) - 1);
  const endLine = Math.max(0, (evidence.endLine ?? evidence.startLine ?? 1) - 1);

  return new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);
}

function toDiagnosticSeverity(severity: Finding["severity"]): vscode.DiagnosticSeverity {
  if (severity === "blocker" || severity === "high") {
    return vscode.DiagnosticSeverity.Error;
  }

  if (severity === "medium") {
    return vscode.DiagnosticSeverity.Warning;
  }

  if (severity === "low") {
    return vscode.DiagnosticSeverity.Information;
  }

  return vscode.DiagnosticSeverity.Hint;
}

function resolveWorkspacePath(folder: vscode.WorkspaceFolder, configuredPath: string): string {
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

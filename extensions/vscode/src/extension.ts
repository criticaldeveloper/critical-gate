import { execFile } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";

import * as vscode from "vscode";

import {
  findingsToEditorDiagnostics,
  groupEditorDiagnosticsByPath,
  type EditorDiagnostic
} from "../../../src/editor/index.js";
import type { GateResult } from "../../../src/schema/index.js";

const execFileAsync = promisify(execFile);
const diagnosticSource = "critical-gate";
const diagnosticPayloads = new Map<string, CriticalGateDiagnosticPayload>();

interface CriticalGateDiagnosticPayload {
  findingId: string;
  detector: string;
  title: string;
  repair: string;
  evidencePath: string;
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
  const openEvidenceCommand = vscode.commands.registerCommand(
    "criticalGate.openEvidence",
    async (payload: CriticalGateDiagnosticPayload) => {
      await openEvidence(payload);
    }
  );
  const copyRepairCommand = vscode.commands.registerCommand(
    "criticalGate.copyRepair",
    async (payload: CriticalGateDiagnosticPayload) => {
      await vscode.env.clipboard.writeText(payload.repair);
      vscode.window.showInformationMessage("Critical Gate repair text copied.");
    }
  );
  const codeActions = vscode.languages.registerCodeActionsProvider(
    { scheme: "file" },
    new CriticalGateCodeActionProvider(),
    {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    }
  );

  context.subscriptions.push(
    diagnostics,
    runCommand,
    clearCommand,
    openEvidenceCommand,
    copyRepairCommand,
    codeActions
  );
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
  diagnosticPayloads.clear();
  const grouped = groupEditorDiagnosticsByPath(findingsToEditorDiagnostics(result.findings));

  for (const [path, pathDiagnostics] of grouped) {
    diagnostics.set(
      vscode.Uri.file(join(folder.uri.fsPath, path)),
      pathDiagnostics.map(toVsCodeDiagnostic)
    );
  }
}

function toVsCodeDiagnostic(editorDiagnostic: EditorDiagnostic): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(
    toRange(editorDiagnostic.range),
    editorDiagnostic.message,
    toDiagnosticSeverity(editorDiagnostic.severity)
  );
  diagnostic.source = editorDiagnostic.source;
  const payload = toDiagnosticPayload(editorDiagnostic);
  const code = toDiagnosticCode(payload);
  diagnosticPayloads.set(code, payload);
  diagnostic.code = {
    value: code,
    target: vscode.Uri.parse(
      `command:criticalGate.openEvidence?${encodeURIComponent(JSON.stringify([payload]))}`
    )
  };

  return diagnostic;
}

function toRange(range: EditorDiagnostic["range"]): vscode.Range {
  return new vscode.Range(range.startLine, range.startColumn, range.endLine, range.endColumn);
}

function toDiagnosticSeverity(severity: EditorDiagnostic["severity"]): vscode.DiagnosticSeverity {
  if (severity === "error") {
    return vscode.DiagnosticSeverity.Error;
  }

  if (severity === "warning") {
    return vscode.DiagnosticSeverity.Warning;
  }

  if (severity === "information") {
    return vscode.DiagnosticSeverity.Information;
  }

  return vscode.DiagnosticSeverity.Hint;
}

function resolveWorkspacePath(folder: vscode.WorkspaceFolder, configuredPath: string): string {
  return isAbsolute(configuredPath) ? configuredPath : join(folder.uri.fsPath, configuredPath);
}

function toDiagnosticPayload(editorDiagnostic: EditorDiagnostic): CriticalGateDiagnosticPayload {
  return {
    findingId: editorDiagnostic.code,
    detector: editorDiagnostic.detector,
    title: editorDiagnostic.findingTitle,
    repair: editorDiagnostic.repair,
    evidencePath: editorDiagnostic.evidence.path,
    startLine: editorDiagnostic.evidence.startLine,
    endLine: editorDiagnostic.evidence.endLine
  };
}

async function openEvidence(payload: CriticalGateDiagnosticPayload): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];

  if (folder === undefined) {
    vscode.window.showWarningMessage("Critical Gate requires an open workspace folder.");
    return;
  }

  const uri = vscode.Uri.file(join(folder.uri.fsPath, payload.evidencePath));
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);
  const startLine = Math.max(0, (payload.startLine ?? 1) - 1);
  const endLine = Math.max(0, (payload.endLine ?? payload.startLine ?? 1) - 1);
  const range = new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);

  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

class CriticalGateCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    _document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    return context.diagnostics.filter(isCriticalGateDiagnostic).flatMap((diagnostic) => {
      const payload = getDiagnosticPayload(diagnostic);

      if (payload === undefined) {
        return [];
      }

      const openEvidence = new vscode.CodeAction(
        "Critical Gate: Open evidence",
        vscode.CodeActionKind.QuickFix
      );
      openEvidence.command = {
        command: "criticalGate.openEvidence",
        title: "Critical Gate: Open evidence",
        arguments: [payload]
      };
      openEvidence.diagnostics = [diagnostic];

      const copyRepair = new vscode.CodeAction(
        "Critical Gate: Copy repair text",
        vscode.CodeActionKind.QuickFix
      );
      copyRepair.command = {
        command: "criticalGate.copyRepair",
        title: "Critical Gate: Copy repair text",
        arguments: [payload]
      };
      copyRepair.diagnostics = [diagnostic];

      return [openEvidence, copyRepair];
    });
  }
}

function isCriticalGateDiagnostic(diagnostic: vscode.Diagnostic): boolean {
  return diagnostic.source === diagnosticSource;
}

function getDiagnosticPayload(
  diagnostic: vscode.Diagnostic
): CriticalGateDiagnosticPayload | undefined {
  if (typeof diagnostic.code !== "object" || diagnostic.code === null) {
    return undefined;
  }

  return diagnosticPayloads.get(String(diagnostic.code.value));
}

function toDiagnosticCode(payload: CriticalGateDiagnosticPayload): string {
  return [
    payload.detector,
    payload.findingId,
    payload.evidencePath,
    String(payload.startLine ?? 1)
  ].join("/");
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

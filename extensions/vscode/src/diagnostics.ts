import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

import * as vscode from "vscode";

import {
  findingsToEditorDiagnostics,
  groupEditorDiagnosticsByPath,
  type EditorDiagnostic
} from "../../../src/editor/index.js";
import type { GateResult } from "../../../src/schema/index.js";
import { toCriticalGatePayload } from "./action-payload.js";
import { getConfiguredBase } from "./state.js";
import { diagnosticSource, type CriticalGateDiagnosticPayload } from "./types.js";

const execFileAsync = promisify(execFile);

export const diagnosticPayloads = new Map<string, CriticalGateDiagnosticPayload>();

export function applyDiagnostics(
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

export async function openEvidence(payload: CriticalGateDiagnosticPayload): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];

  if (folder === undefined) {
    vscode.window.showWarningMessage("Critical Gate requires an open workspace folder.");
    return;
  }

  const uri = vscode.Uri.file(join(folder.uri.fsPath, payload.evidencePath));
  const document = (await fileExists(uri))
    ? await vscode.workspace.openTextDocument(uri)
    : await openDeletedEvidenceDocument(folder, payload.evidencePath);
  const editor = await vscode.window.showTextDocument(document);
  const startLine = Math.max(0, (payload.startLine ?? 1) - 1);
  const endLine = Math.max(0, (payload.endLine ?? payload.startLine ?? 1) - 1);
  const range = new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);

  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

export function isCriticalGateDiagnostic(diagnostic: vscode.Diagnostic): boolean {
  return diagnostic.source === diagnosticSource;
}

export function getDiagnosticPayload(
  diagnostic: vscode.Diagnostic
): CriticalGateDiagnosticPayload | undefined {
  if (typeof diagnostic.code !== "object" || diagnostic.code === null) {
    return undefined;
  }

  return diagnosticPayloads.get(String(diagnostic.code.value));
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

function toDiagnosticPayload(editorDiagnostic: EditorDiagnostic): CriticalGateDiagnosticPayload {
  return toCriticalGatePayload({
    findingId: editorDiagnostic.code,
    detector: editorDiagnostic.detector,
    title: editorDiagnostic.findingTitle,
    message: editorDiagnostic.findingMessage,
    repair: editorDiagnostic.repair,
    evidencePath: editorDiagnostic.evidence.path,
    startLine: editorDiagnostic.evidence.startLine,
    endLine: editorDiagnostic.evidence.endLine,
    evidenceData: editorDiagnostic.evidenceData,
    findingEvidence: editorDiagnostic.findingEvidence
  });
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function openDeletedEvidenceDocument(
  folder: vscode.WorkspaceFolder,
  evidencePath: string
): Promise<vscode.TextDocument> {
  const base = getConfiguredBase() || "HEAD";

  try {
    const { stdout } = await execFileAsync("git", ["show", `${base}:${evidencePath}`], {
      cwd: folder.uri.fsPath,
      maxBuffer: 10 * 1024 * 1024
    });

    vscode.window.setStatusBarMessage(`Critical Gate opened deleted evidence from ${base}.`, 4000);

    return vscode.workspace.openTextDocument({
      content: stdout,
      language: inferVsCodeLanguage(evidencePath)
    });
  } catch {
    throw new Error(
      `Critical Gate could not open deleted evidence for ${evidencePath}. Try setting criticalGate.base to the branch or SHA that still contains the file.`
    );
  }
}

function inferVsCodeLanguage(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "sass":
      return "sass";
    case "less":
      return "less";
    case "ts":
      return "typescript";
    case "tsx":
      return "typescriptreact";
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "jsx":
      return "javascriptreact";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "yml":
    case "yaml":
      return "yaml";
    default:
      return "plaintext";
  }
}

function toDiagnosticCode(payload: CriticalGateDiagnosticPayload): string {
  return [
    payload.detector,
    payload.findingId,
    payload.evidencePath,
    String(payload.startLine ?? 1)
  ].join("/");
}

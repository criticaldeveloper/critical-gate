import { join } from "node:path";

import * as vscode from "vscode";

import { runCli, runInitAgent } from "./cli-adapter.js";
import { applyDiagnostics } from "./diagnostics.js";
import { renderReport, showReport, writeReport } from "./report-view.js";
import {
  addRunHistory,
  clearPersistedRunState,
  getConfiguredTask,
  getRefreshDebounceMs,
  getRefreshMode,
  persistRunState,
  updateRunViews,
  updateStatusBar
} from "./state.js";
import type { CriticalGateDiagnosticPayload, RefreshState, RunReason } from "./types.js";

const acceptedBlastRadiusStorageKey = "criticalGate.acceptedBlastRadiusExpansions.v1";

interface AcceptedBlastRadiusExpansion {
  findingId: string;
  acceptedAt: string;
  paths: string[];
  message?: string;
}

export async function runCriticalGate(state: RefreshState, reason: RunReason): Promise<void> {
  if (state.running) {
    return;
  }

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
    state.running = true;
    state.lastError = undefined;
    state.lastTask = task;
    state.restoredAt = undefined;
    state.statusBar.text = "$(sync~spin) Critical Gate";
    state.statusBar.tooltip = "Critical Gate is running.";
    updateRunViews(state);

    const result = await runCli(folder, task, state.extensionUri);
    const report = renderReport(result);
    state.lastResult = result;
    state.lastReport = report;
    addRunHistory(state, result);
    applyDiagnostics(state.diagnostics, folder, result);
    writeReport(state.output, report);
    await persistRunState(state);
    updateStatusBar(state);
    updateRunViews(state);

    await notifyResult(state, reason, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Critical Gate error.";
    state.lastError = message;
    state.statusBar.text = "$(error) Critical Gate";
    state.statusBar.tooltip = message;
    updateRunViews(state);
    vscode.window.showErrorMessage(message);
  } finally {
    state.running = false;
    updateStatusBar(state);
    updateRunViews(state);
  }
}

export function scheduleRefresh(state: RefreshState): void {
  if (getRefreshMode() !== "onSave") {
    return;
  }

  const task = getConfiguredTask();

  if (task.length === 0) {
    vscode.window.setStatusBarMessage(
      "Critical Gate on-save refresh skipped: configure criticalGate.task.",
      5000
    );
    return;
  }

  clearPendingRefresh(state);

  state.pendingTimer = setTimeout(() => {
    state.pendingTimer = undefined;
    void runCriticalGate(state, "onSave");
  }, getRefreshDebounceMs());
}

export function clearPendingRefresh(state: RefreshState): void {
  if (state.pendingTimer !== undefined) {
    clearTimeout(state.pendingTimer);
    state.pendingTimer = undefined;
  }
}

export async function clearRunState(state: RefreshState): Promise<void> {
  clearPendingRefresh(state);
  state.diagnostics.clear();
  state.lastResult = undefined;
  state.lastReport = undefined;
  state.lastError = undefined;
  state.restoredAt = undefined;
  state.statusBar.text = "$(shield) Critical Gate";
  state.statusBar.tooltip = "Run Critical Gate";
  await clearPersistedRunState(state);
  updateRunViews(state);
}

export async function openSettings(): Promise<void> {
  await vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "@ext:criticaldeveloper.critical-gate-vscode"
  );
}

export async function initializeAgentInstructions(state: RefreshState): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];

  if (folder === undefined) {
    vscode.window.showWarningMessage("Critical Gate requires an open workspace folder.");
    return;
  }

  try {
    const message = (await runInitAgent(folder, state.extensionUri)).trim();
    vscode.window.showInformationMessage(
      message.length > 0 ? message : "Critical Gate agent instructions initialized."
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Critical Gate error.";
    vscode.window.showErrorMessage(`Critical Gate could not initialize AGENTS.md: ${message}`);
  }
}

export function getCommandPayload(input: unknown): CriticalGateDiagnosticPayload | undefined {
  if (isCriticalGatePayload(input)) {
    return input;
  }

  if (typeof input === "object" && input !== null) {
    const candidate = (input as { criticalGatePayload?: unknown }).criticalGatePayload;

    if (isCriticalGatePayload(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export async function copyRepair(payloadOrRepair: unknown): Promise<void> {
  const payload = getCommandPayload(payloadOrRepair);
  const repair = typeof payloadOrRepair === "string" ? payloadOrRepair : payload?.repair;

  if (repair === undefined) {
    vscode.window.showWarningMessage("Critical Gate could not find repair text for this item.");
    return;
  }

  await vscode.env.clipboard.writeText(repair);
  vscode.window.showInformationMessage("Critical Gate repair contract copied.");
}

export async function openExistingSolution(payloadOrTreeItem: unknown): Promise<void> {
  const payload = getCommandPayload(payloadOrTreeItem);

  if (payload?.existingSolutionPath === undefined) {
    vscode.window.showWarningMessage("Critical Gate could not find an existing solution path.");
    return;
  }

  await openWorkspacePath(payload.existingSolutionPath);
}

export async function openExpectedCompanion(payloadOrTreeItem: unknown): Promise<void> {
  const payload = getCommandPayload(payloadOrTreeItem);

  if (payload?.expectedCompanionPath === undefined) {
    vscode.window.showWarningMessage("Critical Gate could not find an expected companion path.");
    return;
  }

  await openWorkspacePath(payload.expectedCompanionPath, {
    missingMessage: `Expected companion is not present yet: ${payload.expectedCompanionPath}`
  });
}

export async function acceptBlastRadiusExpansion(
  state: RefreshState,
  payloadOrTreeItem: unknown
): Promise<void> {
  const payload = getCommandPayload(payloadOrTreeItem);

  if (payload === undefined || payload.detector !== "blast-radius") {
    vscode.window.showWarningMessage("Critical Gate can only accept blast-radius findings.");
    return;
  }

  const accepted =
    state.workspaceState.get<AcceptedBlastRadiusExpansion[]>(acceptedBlastRadiusStorageKey) ?? [];
  const next: AcceptedBlastRadiusExpansion[] = [
    {
      findingId: payload.findingId,
      acceptedAt: new Date().toISOString(),
      paths: payload.clusterPaths ?? [payload.evidencePath],
      message: payload.message
    },
    ...accepted.filter((entry) => entry.findingId !== payload.findingId)
  ].slice(0, 50);

  await state.workspaceState.update(acceptedBlastRadiusStorageKey, next);
  vscode.window.showInformationMessage("Critical Gate blast-radius expansion accepted locally.");
}

export function openClusterReport(state: RefreshState, payloadOrTreeItem: unknown): void {
  const payload = getCommandPayload(payloadOrTreeItem);

  if (payload === undefined || (payload.clusterPaths?.length ?? 0) === 0) {
    vscode.window.showWarningMessage("Critical Gate could not find cluster details for this item.");
    return;
  }

  state.output.clear();
  state.output.appendLine("# Critical Gate Cluster Report");
  state.output.appendLine("");
  state.output.appendLine(`Finding: ${payload.title}`);
  state.output.appendLine(`Detector: ${payload.detector}`);
  state.output.appendLine(`Evidence: ${payload.evidencePath}`);
  state.output.appendLine("");

  if (payload.message !== undefined) {
    state.output.appendLine(payload.message);
    state.output.appendLine("");
  }

  state.output.appendLine("Changed cluster files:");

  for (const path of payload.clusterPaths ?? []) {
    state.output.appendLine(`- ${path}`);
  }

  state.output.appendLine("");
  state.output.appendLine(`Repair: ${payload.repair}`);
  state.output.show(true);
}

export { showReport };

async function resolveTask(): Promise<string | undefined> {
  const configuredTask = getConfiguredTask();

  if (configuredTask.length > 0) {
    return configuredTask;
  }

  return vscode.window.showInputBox({
    title: "Critical Gate task intent",
    prompt: "Describe the task this diff is expected to satisfy.",
    ignoreFocusOut: true
  });
}

function isCriticalGatePayload(input: unknown): input is CriticalGateDiagnosticPayload {
  if (typeof input !== "object" || input === null) {
    return false;
  }

  const candidate = input as Partial<CriticalGateDiagnosticPayload>;

  return (
    typeof candidate.findingId === "string" &&
    typeof candidate.detector === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.repair === "string" &&
    typeof candidate.evidencePath === "string"
  );
}

async function openWorkspacePath(
  relativePath: string,
  options: { missingMessage?: string } = {}
): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];

  if (folder === undefined) {
    vscode.window.showWarningMessage("Critical Gate requires an open workspace folder.");
    return;
  }

  const uri = vscode.Uri.file(join(folder.uri.fsPath, relativePath));

  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    vscode.window.showInformationMessage(
      options.missingMessage ?? `Critical Gate could not find ${relativePath}.`
    );
    return;
  }

  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
}

async function notifyResult(
  state: RefreshState,
  reason: RunReason,
  result: NonNullable<RefreshState["lastResult"]>
): Promise<void> {
  const checked = `${result.diff.files.length} file${result.diff.files.length === 1 ? "" : "s"}`;
  const findings = `${result.summary.findingCount} finding${
    result.summary.findingCount === 1 ? "" : "s"
  }`;

  if (reason === "onSave") {
    vscode.window.setStatusBarMessage(
      `Critical Gate ${result.summary.decision}: ${findings}.`,
      5000
    );
    return;
  }

  const message =
    result.summary.decision === "pass"
      ? `Critical Gate passed: ${checked} checked, ${findings}.`
      : `Critical Gate failed: ${checked} checked, ${findings}.`;
  const action = await (result.summary.decision === "pass"
    ? vscode.window.showInformationMessage(message, "Show Report", "Run Again")
    : vscode.window.showWarningMessage(message, "Show Report", "Run Again"));

  if (action === "Show Report") {
    showReport(state);
  } else if (action === "Run Again") {
    await runCriticalGate(state, "manual");
  }
}

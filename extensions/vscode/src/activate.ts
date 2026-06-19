import * as vscode from "vscode";

import { CriticalGateCodeActionProvider } from "./code-actions.js";
import {
  clearPendingRefresh,
  clearRunState,
  copyRepair,
  openSettings,
  runCriticalGate,
  scheduleRefresh,
  showReport
} from "./commands.js";
import { diagnosticPayloads, openEvidence } from "./diagnostics.js";
import { toDashboardState } from "./state.js";
import { CriticalGateDashboardProvider } from "./tree-provider.js";
import {
  diagnosticSource,
  type CriticalGateDiagnosticPayload,
  type RefreshState
} from "./types.js";

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection(diagnosticSource);
  const output = vscode.window.createOutputChannel("Critical Gate");
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  const dashboard = new CriticalGateDashboardProvider(context.extensionUri);
  const refreshState: RefreshState = {
    extensionUri: context.extensionUri,
    diagnostics,
    output,
    statusBar,
    dashboard,
    running: false,
    runSequence: 0,
    history: []
  };

  statusBar.name = "Critical Gate";
  statusBar.text = "$(shield) Critical Gate";
  statusBar.tooltip = "Run Critical Gate";
  statusBar.command = "criticalGate.runCheck";
  statusBar.show();
  dashboard.update(toDashboardState(refreshState));

  const dashboardView = vscode.window.registerWebviewViewProvider(
    CriticalGateDashboardProvider.viewType,
    dashboard
  );
  const runCommand = vscode.commands.registerCommand("criticalGate.runCheck", async () => {
    await runCriticalGate(refreshState, "manual");
  });
  const showReportCommand = vscode.commands.registerCommand("criticalGate.showReport", () => {
    showReport(refreshState);
  });
  const clearCommand = vscode.commands.registerCommand("criticalGate.clearDiagnostics", () => {
    clearRunState(refreshState);
    diagnosticPayloads.clear();
  });
  const settingsCommand = vscode.commands.registerCommand(
    "criticalGate.openSettings",
    openSettings
  );
  const openEvidenceCommand = vscode.commands.registerCommand(
    "criticalGate.openEvidence",
    async (payload: CriticalGateDiagnosticPayload) => {
      await openEvidence(payload);
    }
  );
  const copyRepairCommand = vscode.commands.registerCommand(
    "criticalGate.copyRepair",
    async (payload: CriticalGateDiagnosticPayload) => {
      await copyRepair(payload.repair);
    }
  );
  const codeActions = vscode.languages.registerCodeActionsProvider(
    { scheme: "file" },
    new CriticalGateCodeActionProvider(),
    {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    }
  );
  const saveRefresh = vscode.workspace.onDidSaveTextDocument(() => {
    scheduleRefresh(refreshState);
  });

  context.subscriptions.push(
    diagnostics,
    output,
    statusBar,
    dashboardView,
    runCommand,
    showReportCommand,
    clearCommand,
    settingsCommand,
    openEvidenceCommand,
    copyRepairCommand,
    codeActions,
    saveRefresh,
    {
      dispose: () => clearPendingRefresh(refreshState)
    }
  );
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions for us.
}

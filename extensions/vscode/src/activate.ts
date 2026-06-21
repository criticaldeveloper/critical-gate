import * as vscode from "vscode";

import { CriticalGateCodeActionProvider } from "./code-actions.js";
import {
  clearPendingRefresh,
  clearRunState,
  copyRepair,
  getCommandPayload,
  acceptBlastRadiusExpansion,
  initializeAgentInstructions,
  openClusterReport,
  openExistingSolution,
  openExpectedCompanion,
  openSettings,
  runCriticalGate,
  scheduleRefresh,
  showReport
} from "./commands.js";
import { diagnosticPayloads, openEvidence } from "./diagnostics.js";
import { restoreRunState, updateRunViews, updateStatusBar } from "./state.js";
import { CriticalGateDashboardProvider, CriticalGateTreeProvider } from "./tree-provider.js";
import { diagnosticSource, type RefreshState } from "./types.js";

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection(diagnosticSource);
  const output = vscode.window.createOutputChannel("Critical Gate");
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  const dashboard = new CriticalGateDashboardProvider(context.extensionUri);
  const analysisTree = new CriticalGateTreeProvider();
  const refreshState: RefreshState = {
    extensionUri: context.extensionUri,
    diagnostics,
    output,
    statusBar,
    dashboard,
    analysisTree,
    workspaceState: context.workspaceState,
    running: false,
    runSequence: 0,
    history: []
  };

  restoreRunState(refreshState);
  statusBar.name = "Critical Gate";
  statusBar.text = "$(shield) Critical Gate";
  statusBar.tooltip = "Run Critical Gate";
  statusBar.command = "criticalGate.runCheck";
  statusBar.show();
  updateStatusBar(refreshState);
  updateRunViews(refreshState);

  const dashboardView = vscode.window.registerWebviewViewProvider(
    CriticalGateDashboardProvider.viewType,
    dashboard
  );
  const treeView = vscode.window.createTreeView(CriticalGateTreeProvider.viewType, {
    treeDataProvider: analysisTree,
    showCollapseAll: true
  });
  const runCommand = vscode.commands.registerCommand("criticalGate.runCheck", async () => {
    await runCriticalGate(refreshState, "manual");
  });
  const showReportCommand = vscode.commands.registerCommand("criticalGate.showReport", () => {
    showReport(refreshState);
  });
  const clearCommand = vscode.commands.registerCommand(
    "criticalGate.clearDiagnostics",
    async () => {
      await clearRunState(refreshState);
      diagnosticPayloads.clear();
    }
  );
  const settingsCommand = vscode.commands.registerCommand(
    "criticalGate.openSettings",
    openSettings
  );
  const initAgentCommand = vscode.commands.registerCommand(
    "criticalGate.initializeAgentInstructions",
    async () => {
      await initializeAgentInstructions(refreshState);
    }
  );
  const openEvidenceCommand = vscode.commands.registerCommand(
    "criticalGate.openEvidence",
    async (payloadOrTreeItem: unknown) => {
      const payload = getCommandPayload(payloadOrTreeItem);

      if (payload === undefined) {
        vscode.window.showWarningMessage("Critical Gate could not find evidence for this item.");
        return;
      }

      await openEvidence(payload);
    }
  );
  const copyRepairCommand = vscode.commands.registerCommand(
    "criticalGate.copyRepair",
    async (payloadOrTreeItem: unknown) => {
      await copyRepair(payloadOrTreeItem);
    }
  );
  const openExistingSolutionCommand = vscode.commands.registerCommand(
    "criticalGate.openExistingSolution",
    async (payloadOrTreeItem: unknown) => {
      await openExistingSolution(payloadOrTreeItem);
    }
  );
  const openExpectedCompanionCommand = vscode.commands.registerCommand(
    "criticalGate.openExpectedCompanion",
    async (payloadOrTreeItem: unknown) => {
      await openExpectedCompanion(payloadOrTreeItem);
    }
  );
  const acceptBlastRadiusCommand = vscode.commands.registerCommand(
    "criticalGate.acceptBlastRadiusExpansion",
    async (payloadOrTreeItem: unknown) => {
      await acceptBlastRadiusExpansion(refreshState, payloadOrTreeItem);
    }
  );
  const openClusterReportCommand = vscode.commands.registerCommand(
    "criticalGate.openClusterReport",
    (payloadOrTreeItem: unknown) => {
      openClusterReport(refreshState, payloadOrTreeItem);
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
    treeView,
    runCommand,
    showReportCommand,
    clearCommand,
    settingsCommand,
    initAgentCommand,
    openEvidenceCommand,
    copyRepairCommand,
    openExistingSolutionCommand,
    openExpectedCompanionCommand,
    acceptBlastRadiusCommand,
    openClusterReportCommand,
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

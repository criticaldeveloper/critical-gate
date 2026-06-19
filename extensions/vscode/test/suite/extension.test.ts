import assert from "node:assert/strict";

import * as vscode from "vscode";

export async function runExtensionTests(): Promise<void> {
  await activatesCommandContributions();
  await contributesNativeAnalysisTree();
  await contributesManualRefreshDefaults();
  await copiesRepairTextThroughCommandPayload();
  await copiesRepairTextThroughTreeItemPayload();
  await opensEvidenceFilesThroughCommandPayload();
}

async function activatesCommandContributions(): Promise<void> {
  await vscode.commands.executeCommand("criticalGate.clearDiagnostics");

  const commands = await vscode.commands.getCommands(true);

  assert.ok(commands.includes("criticalGate.runCheck"));
  assert.ok(commands.includes("criticalGate.showReport"));
  assert.ok(commands.includes("criticalGate.clearDiagnostics"));
  assert.ok(commands.includes("criticalGate.openSettings"));
  assert.ok(commands.includes("criticalGate.openEvidence"));
  assert.ok(commands.includes("criticalGate.copyRepair"));
}

async function contributesNativeAnalysisTree(): Promise<void> {
  const extension = vscode.extensions.getExtension("criticaldeveloper.critical-gate-vscode");
  const packageJson = extension?.packageJSON as
    | {
        contributes?: {
          views?: Record<string, Array<{ id: string; name: string; type?: string }>>;
          menus?: Record<string, Array<{ command: string; when?: string }>>;
        };
      }
    | undefined;

  const criticalGateViews = packageJson?.contributes?.views?.criticalGate ?? [];
  const contextMenuItems = packageJson?.contributes?.menus?.["view/item/context"] ?? [];

  assert.ok(
    criticalGateViews.some(
      (view) => view.id === "criticalGate.analysisTree" && view.name === "Analysis"
    )
  );
  assert.ok(
    contextMenuItems.some(
      (item) =>
        item.command === "criticalGate.openEvidence" &&
        item.when?.includes("criticalGate.analysisTree")
    )
  );
  assert.ok(
    contextMenuItems.some(
      (item) =>
        item.command === "criticalGate.copyRepair" &&
        item.when?.includes("criticalGate.analysisTree")
    )
  );
}

async function contributesManualRefreshDefaults(): Promise<void> {
  const config = vscode.workspace.getConfiguration("criticalGate");

  assert.equal(config.get("cliPath"), "");
  assert.equal(config.get("refreshMode"), "manual");
  assert.equal(config.get("refreshDebounceMs"), 1200);
}

async function copiesRepairTextThroughCommandPayload(): Promise<void> {
  await vscode.commands.executeCommand("criticalGate.copyRepair", {
    findingId: "test-finding",
    detector: "test",
    title: "Test finding",
    repair: "Restore the removed assertion.",
    evidencePath: "evidence.ts"
  });

  assert.equal(await vscode.env.clipboard.readText(), "Restore the removed assertion.");
}

async function copiesRepairTextThroughTreeItemPayload(): Promise<void> {
  await vscode.commands.executeCommand("criticalGate.copyRepair", {
    criticalGatePayload: {
      findingId: "tree-finding",
      detector: "test",
      title: "Tree finding",
      repair: "Use the tree item repair payload.",
      evidencePath: "evidence.ts"
    }
  });

  assert.equal(await vscode.env.clipboard.readText(), "Use the tree item repair payload.");
}

async function opensEvidenceFilesThroughCommandPayload(): Promise<void> {
  await vscode.commands.executeCommand("criticalGate.openEvidence", {
    findingId: "test-finding",
    detector: "test",
    title: "Test finding",
    repair: "Restore the removed assertion.",
    evidencePath: "evidence.ts",
    startLine: 1,
    endLine: 1
  });

  assert.equal(vscode.window.activeTextEditor?.document.fileName.endsWith("evidence.ts"), true);
}

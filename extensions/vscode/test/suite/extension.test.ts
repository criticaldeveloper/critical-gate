import assert from "node:assert/strict";

import * as vscode from "vscode";

export async function runExtensionTests(): Promise<void> {
  await activatesCommandContributions();
  await contributesNativeAnalysisTree();
  await contributesManualRefreshDefaults();
  await copiesRepairTextThroughCommandPayload();
  await copiesRepairContractThroughCommandPayload();
  await copiesRepairTextThroughTreeItemPayload();
  await opensEvidenceFilesThroughCommandPayload();
  await opensExistingSolutionThroughTreeItemPayload();
  await acceptsBlastRadiusExpansionThroughCommandPayload();
}

async function activatesCommandContributions(): Promise<void> {
  await vscode.commands.executeCommand("criticalGate.clearDiagnostics");

  const commands = await vscode.commands.getCommands(true);

  assert.ok(commands.includes("criticalGate.runCheck"));
  assert.ok(commands.includes("criticalGate.showReport"));
  assert.ok(commands.includes("criticalGate.clearDiagnostics"));
  assert.ok(commands.includes("criticalGate.openSettings"));
  assert.ok(commands.includes("criticalGate.initializeRepository"));
  assert.ok(commands.includes("criticalGate.openEvidence"));
  assert.ok(commands.includes("criticalGate.copyRepair"));
  assert.ok(commands.includes("criticalGate.openExistingSolution"));
  assert.ok(commands.includes("criticalGate.openExpectedCompanion"));
  assert.ok(commands.includes("criticalGate.acceptBlastRadiusExpansion"));
  assert.ok(commands.includes("criticalGate.openClusterReport"));
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
  const titleMenuItems = packageJson?.contributes?.menus?.["view/title"] ?? [];

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
  assert.ok(
    titleMenuItems.some(
      (item) =>
        item.command === "criticalGate.initializeRepository" &&
        item.when?.includes("criticalGate.dashboard")
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

async function copiesRepairContractThroughCommandPayload(): Promise<void> {
  await vscode.commands.executeCommand("criticalGate.copyRepair", {
    findingId: "contract-finding",
    detector: "test",
    title: "Contract finding",
    repair: [
      "Repair contract for contract-finding",
      "",
      "Instructions:",
      "- Restore the removed assertion.",
      "",
      "Allowed files:",
      "- tests/signup.test.ts",
      "",
      "Forbidden files:",
      "- src/signup.ts",
      "",
      "Success criteria:",
      "- The finding no longer appears."
    ].join("\n"),
    evidencePath: "evidence.ts"
  });

  assert.match(await vscode.env.clipboard.readText(), /Repair contract for contract-finding/);
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

async function opensExistingSolutionThroughTreeItemPayload(): Promise<void> {
  await vscode.commands.executeCommand("criticalGate.openExistingSolution", {
    criticalGatePayload: {
      findingId: "existing-solution",
      detector: "existing-solution",
      title: "Existing solution",
      repair: "Reuse the fixture evidence.",
      evidencePath: "evidence.ts",
      existingSolutionPath: "evidence.ts"
    }
  });

  assert.equal(vscode.window.activeTextEditor?.document.fileName.endsWith("evidence.ts"), true);
}

async function acceptsBlastRadiusExpansionThroughCommandPayload(): Promise<void> {
  await vscode.commands.executeCommand("criticalGate.acceptBlastRadiusExpansion", {
    findingId: "blast-radius:test",
    detector: "blast-radius",
    title: "Unexpected changed-file cluster",
    repair: "Confirm this separate cluster belongs to the current task.",
    evidencePath: "evidence.ts",
    clusterPaths: ["evidence.ts"]
  });
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

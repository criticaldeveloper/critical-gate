import assert from "node:assert/strict";

import * as vscode from "vscode";

export async function runExtensionTests(): Promise<void> {
  await activatesCommandContributions();
  await copiesRepairTextThroughCommandPayload();
  await opensEvidenceFilesThroughCommandPayload();
}

async function activatesCommandContributions(): Promise<void> {
  await vscode.commands.executeCommand("criticalGate.clearDiagnostics");

  const commands = await vscode.commands.getCommands(true);

  assert.ok(commands.includes("criticalGate.runCheck"));
  assert.ok(commands.includes("criticalGate.clearDiagnostics"));
  assert.ok(commands.includes("criticalGate.openEvidence"));
  assert.ok(commands.includes("criticalGate.copyRepair"));
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

import * as vscode from "vscode";

import { getDiagnosticPayload, isCriticalGateDiagnostic } from "./diagnostics.js";

export class CriticalGateCodeActionProvider implements vscode.CodeActionProvider {
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
        title: "Critical Gate: Copy repair prompt",
        arguments: [payload]
      };
      copyRepair.diagnostics = [diagnostic];

      const actions = [openEvidence, copyRepair];

      if (payload.existingSolutionPath !== undefined) {
        const openExistingSolution = new vscode.CodeAction(
          "Critical Gate: Open existing solution",
          vscode.CodeActionKind.QuickFix
        );
        openExistingSolution.command = {
          command: "criticalGate.openExistingSolution",
          title: "Critical Gate: Open existing solution",
          arguments: [payload]
        };
        openExistingSolution.diagnostics = [diagnostic];
        actions.push(openExistingSolution);
      }

      if (payload.expectedCompanionPath !== undefined) {
        const openExpectedCompanion = new vscode.CodeAction(
          "Critical Gate: Open expected companion",
          vscode.CodeActionKind.QuickFix
        );
        openExpectedCompanion.command = {
          command: "criticalGate.openExpectedCompanion",
          title: "Critical Gate: Open expected companion",
          arguments: [payload]
        };
        openExpectedCompanion.diagnostics = [diagnostic];
        actions.push(openExpectedCompanion);
      }

      if ((payload.clusterPaths?.length ?? 0) > 0) {
        const openClusterReport = new vscode.CodeAction(
          "Critical Gate: Open cluster report",
          vscode.CodeActionKind.QuickFix
        );
        openClusterReport.command = {
          command: "criticalGate.openClusterReport",
          title: "Critical Gate: Open cluster report",
          arguments: [payload]
        };
        openClusterReport.diagnostics = [diagnostic];
        actions.push(openClusterReport);
      }

      if (payload.detector === "blast-radius") {
        const acceptBlastRadius = new vscode.CodeAction(
          "Critical Gate: Accept blast-radius expansion locally",
          vscode.CodeActionKind.QuickFix
        );
        acceptBlastRadius.command = {
          command: "criticalGate.acceptBlastRadiusExpansion",
          title: "Critical Gate: Accept blast-radius expansion locally",
          arguments: [payload]
        };
        acceptBlastRadius.diagnostics = [diagnostic];
        actions.push(acceptBlastRadius);
      }

      return actions;
    });
  }
}

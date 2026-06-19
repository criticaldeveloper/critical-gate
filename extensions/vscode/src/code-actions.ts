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
        title: "Critical Gate: Copy repair text",
        arguments: [payload]
      };
      copyRepair.diagnostics = [diagnostic];

      return [openEvidence, copyRepair];
    });
  }
}

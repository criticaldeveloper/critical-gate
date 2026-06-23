import type * as vscode from "vscode";

import type { FindingRepairContract, GateResult } from "../../../src/schema/index.js";
import type { CriticalGateDashboardProvider, CriticalGateTreeProvider } from "./tree-provider.js";

export const diagnosticSource = "critical-gate";

export interface CriticalGateDiagnosticPayload {
  findingId: string;
  detector: string;
  title: string;
  message?: string;
  repair: string;
  repairContract?: FindingRepairContract;
  evidencePath: string;
  startLine?: number;
  endLine?: number;
  existingSolutionPath?: string;
  existingSolutionSymbol?: string;
  expectedCompanionPath?: string;
  clusterPaths?: string[];
}

export interface RunRecord {
  id: number;
  task: string;
  generatedAt: string;
  decision: GateResult["summary"]["decision"];
  findingCount: number;
  fileCount: number;
  diffCostScore?: number;
}

export interface RefreshState {
  extensionUri: vscode.Uri;
  diagnostics: vscode.DiagnosticCollection;
  output: vscode.OutputChannel;
  statusBar: vscode.StatusBarItem;
  dashboard: CriticalGateDashboardProvider;
  analysisTree: CriticalGateTreeProvider;
  workspaceState: vscode.Memento;
  running: boolean;
  pendingTimer?: ReturnType<typeof setTimeout>;
  lastResult?: GateResult;
  lastReport?: string;
  lastTask?: string;
  lastError?: string;
  restoredAt?: string;
  runSequence: number;
  history: RunRecord[];
}

export interface DashboardState {
  running: boolean;
  task: string;
  result?: GateResult;
  history: RunRecord[];
  error?: string;
  stale?: boolean;
  restoredAt?: string;
}

export type DashboardMessage =
  | { command: "run" | "showReport" | "clear" | "settings" | "initialize" }
  | { command: "openEvidence" | "copyRepair"; payload?: CriticalGateDiagnosticPayload };

export type RunReason = "manual" | "onSave";

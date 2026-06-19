import * as vscode from "vscode";

import type { GateResult } from "../../../src/schema/index.js";
import type { DashboardState, RefreshState, RunRecord } from "./types.js";

const runStateStorageKey = "criticalGate.workspaceRunState.v1";

interface PersistedRunState {
  lastResult?: GateResult;
  lastReport?: string;
  lastTask?: string;
  history: RunRecord[];
  runSequence: number;
  savedAt: string;
}

export function getRefreshMode(): "manual" | "onSave" {
  const configuredMode = vscode.workspace
    .getConfiguration("criticalGate")
    .get<string>("refreshMode", "manual");

  return configuredMode === "onSave" ? "onSave" : "manual";
}

export function getRefreshDebounceMs(): number {
  const configuredDelay = vscode.workspace
    .getConfiguration("criticalGate")
    .get<number>("refreshDebounceMs", 1200);

  return Math.max(0, configuredDelay);
}

export function getConfiguredTask(): string {
  return vscode.workspace.getConfiguration("criticalGate").get<string>("task", "").trim();
}

export function getConfiguredBase(): string {
  return vscode.workspace.getConfiguration("criticalGate").get<string>("base", "").trim();
}

export function addRunHistory(state: RefreshState, result: GateResult): void {
  state.history = [
    {
      id: ++state.runSequence,
      task: result.task.summary ?? result.task.text,
      generatedAt: result.generatedAt,
      decision: result.summary.decision,
      findingCount: result.summary.findingCount,
      fileCount: result.diff.files.length,
      diffCostScore: result.summary.diffCostScore
    },
    ...state.history
  ].slice(0, 20);
}

export function restoreRunState(state: RefreshState): void {
  const persisted = state.workspaceState.get<PersistedRunState>(runStateStorageKey);

  if (persisted === undefined || !isPersistedRunState(persisted)) {
    return;
  }

  state.lastResult = persisted.lastResult;
  state.lastReport = persisted.lastReport;
  state.lastTask = persisted.lastTask;
  state.history = persisted.history.slice(0, 20);
  state.runSequence = persisted.runSequence;
  state.restoredAt = persisted.savedAt;
}

export async function persistRunState(state: RefreshState): Promise<void> {
  const persisted: PersistedRunState = {
    lastResult: state.lastResult,
    lastReport: state.lastReport,
    lastTask: state.lastTask,
    history: state.history.slice(0, 20),
    runSequence: state.runSequence,
    savedAt: new Date().toISOString()
  };

  await state.workspaceState.update(runStateStorageKey, persisted);
}

export async function clearPersistedRunState(state: RefreshState): Promise<void> {
  await state.workspaceState.update(runStateStorageKey, undefined);
}

export function updateStatusBar(state: RefreshState): void {
  if (state.running) {
    return;
  }

  const result = state.lastResult;

  if (state.lastError !== undefined) {
    state.statusBar.text = "$(error) Critical Gate";
    state.statusBar.tooltip = state.lastError;
    return;
  }

  if (result === undefined) {
    state.statusBar.text = "$(shield) Critical Gate";
    state.statusBar.tooltip = "Run Critical Gate";
    return;
  }

  const checked = `${result.diff.files.length} file${result.diff.files.length === 1 ? "" : "s"}`;
  const findings = `${result.summary.findingCount} finding${
    result.summary.findingCount === 1 ? "" : "s"
  }`;

  if (result.summary.decision === "pass") {
    state.statusBar.text =
      state.restoredAt === undefined ? "$(pass) Critical Gate" : "$(history) Critical Gate";
    state.statusBar.tooltip = `${state.restoredAt === undefined ? "Passed" : "Restored last pass"}: ${checked}, ${findings}.`;
  } else {
    state.statusBar.text =
      state.restoredAt === undefined ? "$(warning) Critical Gate" : "$(history) Critical Gate";
    state.statusBar.tooltip = `${state.restoredAt === undefined ? "Failed" : "Restored last failure"}: ${checked}, ${findings}.`;
  }
}

export function updateRunViews(state: RefreshState): void {
  const dashboardState = toDashboardState(state);
  state.dashboard.update(dashboardState);
  state.analysisTree.update(dashboardState);
}

export function toDashboardState(state: RefreshState): DashboardState {
  return {
    running: state.running,
    task: state.lastTask ?? getConfiguredTask(),
    result: state.lastResult,
    history: state.history,
    error: state.lastError,
    stale: state.restoredAt !== undefined,
    restoredAt: state.restoredAt
  };
}

function isPersistedRunState(input: PersistedRunState): boolean {
  return (
    typeof input.savedAt === "string" &&
    typeof input.runSequence === "number" &&
    Array.isArray(input.history)
  );
}

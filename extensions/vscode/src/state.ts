import * as vscode from "vscode";

import type { GateResult } from "../../../src/schema/index.js";
import type { DashboardState, RefreshState } from "./types.js";

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
  ].slice(0, 8);
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
    state.statusBar.text = "$(pass) Critical Gate";
    state.statusBar.tooltip = `Passed: ${checked}, ${findings}.`;
  } else {
    state.statusBar.text = "$(warning) Critical Gate";
    state.statusBar.tooltip = `Failed: ${checked}, ${findings}.`;
  }
}

export function toDashboardState(state: RefreshState): DashboardState {
  return {
    running: state.running,
    task: state.lastTask ?? getConfiguredTask(),
    result: state.lastResult,
    history: state.history,
    error: state.lastError
  };
}

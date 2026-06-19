import * as vscode from "vscode";

import type { Finding, GateResult } from "../../../src/schema/index.js";
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
    state.statusBar.command = "criticalGate.showReport";
    return;
  }

  if (result === undefined) {
    state.statusBar.text = "$(shield) Critical Gate";
    state.statusBar.tooltip = "Run Critical Gate";
    state.statusBar.command = "criticalGate.runCheck";
    return;
  }

  const signal = getStatusSignal(result, state.restoredAt !== undefined);
  state.statusBar.text = signal.text;
  state.statusBar.tooltip = getStatusTooltip(result, signal, state.restoredAt);
  state.statusBar.command = "criticalGate.showReport";
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

function getStatusSignal(result: GateResult, restored: boolean): { text: string; detail: string } {
  const prefix = restored ? "$(history)" : getDecisionIcon(result);
  const expectedCompanionCount = countFindings(result.findings, "expected-companions");
  const blastRadiusCount = countFindings(result.findings, "blast-radius");
  const apiTouched =
    result.intentVerification?.observedClasses.includes("api-surface") === true ||
    result.findings.some((finding) => finding.tags.includes("api"));
  const score = result.summary.scopeExpansionScore?.score;

  if (score !== undefined && (score >= 7 || result.summary.decision === "fail")) {
    return {
      text: `${prefix} Critical Gate: scope ${score}/10`,
      detail: `Scope Expansion Score: ${score}/10`
    };
  }

  if (blastRadiusCount > 0) {
    return {
      text: `${prefix} Critical Gate: ${blastRadiusCount} unexpected cluster${
        blastRadiusCount === 1 ? "" : "s"
      }`,
      detail: `${blastRadiusCount} unexpected changed-file cluster${
        blastRadiusCount === 1 ? "" : "s"
      }`
    };
  }

  if (expectedCompanionCount > 0) {
    return {
      text: `${prefix} Critical Gate: companions missing`,
      detail: `${expectedCompanionCount} expected companion finding${
        expectedCompanionCount === 1 ? "" : "s"
      }`
    };
  }

  if (apiTouched) {
    return {
      text: `${prefix} Critical Gate: API surface touched`,
      detail: "API surface touched"
    };
  }

  if (result.summary.findingCount > 0) {
    return {
      text: `${prefix} Critical Gate: ${result.summary.findingCount} finding${
        result.summary.findingCount === 1 ? "" : "s"
      }`,
      detail: `${result.summary.findingCount} finding${
        result.summary.findingCount === 1 ? "" : "s"
      }`
    };
  }

  return {
    text: `${prefix} Critical Gate: clean`,
    detail: "No findings"
  };
}

function getDecisionIcon(result: GateResult): string {
  return result.summary.decision === "pass" ? "$(pass)" : "$(warning)";
}

function countFindings(findings: Finding[], detector: string): number {
  return findings.filter((finding) => finding.detector === detector).length;
}

function getStatusTooltip(
  result: GateResult,
  signal: { detail: string },
  restoredAt: string | undefined
): string {
  const checked = `${result.diff.files.length} file${result.diff.files.length === 1 ? "" : "s"}`;
  const findings = `${result.summary.findingCount} finding${
    result.summary.findingCount === 1 ? "" : "s"
  }`;
  const generated = new Date(result.generatedAt).toLocaleString();
  const lines = [
    restoredAt === undefined
      ? `Latest run: ${result.summary.decision}`
      : `Restored historical run: ${result.summary.decision}`,
    signal.detail,
    `${checked}, ${findings}`,
    `Generated: ${generated}`
  ];

  if (restoredAt !== undefined) {
    lines.push(`Restored: ${new Date(restoredAt).toLocaleString()}`);
  }

  const drivers = result.summary.scopeExpansionScore?.drivers ?? [];

  if (drivers.length > 0) {
    lines.push(
      "Top drivers:",
      ...drivers.slice(0, 3).map((driver) => `- ${driver.label} (+${driver.points})`)
    );
  }

  lines.push("Click to open the Critical Gate report.");

  return lines.join("\n");
}

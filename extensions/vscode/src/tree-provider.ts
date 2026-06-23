import * as vscode from "vscode";

import type { Finding, GateResult } from "../../../src/schema/index.js";
import { getTreeContextValue, toFindingPayload } from "./action-payload.js";
import type { CriticalGateDiagnosticPayload, DashboardMessage, DashboardState } from "./types.js";

export class CriticalGateDashboardProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "criticalGate.dashboard";

  private state: DashboardState = {
    running: false,
    task: "",
    history: []
  };

  private view?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.onDidReceiveMessage((message: DashboardMessage) => {
      void this.handleMessage(message);
    });
    this.render();
  }

  update(state: DashboardState): void {
    this.state = state;
    this.render();
  }

  private render(): void {
    if (this.view === undefined) {
      return;
    }

    const nonce = createNonce();
    this.view.webview.html = renderDashboardHtml(this.state, nonce);
  }

  private async handleMessage(message: DashboardMessage): Promise<void> {
    if (message.command === "run") {
      await vscode.commands.executeCommand("criticalGate.runCheck");
    } else if (message.command === "showReport") {
      await vscode.commands.executeCommand("criticalGate.showReport");
    } else if (message.command === "clear") {
      await vscode.commands.executeCommand("criticalGate.clearDiagnostics");
    } else if (message.command === "settings") {
      await vscode.commands.executeCommand("criticalGate.openSettings");
    } else if (message.command === "initialize") {
      await vscode.commands.executeCommand("criticalGate.initializeRepository");
    } else if (message.command === "openEvidence" && message.payload !== undefined) {
      await vscode.commands.executeCommand("criticalGate.openEvidence", message.payload);
    } else if (message.command === "copyRepair" && message.payload !== undefined) {
      await vscode.commands.executeCommand("criticalGate.copyRepair", message.payload);
    }
  }
}

type TreeItemKind =
  | "latest"
  | "metric"
  | "findings"
  | "detector"
  | "finding"
  | "clusters"
  | "cluster"
  | "companions"
  | "solutions"
  | "files"
  | "file"
  | "history"
  | "run";

interface GateTreeNode {
  kind: TreeItemKind;
  label: string;
  description?: string;
  tooltip?: string;
  icon?: vscode.ThemeIcon;
  collapsibleState?: vscode.TreeItemCollapsibleState;
  contextValue?: string;
  payload?: CriticalGateDiagnosticPayload;
  children?: GateTreeNode[];
}

export class CriticalGateTreeProvider implements vscode.TreeDataProvider<GateTreeNode> {
  static readonly viewType = "criticalGate.analysisTree";

  private state: DashboardState = {
    running: false,
    task: "",
    history: []
  };

  private readonly changedEmitter = new vscode.EventEmitter<
    GateTreeNode | undefined | null | void
  >();

  readonly onDidChangeTreeData = this.changedEmitter.event;

  update(state: DashboardState): void {
    this.state = state;
    this.changedEmitter.fire();
  }

  getTreeItem(element: GateTreeNode): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      element.collapsibleState ?? vscode.TreeItemCollapsibleState.None
    );

    item.description = element.description;
    item.tooltip = element.tooltip ?? element.description;
    item.iconPath = element.icon;
    item.contextValue = element.contextValue ?? element.kind;

    if (element.payload !== undefined) {
      Object.assign(item, { criticalGatePayload: element.payload });
      item.command = {
        command: "criticalGate.openEvidence",
        title: "Open Evidence",
        arguments: [element.payload]
      };
    }

    return item;
  }

  getChildren(element?: GateTreeNode): GateTreeNode[] {
    if (element !== undefined) {
      return element.children ?? [];
    }

    return createTreeRoots(this.state);
  }
}

function createTreeRoots(state: DashboardState): GateTreeNode[] {
  return [
    createLatestRunNode(state),
    createFindingsNode(state.result?.findings ?? []),
    createClustersNode(state.result?.diff.files ?? []),
    createCompanionsNode(state.result?.findings ?? []),
    createSolutionsNode(state.result?.findings ?? []),
    createFilesNode(state.result?.diff.files ?? []),
    createHistoryNode(state.history)
  ];
}

function createLatestRunNode(state: DashboardState): GateTreeNode {
  const result = state.result;
  const decision = state.running ? "running" : (result?.summary.decision ?? "idle");
  const restoredLabel =
    state.stale && state.restoredAt !== undefined
      ? `restored ${new Date(state.restoredAt).toLocaleString()}`
      : undefined;
  const score = result?.summary.scopeExpansionScore?.score;
  const children: GateTreeNode[] = [
    {
      kind: "metric",
      label: "Decision",
      description: state.running ? "running" : (result?.summary.decision ?? "not run"),
      icon: new vscode.ThemeIcon(state.running ? "sync~spin" : "shield")
    },
    {
      kind: "metric",
      label: "Task",
      description: state.task.length === 0 ? "not configured" : state.task,
      icon: new vscode.ThemeIcon("target")
    },
    {
      kind: "metric",
      label: "Scope Expansion",
      description: score === undefined ? "not available" : `${score}/10`,
      icon: new vscode.ThemeIcon("pulse")
    },
    {
      kind: "metric",
      label: "Findings",
      description: String(result?.summary.findingCount ?? 0),
      icon: new vscode.ThemeIcon("warning")
    },
    {
      kind: "metric",
      label: "Changed Files",
      description: String(result?.diff.files.length ?? 0),
      icon: new vscode.ThemeIcon("files")
    }
  ];

  if (result?.intentVerification !== undefined) {
    children.push(
      {
        kind: "metric",
        label: "Requested",
        description: formatList(result.intentVerification.requestedClasses),
        icon: new vscode.ThemeIcon("checklist")
      },
      {
        kind: "metric",
        label: "Observed",
        description: formatList(result.intentVerification.observedClasses),
        icon: new vscode.ThemeIcon("eye")
      },
      {
        kind: "metric",
        label: "Unexpected",
        description: formatList(result.intentVerification.unexpectedClasses),
        icon: new vscode.ThemeIcon(
          result.intentVerification.unexpectedClasses.length === 0 ? "pass" : "error"
        )
      }
    );
  }

  return {
    kind: "latest",
    label: "Latest run",
    description: restoredLabel ?? decision,
    tooltip: restoredLabel,
    icon: new vscode.ThemeIcon(
      state.stale ? "history" : decision === "fail" ? "warning" : "shield"
    ),
    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    children
  };
}

function createFindingsNode(findings: Finding[]): GateTreeNode {
  const byDetector = new Map<string, Finding[]>();

  for (const finding of findings) {
    byDetector.set(finding.detector, [...(byDetector.get(finding.detector) ?? []), finding]);
  }

  const children = [...byDetector.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([detector, detectorFindings]) => ({
      kind: "detector" as const,
      label: detector,
      description: `${detectorFindings.length} finding${detectorFindings.length === 1 ? "" : "s"}`,
      icon: new vscode.ThemeIcon("symbol-method"),
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
      children: detectorFindings.map(createFindingNode)
    }));

  return {
    kind: "findings",
    label: "Findings by detector",
    description: String(findings.length),
    icon: new vscode.ThemeIcon(findings.length === 0 ? "pass" : "warning"),
    collapsibleState:
      children.length === 0
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Expanded,
    children
  };
}

function createFindingNode(finding: Finding): GateTreeNode {
  const payload = toFindingPayload(finding);

  return {
    kind: "finding",
    label: finding.title,
    description: `${finding.severity} | ${Math.round(finding.confidence * 100)}%`,
    tooltip: `${finding.message}\n\nRepair: ${finding.repair}`,
    icon: new vscode.ThemeIcon(
      finding.severity === "high" || finding.severity === "blocker" ? "error" : "warning"
    ),
    contextValue: getTreeContextValue(payload),
    payload,
    children: finding.evidence.map((evidence) => ({
      kind: "metric",
      label: evidence.path ?? evidence.kind,
      description: evidence.message,
      tooltip: evidence.message,
      icon: new vscode.ThemeIcon("references")
    }))
  };
}

function createClustersNode(files: GateResult["diff"]["files"]): GateTreeNode {
  const byCluster = new Map<string, GateResult["diff"]["files"]>();

  for (const file of files) {
    const cluster = inferClusterLabel(file.path);
    byCluster.set(cluster, [...(byCluster.get(cluster) ?? []), file]);
  }

  const children = [...byCluster.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cluster, clusterFiles]) => ({
      kind: "cluster" as const,
      label: cluster,
      description: `${clusterFiles.length} file${clusterFiles.length === 1 ? "" : "s"}`,
      icon: new vscode.ThemeIcon("type-hierarchy"),
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      children: clusterFiles.map(createFileNode)
    }));

  return {
    kind: "clusters",
    label: "Changed clusters",
    description: String(children.length),
    icon: new vscode.ThemeIcon("graph"),
    collapsibleState:
      children.length === 0
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed,
    children
  };
}

function createCompanionsNode(findings: Finding[]): GateTreeNode {
  const companionFindings = findings.filter((finding) =>
    `${finding.id} ${finding.detector} ${finding.title}`.toLowerCase().includes("companion")
  );

  return createFindingGroupNode(
    "companions",
    "Missing companions",
    "git-pull-request",
    companionFindings
  );
}

function createSolutionsNode(findings: Finding[]): GateTreeNode {
  const solutionFindings = findings.filter((finding) =>
    `${finding.id} ${finding.detector} ${finding.title}`
      .toLowerCase()
      .match(/solution|utility|reuse/)
  );

  return createFindingGroupNode(
    "solutions",
    "Existing solutions",
    "symbol-function",
    solutionFindings
  );
}

function createFindingGroupNode(
  kind: "companions" | "solutions",
  label: string,
  icon: string,
  findings: Finding[]
): GateTreeNode {
  return {
    kind,
    label,
    description: String(findings.length),
    icon: new vscode.ThemeIcon(icon),
    collapsibleState:
      findings.length === 0
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed,
    children: findings.map(createFindingNode)
  };
}

function createFilesNode(files: GateResult["diff"]["files"]): GateTreeNode {
  return {
    kind: "files",
    label: "Changed files",
    description: String(files.length),
    icon: new vscode.ThemeIcon("files"),
    collapsibleState:
      files.length === 0
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed,
    children: files.map(createFileNode)
  };
}

function createFileNode(file: GateResult["diff"]["files"][number]): GateTreeNode {
  return {
    kind: "file",
    label: file.path,
    description: `${formatFileStatus(file.status)} | ${file.role} | +${file.additions}/-${file.deletions}`,
    icon: new vscode.ThemeIcon(file.status === "deleted" ? "trash" : "file"),
    contextValue: "criticalGateFile"
  };
}

function createHistoryNode(history: DashboardState["history"]): GateTreeNode {
  return {
    kind: "history",
    label: "Recent runs",
    description: String(history.length),
    icon: new vscode.ThemeIcon("history"),
    collapsibleState:
      history.length === 0
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed,
    children: history.map((run) => ({
      kind: "run",
      label: run.decision,
      description: `${run.fileCount} files | ${run.findingCount} findings | ${new Date(
        run.generatedAt
      ).toLocaleTimeString()}`,
      tooltip: run.task,
      icon: new vscode.ThemeIcon(run.decision === "fail" ? "warning" : "pass")
    }))
  };
}

function inferClusterLabel(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean);

  if (segments.length <= 1) {
    return "repository root";
  }

  if (segments[0] === "src" && segments.length >= 3) {
    return `${segments[0]}/${segments[1]}`;
  }

  return segments[0];
}

function formatList(values: string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

function renderDashboardHtml(state: DashboardState, nonce: string): string {
  const result = state.result;
  const decision = result?.summary.decision ?? "idle";
  const findingCount = result?.summary.findingCount ?? 0;
  const fileCount = result?.diff.files.length ?? 0;
  const diffCostScore = result?.summary.diffCostScore ?? 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Critical Gate</title>
  <style>
    body {
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      margin: 0;
      padding: 12px;
    }
    button {
      align-items: center;
      background: var(--vscode-button-background);
      border: 0;
      border-radius: 4px;
      color: var(--vscode-button-foreground);
      cursor: pointer;
      display: inline-flex;
      font: inherit;
      min-height: 28px;
      padding: 4px 10px;
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.icon {
      background: transparent;
      color: var(--vscode-foreground);
      min-height: 24px;
      padding: 2px 6px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }
    .hero {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      margin-bottom: 12px;
      padding: 12px;
    }
    .state {
      align-items: center;
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }
    .dot {
      border-radius: 50%;
      display: inline-block;
      flex: 0 0 auto;
      height: 10px;
      width: 10px;
    }
    .pass { background: var(--vscode-testing-iconPassed); }
    .fail { background: var(--vscode-testing-iconFailed); }
    .idle { background: var(--vscode-descriptionForeground); }
    .running { background: var(--vscode-progressBar-background); }
    .title {
      font-weight: 600;
      line-height: 1.3;
    }
    .subtle {
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }
    .metrics {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .metric {
      background: var(--vscode-editorWidget-background);
      border-radius: 4px;
      padding: 8px;
    }
    .metric strong {
      display: block;
      font-size: 1.2em;
    }
    h2 {
      font-size: 12px;
      margin: 16px 0 8px;
      text-transform: uppercase;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      border-bottom: 1px solid var(--vscode-panel-border);
      padding: 8px 0;
    }
    .file, .finding, .run {
      display: grid;
      gap: 4px;
    }
    .finding {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      margin-bottom: 8px;
      padding: 10px;
    }
    .row {
      align-items: center;
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }
    .badge {
      background: var(--vscode-badge-background);
      border-radius: 999px;
      color: var(--vscode-badge-foreground);
      font-size: 11px;
      padding: 2px 7px;
      white-space: nowrap;
    }
    .status-added {
      background: var(--vscode-testing-iconPassed);
      color: var(--vscode-editor-background);
    }
    .status-deleted {
      background: var(--vscode-testing-iconFailed);
      color: var(--vscode-editor-background);
    }
    .status-modified {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .status-renamed {
      background: var(--vscode-charts-yellow);
      color: var(--vscode-editor-background);
    }
    code {
      color: var(--vscode-textPreformat-foreground);
      font-family: var(--vscode-editor-font-family);
      overflow-wrap: anywhere;
    }
  </style>
</head>
<body>
  <div class="actions">
    <button data-command="run">${state.running ? "Running..." : "Run Gate"}</button>
    <button class="secondary" data-command="initialize">Initialize</button>
    <button class="secondary" data-command="showReport">Show Report</button>
    <button class="secondary" data-command="clear">Clear</button>
    <button class="secondary" title="Open Critical Gate settings" data-command="settings">Settings</button>
  </div>

  <section class="hero">
    <div class="state">
      <span class="dot ${state.running ? "running" : decision}"></span>
      <div>
        <div class="title">${escapeHtml(formatDecision(state))}</div>
        <div class="subtle">${escapeHtml(formatTask(state.task))}</div>
      </div>
    </div>
    <div class="metrics">
      <div class="metric"><strong>${fileCount}</strong><span class="subtle">files</span></div>
      <div class="metric"><strong>${findingCount}</strong><span class="subtle">findings</span></div>
      <div class="metric"><strong>${diffCostScore}</strong><span class="subtle">cost</span></div>
    </div>
  </section>

  ${state.error === undefined ? "" : `<p class="subtle">${escapeHtml(state.error)}</p>`}
  ${
    state.stale && state.restoredAt !== undefined
      ? `<p class="subtle">Restored last run from ${escapeHtml(
          new Date(state.restoredAt).toLocaleString()
        )}. Problems diagnostics will refresh on the next run.</p>`
      : ""
  }

  <h2>Findings</h2>
  ${renderFindings(result?.findings ?? [])}

  <h2>Changed Files</h2>
  ${renderFiles(result?.diff.files ?? [])}

  <h2>Recent Runs</h2>
  ${renderHistory(state.history)}

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll("[data-command]").forEach((button) => {
      button.addEventListener("click", () => {
        vscode.postMessage({ command: button.dataset.command });
      });
    });
    document.querySelectorAll("[data-payload]").forEach((button) => {
      button.addEventListener("click", () => {
        vscode.postMessage({
          command: button.dataset.action,
          payload: JSON.parse(button.dataset.payload)
        });
      });
    });
  </script>
</body>
</html>`;
}

function renderFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return `<p class="subtle">No findings from the latest run.</p>`;
  }

  return findings
    .map((finding) => {
      const payload = toFindingPayload(finding);
      const encodedPayload = payload === undefined ? "" : escapeHtml(JSON.stringify(payload));
      return `<article class="finding">
        <div class="row">
          <strong>${escapeHtml(finding.title)}</strong>
          <span class="badge">${escapeHtml(finding.severity)}</span>
        </div>
        <div class="subtle">${escapeHtml(finding.detector)} | ${Math.round(
          finding.confidence * 100
        )}% confidence</div>
        <p>${escapeHtml(finding.message)}</p>
        <p class="subtle">${escapeHtml(finding.repair)}</p>
        <div class="actions">
          ${
            payload === undefined
              ? ""
              : `<button class="secondary" data-action="openEvidence" data-payload="${encodedPayload}">Open Evidence</button>`
          }
          ${
            payload === undefined
              ? ""
              : `<button class="secondary" data-action="copyRepair" data-payload="${encodedPayload}">Copy Repair</button>`
          }
        </div>
      </article>`;
    })
    .join("");
}

function renderFiles(files: GateResult["diff"]["files"]): string {
  if (files.length === 0) {
    return `<p class="subtle">No changed files detected.</p>`;
  }

  return `<ul>${files
    .map(
      (file) => `<li class="file">
        <div class="row">
          <code>${escapeHtml(file.path)}</code>
          <span class="badge ${getFileStatusBadgeClass(file.status)}">${escapeHtml(
            formatFileStatus(file.status)
          )}</span>
        </div>
        <span class="subtle">${escapeHtml(file.role)} | +${file.additions}/-${file.deletions}</span>
      </li>`
    )
    .join("")}</ul>`;
}

function getFileStatusBadgeClass(status: GateResult["diff"]["files"][number]["status"]): string {
  switch (status) {
    case "added":
      return "status-added";
    case "deleted":
      return "status-deleted";
    case "modified":
      return "status-modified";
    case "renamed":
      return "status-renamed";
  }
}

function formatFileStatus(status: GateResult["diff"]["files"][number]["status"]): string {
  switch (status) {
    case "added":
      return "created";
    case "deleted":
      return "deleted";
    case "modified":
      return "updated";
    case "renamed":
      return "renamed";
  }
}

function renderHistory(history: DashboardState["history"]): string {
  if (history.length === 0) {
    return `<p class="subtle">No runs yet.</p>`;
  }

  return `<ul>${history
    .map(
      (run) => `<li class="run">
        <div class="row">
          <strong>${escapeHtml(run.decision)}</strong>
          <span class="subtle">${escapeHtml(new Date(run.generatedAt).toLocaleTimeString())}</span>
        </div>
        <span class="subtle">${run.fileCount} files | ${run.findingCount} findings | cost ${
          run.diffCostScore ?? 0
        }</span>
        <span class="subtle">${escapeHtml(run.task)}</span>
      </li>`
    )
    .join("")}</ul>`;
}

function formatDecision(state: DashboardState): string {
  if (state.running) {
    return "Critical Gate is running";
  }

  if (state.result === undefined) {
    return "Ready to check this diff";
  }

  return state.result.summary.decision === "pass"
    ? "Gate passed"
    : `Gate failed with ${state.result.summary.findingCount} finding(s)`;
}

function formatTask(task: string): string {
  return task.length === 0 ? "Set a task intent or run the gate to enter one." : task;
}

function createNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";

  for (let index = 0; index < 32; index++) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }

  return nonce;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

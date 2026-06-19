import * as vscode from "vscode";

import type { Finding, FindingEvidence, GateResult } from "../../../src/schema/index.js";
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
    } else if (message.command === "openEvidence" && message.payload !== undefined) {
      await vscode.commands.executeCommand("criticalGate.openEvidence", message.payload);
    } else if (message.command === "copyRepair" && message.payload !== undefined) {
      await vscode.commands.executeCommand("criticalGate.copyRepair", message.payload);
    }
  }
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

function toFindingPayload(finding: Finding): CriticalGateDiagnosticPayload | undefined {
  const evidence = finding.evidence.find(
    (item): item is FindingEvidence & { path: string } =>
      item.path !== undefined && item.path.length > 0
  );

  if (evidence === undefined) {
    return undefined;
  }

  return {
    findingId: finding.id,
    detector: finding.detector,
    title: finding.title,
    repair: finding.repair,
    evidencePath: evidence.path,
    startLine: evidence.startLine,
    endLine: evidence.endLine
  };
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

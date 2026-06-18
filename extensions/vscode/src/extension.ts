import { execFile } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";

import * as vscode from "vscode";

import {
  findingsToEditorDiagnostics,
  groupEditorDiagnosticsByPath,
  type EditorDiagnostic
} from "../../../src/editor/index.js";
import type { Finding, FindingEvidence, GateResult } from "../../../src/schema/index.js";

const execFileAsync = promisify(execFile);
const diagnosticSource = "critical-gate";
const diagnosticPayloads = new Map<string, CriticalGateDiagnosticPayload>();

interface CriticalGateDiagnosticPayload {
  findingId: string;
  detector: string;
  title: string;
  repair: string;
  evidencePath: string;
  startLine?: number;
  endLine?: number;
}

interface RunRecord {
  id: number;
  task: string;
  generatedAt: string;
  decision: GateResult["summary"]["decision"];
  findingCount: number;
  fileCount: number;
  diffCostScore?: number;
}

interface RefreshState {
  diagnostics: vscode.DiagnosticCollection;
  output: vscode.OutputChannel;
  statusBar: vscode.StatusBarItem;
  dashboard: CriticalGateDashboardProvider;
  running: boolean;
  pendingTimer?: ReturnType<typeof setTimeout>;
  lastResult?: GateResult;
  lastReport?: string;
  lastTask?: string;
  lastError?: string;
  runSequence: number;
  history: RunRecord[];
}

type RunReason = "manual" | "onSave";

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection(diagnosticSource);
  const output = vscode.window.createOutputChannel("Critical Gate");
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  const dashboard = new CriticalGateDashboardProvider(context.extensionUri);
  const refreshState: RefreshState = {
    diagnostics,
    output,
    statusBar,
    dashboard,
    running: false,
    runSequence: 0,
    history: []
  };

  statusBar.name = "Critical Gate";
  statusBar.text = "$(shield) Critical Gate";
  statusBar.tooltip = "Run Critical Gate";
  statusBar.command = "criticalGate.runCheck";
  statusBar.show();
  dashboard.update(toDashboardState(refreshState));

  const dashboardView = vscode.window.registerWebviewViewProvider(
    CriticalGateDashboardProvider.viewType,
    dashboard
  );
  const runCommand = vscode.commands.registerCommand("criticalGate.runCheck", async () => {
    await runCriticalGate(refreshState, "manual");
  });
  const showReportCommand = vscode.commands.registerCommand("criticalGate.showReport", () => {
    showReport(refreshState);
  });
  const clearCommand = vscode.commands.registerCommand("criticalGate.clearDiagnostics", () => {
    clearPendingRefresh(refreshState);
    diagnostics.clear();
    diagnosticPayloads.clear();
    refreshState.lastResult = undefined;
    refreshState.lastReport = undefined;
    refreshState.lastError = undefined;
    refreshState.statusBar.text = "$(shield) Critical Gate";
    refreshState.statusBar.tooltip = "Run Critical Gate";
    refreshState.dashboard.update(toDashboardState(refreshState));
  });
  const settingsCommand = vscode.commands.registerCommand("criticalGate.openSettings", async () => {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "@ext:criticaldeveloper.critical-gate-vscode"
    );
  });
  const openEvidenceCommand = vscode.commands.registerCommand(
    "criticalGate.openEvidence",
    async (payload: CriticalGateDiagnosticPayload) => {
      await openEvidence(payload);
    }
  );
  const copyRepairCommand = vscode.commands.registerCommand(
    "criticalGate.copyRepair",
    async (payload: CriticalGateDiagnosticPayload) => {
      await vscode.env.clipboard.writeText(payload.repair);
      vscode.window.showInformationMessage("Critical Gate repair text copied.");
    }
  );
  const codeActions = vscode.languages.registerCodeActionsProvider(
    { scheme: "file" },
    new CriticalGateCodeActionProvider(),
    {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    }
  );
  const saveRefresh = vscode.workspace.onDidSaveTextDocument(() => {
    scheduleRefresh(refreshState);
  });

  context.subscriptions.push(
    diagnostics,
    output,
    statusBar,
    dashboardView,
    runCommand,
    showReportCommand,
    clearCommand,
    settingsCommand,
    openEvidenceCommand,
    copyRepairCommand,
    codeActions,
    saveRefresh,
    {
      dispose: () => clearPendingRefresh(refreshState)
    }
  );
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions for us.
}

async function runCriticalGate(state: RefreshState, reason: RunReason): Promise<void> {
  if (state.running) {
    return;
  }

  const folder = vscode.workspace.workspaceFolders?.[0];

  if (folder === undefined) {
    vscode.window.showWarningMessage("Critical Gate requires an open workspace folder.");
    return;
  }

  const task = await resolveTask();

  if (task === undefined) {
    return;
  }

  try {
    state.running = true;
    state.lastError = undefined;
    state.lastTask = task;
    state.statusBar.text = "$(sync~spin) Critical Gate";
    state.statusBar.tooltip = "Critical Gate is running.";
    state.dashboard.update(toDashboardState(state));

    const result = await runCli(folder, task);
    const report = renderReport(result);
    state.lastResult = result;
    state.lastReport = report;
    addRunHistory(state, result);
    applyDiagnostics(state.diagnostics, folder, result);
    writeReport(state.output, report);
    updateStatusBar(state);
    state.dashboard.update(toDashboardState(state));

    await notifyResult(state, reason, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Critical Gate error.";
    state.lastError = message;
    state.statusBar.text = "$(error) Critical Gate";
    state.statusBar.tooltip = message;
    state.dashboard.update(toDashboardState(state));
    vscode.window.showErrorMessage(message);
  } finally {
    state.running = false;
    updateStatusBar(state);
    state.dashboard.update(toDashboardState(state));
  }
}

function scheduleRefresh(state: RefreshState): void {
  if (getRefreshMode() !== "onSave") {
    return;
  }

  const task = getConfiguredTask();

  if (task.length === 0) {
    vscode.window.setStatusBarMessage(
      "Critical Gate on-save refresh skipped: configure criticalGate.task.",
      5000
    );
    return;
  }

  clearPendingRefresh(state);

  state.pendingTimer = setTimeout(() => {
    state.pendingTimer = undefined;
    void runCriticalGate(state, "onSave");
  }, getRefreshDebounceMs());
}

function clearPendingRefresh(state: RefreshState): void {
  if (state.pendingTimer !== undefined) {
    clearTimeout(state.pendingTimer);
    state.pendingTimer = undefined;
  }
}

async function resolveTask(): Promise<string | undefined> {
  const configuredTask = getConfiguredTask();

  if (configuredTask.length > 0) {
    return configuredTask;
  }

  return vscode.window.showInputBox({
    title: "Critical Gate task intent",
    prompt: "Describe the task this diff is expected to satisfy.",
    ignoreFocusOut: true
  });
}

async function runCli(folder: vscode.WorkspaceFolder, task: string): Promise<GateResult> {
  const config = vscode.workspace.getConfiguration("criticalGate");
  const cliPath = resolveWorkspacePath(folder, config.get<string>("cliPath", "dist/cli.js"));
  const base = config.get<string>("base", "").trim();
  const args = [cliPath, "check", "--task", task, "--format", "json"];

  if (base.length > 0) {
    args.push("--base", base);
  }

  const stdout = await execCriticalGate(args, folder.uri.fsPath);
  return JSON.parse(stdout) as GateResult;
}

async function execCriticalGate(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(process.execPath, args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024
    });

    return stdout;
  } catch (error) {
    if (isCliFindingFailure(error)) {
      return error.stdout;
    }

    throw error;
  }
}

function applyDiagnostics(
  diagnostics: vscode.DiagnosticCollection,
  folder: vscode.WorkspaceFolder,
  result: GateResult
): void {
  diagnostics.clear();
  diagnosticPayloads.clear();
  const grouped = groupEditorDiagnosticsByPath(findingsToEditorDiagnostics(result.findings));

  for (const [path, pathDiagnostics] of grouped) {
    diagnostics.set(
      vscode.Uri.file(join(folder.uri.fsPath, path)),
      pathDiagnostics.map(toVsCodeDiagnostic)
    );
  }
}

function toVsCodeDiagnostic(editorDiagnostic: EditorDiagnostic): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(
    toRange(editorDiagnostic.range),
    editorDiagnostic.message,
    toDiagnosticSeverity(editorDiagnostic.severity)
  );
  diagnostic.source = editorDiagnostic.source;
  const payload = toDiagnosticPayload(editorDiagnostic);
  const code = toDiagnosticCode(payload);
  diagnosticPayloads.set(code, payload);
  diagnostic.code = {
    value: code,
    target: vscode.Uri.parse(
      `command:criticalGate.openEvidence?${encodeURIComponent(JSON.stringify([payload]))}`
    )
  };

  return diagnostic;
}

function toRange(range: EditorDiagnostic["range"]): vscode.Range {
  return new vscode.Range(range.startLine, range.startColumn, range.endLine, range.endColumn);
}

function toDiagnosticSeverity(severity: EditorDiagnostic["severity"]): vscode.DiagnosticSeverity {
  if (severity === "error") {
    return vscode.DiagnosticSeverity.Error;
  }

  if (severity === "warning") {
    return vscode.DiagnosticSeverity.Warning;
  }

  if (severity === "information") {
    return vscode.DiagnosticSeverity.Information;
  }

  return vscode.DiagnosticSeverity.Hint;
}

function resolveWorkspacePath(folder: vscode.WorkspaceFolder, configuredPath: string): string {
  return isAbsolute(configuredPath) ? configuredPath : join(folder.uri.fsPath, configuredPath);
}

function getRefreshMode(): "manual" | "onSave" {
  const configuredMode = vscode.workspace
    .getConfiguration("criticalGate")
    .get<string>("refreshMode", "manual");

  return configuredMode === "onSave" ? "onSave" : "manual";
}

function getRefreshDebounceMs(): number {
  const configuredDelay = vscode.workspace
    .getConfiguration("criticalGate")
    .get<number>("refreshDebounceMs", 1200);

  return Math.max(0, configuredDelay);
}

function getConfiguredTask(): string {
  return vscode.workspace.getConfiguration("criticalGate").get<string>("task", "").trim();
}

function toDiagnosticPayload(editorDiagnostic: EditorDiagnostic): CriticalGateDiagnosticPayload {
  return {
    findingId: editorDiagnostic.code,
    detector: editorDiagnostic.detector,
    title: editorDiagnostic.findingTitle,
    repair: editorDiagnostic.repair,
    evidencePath: editorDiagnostic.evidence.path,
    startLine: editorDiagnostic.evidence.startLine,
    endLine: editorDiagnostic.evidence.endLine
  };
}

async function openEvidence(payload: CriticalGateDiagnosticPayload): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];

  if (folder === undefined) {
    vscode.window.showWarningMessage("Critical Gate requires an open workspace folder.");
    return;
  }

  const uri = vscode.Uri.file(join(folder.uri.fsPath, payload.evidencePath));
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);
  const startLine = Math.max(0, (payload.startLine ?? 1) - 1);
  const endLine = Math.max(0, (payload.endLine ?? payload.startLine ?? 1) - 1);
  const range = new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);

  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

function addRunHistory(state: RefreshState, result: GateResult): void {
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

function updateStatusBar(state: RefreshState): void {
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

async function notifyResult(
  state: RefreshState,
  reason: RunReason,
  result: GateResult
): Promise<void> {
  const checked = `${result.diff.files.length} file${result.diff.files.length === 1 ? "" : "s"}`;
  const findings = `${result.summary.findingCount} finding${
    result.summary.findingCount === 1 ? "" : "s"
  }`;

  if (reason === "onSave") {
    vscode.window.setStatusBarMessage(
      `Critical Gate ${result.summary.decision}: ${findings}.`,
      5000
    );
    return;
  }

  const message =
    result.summary.decision === "pass"
      ? `Critical Gate passed: ${checked} checked, ${findings}.`
      : `Critical Gate failed: ${checked} checked, ${findings}.`;
  const action = await (result.summary.decision === "pass"
    ? vscode.window.showInformationMessage(message, "Show Report", "Run Again")
    : vscode.window.showWarningMessage(message, "Show Report", "Run Again"));

  if (action === "Show Report") {
    showReport(state);
  } else if (action === "Run Again") {
    await runCriticalGate(state, "manual");
  }
}

function showReport(state: RefreshState): void {
  if (state.lastReport === undefined) {
    state.output.appendLine("No Critical Gate report is available yet. Run Critical Gate first.");
  }

  state.output.show(true);
}

function writeReport(output: vscode.OutputChannel, report: string): void {
  output.clear();
  output.append(report);
}

function renderReport(result: GateResult): string {
  const lines = [
    "# Critical Gate Report",
    "",
    `Decision: ${result.summary.decision}`,
    `Task: ${result.task.summary ?? result.task.text}`,
    `Base: ${result.diff.baseRef ?? "working tree"}`,
    `Head: ${result.diff.headRef ?? "HEAD"}`,
    `Changed Files: ${result.diff.files.length}`,
    `Findings: ${result.summary.findingCount}`,
    `Diff Cost Score: ${result.summary.diffCostScore ?? 0}`,
    "",
    "## Changed Files",
    "",
    ...formatChangedFiles(result),
    "",
    "## Findings",
    "",
    ...formatFindings(result.findings)
  ];

  return `${lines.join("\n")}\n`;
}

function formatChangedFiles(result: GateResult): string[] {
  if (result.diff.files.length === 0) {
    return ["- No changed files detected."];
  }

  return result.diff.files.map(
    (file) => `- ${file.status} ${file.path} (${file.role}, +${file.additions}/-${file.deletions})`
  );
}

function formatFindings(findings: Finding[]): string[] {
  if (findings.length === 0) {
    return ["- No findings."];
  }

  return findings.flatMap((finding, index) => [
    `### ${index + 1}. ${finding.title}`,
    "",
    `- Severity: ${finding.severity}`,
    `- Detector: ${finding.detector}`,
    `- Confidence: ${Math.round(finding.confidence * 100)}%`,
    `- Message: ${finding.message}`,
    `- Repair: ${finding.repair}`,
    `- Evidence: ${formatEvidenceList(finding.evidence)}`,
    ""
  ]);
}

function formatEvidenceList(evidence: FindingEvidence[]): string {
  if (evidence.length === 0) {
    return "none";
  }

  return evidence
    .map((item) => {
      const location =
        item.path === undefined
          ? item.kind
          : `${item.path}${item.startLine === undefined ? "" : `:${item.startLine}`}`;
      return `${location} (${item.message})`;
    })
    .join("; ");
}

function toDashboardState(state: RefreshState): DashboardState {
  return {
    running: state.running,
    task: state.lastTask ?? getConfiguredTask(),
    result: state.lastResult,
    history: state.history,
    error: state.lastError
  };
}

class CriticalGateCodeActionProvider implements vscode.CodeActionProvider {
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

interface DashboardState {
  running: boolean;
  task: string;
  result?: GateResult;
  history: RunRecord[];
  error?: string;
}

class CriticalGateDashboardProvider implements vscode.WebviewViewProvider {
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

type DashboardMessage =
  | { command: "run" | "showReport" | "clear" | "settings" }
  | { command: "openEvidence" | "copyRepair"; payload?: CriticalGateDiagnosticPayload };

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

function renderHistory(history: RunRecord[]): string {
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

function isCriticalGateDiagnostic(diagnostic: vscode.Diagnostic): boolean {
  return diagnostic.source === diagnosticSource;
}

function getDiagnosticPayload(
  diagnostic: vscode.Diagnostic
): CriticalGateDiagnosticPayload | undefined {
  if (typeof diagnostic.code !== "object" || diagnostic.code === null) {
    return undefined;
  }

  return diagnosticPayloads.get(String(diagnostic.code.value));
}

function toDiagnosticCode(payload: CriticalGateDiagnosticPayload): string {
  return [
    payload.detector,
    payload.findingId,
    payload.evidencePath,
    String(payload.startLine ?? 1)
  ].join("/");
}

function isCliFindingFailure(error: unknown): error is { code: number; stdout: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "stdout" in error &&
    (error as { code: unknown }).code === 1 &&
    typeof (error as { stdout: unknown }).stdout === "string"
  );
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

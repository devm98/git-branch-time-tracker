import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";

const execAsync = promisify(exec);

interface TimeEntry {
  date: string;
  repository: string;
  branch: string;
  duration: number; // in seconds
  startTime: number;
  endTime: number;
}

interface ActiveSession {
  repository: string;
  branch: string;
  startTime: number;
  lastActivity: number;
}

export class GitBranchTimeTracker {
  private context: vscode.ExtensionContext;
  private timeData: TimeEntry[] = [];
  private activeSession: ActiveSession | null = null;
  private activityTimer: NodeJS.Timeout | null = null;
  private readonly INACTIVITY_THRESHOLD = 30 * 1000; // 30 seconds
  private readonly DATA_FILE = "git-branch-time-data.json";
  private isDisposed = false;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadTimeData();
    this.setupEventListeners();
    this.startInitialTracking();
  }

  private loadTimeData() {
    try {
      const globalStoragePath = this.context.globalStorageUri?.fsPath;
      if (!globalStoragePath) {
        console.log("No global storage path available");
        return;
      }

      const dataPath = path.join(globalStoragePath, this.DATA_FILE);
      if (fs.existsSync(dataPath)) {
        const data = fs.readFileSync(dataPath, "utf8");
        this.timeData = JSON.parse(data);
        console.log("Loaded time data:", this.timeData.length, "entries");
      }
    } catch (error) {
      console.error("Failed to load time data:", error);
      this.timeData = [];
    }
  }

  private saveTimeData() {
    try {
      const globalStoragePath = this.context.globalStorageUri?.fsPath;
      if (!globalStoragePath) {
        console.error("No global storage path available");
        return;
      }

      if (!fs.existsSync(globalStoragePath)) {
        fs.mkdirSync(globalStoragePath, { recursive: true });
      }

      const dataPath = path.join(globalStoragePath, this.DATA_FILE);
      fs.writeFileSync(dataPath, JSON.stringify(this.timeData, null, 2));
      console.log("Saved time data:", this.timeData.length, "entries");
    } catch (error) {
      console.error("Failed to save time data:", error);
    }
  }

  private setupEventListeners() {
    if (this.isDisposed) return;

    // Track text document changes
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (
          event.document.uri.scheme === "file" &&
          event.contentChanges.length > 0
        ) {
          console.log("Document changed:", event.document.fileName);
          this.onActivity();
        }
      })
    );

    // Track when files are saved
    this.context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.uri.scheme === "file") {
          console.log("Document saved:", document.fileName);
          this.onActivity();
        }
      })
    );

    // Track when files are opened
    this.context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.uri.scheme === "file") {
          console.log("Document opened:", document.fileName);
          this.onActivity();
        }
      })
    );

    // Track workspace folder changes
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        console.log("Workspace folders changed");
        this.startInitialTracking();
      })
    );

    // Track when VS Code window loses focus
    this.context.subscriptions.push(
      vscode.window.onDidChangeWindowState((state) => {
        if (!state.focused) {
          console.log("Window lost focus");
          this.stopCurrentSession();
        }
      })
    );

    // Track active editor changes
    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.uri.scheme === "file") {
          console.log("Active editor changed:", editor.document.fileName);
          this.onActivity();
        }
      })
    );
  }

  private async onActivity() {
    if (this.isDisposed) return;

    const now = Date.now();
    console.log("Activity detected at:", new Date(now).toLocaleTimeString());

    try {
      const workspaceFolder = this.getActiveWorkspaceFolder();
      if (!workspaceFolder) {
        console.log("No workspace folder found");
        return;
      }

      const currentRepo = await this.getCurrentRepository(
        workspaceFolder.uri.fsPath
      );
      const currentBranch = await this.getCurrentBranch(
        workspaceFolder.uri.fsPath
      );

      if (!currentRepo || !currentBranch) {
        console.log("Not in a git repository or no branch found");
        return;
      }

      console.log("Current repo:", currentRepo, "branch:", currentBranch);

      // If no active session or different repo/branch, start new session
      if (
        !this.activeSession ||
        this.activeSession.repository !== currentRepo ||
        this.activeSession.branch !== currentBranch
      ) {
        console.log("Starting new session");
        this.stopCurrentSession();
        this.startNewSession(currentRepo, currentBranch, now);
      }

      // Update last activity time
      if (this.activeSession) {
        this.activeSession.lastActivity = now;
        console.log("Updated last activity time");
      }

      // Reset inactivity timer
      this.resetActivityTimer();
    } catch (error) {
      console.error("Error handling activity:", error);
    }
  }

  private getActiveWorkspaceFolder(): vscode.WorkspaceFolder | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    // Try to get workspace folder of active document
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const activeDocument = activeEditor.document;
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(
        activeDocument.uri
      );
      if (workspaceFolder) {
        return workspaceFolder;
      }
    }

    // Fallback to first workspace folder
    return workspaceFolders[0];
  }

  private startNewSession(
    repository: string,
    branch: string,
    startTime: number
  ) {
    this.activeSession = {
      repository,
      branch,
      startTime,
      lastActivity: startTime,
    };
    console.log("New session started:", repository, branch);
  }

  private stopCurrentSession() {
    if (!this.activeSession) {
      return;
    }

    const endTime = this.activeSession.lastActivity;
    const duration = Math.max(0, endTime - this.activeSession.startTime);

    console.log("Stopping session, duration:", duration / 1000, "seconds");

    if (duration > 5000) {
      // Only save sessions longer than 5 seconds
      const entry: TimeEntry = {
        date: new Date(this.activeSession.startTime)
          .toISOString()
          .split("T")[0],
        repository: this.activeSession.repository,
        branch: this.activeSession.branch,
        duration: Math.floor(duration / 1000),
        startTime: this.activeSession.startTime,
        endTime: endTime,
      };

      this.timeData.push(entry);
      this.saveTimeData();
      console.log("Session saved:", entry);
    }

    this.activeSession = null;
  }

  private resetActivityTimer() {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
    }

    this.activityTimer = setTimeout(() => {
      console.log("Inactivity timeout reached");
      this.stopCurrentSession();
    }, this.INACTIVITY_THRESHOLD);
  }

  private async getCurrentRepository(
    workspacePath: string
  ): Promise<string | null> {
    try {
      const { stdout } = await execAsync("git rev-parse --show-toplevel", {
        cwd: workspacePath,
        timeout: 5000,
      });
      const repoPath = stdout.trim();
      return path.basename(repoPath);
    } catch (error) {
      console.log("Not a git repository:", workspacePath);
      return null;
    }
  }

  private async getCurrentBranch(
    workspacePath: string
  ): Promise<string | null> {
    try {
      const { stdout } = await execAsync("git branch --show-current", {
        cwd: workspacePath,
        timeout: 5000,
      });
      const branch = stdout.trim();
      return branch || "main";
    } catch (error) {
      console.log("Could not get current branch:", workspacePath);
      return null;
    }
  }

  private async startInitialTracking() {
    // Wait a bit for VS Code to settle
    setTimeout(() => {
      if (!this.isDisposed) {
        console.log("Starting initial tracking check");
        this.onActivity();
      }
    }, 2000);
  }

  public getTimeData(): TimeEntry[] {
    return [...this.timeData];
  }

  public resetData() {
    this.timeData = [];
    this.stopCurrentSession();
    this.saveTimeData();
    vscode.window.showInformationMessage("Time tracking data has been reset.");
  }

  public getStatsForRepository(repository: string): any {
    const repoData = this.timeData.filter(
      (entry) => entry.repository === repository
    );
    const branches: { [key: string]: { [key: string]: number } } = {};

    repoData.forEach((entry) => {
      if (!branches[entry.branch]) {
        branches[entry.branch] = {};
      }
      if (!branches[entry.branch][entry.date]) {
        branches[entry.branch][entry.date] = 0;
      }
      branches[entry.branch][entry.date] += entry.duration;
    });

    return branches;
  }

  public getAllRepositories(): string[] {
    const repos = new Set(this.timeData.map((entry) => entry.repository));
    return Array.from(repos);
  }

  public getCurrentStatus(): string {
    if (this.activeSession) {
      const duration = Date.now() - this.activeSession.startTime;
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      return `Active: ${this.activeSession.repository}/${this.activeSession.branch} (${minutes}m ${seconds}s)`;
    }
    return "Inactive";
  }

  public dispose() {
    this.isDisposed = true;
    this.stopCurrentSession();
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
    }
  }
}

class TimeTrackerWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "gitBranchTimeTracker";
  private webviewView?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly tracker: GitBranchTimeTracker
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ) {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    this.updateWebview();

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "refresh":
          this.updateWebview();
          break;
        case "reset":
          vscode.commands.executeCommand("gitBranchTimeTracker.resetData");
          break;
      }
    });
  }

  private updateWebview() {
    if (!this.webviewView) {
      return;
    }

    const repositories = this.tracker.getAllRepositories();
    const timeData = this.tracker.getTimeData();
    const currentStatus = this.tracker.getCurrentStatus();

    this.webviewView.webview.html = this.getWebviewContent(
      repositories,
      timeData,
      currentStatus
    );
  }

  private getWebviewContent(
    repositories: string[],
    timeData: TimeEntry[],
    currentStatus: string
  ): string {
    const formatDuration = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    };

    const groupedData: {
      [repo: string]: { [branch: string]: { [date: string]: number } };
    } = {};

    timeData.forEach((entry) => {
      if (!groupedData[entry.repository]) {
        groupedData[entry.repository] = {};
      }
      if (!groupedData[entry.repository][entry.branch]) {
        groupedData[entry.repository][entry.branch] = {};
      }
      if (!groupedData[entry.repository][entry.branch][entry.date]) {
        groupedData[entry.repository][entry.branch][entry.date] = 0;
      }
      groupedData[entry.repository][entry.branch][entry.date] += entry.duration;
    });

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    padding: 10px;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                }
                .status-bar {
                    background-color: var(--vscode-statusBar-background);
                    color: var(--vscode-statusBar-foreground);
                    padding: 8px;
                    margin: -10px -10px 15px -10px;
                    font-size: 12px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .controls {
                    margin-bottom: 15px;
                    text-align: center;
                }
                .button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    margin: 0 5px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .button.secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .button.secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                .repo-section {
                    margin-bottom: 20px;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 10px;
                    background-color: var(--vscode-editor-background);
                }
                .repo-title {
                    font-weight: bold;
                    font-size: 14px;
                    margin-bottom: 10px;
                    color: var(--vscode-textLink-foreground);
                    display: flex;
                    align-items: center;
                }
                .repo-icon {
                    margin-right: 8px;
                }
                .branch-item {
                    margin-left: 15px;
                    margin-bottom: 8px;
                    padding: 8px;
                    background-color: var(--vscode-list-hoverBackground);
                    border-radius: 3px;
                    border-left: 3px solid var(--vscode-gitDecoration-modifiedResourceForeground);
                }
                .branch-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 5px;
                }
                .branch-name {
                    font-weight: 500;
                    color: var(--vscode-gitDecoration-modifiedResourceForeground);
                    display: flex;
                    align-items: center;
                }
                .branch-icon {
                    margin-right: 6px;
                }
                .total-time {
                    font-weight: bold;
                    color: var(--vscode-terminal-ansiGreen);
                    font-size: 12px;
                }
                .time-entries {
                    margin-left: 10px;
                }
                .time-entry {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 2px;
                    display: flex;
                    justify-content: space-between;
                }
                .no-data {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    margin: 30px 0;
                    padding: 20px;
                    background-color: var(--vscode-inputValidation-infoBackground);
                    border-radius: 4px;
                }
                .summary {
                    background-color: var(--vscode-notifications-background);
                    border: 1px solid var(--vscode-notifications-border);
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div class="status-bar">
                🕒 Status: ${currentStatus}
            </div>

            <div class="controls">
                <button class="button" onclick="refresh()">🔄 Refresh</button>
                <button class="button secondary" onclick="resetData()">🗑️ Reset Data</button>
            </div>

            ${
              Object.keys(groupedData).length === 0
                ? `
                <div class="no-data">
                    <div style="font-size: 24px; margin-bottom: 10px;">📊</div>
                    <div><strong>No time data available yet</strong></div>
                    <div style="margin-top: 8px;">Start editing files in a Git repository to begin tracking!</div>
                </div>
            `
                : `
                <div class="summary">
                    <strong>📈 Summary:</strong> ${
                      repositories.length
                    } repositories, ${timeData.length} sessions
                </div>
                ${Object.entries(groupedData)
                  .map(
                    ([repo, branches]) => `
                    <div class="repo-section">
                        <div class="repo-title">
                            <span class="repo-icon">📁</span>
                            ${repo}
                        </div>
                        ${Object.entries(branches)
                          .map(([branch, dates]) => {
                            const totalTime = Object.values(dates).reduce(
                              (sum, time) => sum + time,
                              0
                            );
                            const sortedDates = Object.entries(dates).sort(
                              ([a], [b]) => b.localeCompare(a)
                            );
                            return `
                                <div class="branch-item">
                                    <div class="branch-header">
                                        <div class="branch-name">
                                            <span class="branch-icon">🌿</span>
                                            ${branch}
                                        </div>
                                        <div class="total-time">${formatDuration(
                                          totalTime
                                        )}</div>
                                    </div>
                                    <div class="time-entries">
                                        ${sortedDates
                                          .map(
                                            ([date, time]) => `
                                            <div class="time-entry">
                                                <span>📅 ${date}</span>
                                                <span>${formatDuration(
                                                  time
                                                )}</span>
                                            </div>
                                        `
                                          )
                                          .join("")}
                                    </div>
                                </div>
                            `;
                          })
                          .join("")}
                    </div>
                `
                  )
                  .join("")}
            `
            }

            <script>
                const vscode = acquireVsCodeApi();

                function refresh() {
                    vscode.postMessage({ command: 'refresh' });
                }

                function resetData() {
                    if (confirm('Are you sure you want to reset all time tracking data? This cannot be undone.')) {
                        vscode.postMessage({ command: 'reset' });
                    }
                }

                // Auto refresh every 30 seconds
                setInterval(refresh, 30000);
            </script>
        </body>
        </html>`;
  }

  public refresh() {
    this.updateWebview();
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log("Git Branch Time Tracker is now active!");

  const tracker = new GitBranchTimeTracker(context);
  const webviewProvider = new TimeTrackerWebviewProvider(context, tracker);

  // Register webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TimeTrackerWebviewProvider.viewType,
      webviewProvider
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "gitBranchTimeTracker.showDashboard",
      () => {
        webviewProvider.refresh();
        vscode.commands.executeCommand(
          "workbench.view.extension.gitBranchTimeTracker"
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("gitBranchTimeTracker.resetData", () => {
      vscode.window
        .showWarningMessage(
          "Are you sure you want to reset all time tracking data? This action cannot be undone.",
          "Yes, Reset",
          "Cancel"
        )
        .then((selection) => {
          if (selection === "Yes, Reset") {
            tracker.resetData();
            webviewProvider.refresh();
          }
        });
    })
  );

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = "gitBranchTimeTracker.showDashboard";
  statusBarItem.show();

  // Update status bar every 10 seconds
  const updateStatusBar = () => {
    const status = tracker.getCurrentStatus();
    statusBarItem.text = `$(clock) ${status}`;
    statusBarItem.tooltip = "Git Branch Time Tracker - Click to open dashboard";
  };

  updateStatusBar();
  const statusInterval = setInterval(updateStatusBar, 10000);

  // Auto-refresh webview every 30 seconds
  const refreshInterval = setInterval(() => {
    webviewProvider.refresh();
  }, 30000);

  context.subscriptions.push(
    statusBarItem,
    { dispose: () => clearInterval(statusInterval) },
    { dispose: () => clearInterval(refreshInterval) },
    { dispose: () => tracker.dispose() }
  );

  // Show welcome message
  vscode.window
    .showInformationMessage(
      "Git Branch Time Tracker is now active! Start editing files to begin tracking.",
      "Open Dashboard"
    )
    .then((selection) => {
      if (selection === "Open Dashboard") {
        vscode.commands.executeCommand("gitBranchTimeTracker.showDashboard");
      }
    });
}

export function deactivate() {
  console.log("Git Branch Time Tracker deactivated");
}

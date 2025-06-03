// extension.ts
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

interface TimeSession {
  start: string;
  end?: string;
  files: string[];
}

interface BranchData {
  totalTime: number; // in seconds
  sessions: TimeSession[];
}

interface TrackingData {
  [branchName: string]: BranchData;
}

export function activate(context: vscode.ExtensionContext) {
  const tracker = new GitBranchTimeTracker(context);

  // Commands
  const showDashboard = vscode.commands.registerCommand(
    "gitBranchTracker.showDashboard",
    () => {
      tracker.showDashboard();
    }
  );

  const resetData = vscode.commands.registerCommand(
    "gitBranchTracker.resetData",
    () => {
      tracker.resetData();
    }
  );

  context.subscriptions.push(showDashboard, resetData);
}

class GitBranchTimeTracker {
  private currentBranch: string | null = null;
  private currentSession: TimeSession | null = null;
  private trackingData: TrackingData = {};
  private dataFilePath: string;
  private gitExtension: any;
  private statusBarItem: vscode.StatusBarItem;

  constructor(private context: vscode.ExtensionContext) {
    this.dataFilePath = path.join(
      context.globalStorageUri?.fsPath || "",
      "git-branch-tracker.json"
    );
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = "gitBranchTracker.showDashboard";

    this.initialize();
  }

  private async initialize() {
    // Load existing data
    this.loadData();

    // Get Git extension
    const gitExt = vscode.extensions.getExtension("vscode.git");
    if (gitExt) {
      this.gitExtension = gitExt.exports.getAPI(1);
    }

    // Start tracking
    this.startTracking();

    // Setup event listeners
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for file changes
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (this.currentSession && event.document.uri.scheme === "file") {
        const fileName = path.basename(event.document.uri.fsPath);
        if (!this.currentSession.files.includes(fileName)) {
          this.currentSession.files.push(fileName);
        }
      }
    });

    // Listen for active editor changes
    vscode.window.onDidChangeActiveTextEditor(() => {
      this.checkBranchChange();
    });

    // Periodic check for branch changes
    setInterval(() => {
      this.checkBranchChange();
    }, 5000);

    // Save data periodically
    setInterval(() => {
      this.saveData();
    }, 30000);
  }

  private async getCurrentBranch(): Promise<string | null> {
    if (!this.gitExtension || this.gitExtension.repositories.length === 0) {
      return null;
    }

    const repo = this.gitExtension.repositories[0];
    return repo.state.HEAD?.name || null;
  }

  private async checkBranchChange() {
    const newBranch = await this.getCurrentBranch();

    if (newBranch !== this.currentBranch) {
      // Stop current session
      if (this.currentSession) {
        this.stopCurrentSession();
      }

      // Start new session for new branch
      if (newBranch) {
        this.startNewSession(newBranch);
      }

      this.currentBranch = newBranch;
      this.updateStatusBar();
    }
  }

  private startTracking() {
    this.getCurrentBranch().then((branch) => {
      if (branch) {
        this.startNewSession(branch);
        this.currentBranch = branch;
        this.updateStatusBar();
      }
    });
  }

  private startNewSession(branchName: string) {
    this.currentSession = {
      start: new Date().toISOString(),
      files: [],
    };

    if (!this.trackingData[branchName]) {
      this.trackingData[branchName] = {
        totalTime: 0,
        sessions: [],
      };
    }

    vscode.window.showInformationMessage(`Started tracking: ${branchName}`);
  }

  private stopCurrentSession() {
    if (!this.currentSession || !this.currentBranch) return;

    this.currentSession.end = new Date().toISOString();

    const startTime = new Date(this.currentSession.start);
    const endTime = new Date(this.currentSession.end);
    const duration = Math.floor(
      (endTime.getTime() - startTime.getTime()) / 1000
    );

    this.trackingData[this.currentBranch].sessions.push(this.currentSession);
    this.trackingData[this.currentBranch].totalTime += duration;

    this.saveData();

    vscode.window.showInformationMessage(
      `Stopped tracking: ${this.currentBranch} (${this.formatDuration(
        duration
      )})`
    );

    this.currentSession = null;
  }

  private updateStatusBar() {
    if (this.currentBranch && this.currentSession) {
      const startTime = new Date(this.currentSession.start);
      const currentTime = new Date();
      const elapsed = Math.floor(
        (currentTime.getTime() - startTime.getTime()) / 1000
      );

      this.statusBarItem.text = `$(git-branch) ${
        this.currentBranch
      } | $(clock) ${this.formatDuration(elapsed)}`;
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }

    // Update every minute
    setTimeout(() => this.updateStatusBar(), 60000);
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  private loadData() {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const data = fs.readFileSync(this.dataFilePath, "utf8");
        this.trackingData = JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading tracking data:", error);
    }
  }

  private saveData() {
    try {
      const dir = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.dataFilePath,
        JSON.stringify(this.trackingData, null, 2)
      );
    } catch (error) {
      console.error("Error saving tracking data:", error);
    }
  }

  public showDashboard() {
    const panel = vscode.window.createWebviewPanel(
      "gitBranchTracker",
      "Git Branch Time Tracker",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = this.getDashboardHtml();
  }

  private getDashboardHtml(): string {
    const branches = Object.keys(this.trackingData).sort(
      (a, b) => this.trackingData[b].totalTime - this.trackingData[a].totalTime
    );

    let branchesHtml = "";

    for (const branch of branches) {
      const data = this.trackingData[branch];
      const totalHours = (data.totalTime / 3600).toFixed(1);

      // Group sessions by date
      const sessionsByDate: { [date: string]: TimeSession[] } = {};

      data.sessions.forEach((session) => {
        const date = new Date(session.start).toLocaleDateString("vi-VN");
        if (!sessionsByDate[date]) {
          sessionsByDate[date] = [];
        }
        sessionsByDate[date].push(session);
      });

      let sessionsHtml = "";
      Object.keys(sessionsByDate)
        .sort()
        .reverse()
        .forEach((date) => {
          const sessions = sessionsByDate[date];
          const dailyTotal = sessions.reduce((total, session) => {
            if (session.end) {
              const duration =
                (new Date(session.end).getTime() -
                  new Date(session.start).getTime()) /
                1000;
              return total + duration;
            }
            return total;
          }, 0);

          sessionsHtml += `
                    <div class="date-group">
                        <h4>${date} - ${this.formatDuration(dailyTotal)}</h4>
                        <ul class="sessions">
                `;

          sessions.forEach((session) => {
            const startTime = new Date(session.start).toLocaleTimeString(
              "vi-VN",
              {
                hour: "2-digit",
                minute: "2-digit",
              }
            );
            const endTime = session.end
              ? new Date(session.end).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Đang chạy";

            const duration = session.end
              ? Math.floor(
                  (new Date(session.end).getTime() -
                    new Date(session.start).getTime()) /
                    1000
                )
              : 0;

            const filesText =
              session.files.length > 0
                ? `Files: ${session.files.join(", ")}`
                : "No files modified";

            sessionsHtml += `
                        <li class="session">
                            <div class="session-time">${startTime} - ${endTime} ${
              session.end ? `(${this.formatDuration(duration)})` : ""
            }</div>
                            <div class="session-files">${filesText}</div>
                        </li>
                    `;
          });

          sessionsHtml += `
                        </ul>
                    </div>
                `;
        });

      branchesHtml += `
                <div class="branch-card">
                    <div class="branch-header">
                        <h3>${branch}</h3>
                        <span class="total-time">${totalHours} giờ</span>
                    </div>
                    <div class="branch-details">
                        ${sessionsHtml}
                    </div>
                </div>
            `;
    }

    return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Git Branch Time Tracker</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 20px;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .header {
                        border-bottom: 1px solid var(--vscode-panel-border);
                        padding-bottom: 20px;
                        margin-bottom: 20px;
                    }
                    .branch-card {
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 8px;
                        margin-bottom: 20px;
                        padding: 20px;
                    }
                    .branch-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 15px;
                    }
                    .branch-header h3 {
                        margin: 0;
                        color: var(--vscode-gitDecoration-modifiedResourceForeground);
                    }
                    .total-time {
                        font-size: 18px;
                        font-weight: bold;
                        color: var(--vscode-terminal-ansiGreen);
                    }
                    .date-group {
                        margin-bottom: 15px;
                    }
                    .date-group h4 {
                        margin: 0 0 10px 0;
                        color: var(--vscode-textLink-foreground);
                    }
                    .sessions {
                        list-style: none;
                        padding: 0;
                        margin: 0 0 0 20px;
                    }
                    .session {
                        margin-bottom: 8px;
                        padding: 8px;
                        background: var(--vscode-input-background);
                        border-radius: 4px;
                        border-left: 3px solid var(--vscode-textLink-foreground);
                    }
                    .session-time {
                        font-weight: bold;
                        margin-bottom: 4px;
                    }
                    .session-files {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Git Branch Time Tracker</h1>
                    <p>Thống kê thời gian làm việc theo branch</p>
                </div>
                ${branchesHtml || "<p>Chưa có dữ liệu tracking nào.</p>"}
            </body>
            </html>
        `;
  }

  public resetData() {
    vscode.window
      .showWarningMessage(
        "Bạn có chắc muốn xóa tất cả dữ liệu tracking?",
        "Có",
        "Không"
      )
      .then((selection) => {
        if (selection === "Có") {
          this.trackingData = {};
          this.saveData();
          vscode.window.showInformationMessage(
            "Đã xóa tất cả dữ liệu tracking."
          );
        }
      });
  }
}

export function deactivate() {
  // Cleanup if needed
}

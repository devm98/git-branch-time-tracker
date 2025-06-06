import * as vscode from "vscode";
import { TimeEntry } from "../interfaces/time-tracker";
import { GitBranchTimeTracker } from "../services/time-tracker-service";
import { debounce } from "../utils/debounce";

export class TimeTrackerWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "gitBranchTimeTracker";
  private webviewView?: vscode.WebviewView;
  private lastUpdateTime: number = 0;
  private readonly UPDATE_INTERVAL = 1000; // Minimum time between updates in ms

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

  private updateWebview = debounce(() => {
    if (!this.webviewView) {
      return;
    }

    const now = Date.now();
    if (now - this.lastUpdateTime < this.UPDATE_INTERVAL) {
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

    this.lastUpdateTime = now;
  }, 300);

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
                let lastRefreshTime = 0;
                const MIN_REFRESH_INTERVAL = 1000; // Minimum time between refreshes in ms

                function refresh() {
                    const now = Date.now();
                    if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
                        return;
                    }
                    lastRefreshTime = now;
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

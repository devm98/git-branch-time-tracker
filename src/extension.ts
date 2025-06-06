import * as vscode from "vscode";
import { GitBranchTimeTracker } from "./services/time-tracker-service";
import { TimeTrackerWebviewProvider } from "./providers/time-tracker-webview-provider";

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

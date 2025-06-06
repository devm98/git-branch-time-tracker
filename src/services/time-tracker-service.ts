import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { TimeEntry, ActiveSession } from "../interfaces/time-tracker";
import { getCurrentRepository, getCurrentBranch } from "../utils/git-utils";
import { BatchUpdater } from "../utils/batch-updater";
import { debounce } from "../utils/debounce";

export class GitBranchTimeTracker {
  private context: vscode.ExtensionContext;
  private timeData: TimeEntry[] = [];
  private activeSession: ActiveSession | null = null;
  private activityTimer: NodeJS.Timeout | null = null;
  private readonly INACTIVITY_THRESHOLD = 30 * 1000; // 30 seconds
  private readonly DATA_FILE = "git-branch-time-data.json";
  private isDisposed = false;
  private batchUpdater: BatchUpdater<TimeEntry>;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadTimeData();
    this.batchUpdater = new BatchUpdater<TimeEntry>(
      (entries) => this.saveTimeDataBatch(entries),
      10, // batch size
      5000 // 5 seconds timeout
    );
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

  private saveTimeDataBatch(entries: TimeEntry[]) {
    try {
      const globalStoragePath = this.context.globalStorageUri?.fsPath;
      if (!globalStoragePath) {
        console.error("No global storage path available");
        return;
      }

      if (!fs.existsSync(globalStoragePath)) {
        fs.mkdirSync(globalStoragePath, { recursive: true });
      }

      // Add new entries to timeData
      this.timeData.push(...entries);

      const dataPath = path.join(globalStoragePath, this.DATA_FILE);
      fs.writeFileSync(dataPath, JSON.stringify(this.timeData, null, 2));
      console.log("Saved time data batch:", entries.length, "entries");
    } catch (error) {
      console.error("Failed to save time data batch:", error);
    }
  }

  private setupEventListeners() {
    if (this.isDisposed) return;

    // Track text document changes with debounce
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(
        debounce((event) => {
          if (
            event.document.uri.scheme === "file" &&
            event.contentChanges.length > 0
          ) {
            console.log("Document changed:", event.document.fileName);
            this.onActivity();
          }
        }, 300)
      )
    );

    // Track when files are saved
    this.context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(
        debounce((document) => {
          if (document.uri.scheme === "file") {
            console.log("Document saved:", document.fileName);
            this.onActivity();
          }
        }, 300)
      )
    );

    // Track when files are opened
    this.context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument(
        debounce((document) => {
          if (document.uri.scheme === "file") {
            console.log("Document opened:", document.fileName);
            this.onActivity();
          }
        }, 300)
      )
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

    // Track active editor changes with debounce
    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(
        debounce((editor) => {
          if (editor && editor.document.uri.scheme === "file") {
            console.log("Active editor changed:", editor.document.fileName);
            this.onActivity();
          }
        }, 300)
      )
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

      const currentRepo = await getCurrentRepository(
        workspaceFolder.uri.fsPath
      );
      const currentBranch = await getCurrentBranch(workspaceFolder.uri.fsPath);

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

      // Use batch updater instead of direct save
      this.batchUpdater.add(entry);
      console.log("Session added to batch:", entry);
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
    this.batchUpdater.flush();
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
    this.batchUpdater.dispose();
  }
}

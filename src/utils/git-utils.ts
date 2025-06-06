import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";

const execAsync = promisify(exec);

export async function getCurrentRepository(
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

export async function getCurrentBranch(
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

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

function getCurrentRepoRoot(): string {
  return path.resolve(__dirname, "..", "..", "..");
}

function getPrimaryRepoRoot(currentRepoRoot: string): string {
  try {
    const gitCommonDir = execSync("git rev-parse --git-common-dir", {
      cwd: currentRepoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return path.resolve(gitCommonDir, "..");
  } catch {
    return currentRepoRoot;
  }
}

export function resolveRepoFile(fileName: string): string {
  const currentRepoRoot = getCurrentRepoRoot();
  const localPath = path.join(currentRepoRoot, fileName);
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  const primaryRepoRoot = getPrimaryRepoRoot(currentRepoRoot);
  const primaryPath = path.join(primaryRepoRoot, fileName);
  if (fs.existsSync(primaryPath)) {
    return primaryPath;
  }

  return localPath;
}

import os from "node:os";
import path from "node:path";

export function getHomeDir(explicitHome?: string): string {
  return explicitHome || process.env.AMAZINGZZ_HOME || process.env.HOME || process.env.USERPROFILE || os.homedir();
}

export function expandHome(filePath: string, homeDir = getHomeDir()): string {
  if (filePath === "~") return homeDir;
  if (filePath.startsWith(`~${path.sep}`) || filePath.startsWith("~/")) {
    return path.join(homeDir, filePath.slice(2));
  }
  return filePath;
}

export function configPath(homeDir: string, ...segments: string[]): string {
  return path.join(homeDir, ...segments);
}

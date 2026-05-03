import fs from "node:fs/promises";
import path from "node:path";

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readText(filePath: string): Promise<string | undefined> {
  if (!(await pathExists(filePath))) return undefined;
  return fs.readFile(filePath, "utf8");
}

export async function readJson(filePath: string): Promise<Record<string, unknown>> {
  const text = await readText(filePath);
  if (!text?.trim()) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

export async function writeJsonWithBackup(filePath: string, value: unknown, dryRun: boolean): Promise<string | undefined> {
  return writeTextWithBackup(filePath, `${JSON.stringify(value, null, 2)}\n`, dryRun);
}

export async function writeTextWithBackup(filePath: string, content: string, dryRun: boolean): Promise<string | undefined> {
  if (dryRun) return undefined;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  let backupPath: string | undefined;
  if (await pathExists(filePath)) {
    backupPath = `${filePath}.bak.${timestamp()}`;
    await fs.copyFile(filePath, backupPath);
  }
  await fs.writeFile(filePath, content, "utf8");
  return backupPath;
}

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

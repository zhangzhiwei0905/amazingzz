import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { API_KEY_ENV } from "../constants.js";

export async function persistApiKey(apiKey: string, homeDir: string, dryRun: boolean): Promise<string> {
  process.env[API_KEY_ENV] = apiKey;
  if (dryRun) return `${API_KEY_ENV} set for this process only (dry run)`;

  if (process.platform === "win32") {
    const result = spawnSync("setx", [API_KEY_ENV, apiKey], { stdio: "ignore", windowsHide: true });
    if (result.status === 0) return `${API_KEY_ENV} saved to Windows user environment`;
    return `${API_KEY_ENV} set for this process; setx failed`;
  }

  const shell = process.env.SHELL || "";
  const profile = shell.includes("zsh") ? ".zshrc" : ".bashrc";
  const profilePath = path.join(homeDir, profile);
  const line = `export ${API_KEY_ENV}=${JSON.stringify(apiKey)}`;
  const marker = `# amazingzz ${API_KEY_ENV}`;
  let current = "";
  try {
    current = await fs.readFile(profilePath, "utf8");
  } catch {
    // A missing profile is fine; create it below.
  }
  const next = current.includes(marker)
    ? current.replace(new RegExp(`${escapeRegExp(marker)}\\nexport ${API_KEY_ENV}=.*`, "m"), `${marker}\n${line}`)
    : `${current}${current.endsWith("\n") || !current ? "" : "\n"}${marker}\n${line}\n`;
  await fs.writeFile(profilePath, next, "utf8");
  return `${API_KEY_ENV} saved to ${profilePath}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

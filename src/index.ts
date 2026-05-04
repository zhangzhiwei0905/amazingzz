#!/usr/bin/env node
import { Command, Option } from "commander";
import { checkbox, input, password } from "@inquirer/prompts";
import { adapters } from "./adapters/index.js";
import { API_KEY_ENV, CLAUDE_CODE_MODEL, DEFAULT_MODEL, DEFAULT_TARGETS } from "./constants.js";
import type { ApplyResult, CheckResult, Target } from "./types.js";
import { persistApiKey } from "./utils/env.js";
import { getHomeDir } from "./utils/paths.js";
import { normalizeBaseUrl } from "./utils/url.js";

const program = new Command();

program
  .name("amazingzz")
  .description("Configure Codex CLI, OpenClaw, Hermes, and Claude Code for the AmazingZZ sub2api gateway")
  .version("0.1.0");

program
  .command("setup")
  .description("Configure supported clients")
  .option("--base-url <url>", "AmazingZZ gateway base URL")
  .option("--api-key <key>", "AmazingZZ API key")
  .option("--model <model>", "Default OpenAI/GPT model for Codex, OpenClaw, and Hermes", DEFAULT_MODEL)
  .option("--claude-code-model <model>", "Claude-facing model name for Claude Code", CLAUDE_CODE_MODEL)
  .option("--targets <targets>", "Comma-separated targets: codex,openclaw,hermes,claude-code")
  .option("--yes", "Run non-interactively; requires base URL and API key")
  .option("--dry-run", "Print what would change without writing files")
  .option("--json", "Output JSON")
  .option("--hermes-home <path>", "Override Hermes home directory")
  .addOption(new Option("--home <path>", "Override home directory").hideHelp())
  .action(async (options) => {
    const homeDir = getHomeDir(options.home);
    const targets = options.targets ? parseTargets(options.targets) : await promptTargets(options.yes);
    const baseUrlInput = await getRequiredValue("base_url", options.baseUrl, options.yes, false);
    const apiKey = await getRequiredValue("api_key", options.apiKey, options.yes, true);
    const model = await getModelValue(options.model, options.yes);
    const baseUrl = normalizeBaseUrl(baseUrlInput);
    const claudeCodeModel = String(options.claudeCodeModel || CLAUDE_CODE_MODEL).trim() || CLAUDE_CODE_MODEL;

    const envMessage = await persistApiKey(apiKey, homeDir, Boolean(options.dryRun));
    const results: ApplyResult[] = [];
    for (const target of targets) {
      results.push(await adapters[target].setup({
        baseUrl,
        apiKey,
        model,
        dryRun: Boolean(options.dryRun),
        yes: Boolean(options.yes),
        homeDir: targetHomeDir(target, homeDir, options.hermesHome),
        network: !options.dryRun,
        allowNativeHermes: target === "hermes" && Boolean(options.hermesHome),
        claudeCodeModel
      }));
    }

    if (options.json) {
      printJson({ env: envMessage, results });
    } else {
      console.log(envMessage);
      printApplyResults(results);
    }
  });

program
  .command("check")
  .description("Check supported client configuration")
  .option("--base-url <url>", "Expected AmazingZZ gateway base URL")
  .option("--api-key <key>", "API key to use for network checks")
  .option("--model <model>", "Model to use for network checks", DEFAULT_MODEL)
  .option("--targets <targets>", "Comma-separated targets: codex,openclaw,hermes,claude-code")
  .option("--no-network", "Skip network checks")
  .option("--json", "Output JSON")
  .option("--hermes-home <path>", "Override Hermes home directory")
  .addOption(new Option("--home <path>", "Override home directory").hideHelp())
  .action(async (options) => {
    const homeDir = getHomeDir(options.home);
    const targets = parseTargets(options.targets || DEFAULT_TARGETS.join(","));
    const expectedBaseUrl = options.baseUrl ? normalizeBaseUrl(options.baseUrl) : undefined;
    const results: CheckResult[] = [];

    for (const target of targets) {
      results.push(await adapters[target].check({
        expectedBaseUrl,
        apiKey: options.apiKey,
        model: options.model,
        homeDir: targetHomeDir(target, homeDir, options.hermesHome),
        network: Boolean(options.network)
      }));
    }

    if (options.json) printJson({ results });
    else printCheckResults(results);

    if (results.some((result) => result.status === "fail")) process.exitCode = 1;
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function promptTargets(yes?: boolean): Promise<Target[]> {
  if (yes) return [...DEFAULT_TARGETS];
  return checkbox<Target>({
    message: "Select clients to configure",
    choices: DEFAULT_TARGETS.map((target) => ({ name: target, value: target, checked: true })),
    required: true
  });
}

async function getRequiredValue(name: string, value: string | undefined, yes: boolean | undefined, secret: boolean): Promise<string> {
  if (value?.trim()) return value.trim();
  if (yes) throw new Error(`--${name.replace("_", "-")} is required with --yes`);
  const message = `Enter ${name}`;
  const answer = secret
    ? await password({ message, mask: "*" })
    : await input({ message, required: true });
  if (!answer.trim()) throw new Error(`${name} is required`);
  return answer.trim();
}

async function getModelValue(value: string | undefined, yes: boolean | undefined): Promise<string> {
  if (value?.trim()) return value.trim();
  if (yes) return DEFAULT_MODEL;
  const answer = await input({ message: "Enter model", default: DEFAULT_MODEL });
  return answer.trim() || DEFAULT_MODEL;
}
function parseTargets(value: string): Target[] {
  const targets = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (!targets.length) throw new Error("At least one target is required");
  for (const target of targets) {
    if (!DEFAULT_TARGETS.includes(target as Target)) throw new Error(`Unknown target: ${target}`);
  }
  return targets as Target[];
}

function targetHomeDir(target: Target, defaultHomeDir: string, hermesHome?: string): string {
  return target === "hermes" && hermesHome ? getHomeDir(hermesHome) : defaultHomeDir;
}
function printApplyResults(results: ApplyResult[]): void {
  for (const result of results) {
    const backup = result.backupPath ? ` backup=${result.backupPath}` : "";
    const mode = result.apiMode ? ` mode=${result.apiMode}` : "";
    console.log(`${statusIcon(result.status)} ${targetLabel(result.target)}${result.status === "pass" ? "已配置完成" : result.status === "warn" ? "配置有提示" : "配置失败"}`);
    console.log(`    ${result.message}`);
    console.log(`    path=${result.path}${mode}${backup}`);
  }
}

function statusIcon(status: ApplyResult["status"]): string {
  if (status === "pass") return "✅";
  if (status === "warn") return "⚠️";
  return "❌";
}

function targetLabel(target: Target): string {
  switch (target) {
    case "claude-code":
      return "Claude Code";
    case "openclaw":
      return "OpenClaw";
    case "hermes":
      return "Hermes";
    case "codex":
      return "Codex";
  }
}

function printCheckResults(results: CheckResult[]): void {
  for (const result of results) {
    const mode = result.apiMode ? ` mode=${result.apiMode}` : "";
    const baseUrl = result.baseUrl ? ` base_url=${result.baseUrl}` : "";
    const model = result.model ? ` model=${result.model}` : "";
    console.log(`[${result.status}] ${result.target}: ${result.message}`);
    console.log(`    path=${result.path}${mode}${baseUrl}${model}`);
    for (const detail of result.details ?? []) console.log(`    - ${detail}`);
  }
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

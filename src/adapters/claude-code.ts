import { CLAUDE_CODE_MODEL } from "../constants.js";
import type { Adapter, ApplyResult, CheckContext, CheckResult, SetupContext } from "../types.js";
import { readJson, writeJsonWithBackup } from "../utils/fs.js";
import { configPath } from "../utils/paths.js";
import { probeAnthropicEndpoint } from "../utils/network.js";
import { normalizeAnthropicBaseUrl } from "../utils/url.js";

type JsonObject = Record<string, unknown>;

const ANTHROPIC_BASE_URL = "ANTHROPIC_BASE_URL";
const ANTHROPIC_API_KEY = "ANTHROPIC_API_KEY";
const ANTHROPIC_AUTH_TOKEN = "ANTHROPIC_AUTH_TOKEN";
const ANTHROPIC_MODEL = "ANTHROPIC_MODEL";
const ANTHROPIC_CUSTOM_MODEL_OPTION = "ANTHROPIC_CUSTOM_MODEL_OPTION";

export const claudeCodeAdapter: Adapter = {
  target: "claude-code",
  async setup(context: SetupContext): Promise<ApplyResult> {
    const filePath = getPath(context.homeDir);
    const config = await readJson(filePath);
    const env = ensureObject(config, "env");
    const baseUrl = normalizeAnthropicBaseUrl(context.baseUrl);

    const claudeModel = context.claudeCodeModel || CLAUDE_CODE_MODEL;

    env[ANTHROPIC_BASE_URL] = baseUrl;
    env[ANTHROPIC_API_KEY] = context.apiKey;
    env[ANTHROPIC_AUTH_TOKEN] = context.apiKey;
    env[ANTHROPIC_MODEL] = claudeModel;
    env[ANTHROPIC_CUSTOM_MODEL_OPTION] = claudeModel;

    const backupPath = await writeJsonWithBackup(filePath, config, context.dryRun);
    return {
      target: "claude-code",
      status: "pass",
      path: filePath,
      message: context.dryRun ? "Claude Code settings would be updated" : "Claude Code settings updated",
      backupPath,
      apiMode: "anthropic"
    };
  },

  async check(context: CheckContext): Promise<CheckResult> {
    const filePath = getPath(context.homeDir);
    const config = await readJson(filePath);
    const env = isObject(config.env) ? config.env : {};
    const baseUrl = typeof env[ANTHROPIC_BASE_URL] === "string" ? env[ANTHROPIC_BASE_URL] : undefined;
    const apiKey = context.apiKey
      || (typeof env[ANTHROPIC_AUTH_TOKEN] === "string" ? env[ANTHROPIC_AUTH_TOKEN] : undefined)
      || (typeof env[ANTHROPIC_API_KEY] === "string" ? env[ANTHROPIC_API_KEY] : undefined);
    const model = typeof env[ANTHROPIC_MODEL] === "string" ? env[ANTHROPIC_MODEL] : context.model;
    const details: string[] = [];

    if (!baseUrl) details.push(`${ANTHROPIC_BASE_URL} is missing`);
    if (!apiKey) details.push(`${ANTHROPIC_API_KEY} or ${ANTHROPIC_AUTH_TOKEN} is missing`);
    if (baseUrl && context.expectedBaseUrl && baseUrl !== normalizeAnthropicBaseUrl(context.expectedBaseUrl)) {
      details.push(`${ANTHROPIC_BASE_URL} is ${baseUrl}`);
    }
    if (!model) details.push(`${ANTHROPIC_MODEL} is missing`);

    if (context.network && baseUrl && apiKey && model) {
      const probe = await probeAnthropicEndpoint(baseUrl, apiKey, model);
      if (!probe.ok) details.push(`network: ${probe.detail}`);
    }

    return {
      target: "claude-code",
      status: details.length ? "fail" : "pass",
      path: filePath,
      message: details.length ? "Claude Code settings need attention" : "Claude Code settings are valid",
      baseUrl,
      model,
      authSource: `${ANTHROPIC_API_KEY}/${ANTHROPIC_AUTH_TOKEN}`,
      apiMode: "anthropic",
      details
    };
  }
};

function getPath(homeDir: string): string {
  return configPath(homeDir, ".claude", "settings.json");
}

function ensureObject(parent: JsonObject, key: string): JsonObject {
  const value = parent[key];
  if (!isObject(value)) parent[key] = {};
  return parent[key] as JsonObject;
}

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

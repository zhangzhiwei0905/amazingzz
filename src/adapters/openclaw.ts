import { API_KEY_ENV, PROVIDER_ID } from "../constants.js";
import type { Adapter, ApplyResult, CheckContext, CheckResult, SetupContext, ApiMode } from "../types.js";
import { readJson, writeJsonWithBackup } from "../utils/fs.js";
import { configPath } from "../utils/paths.js";
import { probeApiMode } from "../utils/network.js";

type JsonObject = Record<string, unknown>;

export const openClawAdapter: Adapter = {
  target: "openclaw",
  async setup(context: SetupContext): Promise<ApplyResult> {
    const filePath = getPath(context.homeDir);
    const config = await readJson(filePath);
    const modeProbe = context.network
      ? await probeApiMode(context.baseUrl, context.apiKey, context.model, true)
      : { mode: "responses" as ApiMode, detail: "network check skipped" };

    const models = ensureObject(config, "models");
    models.mode = "merge";
    const providers = ensureObject(models, "providers");
    providers[PROVIDER_ID] = {
      ...(isObject(providers[PROVIDER_ID]) ? providers[PROVIDER_ID] as JsonObject : {}),
      baseUrl: context.baseUrl,
      apiKey: `\${${API_KEY_ENV}}`,
      api: modeProbe.mode === "responses" ? "openai-responses" : "openai-completions",
      models: [{ id: context.model, name: context.model }]
    };

    const agents = ensureObject(config, "agents");
    const defaults = ensureObject(agents, "defaults");
    const modelDefaults = ensureObject(defaults, "model");
    modelDefaults.primary = `${PROVIDER_ID}/${context.model}`;

    const backupPath = await writeJsonWithBackup(filePath, config, context.dryRun);
    return {
      target: "openclaw",
      status: "pass",
      path: filePath,
      message: context.dryRun ? "OpenClaw config would be updated" : `OpenClaw config updated (${modeProbe.detail})`,
      backupPath,
      apiMode: modeProbe.mode
    };
  },

  async check(context: CheckContext): Promise<CheckResult> {
    const filePath = getPath(context.homeDir);
    const config = await readJson(filePath);
    const provider = getProvider(config);
    const details: string[] = [];

    if (!provider) details.push("models.providers.amazingzz is missing");
    const baseUrl = provider?.baseUrl;
    if (baseUrl && context.expectedBaseUrl && baseUrl !== context.expectedBaseUrl) details.push(`baseUrl is ${String(baseUrl)}`);
    if (provider?.apiKey !== `\${${API_KEY_ENV}}`) details.push(`apiKey should reference \${${API_KEY_ENV}}`);

    const primary = getPrimaryModel(config);
    if (!primary || !String(primary).startsWith(`${PROVIDER_ID}/`)) details.push(`default model is ${String(primary ?? "missing")}`);
    if (!process.env[API_KEY_ENV] && !context.apiKey) details.push(`${API_KEY_ENV} is not set`);

    const apiMode = provider?.api === "openai-completions" ? "chat" : "responses";
    const apiKey = context.apiKey || process.env[API_KEY_ENV];
    if (context.network && baseUrl && apiKey) {
      const probe = await probeApiMode(String(baseUrl), apiKey, modelFromProvider(provider) || context.model || "gpt-5.5", true);
      if (!probe.ok) details.push(`network: ${probe.detail}`);
      else if (apiMode === "responses" && probe.mode === "chat") details.push("responses failed but chat fallback is reachable");
    }

    return {
      target: "openclaw",
      status: details.length ? "fail" : "pass",
      path: filePath,
      message: details.length ? "OpenClaw config needs attention" : "OpenClaw config is valid",
      baseUrl: baseUrl ? String(baseUrl) : undefined,
      model: modelFromProvider(provider) || modelFromPrimary(primary),
      authSource: API_KEY_ENV,
      apiMode,
      details
    };
  }
};

function getPath(homeDir: string): string {
  return configPath(homeDir, ".openclaw", "openclaw.json");
}

function ensureObject(parent: JsonObject, key: string): JsonObject {
  const value = parent[key];
  if (!isObject(value)) parent[key] = {};
  return parent[key] as JsonObject;
}

function getProvider(config: JsonObject): JsonObject | undefined {
  const models = config.models;
  if (!isObject(models)) return undefined;
  const providers = models.providers;
  if (!isObject(providers)) return undefined;
  const provider = providers[PROVIDER_ID];
  return isObject(provider) ? provider : undefined;
}

function getPrimaryModel(config: JsonObject): unknown {
  const agents = config.agents;
  if (!isObject(agents)) return undefined;
  const defaults = agents.defaults;
  if (!isObject(defaults)) return undefined;
  const model = defaults.model;
  if (!isObject(model)) return undefined;
  return model.primary;
}

function modelFromProvider(provider?: JsonObject): string | undefined {
  const models = provider?.models;
  if (!Array.isArray(models) || !isObject(models[0])) return undefined;
  const id = models[0].id;
  return typeof id === "string" ? id : undefined;
}

function modelFromPrimary(primary: unknown): string | undefined {
  if (typeof primary !== "string") return undefined;
  return primary.startsWith(`${PROVIDER_ID}/`) ? primary.slice(PROVIDER_ID.length + 1) : primary;
}

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}



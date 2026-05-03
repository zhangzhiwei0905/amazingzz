import { API_KEY_ENV, PROVIDER_ID, PROVIDER_NAME } from "../constants.js";
import type { Adapter, ApplyResult, CheckContext, CheckResult, SetupContext } from "../types.js";
import type { TomlObject } from "../config/toml.js";
import { parseToml, stringifyToml } from "../config/toml.js";
import { readText, writeTextWithBackup } from "../utils/fs.js";
import { configPath } from "../utils/paths.js";
import { probeEndpoint } from "../utils/network.js";

export const codexAdapter: Adapter = {
  target: "codex",
  async setup(context: SetupContext): Promise<ApplyResult> {
    const filePath = getPath(context.homeDir);
    const existing = parseToml((await readText(filePath)) ?? "");
    const modelProviders = ensureObject(existing, "model_providers");
    const provider = ensureObject(modelProviders, PROVIDER_ID);

    existing.model = context.model;
    existing.model_provider = PROVIDER_ID;
    provider.name = PROVIDER_NAME;
    provider.base_url = context.baseUrl;
    provider.env_key = API_KEY_ENV;
    provider.wire_api = "responses";

    const backupPath = await writeTextWithBackup(filePath, stringifyToml(existing), context.dryRun);
    return {
      target: "codex",
      status: "pass",
      path: filePath,
      message: context.dryRun ? "Codex config would be updated" : "Codex config updated",
      backupPath,
      apiMode: "responses"
    };
  },

  async check(context: CheckContext): Promise<CheckResult> {
    const filePath = getPath(context.homeDir);
    const config = parseToml((await readText(filePath)) ?? "");
    const provider = getProvider(config);
    const details: string[] = [];

    if (config.model_provider !== PROVIDER_ID) details.push(`model_provider is ${String(config.model_provider ?? "missing")}`);
    if (!provider) details.push("model_providers.amazingzz is missing");
    if (provider?.env_key !== API_KEY_ENV) details.push(`env_key is ${String(provider?.env_key ?? "missing")}`);
    if (provider?.base_url && context.expectedBaseUrl && provider.base_url !== context.expectedBaseUrl) details.push(`base_url is ${provider.base_url}`);
    if (!process.env[API_KEY_ENV] && !context.apiKey) details.push(`${API_KEY_ENV} is not set`);

    const apiKey = context.apiKey || process.env[API_KEY_ENV];
    if (context.network && provider?.base_url && apiKey) {
      const probe = await probeEndpoint(String(provider.base_url), apiKey, String(config.model || context.model || "gpt-5.5"), "responses");
      if (!probe.ok) details.push(`network: ${probe.detail}`);
    }

    return {
      target: "codex",
      status: details.length ? "fail" : "pass",
      path: filePath,
      message: details.length ? "Codex config needs attention" : "Codex config is valid",
      baseUrl: provider?.base_url ? String(provider.base_url) : undefined,
      model: config.model ? String(config.model) : undefined,
      authSource: API_KEY_ENV,
      apiMode: "responses",
      details
    };
  }
};

function getPath(homeDir: string): string {
  return configPath(homeDir, ".codex", "config.toml");
}

function ensureObject(parent: TomlObject, key: string): TomlObject {
  const value = parent[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) parent[key] = {};
  return parent[key] as TomlObject;
}

function getProvider(config: TomlObject): TomlObject | undefined {
  const providers = config.model_providers;
  if (!providers || typeof providers !== "object" || Array.isArray(providers)) return undefined;
  const provider = (providers as TomlObject)[PROVIDER_ID];
  if (!provider || typeof provider !== "object" || Array.isArray(provider)) return undefined;
  return provider as TomlObject;
}



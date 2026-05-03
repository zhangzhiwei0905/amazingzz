import YAML from "yaml";
import { PROVIDER_ID } from "../constants.js";
import type { Adapter, ApplyResult, CheckContext, CheckResult, SetupContext, ApiMode } from "../types.js";
import { readText, writeTextWithBackup } from "../utils/fs.js";
import { configPath } from "../utils/paths.js";
import { probeApiMode } from "../utils/network.js";

type YamlObject = Record<string, unknown>;

export const hermesAdapter: Adapter = {
  target: "hermes",
  async setup(context: SetupContext): Promise<ApplyResult> {
    const filePath = getPath(context.homeDir);
    if (isNativeWindows(context)) {
      return {
        target: "hermes",
        status: "warn",
        path: filePath,
        message: "Hermes is WSL-first on Windows; run this command inside WSL or pass a WSL home as AMAZINGZZ_HOME"
      };
    }

    const config = readYaml((await readText(filePath)) ?? "");
    const modeProbe = context.network
      ? await probeApiMode(context.baseUrl, context.apiKey, context.model, true)
      : { mode: "responses" as ApiMode, detail: "network check skipped" };

    const providers = Array.isArray(config.custom_providers) ? config.custom_providers as unknown[] : [];
    const nextProvider = {
      ...(findProvider(providers) ?? {}),
      name: PROVIDER_ID,
      base_url: context.baseUrl,
      api_key: context.apiKey,
      api_mode: modeProbe.mode
    };
    config.custom_providers = [...providers.filter((item) => !isAmazingzzProvider(item)), nextProvider];

    const model = ensureObject(config, "model");
    model.provider = `custom:${PROVIDER_ID}`;
    model.default = context.model;

    const backupPath = await writeTextWithBackup(filePath, YAML.stringify(config), context.dryRun);
    return {
      target: "hermes",
      status: "pass",
      path: filePath,
      message: context.dryRun ? "Hermes config would be updated" : `Hermes config updated (${modeProbe.detail})`,
      backupPath,
      apiMode: modeProbe.mode
    };
  },

  async check(context: CheckContext): Promise<CheckResult> {
    const filePath = getPath(context.homeDir);
    const config = readYaml((await readText(filePath)) ?? "");
    const model = isObject(config.model) ? config.model : {};
    const providerName = model.provider;
    const namedProvider = getNamedProvider(config);
    const fallbackBaseUrl = typeof model.base_url === "string" ? model.base_url : undefined;
    const fallbackApiKey = typeof model.api_key === "string" ? model.api_key : undefined;
    const baseUrl = typeof namedProvider?.base_url === "string" ? namedProvider.base_url : fallbackBaseUrl;
    const apiKey = context.apiKey || (typeof namedProvider?.api_key === "string" ? namedProvider.api_key : fallbackApiKey);
    const apiMode = namedProvider?.api_mode === "chat" ? "chat" : "responses";
    const details: string[] = [];

    if (providerName !== `custom:${PROVIDER_ID}` && providerName !== "custom") details.push(`model.provider is ${String(providerName ?? "missing")}`);
    if (!namedProvider && providerName !== "custom") details.push("custom_providers.amazingzz is missing");
    if (baseUrl && context.expectedBaseUrl && baseUrl !== context.expectedBaseUrl) details.push(`base_url is ${baseUrl}`);
    if (!baseUrl) details.push("base_url is missing");
    if (!apiKey) details.push("api_key is missing");

    if (context.network && baseUrl && apiKey) {
      const probe = await probeApiMode(baseUrl, apiKey, String(model.default || context.model || "gpt-5.5"), true);
      if (!probe.ok) details.push(`network: ${probe.detail}`);
      else if (apiMode === "responses" && probe.mode === "chat") details.push("responses failed but chat fallback is reachable");
    }

    return {
      target: "hermes",
      status: details.length ? "fail" : "pass",
      path: filePath,
      message: details.length ? "Hermes config needs attention" : "Hermes config is valid",
      baseUrl,
      model: typeof model.default === "string" ? model.default : undefined,
      authSource: namedProvider ? "custom_providers.amazingzz.api_key" : "model.api_key",
      apiMode,
      details
    };
  }
};

function getPath(homeDir: string): string {
  return configPath(homeDir, ".hermes", "config.yaml");
}

function readYaml(text: string): YamlObject {
  if (!text.trim()) return {};
  const parsed = YAML.parse(text);
  return isObject(parsed) ? parsed : {};
}

function ensureObject(parent: YamlObject, key: string): YamlObject {
  const value = parent[key];
  if (!isObject(value)) parent[key] = {};
  return parent[key] as YamlObject;
}

function getNamedProvider(config: YamlObject): YamlObject | undefined {
  const providers = config.custom_providers;
  if (!Array.isArray(providers)) return undefined;
  return findProvider(providers);
}

function findProvider(providers: unknown[]): YamlObject | undefined {
  const found = providers.find(isAmazingzzProvider);
  return isObject(found) ? found : undefined;
}

function isAmazingzzProvider(value: unknown): boolean {
  return isObject(value) && value.name === PROVIDER_ID;
}

function isObject(value: unknown): value is YamlObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNativeWindows(context: SetupContext): boolean {
  return process.platform === "win32" && !context.allowNativeHermes && !process.env.WSL_DISTRO_NAME && !process.env.AMAZINGZZ_ALLOW_NATIVE_HERMES;
}



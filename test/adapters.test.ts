import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import YAML from "yaml";
import { claudeCodeAdapter } from "../src/adapters/claude-code.js";
import { codexAdapter } from "../src/adapters/codex.js";
import { hermesAdapter } from "../src/adapters/hermes.js";
import { openClawAdapter } from "../src/adapters/openclaw.js";
import { CLAUDE_CODE_MODEL, DEFAULT_MODEL } from "../src/constants.js";
import { parseToml } from "../src/config/toml.js";

let homeDir: string;
const oldAllowNativeHermes = process.env.AMAZINGZZ_ALLOW_NATIVE_HERMES;

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "amazingzz-"));
  process.env.AMAZINGZZ_ALLOW_NATIVE_HERMES = "1";
});

afterEach(async () => {
  if (oldAllowNativeHermes === undefined) delete process.env.AMAZINGZZ_ALLOW_NATIVE_HERMES;
  else process.env.AMAZINGZZ_ALLOW_NATIVE_HERMES = oldAllowNativeHermes;
  await fs.rm(homeDir, { recursive: true, force: true });
});

const setupContext = {
  baseUrl: "https://gateway.example.com/v1",
  apiKey: "test-key",
  model: DEFAULT_MODEL,
  dryRun: false,
  yes: true,
  network: false
};

describe("adapters", () => {
  it("writes Codex provider and default model", async () => {
    await codexAdapter.setup({ ...setupContext, homeDir });
    const text = await fs.readFile(path.join(homeDir, ".codex", "config.toml"), "utf8");
    const config = parseToml(text);

    expect(config.model).toBe(DEFAULT_MODEL);
    expect(config.model_provider).toBe("amazingzz");
    expect((config.model_providers as any).amazingzz.base_url).toBe("https://gateway.example.com/v1");
    expect((config.model_providers as any).amazingzz.env_key).toBe("AMAZINGZZ_API_KEY");
  });

  it("merges OpenClaw config without deleting unrelated fields", async () => {
    const filePath = path.join(homeDir, ".openclaw", "openclaw.json");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ keep: true, models: { providers: { old: { baseUrl: "x" } } } }), "utf8");

    await openClawAdapter.setup({ ...setupContext, homeDir });
    const config = JSON.parse(await fs.readFile(filePath, "utf8"));

    expect(config.keep).toBe(true);
    expect(config.models.providers.old.baseUrl).toBe("x");
    expect(config.models.mode).toBe("merge");
    expect(config.models.providers.amazingzz.baseUrl).toBe("https://gateway.example.com/v1");
    expect(config.models.providers.amazingzz.apiKey).toBe("${AMAZINGZZ_API_KEY}");
    expect(config.agents.defaults.model.primary).toBe(`amazingzz/${DEFAULT_MODEL}`);
  });

  it("writes Claude Code Anthropic-compatible env settings with Claude-facing model", async () => {
    await claudeCodeAdapter.setup({ ...setupContext, homeDir });
    const config = JSON.parse(await fs.readFile(path.join(homeDir, ".claude", "settings.json"), "utf8"));

    expect(config.env.ANTHROPIC_BASE_URL).toBe("https://gateway.example.com");
    expect(config.env.ANTHROPIC_API_KEY).toBe("test-key");
    expect(config.env.ANTHROPIC_AUTH_TOKEN).toBe("test-key");
    expect(config.env.ANTHROPIC_MODEL).toBe(CLAUDE_CODE_MODEL);
    expect(config.env.ANTHROPIC_CUSTOM_MODEL_OPTION).toBe(CLAUDE_CODE_MODEL);
  });

  it("preserves unrelated Claude Code settings and existing env values", async () => {
    const filePath = path.join(homeDir, ".claude", "settings.json");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ alwaysThinkingEnabled: true, env: { KEEP_ME: "yes" } }), "utf8");

    await claudeCodeAdapter.setup({ ...setupContext, homeDir });
    const config = JSON.parse(await fs.readFile(filePath, "utf8"));

    expect(config.alwaysThinkingEnabled).toBe(true);
    expect(config.env.KEEP_ME).toBe("yes");
    expect(config.env.ANTHROPIC_MODEL).toBe(CLAUDE_CODE_MODEL);
  });

  it("writes Hermes named custom provider without creating other client configs", async () => {
    await hermesAdapter.setup({ ...setupContext, homeDir });
    const config = YAML.parse(await fs.readFile(path.join(homeDir, ".hermes", "config.yaml"), "utf8"));

    expect(config.model.provider).toBe("custom:amazingzz");
    expect(config.model.default).toBe(DEFAULT_MODEL);
    expect(config.custom_providers[0].name).toBe("amazingzz");
    expect(config.custom_providers[0].base_url).toBe("https://gateway.example.com/v1");
    expect(config.custom_providers[0].api_key).toBe("test-key");
    await expect(fs.access(path.join(homeDir, ".claude", "settings.json"))).rejects.toThrow();
    await expect(fs.access(path.join(homeDir, ".codex", "config.toml"))).rejects.toThrow();
    await expect(fs.access(path.join(homeDir, ".openclaw", "openclaw.json"))).rejects.toThrow();
  });
});

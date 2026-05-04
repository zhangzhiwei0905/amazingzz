# amazingzz

`amazingzz` is an npx-friendly setup and diagnostics tool for configuring local AI coding clients to use an AmazingZZ sub2api gateway.

It currently supports:

- Codex CLI
- OpenClaw
- Hermes Agent
- Claude Code

The tool focuses on the two settings that matter for gateway access: `base_url` and `api_key`. The default model is `gpt-5.5`.

## Quick Start

```bash
npx amazingzz setup
```

The interactive setup wizard asks for:

- gateway base URL
- API key
- default model, prefilled as `gpt-5.5`
- target clients to configure

You can also run it non-interactively:

```bash
npx amazingzz setup --yes --base-url https://gateway.example.com --api-key sk-xxx --model gpt-5.5
```

Check whether local configuration is correct:

```bash
npx amazingzz check
```

Check without network requests:

```bash
npx amazingzz check --no-network
```


## API Compatibility

Codex CLI, OpenClaw, and Hermes are configured against OpenAI-compatible gateway routes such as `/v1/responses` or `/v1/chat/completions`.

Claude Code is different: it expects Anthropic-compatible Messages API behavior at `/v1/messages`. A gateway that only implements OpenAI-compatible APIs will not be enough for Claude Code unless it also translates Anthropic Messages requests.
## Commands

### `setup`

Writes or updates client configuration files. Existing files are backed up with a timestamp before they are changed.

```bash
npx amazingzz setup [options]
```

Useful options:

- `--base-url <url>`: AmazingZZ gateway URL. If `/v1` is missing, it is added automatically.
- `--api-key <key>`: AmazingZZ API key.
- `--model <model>`: model name. Defaults to `gpt-5.5`.
- `--targets <list>`: comma-separated clients, for example `codex,openclaw,hermes,claude-code`.
- `--yes`: non-interactive mode.
- `--dry-run`: show planned changes without writing files.
- `--json`: print machine-readable output.
- `--hermes-home <path>`: override the home directory used for Hermes config.

### `check`

Inspects local config and optionally sends a lightweight request to the gateway.

```bash
npx amazingzz check [options]
```

Useful options:

- `--base-url <url>`: expected gateway URL.
- `--api-key <key>`: key used for network checks.
- `--model <model>`: model used for network checks. Defaults to `gpt-5.5`.
- `--targets <list>`: comma-separated clients to check.
- `--no-network`: skip gateway requests and only inspect local files.
- `--json`: print machine-readable output.
- `--hermes-home <path>`: override the home directory used for Hermes config.

## What It Configures

### Codex CLI

Target file:

```text
~/.codex/config.toml
```

The tool adds an `amazingzz` model provider, sets it as the active provider, and stores the API key in the user environment as `AMAZINGZZ_API_KEY`.

Codex is configured for the Responses API.

### OpenClaw

Target file:

```text
~/.openclaw/openclaw.json
```

The tool adds `models.providers.amazingzz`, points it at the gateway, references `AMAZINGZZ_API_KEY`, and sets the default model to `amazingzz/<model>`.

OpenClaw uses Responses mode when available and can fall back to Chat Completions mode when the gateway check indicates that is the reachable mode.

### Hermes Agent

Target file:

```text
~/.hermes/config.yaml
```

The tool writes a named custom provider:

```yaml
model:
  provider: custom:amazingzz
  default: gpt-5.5
custom_providers:
  - name: amazingzz
    base_url: https://gateway.example.com/v1
    api_key: sk-xxx
    api_mode: responses
```

On native Windows, Hermes is treated as WSL-first. Run the command inside WSL, or pass `--hermes-home` to point at the home directory that contains `.hermes/config.yaml`.


### Claude Code

Target file:

```text
~/.claude/settings.json
```

Claude Code uses the Anthropic Messages API shape, so this target requires your gateway to expose an Anthropic-compatible endpoint. This is separate from the OpenAI-compatible `/v1/responses` and `/v1/chat/completions` endpoints used by the other clients.

The tool writes these environment variables under `env`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://gateway.example.com",
    "ANTHROPIC_API_KEY": "sk-xxx",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxx",
    "ANTHROPIC_MODEL": "gpt-5.5",
    "ANTHROPIC_CUSTOM_MODEL_OPTION": "gpt-5.5"
  }
}
```

For Claude Code, the base URL is normalized as an Anthropic root URL. If the user enters `https://gateway.example.com/v1`, Claude Code receives `https://gateway.example.com`, because Claude Code appends `/v1/messages` itself.
## Development

Install dependencies:

```bash
npm install
```

Run type checks:

```bash
npm run check
```

Run tests:

```bash
npm test
```

Build the CLI:

```bash
npm run build
```

Run locally from source:

```bash
npm run dev -- setup --dry-run
```

Run the built CLI:

```bash
node dist/index.js check --no-network
```

## Release Notes

Before publishing to npm, verify:

```bash
npm run check
npm test
npm run build
```

Then publish from the project root:

```bash
npm publish
```

## License

MIT

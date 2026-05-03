import { joinEndpoint } from "./url.js";
import type { ApiMode } from "../types.js";

export interface ProbeResult {
  ok: boolean;
  mode: ApiMode;
  detail: string;
}

export async function probeApiMode(baseUrl: string, apiKey: string, model: string, allowChatFallback: boolean): Promise<ProbeResult> {
  const responses = await probeEndpoint(baseUrl, apiKey, model, "responses");
  if (responses.ok) return { ok: true, mode: "responses", detail: responses.detail };

  if (allowChatFallback) {
    const chat = await probeEndpoint(baseUrl, apiKey, model, "chat");
    if (chat.ok) return { ok: true, mode: "chat", detail: chat.detail };
    return { ok: false, mode: "responses", detail: `responses failed: ${responses.detail}; chat failed: ${chat.detail}` };
  }

  return { ok: false, mode: "responses", detail: responses.detail };
}

export async function probeEndpoint(baseUrl: string, apiKey: string, model: string, mode: ApiMode): Promise<{ ok: boolean; detail: string }> {
  const endpoint = mode === "responses" ? "responses" : "chat/completions";
  const body = mode === "responses"
    ? { model, input: "ping", max_output_tokens: 1 }
    : { model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 };

  try {
    const response = await fetch(joinEndpoint(baseUrl, endpoint), {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (response.ok) return { ok: true, detail: `${endpoint} returned ${response.status}` };
    const text = await response.text();
    return { ok: false, detail: `${endpoint} returned ${response.status}${text ? `: ${text.slice(0, 180)}` : ""}` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

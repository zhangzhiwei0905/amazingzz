import { describe, expect, it } from "vitest";
import { normalizeBaseUrl } from "../src/utils/url.js";

describe("normalizeBaseUrl", () => {
  it("adds protocol and /v1", () => {
    expect(normalizeBaseUrl("api.example.com")).toBe("https://api.example.com/v1");
  });

  it("preserves existing /v1", () => {
    expect(normalizeBaseUrl("https://api.example.com/v1/")).toBe("https://api.example.com/v1");
  });

  it("appends /v1 to custom paths", () => {
    expect(normalizeBaseUrl("https://api.example.com/proxy")).toBe("https://api.example.com/proxy/v1");
  });
});

export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("base_url is required");

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = "";
  url.search = "";

  const pathname = url.pathname.replace(/\/+$/, "");
  if (!pathname || pathname === "/") {
    url.pathname = "/v1";
  } else if (!pathname.endsWith("/v1")) {
    url.pathname = `${pathname}/v1`;
  } else {
    url.pathname = pathname;
  }

  return url.toString().replace(/\/$/, "");
}

export function joinEndpoint(baseUrl: string, endpoint: "responses" | "chat/completions" | "models"): string {
  return `${baseUrl.replace(/\/$/, "")}/${endpoint}`;
}

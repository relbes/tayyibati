import { ReplitConnectors } from "@replit/connectors-sdk";

export async function getUncachableRevenueCatClient() {
  const connectors = new ReplitConnectors();

  return {
    post: async <T>({ url, path, body }: { url: string; path?: Record<string, string>; body?: unknown }) => {
      let resolvedUrl = url;
      if (path) {
        for (const [k, v] of Object.entries(path)) {
          resolvedUrl = resolvedUrl.replace(`{${k}}`, v);
        }
      }
      const response = await connectors.proxy("revenuecat", `/v2${resolvedUrl}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json() as T;
      if (!response.ok) return { data: undefined as any, error: data };
      return { data, error: undefined };
    },
    get: async <T>({ url, path, query }: { url: string; path?: Record<string, string>; query?: Record<string, unknown> }) => {
      let resolvedUrl = url;
      if (path) {
        for (const [k, v] of Object.entries(path)) {
          resolvedUrl = resolvedUrl.replace(`{${k}}`, v);
        }
      }
      if (query) {
        const qs = new URLSearchParams(
          Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)]))
        ).toString();
        if (qs) resolvedUrl += `?${qs}`;
      }
      const response = await connectors.proxy("revenuecat", `/v2${resolvedUrl}`, { method: "GET" });
      const data = await response.json() as T;
      if (!response.ok) return { data: undefined as any, error: data };
      return { data, error: undefined };
    },
  };
}

export const getApiBaseUrl = (): string => {
  const customUrl = localStorage.getItem("tayyibati_api_url");
  if (customUrl) return customUrl;
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return import.meta.env.DEV ? "http://localhost:5000" : "https://api.tayyibati.xyz";
};

export const API_BASE = getApiBaseUrl();

export function adminHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
  };
}

export function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...adminHeaders(),
      ...(options.headers || {}),
    },
  });
}
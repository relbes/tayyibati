export const getApiBaseUrl = (): string => {
  const customUrl = localStorage.getItem("tayyibati_api_url");
  if (customUrl) return customUrl;
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return import.meta.env.DEV ? "http://localhost:5000" : "https://api.tayyibati.xyz";
};

export const API_BASE = getApiBaseUrl();

export function adminHeaders(): HeadersInit {
  const token = localStorage.getItem("tayyibati_admin_token");

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}
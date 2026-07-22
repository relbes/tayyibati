export const API_BASE = "https://api.tayyibati.xyz";

export function adminHeaders(): HeadersInit {
  const token = localStorage.getItem("tayyibati_admin_token");

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}
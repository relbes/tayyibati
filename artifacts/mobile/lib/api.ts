import { setBaseUrl } from "@workspace/api-client-react";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) {
  setBaseUrl(`https://${domain}`);
}

export async function analyzeText(query: string, userId?: string | null) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/analysis/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, userId: userId ?? null }),
  });
  if (!res.ok) throw new Error(`Analysis failed: ${res.status}`);
  return res.json();
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  analysisType: "food" | "label",
  userId?: string | null
) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/analysis/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType, analysisType, userId: userId ?? null }),
  });
  if (!res.ok) throw new Error(`Image analysis failed: ${res.status}`);
  return res.json();
}

export async function getHistory(userId: string, limit = 20, offset = 0) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/history?userId=${userId}&limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function deleteHistoryItem(id: number) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/history/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete history item");
}

export async function getUserUsage(userId: string) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/users/usage?userId=${userId}`);
  if (!res.ok) throw new Error("Failed to fetch usage");
  return res.json();
}

export async function getFoodStats() {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/foods/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function listFoods(params: { search?: string; status?: string; category?: string; limit?: number; offset?: number } = {}) {
  const base = domain ? `https://${domain}` : "";
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  if (params.category) qs.set("category", params.category);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  const res = await fetch(`${base}/api/foods?${qs.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch foods");
  return res.json();
}

export async function createFood(data: {
  nameAr: string;
  nameEn: string;
  category: string;
  status: string;
  reason?: string;
  notes?: string;
}) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/foods`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create food");
  return res.json();
}

export async function updateFood(
  id: number,
  data: Partial<{ nameAr: string; nameEn: string; category: string; status: string; reason: string; notes: string }>
) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/foods/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update food");
  return res.json();
}

export async function deleteFood(id: number) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/foods/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete food");
}

export async function getPlans() {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/plans`);
  if (!res.ok) throw new Error("Failed to fetch plans");
  return res.json();
}

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

export interface LeadItem {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  interest: string | null;
  message: string | null;
  source: string | null;
  status: "new" | "contacted" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface FetchLeadsResponse {
  items: LeadItem[];
  totalItems: number;
  newCount: number;
  offset: number;
  limit: number;
}

export async function fetchAdminLeads(params: {
  status?: string;
  interest?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<FetchLeadsResponse> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.interest && params.interest !== "all") query.set("interest", params.interest);
  if (params.search) query.set("search", params.search);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));

  const res = await adminFetch(`${API_BASE}/api/admin/leads?${query.toString()}`);
  if (!res.ok) throw new Error("فشل في تحميل طلبات التواصل");
  return res.json();
}

export async function updateAdminLeadStatus(
  id: number,
  status: "new" | "contacted" | "closed"
): Promise<{ success: boolean; item: LeadItem; newCount: number }> {
  const res = await adminFetch(`${API_BASE}/api/admin/leads/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("فشل في تحديث حالة الطلب");
  return res.json();
}
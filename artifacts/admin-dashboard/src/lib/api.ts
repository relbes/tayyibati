export const normalizeApiBaseUrl = (url: string): string => {
  return url.replace(/\/+$/, "").replace(/\/api$/, "");
};

export const getApiBaseUrl = (): string => {
  const customUrl = typeof window !== "undefined" ? localStorage.getItem("tayyibati_api_url") : null;
  if (customUrl) return normalizeApiBaseUrl(customUrl);
  if (import.meta.env.VITE_API_URL) return normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "0.0.0.0");

  if (isLocalhost || import.meta.env.DEV) {
    return "http://localhost:5000";
  }

  return "https://api.tayyibati.xyz";
};

export const API_BASE = getApiBaseUrl();

export function adminHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = localStorage.getItem("tayyibati_admin_session_id");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
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

export interface UserActivityHistoryItem {
  id: number;
  userId: string;
  category: string;
  eventType: string;
  eventName: string;
  description: string;
  actorType: "USER" | "ADMIN" | "SYSTEM";
  actorId: string | null;
  actorName: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export interface UserHistoryResponse {
  user: {
    id: string;
    name: string;
    email: string;
  };
  items: UserActivityHistoryItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function fetchUserHistory(
  userId: string,
  params: {
    page?: number;
    pageSize?: number;
    category?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}
): Promise<UserHistoryResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.category && params.category !== "ALL") query.set("category", params.category);
  if (params.search) query.set("search", params.search);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);

  const base = getApiBaseUrl();
  const queryString = query.toString() ? `?${query.toString()}` : "";
  const canonicalUrl = `${base}/api/admin/users/${encodeURIComponent(userId)}/history${queryString}`;

  const res = await adminFetch(canonicalUrl);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `HTTP ${res.status}: Failed to fetch user history`);
  }
  return res.json();
}

export interface UserReportActivity {
  totalEvents: number;
  totalSearches: number;
  foodSearches: number;
  imageAnalyses: number;
  ingredientAnalyses: number;
  logins: number | null;
  lastActiveAt: string | null;
}

export interface SearchBreakdownItem {
  type: "food" | "image" | "label";
  label: string;
  labelAr: string;
  count: number;
  lastAt: string | null;
}

export interface RecentSearchItem {
  id: number;
  query: string;
  analysisType: string;
  compatibilityScore: number | null;
  createdAt: string;
}

export interface UserSubscriptionSummary {
  isPremium: boolean;
  status: "ACTIVE" | "NO_SUBSCRIPTION" | "EXPIRED";
  planId: number | null;
  planName: string;
  planNameEn: string;
  source: string;
  startDate: string | null;
  expirationDate: string | null;
  daysRemaining: number | null;
  autoRenew: boolean;
  dailyLimit: number;
  dailyTextLimit: number;
  dailyImageLimit: number;
}

export interface SubscriptionHistoryItem {
  id: number;
  eventType: string;
  eventName: string;
  description: string;
  source: string;
  status: string;
  actorType: string;
  actorName: string;
  createdAt: string;
  metadata: Record<string, any> | null;
}

export interface UserReportResponse {
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    provider: string;
    isPremium: boolean;
    isLocked: boolean;
    lockedUntil: string | null;
  };
  activity: UserReportActivity;
  searchBreakdown: SearchBreakdownItem[];
  recentSearches: RecentSearchItem[];
  subscription: UserSubscriptionSummary;
  subscriptionHistory: SubscriptionHistoryItem[];
  timeline: UserActivityHistoryItem[];
}

export interface UserSearchesResponse {
  items: RecentSearchItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function fetchUserReport(userId: string): Promise<UserReportResponse> {
  const base = getApiBaseUrl();
  const canonicalUrl = `${base}/api/admin/users/${encodeURIComponent(userId)}/report`;
  const res = await adminFetch(canonicalUrl);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `HTTP ${res.status}: Failed to fetch user report`);
  }
  return res.json();
}

export async function fetchUserSearches(
  userId: string,
  params: { page?: number; pageSize?: number } = {}
): Promise<UserSearchesResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  const base = getApiBaseUrl();
  const queryString = query.toString() ? `?${query.toString()}` : "";
  const canonicalUrl = `${base}/api/admin/users/${encodeURIComponent(userId)}/searches${queryString}`;

  const res = await adminFetch(canonicalUrl);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `HTTP ${res.status}: Failed to fetch user searches`);
  }
  return res.json();
}
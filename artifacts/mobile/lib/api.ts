import { setBaseUrl } from "@workspace/api-client-react";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) {
  setBaseUrl(`https://${domain}`);
}

export class AnalysisError extends Error {
  status: number;
  limitReached: boolean;
  constructor(message: string, status: number, limitReached = false) {
    super(message);
    this.name = "AnalysisError";
    this.status = status;
    this.limitReached = limitReached;
  }
}

async function readAnalysisError(res: Response, fallback: string): Promise<AnalysisError> {
  let message = fallback;
  let limitReached = res.status === 429;
  try {
    const body = await res.json();
    if (body?.message) message = body.message;
    if (body?.error === "limit_reached") limitReached = true;
  } catch {
    // ignore non-JSON bodies
  }
  return new AnalysisError(message, res.status, limitReached);
}

// ---------------------------------------------------------------------------
// Session token — set by AuthContext after login/register, cleared on signOut.
// Never expose this outside this module except through the setter.
// ---------------------------------------------------------------------------
let _sessionToken: string | null = null;

export function setSessionToken(token: string | null): void {
  _sessionToken = token;
}

function authHeader(): Record<string, string> {
  if (_sessionToken) return { Authorization: `Bearer ${_sessionToken}` };
  return {};
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export async function analyzeText(query: string) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/analysis/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw await readAnalysisError(res, `Analysis failed: ${res.status}`);
  return res.json();
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  analysisType: "food" | "label",
) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/analysis/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ imageBase64, mimeType, analysisType }),
  });
  if (!res.ok) throw await readAnalysisError(res, `Image analysis failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// History — all require auth token
// ---------------------------------------------------------------------------

export async function getHistory(limit = 20, offset = 0) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/history?limit=${limit}&offset=${offset}`, {
    headers: authHeader(),
  });
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function deleteHistoryItem(id: number) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/history/${id}`, {
    method: "DELETE",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error("Failed to delete history item");
}

// ---------------------------------------------------------------------------
// Usage — requires auth token
// ---------------------------------------------------------------------------

export async function getUserUsage() {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/users/usage`, {
    headers: authHeader(),
  });
  if (!res.ok) throw new Error("Failed to fetch usage");
  return res.json();
}

// ---------------------------------------------------------------------------
// Foods (public)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Plans (public)
// ---------------------------------------------------------------------------

export async function getPlans() {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/plans`);
  if (!res.ok) throw new Error("Failed to fetch plans");
  return res.json();
}

// ---------------------------------------------------------------------------
// Auth errors
// ---------------------------------------------------------------------------

export class AuthError extends Error {
  status: number;
  remainingAttempts?: number;
  lockedUntil?: string;
  secondsLeft?: number;
  constructor(
    message: string,
    status: number,
    opts?: { remainingAttempts?: number; lockedUntil?: string; secondsLeft?: number },
  ) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.remainingAttempts = opts?.remainingAttempts;
    this.lockedUntil = opts?.lockedUntil;
    this.secondsLeft = opts?.secondsLeft;
  }
}

async function parseAuthError(res: Response, fallback: string): Promise<never> {
  let message = fallback;
  let remainingAttempts: number | undefined;
  let lockedUntil: string | undefined;
  let secondsLeft: number | undefined;
  try {
    const data = await res.json();
    if (data?.error) message = data.error;
    if (typeof data?.remainingAttempts === "number") remainingAttempts = data.remainingAttempts;
    if (typeof data?.lockedUntil === "string") lockedUntil = data.lockedUntil;
    if (typeof data?.secondsLeft === "number") secondsLeft = data.secondsLeft;
  } catch {
    // ignore parse failure, use fallback
  }
  throw new AuthError(message, res.status, { remainingAttempts, lockedUntil, secondsLeft });
}

// ---------------------------------------------------------------------------
// Auth (returns user + token from server)
// ---------------------------------------------------------------------------

export async function registerUser(payload: {
  email: string;
  name?: string;
  password?: string;
  provider?: "email" | "google";
  avatar?: string;
  id?: string;
}) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return parseAuthError(res, "تعذّر إنشاء الحساب");
  return res.json();
}

export async function loginUser(payload: { email: string; password?: string }) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return parseAuthError(res, "تعذّر تسجيل الدخول");
  return res.json();
}

export async function getUser(id: string) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/users/${id}`);
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json();
}

export async function enrollUserPlan(id: string, planId: number, isPremium: boolean) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/users/${id}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId, isPremium }),
  });
  if (!res.ok) throw new Error("Failed to enroll plan");
  return res.json();
}

/**
 * Calls the server to verify the user's RevenueCat entitlement and update isPremium in the DB.
 * Must be called after a successful purchase or restore — server-side verification prevents
 * users from gaining premium access without actually paying.
 */
export async function syncPremium(): Promise<{ isPremium: boolean }> {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/users/me/sync-premium`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
  });
  if (!res.ok) throw new Error(`Failed to sync premium: ${res.status}`);
  return res.json();
}

export async function getPublicConfig(): Promise<Record<string, string>> {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/config/public`);
  if (!res.ok) throw new Error("Failed to fetch config");
  return res.json();
}

export async function forgotPassword(email: string) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/users/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return parseAuthError(res, "تعذّر إرسال رمز التحقق");
  return res.json();
}

export async function resetPasswordWithCode(email: string, code: string, newPassword: string) {
  const base = domain ? `https://${domain}` : "";
  const res = await fetch(`${base}/api/users/reset-password-with-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, newPassword }),
  });
  if (!res.ok) return parseAuthError(res, "تعذّر إعادة تعيين كلمة المرور");
  return res.json();
}

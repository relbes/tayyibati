import { setBaseUrl } from "@workspace/api-client-react";

// Use environment variable if available, otherwise use production API.
const domain =
  process.env.EXPO_PUBLIC_DOMAIN?.trim() || "api.tayyibati.xyz";

const BASE_URL =
  domain.startsWith("http://") || domain.startsWith("https://")
    ? domain
    : `https://${domain}`;

setBaseUrl(BASE_URL);

export const NETWORK_ERROR_USER_MSG =
  "تعذر الاتصال بالخادم.\nتحقق من اتصال الشبكة أو حاول مرة أخرى.";

export class NetworkError extends Error {
  isNetworkError: boolean;
  constructor(message = NETWORK_ERROR_USER_MSG) {
    super(message);
    this.name = "NetworkError";
    this.isNetworkError = true;
  }
}

/**
 * Executes fetch with automatic 1-retry delay for transient network errors.
 * Distinguishes network failures from server HTTP errors.
 * Never exposes raw internal errors to the user.
 */
export async function fetchWithRetry(
  input: string | URL | Request,
  init?: RequestInit,
  maxRetries = 1,
  delayMs = 800
): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      return await fetch(input, init);
    } catch (err: any) {
      attempt++;

      // AbortController cancellations (e.g. autocomplete) should throw original AbortError
      if (err?.name === "AbortError") {
        throw err;
      }

      if (attempt > maxRetries) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.error(
            `[API Network Error] Network request failed after ${attempt} attempt(s) for ${input.toString()}:`,
            err
          );
        }
        throw new NetworkError(NETWORK_ERROR_USER_MSG);
      }

      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.warn(
          `[API Network Retry] Transient error on ${input.toString()}. Retrying attempt #${attempt + 1} in ${delayMs}ms...`,
          err
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export class AnalysisError extends Error {
  status: number;
  limitReached: boolean;
  code?: string;
  constructor(message: string, status: number, limitReached = false, code?: string) {
    super(message);
    this.name = "AnalysisError";
    this.status = status;
    this.limitReached = limitReached;
    this.code = code;
  }
}

async function readAnalysisError(res: Response, fallback: string): Promise<AnalysisError> {
  let message = fallback;
  let limitReached = res.status === 429;
  let code: string | undefined = undefined;
  try {
    const body = await res.json();
    if (body?.message) message = body.message;
    if (body?.code) code = body.code;
    if (body?.error === "limit_reached" || res.status === 429) limitReached = true;
  } catch {
    // ignore non-JSON bodies
  }
  return new AnalysisError(message, res.status, limitReached, code);
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
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/analysis/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();

  return data.report || data;
}

export async function analyzeDish(dishId: number) {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/analysis/dish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ dishId }),
  });
  if (!res.ok) throw await readAnalysisError(res, "حدث خطأ أثناء تحليل الطبق، يرجى المحاولة مرة أخرى.");
  const data = await res.json();

  return data.report || data;
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  analysisType: "food" | "label",
) {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/analysis/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ imageBase64, mimeType, analysisType }),
  });
  if (!res.ok) throw await readAnalysisError(res, "تعذر تحليل الصورة، يرجى المحاولة مرة أخرى.");
  const data = await res.json();
  return data.report || data;
}

// ---------------------------------------------------------------------------
// History — all require auth token
// ---------------------------------------------------------------------------

export async function getHistory(limit = 20, offset = 0) {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/history?limit=${limit}&offset=${offset}`, {
    headers: authHeader(),
  });
  if (!res.ok) throw new Error("تعذر تحميل السجل.");
  return res.json();
}

export async function deleteHistoryItem(id: number) {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/history/${id}`, {
    method: "DELETE",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error("تعذر حذف العنصر من السجل.");
}

// ---------------------------------------------------------------------------
// Usage — requires auth token
// ---------------------------------------------------------------------------

export async function getUserUsage() {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/users/usage`, {
    headers: authHeader(),
  });
  if (!res.ok) throw new Error("تعذر تحميل بيانات الاستخدام.");
  return res.json();
}

export interface BrowseCategoryFoodItem {
  id: number;
  nameAr: string;
  nameEn: string;
  status: "allowed" | "forbidden" | "conditional";
}

export interface BrowseCategoryGroup {
  categoryKey: string;
  nameAr: string;
  nameEn: string;
  foods: BrowseCategoryFoodItem[];
}

export interface BrowseFoodsResponse {
  isPremium: boolean;
  totalCategories: number;
  totalFoods: number;
  totalDatabase: number;
  categories: BrowseCategoryGroup[];
}

export async function browseFoods(): Promise<BrowseFoodsResponse> {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/foods/browse`, {
    headers: authHeader(),
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("UNAUTHENTICATED");
    }
    throw new Error("فشل في تحميل قائمة الأغذية.");
  }
  return res.json();
}

export async function getFoodStats() {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/foods/stats`);
  if (!res.ok) throw new Error("تعذر تحميل الإحصائيات.");
  return res.json();
}

export async function fetchAutocomplete(q: string, abortSignal?: AbortSignal) {
  const base = BASE_URL;
  const res = await fetchWithRetry(
    `${base}/api/foods/autocomplete?q=${encodeURIComponent(q)}`,
    { signal: abortSignal },
    0 // 0 retries for autocomplete to keep typing fast
  );
  if (!res.ok) throw new Error("Failed to fetch autocomplete");
  return res.json();
}

export async function listFoods(params: { search?: string; status?: string; category?: string; limit?: number; offset?: number } = {}) {
  const base = BASE_URL;
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  if (params.category) qs.set("category", params.category);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  const res = await fetchWithRetry(`${base}/api/foods?${qs.toString()}`);
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
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/foods`, {
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
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/foods/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update food");
  return res.json();
}

export async function deleteFood(id: number) {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/foods/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete food");
}

// ---------------------------------------------------------------------------
// Plans (public)
// ---------------------------------------------------------------------------

export async function getPlans() {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/plans`);
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
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return parseAuthError(res, "تعذّر إنشاء الحساب");
  return res.json();
}

export async function loginUser(payload: { email: string; password?: string }) {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return parseAuthError(res, "تعذّر تسجيل الدخول");
  return res.json();
}

export async function getUser(id: string) {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/users/${id}`);
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json();
}

export async function enrollUserPlan(id: string, planId: number, isPremium: boolean) {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/users/${id}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId, isPremium }),
  });
  if (!res.ok) throw new Error("Failed to enroll plan");
  return res.json();
}

export async function syncPremium(): Promise<{ isPremium: boolean }> {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/users/me/sync-premium`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
  });
  if (!res.ok) throw new Error(`Failed to sync premium: ${res.status}`);
  return res.json();
}

export async function getPublicConfig(): Promise<Record<string, string>> {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/config/public`);
  if (!res.ok) throw new Error("Failed to fetch config");
  return res.json();
}

export async function forgotPassword(email: string) {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/users/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return parseAuthError(res, "تعذّر إرسال رمز التحقق");
  return res.json();
}

export async function resetPasswordWithCode(email: string, code: string, newPassword: string) {
  const base = BASE_URL;
  const res = await fetchWithRetry(`${base}/api/users/reset-password-with-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, newPassword }),
  });
  if (!res.ok) return parseAuthError(res, "تعذّر إعادة تعيين كلمة المرور");
  return res.json();
}

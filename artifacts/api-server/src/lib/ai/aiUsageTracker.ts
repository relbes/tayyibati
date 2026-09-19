/**
 * Centralized AI Usage Tracker & Cost Engine for Tayyibati
 *
 * ARCHITECTURAL REQUIREMENTS:
 * - Every OpenAI and Gemini request reports usage through this service.
 * - Non-blocking: failures in tracking never fail the user request.
 * - Model-specific pricing configuration (documented sources & dates).
 * - Exact token recording; if tokens unavailable, marked tokensAvailable: false.
 * - Idempotency: single provider request produces exactly one usage record.
 * - Strict security: zero secrets, bearer tokens, or base64 images stored.
 * - Deterministic status priority: EXHAUSTED > CRITICAL > LOW > ERROR > HEALTHY.
 */

import crypto from "crypto";
import { db, aiApiUsageTable, aiProviderStatusTable, aiAlertSettingsTable } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";
import { logger } from "../logger";
import { evaluateAlertTriggers } from "./aiAlertService";

/**
 * Model Token Pricing Table
 * Source: Official OpenAI & Google Cloud Pricing Documentation (Updated March 2026)
 * Rates specified per 1,000,000 tokens (USD).
 */
export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cachedPerMillion: number;
  pricingSource: string;
}

export const MODEL_PRICING_TABLE: Record<string, ModelPricing> = {
  // OpenAI Models
  "gpt-4o-mini": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
    cachedPerMillion: 0.075,
    pricingSource: "OpenAI Pricing March 2026 ($0.15 / $0.60 per 1M)",
  },
  "gpt-4o": {
    inputPerMillion: 2.5,
    outputPerMillion: 10.0,
    cachedPerMillion: 1.25,
    pricingSource: "OpenAI Pricing March 2026 ($2.50 / $10.00 per 1M)",
  },
  "gpt-3.5-turbo": {
    inputPerMillion: 0.5,
    outputPerMillion: 1.5,
    cachedPerMillion: 0.5,
    pricingSource: "OpenAI Legacy Pricing ($0.50 / $1.50 per 1M)",
  },
  // Gemini Models
  "gemini-1.5-flash": {
    inputPerMillion: 0.075,
    outputPerMillion: 0.3,
    cachedPerMillion: 0.01875,
    pricingSource: "Google AI Studio Pricing March 2026 ($0.075 / $0.30 per 1M)",
  },
  "gemini-2.5-flash": {
    inputPerMillion: 0.075,
    outputPerMillion: 0.3,
    cachedPerMillion: 0.01875,
    pricingSource: "Google AI Studio Pricing March 2026 ($0.075 / $0.30 per 1M)",
  },
  "gemini-2.0-flash": {
    inputPerMillion: 0.1,
    outputPerMillion: 0.4,
    cachedPerMillion: 0.025,
    pricingSource: "Google AI Studio Pricing March 2026 ($0.10 / $0.40 per 1M)",
  },
  "gemini-1.5-pro": {
    inputPerMillion: 1.25,
    outputPerMillion: 5.0,
    cachedPerMillion: 0.3125,
    pricingSource: "Google AI Studio Pricing March 2026 ($1.25 / $5.00 per 1M)",
  },
};

// Default fallback pricing if an unlisted model is encountered
const DEFAULT_FALLBACK_PRICING: ModelPricing = {
  inputPerMillion: 0.15,
  outputPerMillion: 0.6,
  cachedPerMillion: 0.075,
  pricingSource: "Default conservative estimate ($0.15 / $0.60 per 1M)",
};

/**
 * Calculates estimated usage cost in USD.
 * If token counts are not available, returns 0.
 */
export function calculateEstimatedCost(
  model: string,
  inputTokens: number = 0,
  outputTokens: number = 0,
  cachedTokens: number = 0,
  tokensAvailable: boolean = true
): { cost: number; pricingSource: string } {
  if (!tokensAvailable || (inputTokens === 0 && outputTokens === 0 && cachedTokens === 0)) {
    return { cost: 0, pricingSource: "Tokens unavailable" };
  }

  const cleanModel = (model || "").toLowerCase().trim();
  const pricing = MODEL_PRICING_TABLE[cleanModel] || DEFAULT_FALLBACK_PRICING;

  const effectiveInputTokens = Math.max(0, inputTokens - cachedTokens);
  const inputCost = (effectiveInputTokens / 1_000_000) * pricing.inputPerMillion;
  const cachedCost = (Math.max(0, cachedTokens) / 1_000_000) * pricing.cachedPerMillion;
  const outputCost = (Math.max(0, outputTokens) / 1_000_000) * pricing.outputPerMillion;

  const totalCost = Number((inputCost + cachedCost + outputCost).toFixed(8));
  return { cost: totalCost, pricingSource: pricing.pricingSource };
}

/**
 * In-memory LRU dedup cache to protect against duplicate tracking calls.
 * Bounded to 5,000 entries with 15-minute TTL.
 */
class IdempotencyCache {
  private seen = new Map<string, number>();
  private readonly maxEntries = 5000;
  private readonly ttlMs = 15 * 60 * 1000;

  public has(requestId: string): boolean {
    const ts = this.seen.get(requestId);
    if (!ts) return false;
    if (Date.now() - ts > this.ttlMs) {
      this.seen.delete(requestId);
      return false;
    }
    return true;
  }

  public add(requestId: string): void {
    if (this.seen.size >= this.maxEntries) {
      // Evict oldest 1,000 items
      let count = 0;
      for (const k of this.seen.keys()) {
        this.seen.delete(k);
        if (++count > 1000) break;
      }
    }
    this.seen.set(requestId, Date.now());
  }
}

const idempotencyCache = new IdempotencyCache();

/**
 * Security: Sanitizes error messages to prevent leakage of API keys,
 * passwords, Bearer tokens, or raw image base64 data.
 */
export function sanitizeErrorDetails(err: any): { code: string; message: string } {
  if (!err) {
    return { code: "UNKNOWN", message: "Unknown error" };
  }

  let rawMessage = "";
  if (typeof err === "string") {
    rawMessage = err;
  } else if (err instanceof Error) {
    rawMessage = err.message || "";
  } else if (typeof err === "object") {
    rawMessage = err.message || JSON.stringify(err);
  }

  let code = err?.code || err?.type || err?.status || "AI_ERROR";
  if (typeof code === "number") {
    code = `HTTP_${code}`;
  }

  // Detect quota exhaustion codes
  const isQuota =
    err?.status === 429 ||
    code === "insufficient_quota" ||
    code === "RESOURCE_EXHAUSTED" ||
    rawMessage.includes("quota") ||
    rawMessage.includes("insufficient_quota") ||
    rawMessage.includes("credit_balance_exhausted") ||
    rawMessage.includes("RESOURCE_EXHAUSTED");

  if (isQuota) {
    code = "QUOTA_EXHAUSTED";
  }

  // Scrub sensitive patterns
  let cleanMessage = String(rawMessage)
    // Redact OpenAI API keys
    .replace(/sk-[a-zA-Z0-9_\-]{20,}/g, "[REDACTED_API_KEY]")
    // Redact Google / Gemini API keys
    .replace(/AIzaSy[a-zA-Z0-9_\-]{20,}/g, "[REDACTED_API_KEY]")
    // Redact Bearer tokens & JWTs
    .replace(/(?:bearer\s+)+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]+/g, "[REDACTED_TOKEN]")
    // Redact base64 image chunks
    .replace(/[A-Za-z0-9+/=]{40,}/g, "[REDACTED_IMAGE_DATA]")
    // Redact password parameters
    .replace(/"password"\s*:\s*"[^"]+"/gi, '"password":"[REDACTED]"')
    .trim();

  if (cleanMessage.length > 300) {
    cleanMessage = cleanMessage.slice(0, 297) + "...";
  }

  return { code: String(code), message: cleanMessage || "AI provider error" };
}

export interface TrackAIUsageParams {
  requestId?: string;
  chainId?: string;
  parentRequestId?: string;
  provider: "openai" | "gemini";
  model: string;
  feature:
    | "IMAGE_ANALYSIS"
    | "FOOD_SEARCH"
    | "INGREDIENT_ANALYSIS"
    | "DISH_ANALYSIS"
    | "AI_FALLBACK"
    | "OTHER";
  requestStatus: "SUCCESS" | "FAILED";
  httpStatus?: number;
  error?: any;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  tokensAvailable?: boolean;
  isFallback?: boolean;
  fallbackReason?: string;
  chainFinalStatus?: "SUCCESS" | "FAILED";
  metadata?: Record<string, any>;
}

/**
 * Deterministic Operational Status Priority
 * EXHAUSTED > CRITICAL > LOW > ERROR > HEALTHY
 * Note: If quota is exhausted, it strictly takes precedence over ERROR (repeated failures).
 */
export function determineOperationalStatus(params: {
  isQuotaExhausted: boolean;
  consecutiveFailures: number;
  consecutiveThreshold: number;
  todayCost: number;
  monthCost: number;
  dailyWarning: number;
  dailyCritical: number;
  monthlyWarning: number;
  monthlyCritical: number;
}): "HEALTHY" | "LOW" | "CRITICAL" | "EXHAUSTED" | "ERROR" {
  // 1. Quota Exhausted is the absolute highest priority
  if (params.isQuotaExhausted) {
    return "EXHAUSTED";
  }

  // 2. Budget Critical
  if (params.todayCost >= params.dailyCritical || params.monthCost >= params.monthlyCritical) {
    return "CRITICAL";
  }

  // 3. Budget Warning
  if (params.todayCost >= params.dailyWarning || params.monthCost >= params.monthlyWarning) {
    return "LOW";
  }

  // 4. Repeated Operational Failures
  if (params.consecutiveFailures >= params.consecutiveThreshold) {
    return "ERROR";
  }

  // 5. Default Healthy
  return "HEALTHY";
}

/**
 * Internal core usage recording logic.
 * Handles DB persistence, idempotency, cost calculation, and provider status updates.
 */
async function recordUsageInternal(params: TrackAIUsageParams): Promise<void> {
  const requestId = params.requestId || `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const chainId = params.chainId || requestId;

  // Idempotency check: if this requestId was already processed, ignore
  if (idempotencyCache.has(requestId)) {
    return;
  }
  idempotencyCache.add(requestId);

  const tokensAvailable = params.tokensAvailable !== false;
  const inputTokens = tokensAvailable ? params.inputTokens || 0 : 0;
  const outputTokens = tokensAvailable ? params.outputTokens || 0 : 0;
  const cachedTokens = tokensAvailable ? params.cachedTokens || 0 : 0;

  const { cost: estimatedCost } = calculateEstimatedCost(
    params.model,
    inputTokens,
    outputTokens,
    cachedTokens,
    tokensAvailable
  );

  let sanitizedError: { code: string; message: string } | null = null;
  if (params.requestStatus === "FAILED" || params.error) {
    sanitizedError = sanitizeErrorDetails(params.error);
  }

  const isSuccess = params.requestStatus === "SUCCESS";
  const now = new Date();

  // 1. Insert into ai_api_usage
  try {
    await db.insert(aiApiUsageTable).values({
      requestId,
      chainId,
      parentRequestId: params.parentRequestId || null,
      timestamp: now,
      provider: params.provider,
      model: params.model,
      feature: params.feature,
      requestStatus: params.requestStatus,
      httpStatus: params.httpStatus || (isSuccess ? 200 : 500),
      errorCode: sanitizedError?.code || null,
      errorMessage: sanitizedError?.message || null,
      latencyMs: Math.max(0, Math.round(params.latencyMs)),
      inputTokens,
      outputTokens,
      cachedTokens,
      tokensAvailable,
      estimatedCost,
      isFallback: Boolean(params.isFallback),
      fallbackReason: params.fallbackReason ? sanitizeErrorDetails(params.fallbackReason).message : null,
      chainFinalStatus: params.chainFinalStatus || (isSuccess ? "SUCCESS" : "FAILED"),
      metadata: params.metadata || null,
    });
  } catch (err: any) {
    // If unique constraint violation on requestId, ignore gracefully
    if (err?.code === "23505") {
      return;
    }
    throw err;
  }

  // 2. Update ai_provider_status
  try {
    const [settings] = await db.select().from(aiAlertSettingsTable).limit(1);
    const consecutiveThreshold = settings?.consecutiveFailureThreshold || 3;

    // Get current provider status row
    const [currentStatus] = await db
      .select()
      .from(aiProviderStatusTable)
      .where(eq(aiProviderStatusTable.provider, params.provider));

    const prevConsecutiveFailures = currentStatus?.consecutiveFailures || 0;
    const newConsecutiveFailures = isSuccess ? 0 : prevConsecutiveFailures + 1;

    // Aggregate today's and this month's cost
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [todayAgg] = await db
      .select({ total: sql<number>`coalesce(sum(${aiApiUsageTable.estimatedCost}), 0)` })
      .from(aiApiUsageTable)
      .where(
        and(
          eq(aiApiUsageTable.provider, params.provider),
          gte(aiApiUsageTable.timestamp, startOfToday)
        )
      );

    const [monthAgg] = await db
      .select({ total: sql<number>`coalesce(sum(${aiApiUsageTable.estimatedCost}), 0)` })
      .from(aiApiUsageTable)
      .where(
        and(
          eq(aiApiUsageTable.provider, params.provider),
          gte(aiApiUsageTable.timestamp, startOfMonth)
        )
      );

    const todayCost = Number(todayAgg?.total || 0);
    const monthCost = Number(monthAgg?.total || 0);

    const isQuotaExhausted = sanitizedError?.code === "QUOTA_EXHAUSTED";

    const dailyWarning =
      params.provider === "openai"
        ? settings?.openaiDailySpendWarning || 5
        : settings?.geminiDailySpendWarning || 5;
    const dailyCritical =
      params.provider === "openai"
        ? settings?.openaiDailySpendCritical || 10
        : settings?.geminiDailySpendCritical || 10;
    const monthlyWarning =
      params.provider === "openai"
        ? settings?.openaiMonthlySpendWarning || 50
        : settings?.geminiMonthlySpendWarning || 50;
    const monthlyCritical =
      params.provider === "openai"
        ? settings?.openaiMonthlySpendCritical || 100
        : settings?.geminiMonthlySpendCritical || 100;

    const operationalStatus = determineOperationalStatus({
      isQuotaExhausted,
      consecutiveFailures: newConsecutiveFailures,
      consecutiveThreshold,
      todayCost,
      monthCost,
      dailyWarning,
      dailyCritical,
      monthlyWarning,
      monthlyCritical,
    });

    const updateFields: any = {
      isConfigured: true,
      operationalStatus,
      consecutiveFailures: newConsecutiveFailures,
      todayEstimatedCost: todayCost,
      monthEstimatedCost: monthCost,
      allTimeEstimatedCost: (currentStatus?.allTimeEstimatedCost || 0) + estimatedCost,
      updatedAt: now,
    };

    if (isSuccess) {
      updateFields.lastSuccessfulCallAt = now;
      if (currentStatus?.operationalStatus === "EXHAUSTED" && !isQuotaExhausted) {
        // Quota recovered
        updateFields.operationalStatus = "HEALTHY";
      }
    } else {
      updateFields.lastFailedCallAt = now;
      updateFields.lastErrorCode = sanitizedError?.code || "FAILED";
      updateFields.lastErrorMessage = sanitizedError?.message || null;
    }

    if (currentStatus) {
      await db
        .update(aiProviderStatusTable)
        .set(updateFields)
        .where(eq(aiProviderStatusTable.provider, params.provider));
    } else {
      await db.insert(aiProviderStatusTable).values({
        provider: params.provider,
        billingDashboardUrl:
          params.provider === "openai"
            ? "https://platform.openai.com/usage"
            : "https://console.cloud.google.com/billing",
        ...updateFields,
      });
    }

    // 3. Trigger alert evaluation asynchronously
    evaluateAlertTriggers({
      provider: params.provider,
      isSuccess,
      isQuotaExhausted,
      consecutiveFailures: newConsecutiveFailures,
      consecutiveThreshold,
      todayCost,
      monthCost,
      dailyWarning,
      dailyCritical,
      monthlyWarning,
      monthlyCritical,
      previousStatus: currentStatus?.operationalStatus || "HEALTHY",
      currentStatus: operationalStatus,
      errorMessage: sanitizedError?.message,
    }).catch((err) => {
      logger.warn({ err }, "[AI_USAGE_TRACKER] Alert evaluation non-fatal warning");
    });
  } catch (err) {
    logger.warn({ err }, "[AI_USAGE_TRACKER] Provider status update non-fatal error");
  }
}

/**
 * Asynchronous, completely non-blocking usage tracking wrapper.
 * Guarantees that errors during telemetry or DB recording NEVER interrupt
 * or throw back to the caller.
 */
export function trackAIUsageNonBlocking(params: TrackAIUsageParams): void {
  // Fire-and-forget in setImmediate / Promise
  Promise.resolve().then(async () => {
    try {
      await recordUsageInternal(params);
    } catch (err) {
      logger.error({ err }, "[AI_USAGE_TRACKER] Error in non-blocking AI usage tracker");
    }
  });
}

/**
 * Awaitable version for tests or scenarios requiring synchronization.
 * Still wraps everything in try/catch to maintain failure isolation.
 */
export async function trackAIUsage(params: TrackAIUsageParams): Promise<void> {
  try {
    await recordUsageInternal(params);
  } catch (err) {
    logger.error({ err }, "[AI_USAGE_TRACKER] Error in AI usage tracker");
  }
}

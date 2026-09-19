/**
 * AI Provider Connectivity & Health Check Service
 *
 * Lightweight checks without generating unnecessary paid AI requests or tokens.
 *
 * SECURITY RULE:
 * - Gemini API key is ALWAYS sent via header "x-goog-api-key".
 * - Never in URL query string, logs, or error traces.
 *
 * SEPARATION OF CONCERNS:
 * - Connectivity status measures reachability of the models endpoint.
 * - Decoupled from real operational health and error history.
 */

import OpenAI from "openai";
import { db, appConfigTable, aiProviderStatusTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { logger } from "../logger";

export interface HealthCheckResult {
  provider: "openai" | "gemini";
  isConfigured: boolean;
  connectivityStatus: "CONNECTED" | "DISCONNECTED";
  latencyMs: number;
  message: string;
  checkedAt: string;
}

/**
 * Resolves current configured API keys for OpenAI and Gemini from DB or environment.
 */
export async function getProviderApiKeys(): Promise<{ openaiKey?: string; geminiKey?: string }> {
  let openaiKey: string | undefined;
  let geminiKey: string | undefined;

  // 1. Check environment variables first
  if (process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_API_KEY.trim().length > 10) {
    openaiKey = process.env.OPENAI_API_KEY.trim();
  }
  const envGemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (envGemini?.trim() && envGemini.trim().length > 10) {
    geminiKey = envGemini.trim();
  }

  // 2. Fall back to database app_config
  if (!openaiKey || !geminiKey) {
    try {
      const rows = await db
        .select()
        .from(appConfigTable)
        .where(or(eq(appConfigTable.key, "openai_api_key"), eq(appConfigTable.key, "gemini_api_key")));

      for (const r of rows) {
        if (!openaiKey && r.key === "openai_api_key" && r.value?.trim().length > 10) {
          openaiKey = r.value.trim();
        }
        if (!geminiKey && r.key === "gemini_api_key" && r.value?.trim().length > 10) {
          geminiKey = r.value.trim();
        }
      }
    } catch {
      // fall through
    }
  }

  return { openaiKey, geminiKey };
}

/**
 * Checks OpenAI connectivity using the free models.list endpoint (zero token cost).
 */
export async function checkOpenAIHealth(): Promise<HealthCheckResult> {
  const { openaiKey } = await getProviderApiKeys();
  const checkedAt = new Date().toISOString();

  if (!openaiKey) {
    await updateConnectivityStatus("openai", "DISCONNECTED", 0, false);
    return {
      provider: "openai",
      isConfigured: false,
      connectivityStatus: "DISCONNECTED",
      latencyMs: 0,
      message: "OpenAI API key is not configured",
      checkedAt,
    };
  }

  const startTime = Date.now();
  try {
    const openai = new OpenAI({ apiKey: openaiKey, timeout: 10000 });
    // Lightweight models list check (free API endpoint, does not generate completions or cost tokens)
    await openai.models.list();

    const latencyMs = Date.now() - startTime;
    await updateConnectivityStatus("openai", "CONNECTED", latencyMs, true);

    return {
      provider: "openai",
      isConfigured: true,
      connectivityStatus: "CONNECTED",
      latencyMs,
      message: `OpenAI API reachable (${latencyMs}ms)`,
      checkedAt,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    await updateConnectivityStatus("openai", "DISCONNECTED", latencyMs, true);

    const safeMessage = err?.status === 401
      ? "Invalid OpenAI API Key (Authentication Failed)"
      : err?.status === 429
      ? "OpenAI API rate limit or quota exceeded"
      : `Connection error: ${err?.message || "Unreachable"}`;

    return {
      provider: "openai",
      isConfigured: true,
      connectivityStatus: "DISCONNECTED",
      latencyMs,
      message: safeMessage,
      checkedAt,
    };
  }
}

/**
 * Checks Gemini connectivity using Google AI Studio / Gemini models endpoint (zero token cost).
 * SECURITY: Uses "x-goog-api-key" header strictly, never URL query parameter.
 */
export async function checkGeminiHealth(): Promise<HealthCheckResult> {
  const { geminiKey } = await getProviderApiKeys();
  const checkedAt = new Date().toISOString();

  if (!geminiKey) {
    await updateConnectivityStatus("gemini", "DISCONNECTED", 0, false);
    return {
      provider: "gemini",
      isConfigured: false,
      connectivityStatus: "DISCONNECTED",
      latencyMs: 0,
      message: "Gemini API key is not configured",
      checkedAt,
    };
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // MANDATORY SECURITY: Header-based authentication strictly, no API key in URL!
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      method: "GET",
      headers: {
        "x-goog-api-key": geminiKey,
        "Accept": "application/json",
      },
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startTime;

    if (res.ok) {
      await updateConnectivityStatus("gemini", "CONNECTED", latencyMs, true);
      return {
        provider: "gemini",
        isConfigured: true,
        connectivityStatus: "CONNECTED",
        latencyMs,
        message: `Gemini API reachable (${latencyMs}ms)`,
        checkedAt,
      };
    }

    await updateConnectivityStatus("gemini", "DISCONNECTED", latencyMs, true);
    const safeMessage = res.status === 400 || res.status === 403
      ? "Invalid Gemini API Key or Permission Denied"
      : `Gemini API returned HTTP ${res.status}`;

    return {
      provider: "gemini",
      isConfigured: true,
      connectivityStatus: "DISCONNECTED",
      latencyMs,
      message: safeMessage,
      checkedAt,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    await updateConnectivityStatus("gemini", "DISCONNECTED", latencyMs, true);

    return {
      provider: "gemini",
      isConfigured: true,
      connectivityStatus: "DISCONNECTED",
      latencyMs,
      message: `Gemini connectivity failed: ${err?.message || "Network error"}`,
      checkedAt,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Updates connectivity fields in ai_provider_status without modifying
 * real operational error metrics or real traffic history.
 */
async function updateConnectivityStatus(
  provider: "openai" | "gemini",
  status: "CONNECTED" | "DISCONNECTED",
  latencyMs: number,
  isConfigured: boolean
): Promise<void> {
  try {
    const now = new Date();
    const [existing] = await db
      .select()
      .from(aiProviderStatusTable)
      .where(eq(aiProviderStatusTable.provider, provider));

    if (existing) {
      await db
        .update(aiProviderStatusTable)
        .set({
          connectivityStatus: status,
          connectivityLatencyMs: latencyMs,
          connectivityLastCheckedAt: now,
          isConfigured,
          updatedAt: now,
        })
        .where(eq(aiProviderStatusTable.provider, provider));
    } else {
      await db.insert(aiProviderStatusTable).values({
        provider,
        isConfigured,
        connectivityStatus: status,
        connectivityLatencyMs: latencyMs,
        connectivityLastCheckedAt: now,
        billingDashboardUrl:
          provider === "openai"
            ? "https://platform.openai.com/usage"
            : "https://console.cloud.google.com/billing",
      });
    }
  } catch (err) {
    logger.warn({ err }, `[AI_HEALTH] Non-fatal error updating ${provider} connectivity status`);
  }
}

/**
 * Runs connectivity check on both providers.
 */
export async function checkAllProvidersHealth(): Promise<{
  openai: HealthCheckResult;
  gemini: HealthCheckResult;
}> {
  const [openai, gemini] = await Promise.all([checkOpenAIHealth(), checkGeminiHealth()]);
  return { openai, gemini };
}

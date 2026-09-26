import { db } from "@workspace/db";
import { appConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const FREE_MONTHLY_LIMIT_DEFAULT = 10;

/**
 * Centralized AI Configuration
 * Single source of truth for AI provider, model, parameters, timeouts, cache version, and TTL.
 */
export interface AIConfig {
  provider: "openai" | "gemini" | "claude";
  model: string;
  temperature: number;
  timeoutMs: number;
  maxTokens: number;
  retryCount: number;
  cacheVersion: string;
  cacheTtlDays: number;
}

export const AI_CONFIG: AIConfig = {
  provider: "openai",
  model: "gpt-4o-mini",
  temperature: 0,
  timeoutMs: 10000, // 10 seconds timeout
  maxTokens: 1000,
  retryCount: 1, // Retry once on transient failure
  cacheVersion: process.env.AI_CACHE_VERSION || "v1",
  cacheTtlDays: parseInt(process.env.AI_CACHE_TTL_DAYS || "30", 10) || 30,
};

/**
 * Reads `free_monthly_limit` from the app_config table.
 * Falls back to 10 if the key is missing or the value is not a valid integer.
 */
export async function getFreeMonthlyLimit(): Promise<number> {
  try {
    const [row] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "free_monthly_limit"));
    const val = parseInt(row?.value ?? String(FREE_MONTHLY_LIMIT_DEFAULT), 10);
    return isNaN(val) ? FREE_MONTHLY_LIMIT_DEFAULT : val;
  } catch {
    return FREE_MONTHLY_LIMIT_DEFAULT;
  }
}

/**
 * Ensures google_login_enabled is present in app_config table with value 'true' and is_public 'true'.
 * If absent, seeds it so the mobile app and public config endpoint recognize Google Login.
 */
export async function ensureGoogleLoginConfig(): Promise<void> {
  try {
    const [existing] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "google_login_enabled"));
    if (!existing) {
      await db.insert(appConfigTable).values({
        key: "google_login_enabled",
        value: "true",
        description: "Enables Google Sign-In button on mobile and web clients",
        isPublic: "true",
      });
    } else if (existing.isPublic !== "true") {
      await db
        .update(appConfigTable)
        .set({ isPublic: "true" })
        .where(eq(appConfigTable.key, "google_login_enabled"));
    }
  } catch {
    // Non-fatal if table not yet initialized
  }
}


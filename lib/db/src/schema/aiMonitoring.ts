/**
 * Tayyibati AI Monitoring & Credit Alert Database Schema
 *
 * Provides persistent tracking, provider health status,
 * alert settings, and deduplicated alert events.
 */

import { pgTable, text, serial, timestamp, integer, doublePrecision, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * 1. AI API USAGE
 * Persistent log of every real AI request across all providers and features.
 * Supports fallback request chains via chainId and parentRequestId.
 */
export const aiApiUsageTable = pgTable(
  "ai_api_usage",
  {
    id: serial("id").primaryKey(),
    requestId: text("request_id").notNull(), // Unique per provider call for idempotency
    chainId: text("chain_id").notNull(), // Shared correlation ID across fallback attempts
    parentRequestId: text("parent_request_id"), // Points to primary failed attempt if this is a fallback
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    provider: text("provider").notNull(), // 'openai' | 'gemini'
    model: text("model").notNull(),
    feature: text("feature", {
      enum: [
        "IMAGE_ANALYSIS",
        "FOOD_SEARCH",
        "INGREDIENT_ANALYSIS",
        "DISH_ANALYSIS",
        "AI_FALLBACK",
        "OTHER",
      ],
    }).notNull(),
    requestStatus: text("request_status", { enum: ["SUCCESS", "FAILED"] }).notNull(),
    httpStatus: integer("http_status"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"), // Strictly sanitized, max 300 chars, no secrets or images
    latencyMs: integer("latency_ms").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cachedTokens: integer("cached_tokens").notNull().default(0),
    tokensAvailable: boolean("tokens_available").notNull().default(true),
    estimatedCost: doublePrecision("estimated_cost").notNull().default(0),
    isFallback: boolean("is_fallback").notNull().default(false),
    fallbackReason: text("fallback_reason"),
    chainFinalStatus: text("chain_final_status").notNull().default("SUCCESS"),
    metadata: jsonb("metadata"), // Safe diagnostic details only
  },
  (table) => [
    uniqueIndex("ai_api_usage_request_id_idx").on(table.requestId),
    index("ai_api_usage_timestamp_idx").on(table.timestamp),
    index("ai_api_usage_provider_idx").on(table.provider),
    index("ai_api_usage_feature_idx").on(table.feature),
    index("ai_api_usage_request_status_idx").on(table.requestStatus),
    index("ai_api_usage_chain_id_idx").on(table.chainId),
  ]
);

export type AIApiUsage = typeof aiApiUsageTable.$inferSelect;
export type NewAIApiUsage = typeof aiApiUsageTable.$inferInsert;

/**
 * 2. AI PROVIDER STATUS
 * Tracks operational health, connectivity, error rates, real call history,
 * and cost accounting per provider.
 */
export const aiProviderStatusTable = pgTable(
  "ai_provider_status",
  {
    provider: text("provider").primaryKey(), // 'openai' | 'gemini'
    isConfigured: boolean("is_configured").notNull().default(false),
    operationalStatus: text("operational_status", {
      enum: ["HEALTHY", "LOW", "CRITICAL", "EXHAUSTED", "ERROR"],
    }).notNull().default("HEALTHY"),
    connectivityStatus: text("connectivity_status", {
      enum: ["CONNECTED", "DISCONNECTED", "UNCHECKED"],
    }).notNull().default("UNCHECKED"),
    connectivityLastCheckedAt: timestamp("connectivity_last_checked_at", { withTimezone: true }),
    connectivityLatencyMs: integer("connectivity_latency_ms"),
    lastSuccessfulCallAt: timestamp("last_successful_call_at", { withTimezone: true }),
    lastFailedCallAt: timestamp("last_failed_call_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    balanceStatus: text("balance_status", {
      enum: ["UNAVAILABLE_VIA_API", "AVAILABLE"],
    }).notNull().default("UNAVAILABLE_VIA_API"),
    balanceAmount: doublePrecision("balance_amount"),
    balanceCurrency: text("balance_currency").default("USD"),
    balanceLastCheckedAt: timestamp("balance_last_checked_at", { withTimezone: true }),
    billingDashboardUrl: text("billing_dashboard_url").notNull(),
    dailySpendLimit: doublePrecision("daily_spend_limit"),
    monthlySpendLimit: doublePrecision("monthly_spend_limit"),
    todayEstimatedCost: doublePrecision("today_estimated_cost").notNull().default(0),
    monthEstimatedCost: doublePrecision("month_estimated_cost").notNull().default(0),
    allTimeEstimatedCost: doublePrecision("all_time_estimated_cost").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  }
);

export type AIProviderStatus = typeof aiProviderStatusTable.$inferSelect;
export type NewAIProviderStatus = typeof aiProviderStatusTable.$inferInsert;

/**
 * 3. AI ALERT SETTINGS
 * Configurable thresholds for daily/monthly estimated spend, quota exhaustion,
 * repeated failures, and cooldowns.
 */
export const aiAlertSettingsTable = pgTable(
  "ai_alert_settings",
  {
    id: serial("id").primaryKey(),
    enabled: boolean("enabled").notNull().default(true),
    alertEmail: text("alert_email").notNull().default(""),
    openaiDailySpendWarning: doublePrecision("openai_daily_spend_warning").notNull().default(5.0),
    openaiDailySpendCritical: doublePrecision("openai_daily_spend_critical").notNull().default(10.0),
    openaiMonthlySpendWarning: doublePrecision("openai_monthly_spend_warning").notNull().default(50.0),
    openaiMonthlySpendCritical: doublePrecision("openai_monthly_spend_critical").notNull().default(100.0),
    geminiDailySpendWarning: doublePrecision("gemini_daily_spend_warning").notNull().default(5.0),
    geminiDailySpendCritical: doublePrecision("gemini_daily_spend_critical").notNull().default(10.0),
    geminiMonthlySpendWarning: doublePrecision("gemini_monthly_spend_warning").notNull().default(50.0),
    geminiMonthlySpendCritical: doublePrecision("gemini_monthly_spend_critical").notNull().default(100.0),
    alertOnQuotaExhaustion: boolean("alert_on_quota_exhaustion").notNull().default(true),
    alertOnBillingFailure: boolean("alert_on_billing_failure").notNull().default(true),
    alertOnRepeatedFailures: boolean("alert_on_repeated_failures").notNull().default(true),
    consecutiveFailureThreshold: integer("consecutive_failure_threshold").notNull().default(3),
    cooldownMinutes: integer("cooldown_minutes").notNull().default(60),
    sendRecoveryEmail: boolean("send_recovery_email").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  }
);

export type AIAlertSettings = typeof aiAlertSettingsTable.$inferSelect;
export type NewAIAlertSettings = typeof aiAlertSettingsTable.$inferInsert;

/**
 * 4. AI ALERT EVENTS
 * Audit trail of sent and suppressed alert notifications for deduplication.
 */
export const aiAlertEventsTable = pgTable(
  "ai_alert_events",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(), // 'openai' | 'gemini' | 'system'
    alertType: text("alert_type").notNull(), // 'QUOTA_EXHAUSTION' | 'REPEATED_FAILURES' | 'DAILY_SPEND_WARNING' | 'DAILY_SPEND_CRITICAL' | 'MONTHLY_SPEND_WARNING' | 'MONTHLY_SPEND_CRITICAL' | 'RECOVERY' | 'TEST'
    severity: text("severity", { enum: ["INFO", "WARNING", "CRITICAL"] }).notNull(),
    message: text("message").notNull(),
    sentTo: text("sent_to").notNull(),
    status: text("status", { enum: ["SENT", "FAILED", "SUPPRESSED_COOLDOWN"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_alert_events_provider_type_idx").on(table.provider, table.alertType),
    index("ai_alert_events_created_at_idx").on(table.createdAt),
  ]
);

export type AIAlertEvent = typeof aiAlertEventsTable.$inferSelect;
export type NewAIAlertEvent = typeof aiAlertEventsTable.$inferInsert;

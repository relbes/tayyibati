/**
 * Admin AI Monitoring API Routes
 *
 * Endpoints for:
 * - Provider status cards (OpenAI & Gemini)
 * - On-demand lightweight connectivity health checks
 * - Detailed persistent API usage log with fallback chain inspection
 * - Analytics charts (daily calls, daily cost, provider distribution, fallback rates)
 * - Alert settings management
 * - Admin test email action
 */

import { Router, Request, Response } from "express";
import { db, aiApiUsageTable, aiProviderStatusTable, aiAlertSettingsTable, aiAlertEventsTable } from "@workspace/db";
import { eq, and, desc, sql, gte, lte, or } from "drizzle-orm";
import { requireAdmin } from "./admin";
import { checkAllProvidersHealth, checkOpenAIHealth, checkGeminiHealth } from "../lib/ai/aiProviderHealth";
import { sendTestAlertEmail, getTargetAlertEmail } from "../lib/ai/aiAlertService";
import { logger } from "../lib/logger";

const router = Router();

// Ensure all routes require admin session
router.use(requireAdmin);

/**
 * 1. GET /api/admin/ai-monitoring/providers
 * Returns provider cards for OpenAI and Gemini with real operational metrics.
 */
router.get("/providers", async (_req: Request, res: Response) => {
  try {
    const providers = await db.select().from(aiProviderStatusTable);

    // Compute real call aggregates for today and month
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const cards = await Promise.all(
      ["openai", "gemini"].map(async (providerKey) => {
        const row = providers.find((p) => p.provider === providerKey);

        const [todayStats] = await db
          .select({
            callsToday: sql<number>`count(*)`,
            todayCost: sql<number>`coalesce(sum(${aiApiUsageTable.estimatedCost}), 0)`,
          })
          .from(aiApiUsageTable)
          .where(
            and(
              eq(aiApiUsageTable.provider, providerKey),
              gte(aiApiUsageTable.timestamp, startOfToday)
            )
          );

        const [monthStats] = await db
          .select({
            callsThisMonth: sql<number>`count(*)`,
            monthCost: sql<number>`coalesce(sum(${aiApiUsageTable.estimatedCost}), 0)`,
          })
          .from(aiApiUsageTable)
          .where(
            and(
              eq(aiApiUsageTable.provider, providerKey),
              gte(aiApiUsageTable.timestamp, startOfMonth)
            )
          );

        const [allTimeStats] = await db
          .select({
            totalCalls: sql<number>`count(*)`,
            successfulCalls: sql<number>`coalesce(sum(case when ${aiApiUsageTable.requestStatus} = 'SUCCESS' then 1 else 0 end), 0)`,
            failedCalls: sql<number>`coalesce(sum(case when ${aiApiUsageTable.requestStatus} = 'FAILED' then 1 else 0 end), 0)`,
            totalCost: sql<number>`coalesce(sum(${aiApiUsageTable.estimatedCost}), 0)`,
          })
          .from(aiApiUsageTable)
          .where(eq(aiApiUsageTable.provider, providerKey));

        const [latestCall] = await db
          .select({
            requestStatus: aiApiUsageTable.requestStatus,
            errorCode: aiApiUsageTable.errorCode,
            timestamp: aiApiUsageTable.timestamp,
          })
          .from(aiApiUsageTable)
          .where(eq(aiApiUsageTable.provider, providerKey))
          .orderBy(desc(aiApiUsageTable.timestamp))
          .limit(1);

        const todayCost = Number(todayStats?.todayCost || 0);
        const monthCost = Number(monthStats?.monthCost || 0);
        const dailyLimit = row?.dailySpendLimit || 10.0;
        const monthlyLimit = row?.monthlySpendLimit || 100.0;

        let operationalStatus: "HEALTHY" | "LOW" | "CRITICAL" | "EXHAUSTED" | "ERROR" =
          (row?.operationalStatus as any) || "HEALTHY";

        if (todayCost >= dailyLimit || monthCost >= monthlyLimit) {
          operationalStatus = "CRITICAL";
        } else if (todayCost >= dailyLimit * 0.5 || monthCost >= monthlyLimit * 0.5) {
          operationalStatus = "LOW";
        } else if (latestCall?.requestStatus === "SUCCESS") {
          // If the most recent real call was successful, the provider is currently healthy
          operationalStatus = "HEALTHY";
        } else if (latestCall?.requestStatus === "FAILED" && latestCall?.errorCode === "QUOTA_EXHAUSTED") {
          operationalStatus = "EXHAUSTED";
        } else if (row?.consecutiveFailures && row.consecutiveFailures >= 3) {
          operationalStatus = "ERROR";
        } else if (operationalStatus === "EXHAUSTED" && (!latestCall || latestCall.errorCode !== "QUOTA_EXHAUSTED")) {
          // Clear stale quota exhaustion if the latest call was not a quota error
          operationalStatus = "HEALTHY";
        }

        return {
          provider: providerKey,
          displayName: providerKey === "openai" ? "OpenAI" : "Google Gemini",
          isConfigured: row?.isConfigured ?? false,
          operationalStatus,
          connectivityStatus: row?.connectivityStatus || "UNCHECKED",
          connectivityLatencyMs: row?.connectivityLatencyMs ?? null,
          connectivityLastCheckedAt: row?.connectivityLastCheckedAt ?? null,
          lastSuccessfulCallAt: row?.lastSuccessfulCallAt ?? null,
          lastFailedCallAt: row?.lastFailedCallAt ?? null,
          lastErrorCode: row?.lastErrorCode ?? null,
          lastErrorMessage: row?.lastErrorMessage ?? null,
          consecutiveFailures: row?.consecutiveFailures ?? 0,
          callsToday: Number(todayStats?.callsToday || 0),
          callsThisMonth: Number(monthStats?.callsThisMonth || 0),
          successfulCalls: Number(allTimeStats?.successfulCalls || 0),
          failedCalls: Number(allTimeStats?.failedCalls || 0),
          totalCalls: Number(allTimeStats?.totalCalls || 0),
          // Clearly labeled as Estimated Usage Cost
          todayEstimatedCost: Number(todayStats?.todayCost || 0),
          monthEstimatedCost: Number(monthStats?.monthCost || 0),
          allTimeEstimatedCost: Number(allTimeStats?.totalCost || 0),
          dailySpendLimit: row?.dailySpendLimit || 10.0,
          monthlySpendLimit: row?.monthlySpendLimit || 100.0,
          // Balance representation
          balanceStatus: row?.balanceStatus || "UNAVAILABLE_VIA_API",
          balanceAmount: row?.balanceAmount ?? null,
          balanceCurrency: row?.balanceCurrency || "USD",
          billingDashboardUrl:
            row?.billingDashboardUrl ||
            (providerKey === "openai"
              ? "https://platform.openai.com/usage"
              : "https://console.cloud.google.com/billing"),
        };
      })
    );

    res.json({ providers: cards });
  } catch (err) {
    logger.error({ err }, "[AI_MONITORING_API] Failed to fetch provider statuses");
    res.status(500).json({ error: "Failed to fetch provider statuses" });
  }
});

/**
 * 2. POST /api/admin/ai-monitoring/health-check
 * Trigger lightweight connectivity check without token expenditure.
 */
router.post("/health-check", async (req: Request, res: Response) => {
  const { provider } = (req.body || {}) as { provider?: "openai" | "gemini" };

  try {
    if (provider === "openai") {
      const result = await checkOpenAIHealth();
      return void res.json({ results: { openai: result } });
    }

    if (provider === "gemini") {
      const result = await checkGeminiHealth();
      return void res.json({ results: { gemini: result } });
    }

    const results = await checkAllProvidersHealth();
    return void res.json({ results });
  } catch (err) {
    logger.error({ err }, "[AI_MONITORING_API] Error performing provider health check");
    res.status(500).json({ error: "Failed to perform health check" });
  }
});

/**
 * 3. GET /api/admin/ai-monitoring/usage
 * Paginated API usage log with flexible filtering.
 */
router.get("/usage", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 25), 10)));
    const offset = (page - 1) * limit;

    const range = String(req.query.range || "all");
    const provider = String(req.query.provider || "all");
    const feature = String(req.query.feature || "all");
    const status = String(req.query.status || "all");
    const chainId = req.query.chainId ? String(req.query.chainId) : undefined;

    const conditions: any[] = [];

    // Range filtering
    const now = new Date();
    if (range === "today") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      conditions.push(gte(aiApiUsageTable.timestamp, startOfToday));
    } else if (range === "7d") {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      conditions.push(gte(aiApiUsageTable.timestamp, sevenDaysAgo));
    } else if (range === "30d") {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      conditions.push(gte(aiApiUsageTable.timestamp, thirtyDaysAgo));
    } else if (req.query.startDate && req.query.endDate) {
      conditions.push(gte(aiApiUsageTable.timestamp, new Date(String(req.query.startDate))));
      conditions.push(lte(aiApiUsageTable.timestamp, new Date(String(req.query.endDate))));
    }

    if (provider !== "all") {
      conditions.push(eq(aiApiUsageTable.provider, provider));
    }
    if (feature !== "all") {
      conditions.push(eq(aiApiUsageTable.feature, feature as any));
    }
    if (status !== "all") {
      conditions.push(eq(aiApiUsageTable.requestStatus, status as any));
    }
    if (chainId) {
      conditions.push(eq(aiApiUsageTable.chainId, chainId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiApiUsageTable)
      .where(whereClause);

    const total = Number(totalRow?.count || 0);

    const rows = await db
      .select()
      .from(aiApiUsageTable)
      .where(whereClause)
      .orderBy(desc(aiApiUsageTable.timestamp))
      .limit(limit)
      .offset(offset);

    res.json({
      items: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error({ err }, "[AI_MONITORING_API] Failed to query AI usage log");
    res.status(500).json({ error: "Failed to fetch AI usage log" });
  }
});

/**
 * 4. GET /api/admin/ai-monitoring/usage/:id
 * Detail view for a specific API call, including the entire fallback chain timeline if applicable.
 */
router.get("/usage/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return void res.status(400).json({ error: "Invalid record ID" });
    }

    const [record] = await db
      .select()
      .from(aiApiUsageTable)
      .where(eq(aiApiUsageTable.id, id));

    if (!record) {
      return void res.status(404).json({ error: "Usage record not found" });
    }

    // If part of a chain, fetch all attempts in this chain for full audit timeline
    let chainAttempts: any[] = [];
    if (record.chainId) {
      chainAttempts = await db
        .select()
        .from(aiApiUsageTable)
        .where(eq(aiApiUsageTable.chainId, record.chainId))
        .orderBy(aiApiUsageTable.timestamp);
    }

    res.json({
      record,
      chain: {
        chainId: record.chainId,
        isChained: chainAttempts.length > 1,
        attemptsCount: chainAttempts.length,
        attempts: chainAttempts,
      },
    });
  } catch (err) {
    logger.error({ err }, "[AI_MONITORING_API] Error fetching usage record details");
    res.status(500).json({ error: "Failed to fetch usage record details" });
  }
});

/**
 * 5. GET /api/admin/ai-monitoring/charts
 * Analytics time-series and aggregate distribution metrics.
 */
router.get("/charts", async (req: Request, res: Response) => {
  try {
    const range = String(req.query.range || "7d");
    const days = range === "today" ? 1 : range === "30d" ? 30 : 7;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    if (range === "today") {
      startDate.setHours(0, 0, 0, 0);
    }

    // Daily Calls & Spend
    const dailyData = await db
      .select({
        date: sql<string>`to_char(${aiApiUsageTable.timestamp}, 'YYYY-MM-DD')`,
        totalCalls: sql<number>`count(*)`,
        successCalls: sql<number>`coalesce(sum(case when ${aiApiUsageTable.requestStatus} = 'SUCCESS' then 1 else 0 end), 0)`,
        failedCalls: sql<number>`coalesce(sum(case when ${aiApiUsageTable.requestStatus} = 'FAILED' then 1 else 0 end), 0)`,
        openaiCalls: sql<number>`coalesce(sum(case when ${aiApiUsageTable.provider} = 'openai' then 1 else 0 end), 0)`,
        geminiCalls: sql<number>`coalesce(sum(case when ${aiApiUsageTable.provider} = 'gemini' then 1 else 0 end), 0)`,
        totalCost: sql<number>`coalesce(sum(${aiApiUsageTable.estimatedCost}), 0)`,
        openaiCost: sql<number>`coalesce(sum(case when ${aiApiUsageTable.provider} = 'openai' then ${aiApiUsageTable.estimatedCost} else 0 end), 0)`,
        geminiCost: sql<number>`coalesce(sum(case when ${aiApiUsageTable.provider} = 'gemini' then ${aiApiUsageTable.estimatedCost} else 0 end), 0)`,
      })
      .from(aiApiUsageTable)
      .where(gte(aiApiUsageTable.timestamp, startDate))
      .groupBy(sql`to_char(${aiApiUsageTable.timestamp}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${aiApiUsageTable.timestamp}, 'YYYY-MM-DD')`);

    // Feature breakdown
    const featureBreakdown = await db
      .select({
        feature: aiApiUsageTable.feature,
        count: sql<number>`count(*)`,
        cost: sql<number>`coalesce(sum(${aiApiUsageTable.estimatedCost}), 0)`,
      })
      .from(aiApiUsageTable)
      .where(gte(aiApiUsageTable.timestamp, startDate))
      .groupBy(aiApiUsageTable.feature);

    // Fallback usage
    const [fallbackStats] = await db
      .select({
        fallbackCalls: sql<number>`coalesce(sum(case when ${aiApiUsageTable.isFallback} = true then 1 else 0 end), 0)`,
        totalCalls: sql<number>`count(*)`,
      })
      .from(aiApiUsageTable)
      .where(gte(aiApiUsageTable.timestamp, startDate));

    // Summary provider usage
    const [providerTotals] = await db
      .select({
        openaiCalls: sql<number>`coalesce(sum(case when ${aiApiUsageTable.provider} = 'openai' then 1 else 0 end), 0)`,
        geminiCalls: sql<number>`coalesce(sum(case when ${aiApiUsageTable.provider} = 'gemini' then 1 else 0 end), 0)`,
        openaiCost: sql<number>`coalesce(sum(case when ${aiApiUsageTable.provider} = 'openai' then ${aiApiUsageTable.estimatedCost} else 0 end), 0)`,
        geminiCost: sql<number>`coalesce(sum(case when ${aiApiUsageTable.provider} = 'gemini' then ${aiApiUsageTable.estimatedCost} else 0 end), 0)`,
        totalSuccess: sql<number>`coalesce(sum(case when ${aiApiUsageTable.requestStatus} = 'SUCCESS' then 1 else 0 end), 0)`,
        totalFailed: sql<number>`coalesce(sum(case when ${aiApiUsageTable.requestStatus} = 'FAILED' then 1 else 0 end), 0)`,
        totalCalls: sql<number>`count(*)`,
      })
      .from(aiApiUsageTable)
      .where(gte(aiApiUsageTable.timestamp, startDate));

    const totalCalls = Number(providerTotals?.totalCalls || 0);
    const successCalls = Number(providerTotals?.totalSuccess || 0);
    const successRate = totalCalls > 0 ? Number(((successCalls / totalCalls) * 100).toFixed(1)) : 100;

    const fallbackCalls = Number(fallbackStats?.fallbackCalls || 0);
    const fallbackRate = totalCalls > 0 ? Number(((fallbackCalls / totalCalls) * 100).toFixed(1)) : 0;

    res.json({
      dailyData: dailyData.map((d) => ({
        ...d,
        totalCalls: Number(d.totalCalls),
        successCalls: Number(d.successCalls),
        failedCalls: Number(d.failedCalls),
        openaiCalls: Number(d.openaiCalls),
        geminiCalls: Number(d.geminiCalls),
        totalCost: Number(d.totalCost),
        openaiCost: Number(d.openaiCost),
        geminiCost: Number(d.geminiCost),
      })),
      features: featureBreakdown.map((f) => ({
        feature: f.feature,
        count: Number(f.count),
        cost: Number(f.cost),
      })),
      summary: {
        totalCalls,
        successCalls,
        failedCalls: Number(providerTotals?.totalFailed || 0),
        successRate,
        fallbackCalls,
        fallbackRate,
        openaiCalls: Number(providerTotals?.openaiCalls || 0),
        geminiCalls: Number(providerTotals?.geminiCalls || 0),
        openaiCost: Number(providerTotals?.openaiCost || 0),
        geminiCost: Number(providerTotals?.geminiCost || 0),
        totalCost: Number(providerTotals?.openaiCost || 0) + Number(providerTotals?.geminiCost || 0),
      },
    });
  } catch (err) {
    logger.error({ err }, "[AI_MONITORING_API] Error fetching chart metrics");
    res.status(500).json({ error: "Failed to fetch chart metrics" });
  }
});

/**
 * 6. GET /api/admin/ai-monitoring/settings
 * Retrieves alert configuration.
 */
router.get("/settings", async (_req: Request, res: Response) => {
  try {
    let [settings] = await db.select().from(aiAlertSettingsTable).limit(1);

    if (!settings) {
      const [newSettings] = await db
        .insert(aiAlertSettingsTable)
        .values({ id: 1, enabled: true, alertEmail: "" })
        .returning();
      settings = newSettings;
    }

    const defaultTargetEmail = await getTargetAlertEmail();

    res.json({
      settings,
      resolvedRecipientEmail: defaultTargetEmail || "",
      emailServiceConfigured: Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST),
      emailProviderType: process.env.RESEND_API_KEY ? "Resend" : process.env.SMTP_HOST ? "SMTP" : "Simulation (Dev)",
    });
  } catch (err) {
    logger.error({ err }, "[AI_MONITORING_API] Failed to fetch alert settings");
    res.status(500).json({ error: "Failed to fetch alert settings" });
  }
});

/**
 * 7. PATCH /api/admin/ai-monitoring/settings
 * Updates alert thresholds and admin recipient.
 */
router.patch("/settings", async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};

    const updateFields: any = {
      updatedAt: new Date(),
    };

    if (typeof payload.enabled === "boolean") updateFields.enabled = payload.enabled;
    if (typeof payload.alertEmail === "string") updateFields.alertEmail = payload.alertEmail.trim();

    if (typeof payload.openaiDailySpendWarning === "number") updateFields.openaiDailySpendWarning = payload.openaiDailySpendWarning;
    if (typeof payload.openaiDailySpendCritical === "number") updateFields.openaiDailySpendCritical = payload.openaiDailySpendCritical;
    if (typeof payload.openaiMonthlySpendWarning === "number") updateFields.openaiMonthlySpendWarning = payload.openaiMonthlySpendWarning;
    if (typeof payload.openaiMonthlySpendCritical === "number") updateFields.openaiMonthlySpendCritical = payload.openaiMonthlySpendCritical;

    if (typeof payload.geminiDailySpendWarning === "number") updateFields.geminiDailySpendWarning = payload.geminiDailySpendWarning;
    if (typeof payload.geminiDailySpendCritical === "number") updateFields.geminiDailySpendCritical = payload.geminiDailySpendCritical;
    if (typeof payload.geminiMonthlySpendWarning === "number") updateFields.geminiMonthlySpendWarning = payload.geminiMonthlySpendWarning;
    if (typeof payload.geminiMonthlySpendCritical === "number") updateFields.geminiMonthlySpendCritical = payload.geminiMonthlySpendCritical;

    if (typeof payload.alertOnQuotaExhaustion === "boolean") updateFields.alertOnQuotaExhaustion = payload.alertOnQuotaExhaustion;
    if (typeof payload.alertOnBillingFailure === "boolean") updateFields.alertOnBillingFailure = payload.alertOnBillingFailure;
    if (typeof payload.alertOnRepeatedFailures === "boolean") updateFields.alertOnRepeatedFailures = payload.alertOnRepeatedFailures;
    if (typeof payload.consecutiveFailureThreshold === "number") updateFields.consecutiveFailureThreshold = payload.consecutiveFailureThreshold;
    if (typeof payload.cooldownMinutes === "number") updateFields.cooldownMinutes = payload.cooldownMinutes;
    if (typeof payload.sendRecoveryEmail === "boolean") updateFields.sendRecoveryEmail = payload.sendRecoveryEmail;

    const [updated] = await db
      .update(aiAlertSettingsTable)
      .set(updateFields)
      .where(eq(aiAlertSettingsTable.id, 1))
      .returning();

    res.json({ settings: updated });
  } catch (err) {
    logger.error({ err }, "[AI_MONITORING_API] Error updating alert settings");
    res.status(500).json({ error: "Failed to update alert settings" });
  }
});

/**
 * 8. POST /api/admin/ai-monitoring/test-email
 * Admin-triggered email test action.
 */
router.post("/test-email", async (req: Request, res: Response) => {
  try {
    const { targetEmail } = (req.body || {}) as { targetEmail?: string };
    const resolvedEmail = targetEmail?.trim() || (await getTargetAlertEmail());

    if (!resolvedEmail || !resolvedEmail.includes("@")) {
      return void res.status(400).json({
        error: "يرجى تحديد عنوان بريد إلكتروني صحيح لإرسال الاختبار",
      });
    }

    const result = await sendTestAlertEmail(resolvedEmail);
    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "[AI_MONITORING_API] Failed to execute test email");
    res.status(500).json({ error: err?.message || "Failed to send test email" });
  }
});

export default router;

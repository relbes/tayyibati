import { Router, type Request, type Response } from "express";
import { db, userActivityHistoryTable, usersTable, analysisHistoryTable, subscriptionPlansTable } from "@workspace/db";
import { eq, and, desc, sql, count, ilike, or, gte, lte, inArray } from "drizzle-orm";
import { requireAdmin } from "./admin";
import { recordUserActivity, type ActivityCategory } from "../lib/userActivityLogger";

const router = Router();

const VALID_CATEGORIES: Set<string> = new Set([
  "AUTH",
  "SEARCH",
  "IMAGE_ANALYSIS",
  "INGREDIENT_ANALYSIS",
  "SUBSCRIPTION",
  "PAYMENT",
  "NOTIFICATION",
  "ADMIN_ACTION",
  "PROFILE",
  "ERROR",
  "SYSTEM",
]);

/**
 * GET /api/admin/users/:userId/history
 *
 * Retrieves chronological activity and audit history for a specific user.
 * Supports pagination, category filter, date ranges, and text search.
 */
async function handleGetUserHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = String(req.params.userId);
    if (!userId) {
      return void res.status(400).json({ error: "userId parameter is required" });
    }

    // Verify user existence
    const [user] = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      return void res.status(404).json({ error: "User not found" });
    }

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || req.query.limit || "50"), 10) || 50));
    const offset = (page - 1) * pageSize;

    const { category, search, dateFrom, dateTo } = req.query as Record<string, string>;

    const conditions = [eq(userActivityHistoryTable.userId, userId)];

    // Category filter
    if (category && category !== "ALL" && category !== "all") {
      const parts = category
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter((c) => VALID_CATEGORIES.has(c)) as ActivityCategory[];
      if (parts.length === 1) {
        conditions.push(eq(userActivityHistoryTable.category, parts[0]));
      } else if (parts.length > 1) {
        conditions.push(inArray(userActivityHistoryTable.category, parts));
      }
    }

    // Search filter across eventName, description, eventType
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(userActivityHistoryTable.eventName, q),
          ilike(userActivityHistoryTable.description, q),
          ilike(userActivityHistoryTable.eventType, q)
        )!
      );
    }

    // Date range filter
    if (dateFrom && dateFrom.trim()) {
      const fromDate = new Date(dateFrom.trim());
      if (!isNaN(fromDate.getTime())) {
        conditions.push(gte(userActivityHistoryTable.createdAt, fromDate));
      }
    }

    if (dateTo && dateTo.trim()) {
      const toDate = new Date(dateTo.trim());
      if (!isNaN(toDate.getTime())) {
        // If YYYY-MM-DD format, extend to end of day 23:59:59.999
        if (dateTo.trim().length <= 10) {
          toDate.setHours(23, 59, 59, 999);
        }
        conditions.push(lte(userActivityHistoryTable.createdAt, toDate));
      }
    }

    const whereClause = and(...conditions);

    // Total count query
    const [countResult] = await db
      .select({ total: count() })
      .from(userActivityHistoryTable)
      .where(whereClause);

    const total = Number(countResult?.total || 0);

    // Items query - ordered newest first
    const items = await db
      .select()
      .from(userActivityHistoryTable)
      .where(whereClause)
      .orderBy(desc(userActivityHistoryTable.createdAt))
      .limit(pageSize)
      .offset(offset);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (err) {
    req.log.error({ err, userId: req.params.userId }, "Failed to get user history");
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/admin/users/:userId/history
 */
router.get("/admin/users/:userId/history", requireAdmin, handleGetUserHistory);

/**
 * POST /api/admin/users/:userId/history & /api/users/:userId/history
 *
 * Allows an administrator to log an audit event, administrative note,
 * or resolution action onto a user's activity timeline.
 */
async function handlePostUserHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = String(req.params.userId);
    const { category = "ADMIN_ACTION", eventName, description, metadata } = req.body || {};

    if (!eventName || typeof eventName !== "string" || !eventName.trim()) {
      return void res.status(400).json({ error: "eventName is required" });
    }

    const admin = (req as any).adminUser;
    const chosenCategory = VALID_CATEGORIES.has(String(category).toUpperCase())
      ? (String(category).toUpperCase() as ActivityCategory)
      : "ADMIN_ACTION";

    await recordUserActivity({
      userId,
      category: chosenCategory,
      eventType: "ADMIN_AUDIT_LOG",
      eventName: eventName.trim(),
      description: description ? String(description).trim() : "",
      actorType: "ADMIN",
      actorId: admin?.id || null,
      actorName: admin?.username || "Admin",
      metadata: metadata || null,
    });

    res.json({ success: true, message: "Activity logged successfully" });
  } catch (err) {
    req.log.error({ err, userId: req.params.userId }, "Failed to post user activity event");
    res.status(500).json({ error: "Internal server error" });
  }
}

router.post("/admin/users/:userId/history", requireAdmin, handlePostUserHistory);

/**
 * GET /api/admin/users/:userId/report
 *
 * Generates an aggregated User Activity & Subscription Report.
 * Contains:
 * 1. Account overview & status
 * 2. Activity summary (totals, food/image/label breakdowns, login count)
 * 3. Search type breakdown with counts & last activity timestamps
 * 4. Recent search records
 * 5. Subscription summary, plan limits, days remaining, source
 * 6. Subscription history & timeline
 */
async function handleGetUserReport(req: Request, res: Response): Promise<void> {
  try {
    const userId = String(req.params.userId);
    if (!userId) {
      return void res.status(400).json({ error: "userId parameter is required" });
    }

    // 1. Fetch user account
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      return void res.status(404).json({ error: "User not found" });
    }

    // 2. Aggregate Search / Analysis types from analysisHistoryTable
    const searchStats = await db
      .select({
        analysisType: analysisHistoryTable.analysisType,
        count: count(),
        lastAt: sql<string>`MAX(${analysisHistoryTable.createdAt})`,
      })
      .from(analysisHistoryTable)
      .where(eq(analysisHistoryTable.userId, userId))
      .groupBy(analysisHistoryTable.analysisType);

    let foodSearches = 0;
    let imageAnalyses = 0;
    let ingredientAnalyses = 0;
    let lastFoodSearchAt: string | null = null;
    let lastImageAnalysisAt: string | null = null;
    let lastIngredientAnalysisAt: string | null = null;

    for (const stat of searchStats) {
      const c = Number(stat.count) || 0;
      const t = stat.lastAt ? new Date(stat.lastAt).toISOString() : null;
      if (stat.analysisType === "text") {
        foodSearches = c;
        lastFoodSearchAt = t;
      } else if (stat.analysisType === "image") {
        imageAnalyses = c;
        lastImageAnalysisAt = t;
      } else if (stat.analysisType === "label") {
        ingredientAnalyses = c;
        lastIngredientAnalysisAt = t;
      }
    }

    // Check userActivityHistoryTable for any search events
    const [activitySearchCount] = await db
      .select({ count: count() })
      .from(userActivityHistoryTable)
      .where(and(eq(userActivityHistoryTable.userId, userId), eq(userActivityHistoryTable.category, "SEARCH")));

    if (foodSearches === 0 && activitySearchCount && Number(activitySearchCount.count) > 0) {
      foodSearches = Number(activitySearchCount.count);
    }

    const totalSearches = foodSearches + imageAnalyses + ingredientAnalyses;

    // 3. User Activity Summary from userActivityHistoryTable
    const [totalEventsResult] = await db
      .select({
        count: count(),
        lastActive: sql<string>`MAX(${userActivityHistoryTable.createdAt})`,
      })
      .from(userActivityHistoryTable)
      .where(eq(userActivityHistoryTable.userId, userId));

    const totalEvents = Number(totalEventsResult?.count) || 0;
    const lastActiveAt = totalEventsResult?.lastActive ? new Date(totalEventsResult.lastActive).toISOString() : null;

    // Login events count if recorded
    const [loginResult] = await db
      .select({ count: count() })
      .from(userActivityHistoryTable)
      .where(
        and(
          eq(userActivityHistoryTable.userId, userId),
          inArray(userActivityHistoryTable.eventType, ["LOGIN", "USER_LOGIN", "ACCOUNT_LOGIN"])
        )
      );

    const loginCountNumber = Number(loginResult?.count) || 0;
    const logins: number | null = loginCountNumber > 0 ? loginCountNumber : null;

    // 4. Recent Searches (up to 15, newest first)
    const recentSearchesRaw = await db
      .select({
        id: analysisHistoryTable.id,
        query: analysisHistoryTable.query,
        analysisType: analysisHistoryTable.analysisType,
        compatibilityScore: analysisHistoryTable.compatibilityScore,
        createdAt: analysisHistoryTable.createdAt,
      })
      .from(analysisHistoryTable)
      .where(eq(analysisHistoryTable.userId, userId))
      .orderBy(desc(analysisHistoryTable.createdAt))
      .limit(15);

    const recentSearches = recentSearchesRaw.map((s) => ({
      id: s.id,
      query: s.query,
      analysisType: s.analysisType,
      compatibilityScore: s.compatibilityScore,
      createdAt: s.createdAt?.toISOString() || "",
    }));

    // 5. Subscription Plan Details
    let planName = "مجاني";
    let planNameEn = "Free";
    let dailyLimit = 10;
    let dailyTextLimit = 10;
    let dailyImageLimit = 5;

    if (user.planId != null) {
      const [plan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, user.planId))
        .limit(1);

      if (plan) {
        planName = plan.name || "خطة مخصصة";
        planNameEn = plan.nameEn || "Custom Plan";
        dailyLimit = plan.dailyLimit;
        dailyTextLimit = plan.dailyTextLimit;
        dailyImageLimit = plan.dailyImageLimit;
      }
    } else if (user.isPremium === "true") {
      planName = "طيباتي بريميوم";
      planNameEn = "Tayyibati Premium";
      dailyLimit = -1;
      dailyTextLimit = -1;
      dailyImageLimit = -1;
    }

    // 6. Subscription History from userActivityHistoryTable
    const subHistoryRows = await db
      .select()
      .from(userActivityHistoryTable)
      .where(
        and(
          eq(userActivityHistoryTable.userId, userId),
          or(
            eq(userActivityHistoryTable.category, "SUBSCRIPTION"),
            ilike(userActivityHistoryTable.eventType, "%PLAN%"),
            ilike(userActivityHistoryTable.eventType, "%SUB%")
          )
        )
      )
      .orderBy(desc(userActivityHistoryTable.createdAt))
      .limit(50);

    const subscriptionHistory = subHistoryRows.map((row) => {
      const meta = (row.metadata || {}) as Record<string, any>;
      const isPast = new Date(row.createdAt).getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000;
      
      // Strictly determine source from actual recorded data — NEVER guess or default to Google Play
      let source = "None";
      if (row.actorType === "ADMIN" || /admin/i.test(row.eventType)) {
        source = "Admin Grant";
      } else if (
        meta.store === "play_store" ||
        meta.provider === "google_play" ||
        meta.source === "Google Play" ||
        /google.*play|play.*store/i.test(String(meta.source || meta.store || meta.provider || ""))
      ) {
        source = "Google Play";
      } else if (meta.source && typeof meta.source === "string" && meta.source.trim()) {
        source = meta.source.trim();
      }

      return {
        id: row.id,
        eventType: row.eventType,
        eventName: row.eventName,
        description: row.description,
        source,
        status: isPast ? "Expired" : "Active",
        actorType: row.actorType,
        actorName: row.actorName || (row.actorType === "ADMIN" ? "Admin" : "User"),
        createdAt: row.createdAt.toISOString(),
        metadata: meta,
      };
    });

    const isPremium = user.isPremium === "true";
    let subStatus = isPremium ? "ACTIVE" : "NO_SUBSCRIPTION";
    
    // Determine active subscription source strictly from verified records
    let subSource = "None";
    if (isPremium) {
      if (subscriptionHistory.length > 0) {
        const latestSub = subscriptionHistory[0];
        if (latestSub.source === "Admin Grant" || latestSub.actorType === "ADMIN") {
          subSource = "Admin Grant";
        } else if (latestSub.source === "Google Play") {
          subSource = "Google Play";
        } else if (latestSub.source && latestSub.source !== "None") {
          subSource = latestSub.source;
        } else {
          subSource = "None";
        }
      } else {
        subSource = "None";
      }
    }
    let startDate: string | null = null;
    let expirationDate: string | null = null;
    let daysRemaining: number | null = null;

    if (isPremium) {
      if (subscriptionHistory.length > 0) {
        const latestSub = subscriptionHistory[0];
        startDate = latestSub.createdAt;
        const startMs = new Date(latestSub.createdAt).getTime();
        const expMs = startMs + 30 * 24 * 60 * 60 * 1000;
        expirationDate = new Date(expMs).toISOString();
        const nowMs = Date.now();
        if (expMs < nowMs) {
          subStatus = "EXPIRED";
          daysRemaining = 0;
        } else {
          subStatus = "ACTIVE";
          daysRemaining = Math.max(0, Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24)));
        }
      } else {
        startDate = user.createdAt?.toISOString() || null;
      }
    }

    // 7. Recent Activity Timeline (up to 25 items for the report)
    const recentActivityRows = await db
      .select()
      .from(userActivityHistoryTable)
      .where(eq(userActivityHistoryTable.userId, userId))
      .orderBy(desc(userActivityHistoryTable.createdAt))
      .limit(25);

    const timeline = recentActivityRows.map((item) => {
      let meta = item.metadata as Record<string, any> | null;
      if (meta && typeof meta === "object") {
        const clean: Record<string, any> = {};
        for (const [k, v] of Object.entries(meta)) {
          if (/password|token|secret|auth|bearer/i.test(k)) {
            clean[k] = "[REDACTED]";
          } else {
            clean[k] = v;
          }
        }
        meta = clean;
      }
      return {
        id: item.id,
        userId: item.userId,
        category: item.category,
        eventType: item.eventType,
        eventName: item.eventName,
        description: item.description,
        actorType: item.actorType,
        actorId: item.actorId,
        actorName: item.actorName,
        metadata: meta,
        createdAt: item.createdAt.toISOString(),
      };
    });

    const isLocked = !!(user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now());

    res.json({
      user: {
        id: user.id,
        name: user.name || "مستخدم",
        email: user.email,
        createdAt: user.createdAt?.toISOString() || "",
        provider: user.provider || "email",
        isPremium,
        isLocked,
        lockedUntil: user.lockedUntil?.toISOString() || null,
      },
      activity: {
        totalEvents,
        totalSearches,
        foodSearches,
        imageAnalyses,
        ingredientAnalyses,
        logins,
        lastActiveAt,
      },
      searchBreakdown: [
        {
          type: "food",
          label: "Food Search",
          labelAr: "البحث الغذائي",
          count: foodSearches,
          lastAt: lastFoodSearchAt,
        },
        {
          type: "image",
          label: "Image Analysis",
          labelAr: "فحص الصور",
          count: imageAnalyses,
          lastAt: lastImageAnalysisAt,
        },
        {
          type: "label",
          label: "Ingredient Analysis",
          labelAr: "فحص الملصقات والمكونات",
          count: ingredientAnalyses,
          lastAt: lastIngredientAnalysisAt,
        },
      ],
      recentSearches,
      subscription: {
        isPremium,
        status: subStatus,
        planId: user.planId,
        planName,
        planNameEn,
        source: subSource,
        startDate,
        expirationDate,
        daysRemaining,
        autoRenew: isPremium && subStatus === "ACTIVE",
        dailyLimit,
        dailyTextLimit,
        dailyImageLimit,
      },
      subscriptionHistory,
      timeline,
    });
  } catch (err) {
    req.log.error({ err, userId: req.params.userId }, "Failed to generate user report");
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/admin/users/:userId/searches
 *
 * Paginated search details for an administrator to inspect user search activity.
 */
async function handleGetUserSearches(req: Request, res: Response): Promise<void> {
  try {
    const userId = String(req.params.userId);
    if (!userId) {
      return void res.status(400).json({ error: "userId parameter is required" });
    }

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || req.query.limit || "20"), 10) || 20));
    const offset = (page - 1) * pageSize;

    const [totalRow] = await db
      .select({ count: count() })
      .from(analysisHistoryTable)
      .where(eq(analysisHistoryTable.userId, userId));

    const total = Number(totalRow?.count) || 0;

    const rows = await db
      .select({
        id: analysisHistoryTable.id,
        query: analysisHistoryTable.query,
        analysisType: analysisHistoryTable.analysisType,
        compatibilityScore: analysisHistoryTable.compatibilityScore,
        createdAt: analysisHistoryTable.createdAt,
      })
      .from(analysisHistoryTable)
      .where(eq(analysisHistoryTable.userId, userId))
      .orderBy(desc(analysisHistoryTable.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items = rows.map((r) => ({
      id: r.id,
      query: r.query,
      analysisType: r.analysisType,
      compatibilityScore: r.compatibilityScore,
      createdAt: r.createdAt.toISOString(),
    }));

    res.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (err) {
    req.log.error({ err, userId: req.params.userId }, "Failed to get user searches");
    res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/admin/users/:userId/report", requireAdmin, handleGetUserReport);
router.get("/admin/users/:userId/searches", requireAdmin, handleGetUserSearches);

export default router;

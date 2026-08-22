import { Router, type Request, type Response, type NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db, adminUsersTable, type AdminUser, analysisHistoryTable, userUsageTable, foodsTable, usersTable, subscriptionPlansTable, dishes, pendingKnowledgeReviewsTable, aiFoodKnowledgeCacheTable } from "@workspace/db";
import { desc, sql, count, avg, eq, and, or, inArray } from "drizzle-orm";
import { getUserPlanLimits } from "./analysis";
import { comparePassword, createAdminSession, destroyAdminSession, getAdminSession } from "../lib/adminAuth";

const router = Router();

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionData = await getAdminSession(req);
    if (!sessionData) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { admin } = sessionData;
    if (!admin.isActive || admin.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Forbidden: Administrative access required" });
      return;
    }

    (req as any).adminUser = admin;
    next();
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
}

router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      return void res.status(401).json({ error: "بيانات تسجيل الدخول غير صحيحة" });
    }

    const input = username.trim().toLowerCase();

    const users = await db
      .select()
      .from(adminUsersTable)
      .where(or(eq(adminUsersTable.username, input), eq(adminUsersTable.email, input)))
      .limit(1);

    if (users.length === 0) {
      return void res.status(401).json({ error: "بيانات تسجيل الدخول غير صحيحة" });
    }

    const admin = users[0];
    if (!admin.isActive) {
      return void res.status(401).json({ error: "بيانات تسجيل الدخول غير صحيحة" });
    }

    const validPassword = await comparePassword(password, admin.passwordHash);
    if (!validPassword) {
      return void res.status(401).json({ error: "بيانات تسجيل الدخول غير صحيحة" });
    }

    await db
      .update(adminUsersTable)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(adminUsersTable.id, admin.id));

    await createAdminSession(admin.id, res);

    res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Admin login failure");
    res.status(500).json({ error: "تعذّر الوصول إلى الخادم" });
  }
});

router.post("/admin/logout", async (req, res) => {
  try {
    await destroyAdminSession(req, res);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/me", requireAdmin, (req, res) => {
  const admin = (req as any).adminUser as AdminUser;
  res.json({
    authenticated: true,
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
    },
  });
});

router.get("/admin/history", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const offset = Math.max(0, parseInt(String(req.query.offset || "0"), 10) || 0);
    const searchQuery = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
    const typeFilter = typeof req.query.analysisType === "string" ? req.query.analysisType : "";
    const statusFilter = typeof req.query.status === "string" ? req.query.status : "";

    const allItems = await db
      .select()
      .from(analysisHistoryTable)
      .orderBy(desc(analysisHistoryTable.createdAt));

    const users = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable);
    const userMap = new Map<string, string>();
    for (const u of users) {
      if (u.id && u.email) {
        userMap.set(u.id, u.email);
        userMap.set(u.id.trim(), u.email);
        userMap.set(u.id.toLowerCase(), u.email);
      }
    }

    let mapped = allItems.map((i) => {
      const uId = i.userId ? i.userId.trim() : "";
      const email = userMap.get(uId) || userMap.get(uId.toLowerCase()) || "غير متوفر";
      return {
        ...i,
        userEmail: email,
      };
    });

    if (searchQuery) {
      mapped = mapped.filter(
        (i) =>
          i.query.toLowerCase().includes(searchQuery) ||
          (i.userEmail && i.userEmail.toLowerCase().includes(searchQuery)) ||
          i.userId.toLowerCase().includes(searchQuery)
      );
    }

    if (typeFilter && typeFilter !== "all") {
      mapped = mapped.filter((i) => i.analysisType === typeFilter);
    }

    if (statusFilter && statusFilter !== "all") {
      mapped = mapped.filter((i) => {
        const r = (i.report || {}) as any;
        return r.status === statusFilter;
      });
    }

    const totalItems = mapped.length;
    const paginatedItems = mapped.slice(offset, offset + limit);

    res.json({
      items: paginatedItems,
      totalItems,
      offset,
      limit,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list admin history");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/history", requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return void res.status(400).json({ error: "Invalid or empty IDs array" });
    }

    const numIds = ids.map((id) => parseInt(String(id), 10)).filter((id) => !isNaN(id));
    if (numIds.length === 0) {
      return void res.status(400).json({ error: "No valid numeric IDs provided" });
    }

    const deleted = await db
      .delete(analysisHistoryTable)
      .where(inArray(analysisHistoryTable.id, numIds))
      .returning();

    res.json({ success: true, count: deleted.length, message: `Successfully deleted ${deleted.length} search history records` });
  } catch (err) {
    req.log.error({ err }, "Failed to bulk delete search history");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/export/history", requireAdmin, async (req, res) => {
  try {
    const items = await db.select().from(analysisHistoryTable).orderBy(desc(analysisHistoryTable.createdAt));
    const users = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable);
    const userMap = new Map(users.map((u) => [u.id, u.email]));

    const headers = ["id", "user_email", "query", "analysis_type", "compatibility_score", "status", "created_at"];
    const rows = items.map((i) => {
      const rep = (i.report || {}) as any;
      return [
        i.id,
        userMap.get(i.userId) || "غير متوفر",
        i.query,
        i.analysisType,
        i.compatibilityScore ?? 0,
        rep.status || "unknown",
        i.createdAt ? new Date(i.createdAt).toISOString() : "",
      ];
    });

    const csvContent = buildCsv(headers, rows);
    const today = new Date().toISOString().slice(0, 10);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tayyibati_search_history_${today}.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    req.log.error({ err }, "Failed to export search history CSV");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/stats", requireAdmin, async (req, res) => {
  try {
    const [totals] = await db
      .select({
        totalAnalyses: count(analysisHistoryTable.id),
        avgScore: avg(analysisHistoryTable.compatibilityScore),
        textAnalyses: sql<number>`cast(sum(case when ${analysisHistoryTable.analysisType} = 'text' then 1 else 0 end) as int)`,
        imageAnalyses: sql<number>`cast(sum(case when ${analysisHistoryTable.analysisType} = 'image' then 1 else 0 end) as int)`,
        labelAnalyses: sql<number>`cast(sum(case when ${analysisHistoryTable.analysisType} = 'label' then 1 else 0 end) as int)`,
      })
      .from(analysisHistoryTable);

    const [userCount] = await db
      .select({ totalUsers: sql<number>`cast(count(distinct ${usersTable.id}) as int)` })
      .from(usersTable);

    const [foodCount] = await db.select({ c: count() }).from(foodsTable);
    const [dishCount] = await db.select({ c: count() }).from(dishes);
    const [pendingKnowledgeCount] = await db
      .select({ c: count() })
      .from(pendingKnowledgeReviewsTable)
      .where(eq(pendingKnowledgeReviewsTable.status, "pending"));
    const [pendingAiCount] = await db
      .select({ c: count() })
      .from(aiFoodKnowledgeCacheTable)
      .where(eq(aiFoodKnowledgeCacheTable.isDeleted, false));
    const [todayCount] = await db
      .select({ c: count() })
      .from(analysisHistoryTable)
      .where(sql`date_trunc('day', ${analysisHistoryTable.createdAt}) = date_trunc('day', now())`);

    const dailyRows = await db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${analysisHistoryTable.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(analysisHistoryTable)
      .where(sql`${analysisHistoryTable.createdAt} >= now() - interval '14 days'`)
      .groupBy(sql`date_trunc('day', ${analysisHistoryTable.createdAt})`)
      .orderBy(sql`date_trunc('day', ${analysisHistoryTable.createdAt})`);

    const scoreBuckets = [
      { range: "0–30", min: 0, max: 30 },
      { range: "31–50", min: 31, max: 50 },
      { range: "51–70", min: 51, max: 70 },
      { range: "71–90", min: 71, max: 90 },
      { range: "91–100", min: 91, max: 100 },
    ];

    const bucketCounts = await Promise.all(
      scoreBuckets.map(async (b) => {
        const [row] = await db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(analysisHistoryTable)
          .where(
            sql`${analysisHistoryTable.compatibilityScore} >= ${b.min} and ${analysisHistoryTable.compatibilityScore} <= ${b.max}`,
          );
        return { range: b.range, count: row?.count ?? 0 };
      }),
    );

    res.json({
      totalAnalyses: totals?.totalAnalyses ?? 0,
      totalUsers: userCount?.totalUsers ?? 0,
      totalFoods: foodCount?.c ?? 0,
      totalDishes: dishCount?.c ?? 0,
      pendingKnowledge: pendingKnowledgeCount?.c ?? 0,
      pendingAiReviews: pendingAiCount?.c ?? 0,
      todaySearches: todayCount?.c ?? 0,
      avgScore: Math.round(Number(totals?.avgScore ?? 0)),
      textAnalyses: totals?.textAnalyses ?? 0,
      imageAnalyses: totals?.imageAnalyses ?? 0,
      labelAnalyses: totals?.labelAnalyses ?? 0,
      dailyAnalyses: dailyRows,
      scoreBuckets: bucketCounts,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

// CSV Export Helpers
function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  let str = typeof value === "object" ? JSON.stringify(value) : String(value);
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

function buildCsv(headers: string[], rows: any[][]): string {
  const headerRow = headers.map(escapeCsvCell).join(",");
  const dataRows = rows.map((r) => r.map(escapeCsvCell).join(","));
  return "\uFEFF" + [headerRow, ...dataRows].join("\r\n");
}

router.get("/admin/export/foods", requireAdmin, async (req, res) => {
  try {
    const foods = await db.select().from(foodsTable).orderBy(foodsTable.id);

    const headers = [
      "id",
      "name_ar",
      "name_en",
      "category",
      "status",
      "food_type",
      "parent_food_id",
      "reason",
      "notes",
      "is_exception",
      "created_at",
      "updated_at",
    ];

    const rows = foods.map((f) => [
      f.id,
      f.nameAr,
      f.nameEn,
      f.category,
      f.status,
      f.foodType,
      f.parentFoodId ?? "",
      f.reason ?? "",
      f.notes ?? "",
      f.isException ? "true" : "false",
      f.createdAt ? new Date(f.createdAt).toISOString() : "",
      f.updatedAt ? new Date(f.updatedAt).toISOString() : "",
    ]);

    const csvContent = buildCsv(headers, rows);
    const today = new Date().toISOString().slice(0, 10);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tayyibati_foods_${today}.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    req.log.error({ err }, "Failed to export foods CSV");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/export/users", requireAdmin, async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.id);
    const plans = await db.select().from(subscriptionPlansTable);
    const planMap = new Map(plans.map((p) => [p.id, p]));

    const currentMonth = new Date().toISOString().slice(0, 7);

    const headers = [
      "id",
      "email",
      "name",
      "provider",
      "is_premium",
      "plan_name",
      "monthly_text_count",
      "text_limit",
      "text_remaining",
      "monthly_image_count",
      "image_limit",
      "image_remaining",
      "created_at",
      "updated_at",
    ];

    const rows = await Promise.all(
      users.map(async (u) => {
        const [usageRow] = await db
          .select()
          .from(userUsageTable)
          .where(and(eq(userUsageTable.userId, u.id), eq(userUsageTable.date, currentMonth)));

        const limits = await getUserPlanLimits(u.id);
        const isPremium = u.isPremium === "true" || usageRow?.isPremium === "true";

        let planName = isPremium ? "بريميوم" : "مجاني";
        if (!isPremium && u.planId != null && planMap.has(u.planId)) {
          planName = planMap.get(u.planId)?.name || planName;
        }

        const monthlyTextCount = usageRow?.textCount ?? 0;
        const monthlyImageCount = usageRow?.imageCount ?? 0;
        const textLimit = limits.textLimit;
        const imageLimit = limits.imageLimit;
        const textRemaining = textLimit < 0 ? 9999 : Math.max(0, textLimit - monthlyTextCount);
        const imageRemaining = imageLimit < 0 ? 9999 : Math.max(0, imageLimit - monthlyImageCount);

        return [
          u.id,
          u.email,
          u.name ?? "",
          u.provider ?? "email",
          isPremium ? "true" : "false",
          planName,
          monthlyTextCount,
          textLimit < 0 ? "unlimited" : textLimit,
          textRemaining,
          monthlyImageCount,
          imageLimit < 0 ? "unlimited" : imageLimit,
          imageRemaining,
          u.createdAt ? new Date(u.createdAt).toISOString() : "",
          u.updatedAt ? new Date(u.updatedAt).toISOString() : "",
        ];
      })
    );

    const csvContent = buildCsv(headers, rows);
    const today = new Date().toISOString().slice(0, 10);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tayyibati_users_${today}.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    req.log.error({ err }, "Failed to export users CSV");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

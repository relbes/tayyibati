import { Router, type Request, type Response, type NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { analysisHistoryTable, userUsageTable, foodsTable, usersTable, subscriptionPlansTable, dishes, pendingKnowledgeReviewsTable, aiFoodKnowledgeCacheTable } from "@workspace/db";
import { desc, sql, count, avg, eq, and } from "drizzle-orm";
import { getUserPlanLimits } from "./analysis";

const router = Router();

function getAdminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? "admin123" : null);
}

function signToken(iat: number): string {
  const secret = (process.env.SESSION_SECRET || "dev-secret") + (getAdminPassword() || "");
  const payload = `admin:${iat}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers["authorization"];
  const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !verifyAdminToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function verifyAdminToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length !== 3 || parts[0] !== "admin") return false;
    const [, iat, sig] = parts;
    if (Date.now() - parseInt(iat) > 86400000 * 7) return false;
    const secret = (process.env.SESSION_SECRET || "dev-secret") + (getAdminPassword() || "");
    const expected = createHmac("sha256", secret).update(`admin:${iat}`).digest("hex");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}

router.post("/admin/login", (req, res) => {
  const { password } = req.body as { password?: string };
  const adminPassword = getAdminPassword();

  if (!adminPassword) {
    return void res.status(503).json({ error: "Admin password not configured. Set ADMIN_PASSWORD env var." });
  }
  if (!password) {
    return void res.status(400).json({ error: "Password required" });
  }

  const a = Buffer.from(password);
  const b = Buffer.from(adminPassword);
  const valid = a.length === b.length && timingSafeEqual(a, b);

  if (!valid) {
    return void res.status(401).json({ error: "كلمة المرور غير صحيحة" });
  }

  const token = signToken(Date.now());
  res.json({ token });
});

router.get("/admin/me", (req, res) => {
  const auth = req.headers["authorization"];
  const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !verifyAdminToken(token)) {
    return void res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ admin: true });
});

router.get("/admin/history", requireAdmin, async (req, res) => {
  try {
    const { limit = "50", offset = "0" } = req.query as Record<string, string>;

    const items = await db
      .select()
      .from(analysisHistoryTable)
      .orderBy(desc(analysisHistoryTable.createdAt))
      .limit(Math.min(parseInt(limit), 200))
      .offset(parseInt(offset));

    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list admin history");
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

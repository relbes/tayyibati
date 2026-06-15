import { Router } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { analysisHistoryTable, userUsageTable } from "@workspace/db";
import { desc, sql, count, avg } from "drizzle-orm";

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

router.get("/admin/history", async (req, res) => {
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

router.get("/admin/stats", async (req, res) => {
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
      .select({ totalUsers: sql<number>`cast(count(distinct ${userUsageTable.userId}) as int)` })
      .from(userUsageTable);

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

export default router;

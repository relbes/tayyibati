import { Router } from "express";
import { db } from "@workspace/db";
import { analysisHistoryTable, userUsageTable } from "@workspace/db";
import { desc, sql, count, avg } from "drizzle-orm";

const router = Router();

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

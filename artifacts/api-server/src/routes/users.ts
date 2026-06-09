import { Router } from "express";
import { db } from "@workspace/db";
import { userUsageTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const FREE_DAILY_LIMIT = 10;

const router = Router();

router.get("/users/usage", async (req, res) => {
  try {
    const { userId } = req.query as Record<string, string>;
    if (!userId) return void res.status(400).json({ error: "userId is required" });

    const today = new Date().toISOString().split("T")[0];
    const [row] = await db
      .select()
      .from(userUsageTable)
      .where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, today)));

    const isPremium = row?.isPremium === "true";
    const dailyCount = row?.count ?? 0;
    const dailyLimit = isPremium ? 9999 : FREE_DAILY_LIMIT;
    const remainingToday = Math.max(0, dailyLimit - dailyCount);

    res.json({ userId, dailyCount, dailyLimit, isPremium, remainingToday });
  } catch (err) {
    req.log.error({ err }, "Failed to get user usage");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

import { Router } from "express";
import { db } from "@workspace/db";
import { analysisHistoryTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/history", async (req, res) => {
  try {
    const { userId, limit = "20", offset = "0" } = req.query as Record<string, string>;
    if (!userId) return void res.status(400).json({ error: "userId required" });

    const items = await db
      .select()
      .from(analysisHistoryTable)
      .where(eq(analysisHistoryTable.userId, userId))
      .orderBy(desc(analysisHistoryTable.createdAt))
      .limit(Math.min(parseInt(limit), 100))
      .offset(parseInt(offset));

    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list history");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/history/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db
      .select()
      .from(analysisHistoryTable)
      .where(eq(analysisHistoryTable.id, id));
    if (!item) return void res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to get history item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/history/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(analysisHistoryTable).where(eq(analysisHistoryTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete history item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

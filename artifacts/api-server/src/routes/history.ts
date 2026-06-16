import { Router } from "express";
import { db } from "@workspace/db";
import { analysisHistoryTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/history", requireAuth, async (req, res) => {
  try {
    const { limit = "20", offset = "0" } = req.query as Record<string, string>;

    const items = await db
      .select()
      .from(analysisHistoryTable)
      .where(eq(analysisHistoryTable.userId, req.userId!))
      .orderBy(desc(analysisHistoryTable.createdAt))
      .limit(Math.min(parseInt(limit), 100))
      .offset(parseInt(offset));

    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list history");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/history/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [item] = await db
      .select()
      .from(analysisHistoryTable)
      .where(and(eq(analysisHistoryTable.id, id), eq(analysisHistoryTable.userId, req.userId!)));
    if (!item) return void res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to get history item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/history/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [deleted] = await db
      .delete(analysisHistoryTable)
      .where(and(eq(analysisHistoryTable.id, id), eq(analysisHistoryTable.userId, req.userId!)))
      .returning();
    if (!deleted) return void res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete history item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

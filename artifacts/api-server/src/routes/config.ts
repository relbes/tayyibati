import { Router } from "express";
import { db } from "@workspace/db";
import { appConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/config/public", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.isPublic, "true"));
    const config: Record<string, string> = {};
    for (const row of rows) config[row.key] = row.value;
    res.json(config);
  } catch (err) {
    req.log.error({ err }, "Failed to get public config");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/config", async (req, res) => {
  try {
    const rows = await db.select().from(appConfigTable);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get config");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/config/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const { value, isPublic } = req.body;
    if (value === undefined || value === null) {
      return void res.status(400).json({ error: "value is required" });
    }
    const publicFlag = isPublic === undefined ? undefined : isPublic === true || isPublic === "true" ? "true" : "false";
    const [existing] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, key));

    if (existing) {
      const [updated] = await db
        .update(appConfigTable)
        .set({ value: String(value), ...(publicFlag !== undefined ? { isPublic: publicFlag } : {}) })
        .where(eq(appConfigTable.key, key))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(appConfigTable)
        .values({ key, value: String(value), isPublic: publicFlag ?? "false" })
        .returning();
      res.status(201).json(created);
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update config");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

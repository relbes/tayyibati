import { Router } from "express";
import { db } from "@workspace/db";
import { foodsTable } from "@workspace/db";
import { eq, ilike, and, or, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.get("/foods/stats", async (req, res) => {
  try {
    const rows = await db
      .select({
        status: foodsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(foodsTable)
      .groupBy(foodsTable.status);

    const total = rows.reduce((sum, r) => sum + r.count, 0);
    const allowed = rows.find((r) => r.status === "allowed")?.count ?? 0;
    const forbidden = rows.find((r) => r.status === "forbidden")?.count ?? 0;
    const conditional = rows.find((r) => r.status === "conditional")?.count ?? 0;

    const catRows = await db
      .selectDistinct({ category: foodsTable.category })
      .from(foodsTable);

    res.json({ total, allowed, forbidden, conditional, categories: catRows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to get food stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/foods", async (req, res) => {
  try {
    const { search, status, category, limit = "50", offset = "0" } = req.query as Record<string, string>;

    const conditions = [];
    if (status) conditions.push(eq(foodsTable.status, status as any));
    if (category) conditions.push(eq(foodsTable.category, category));
    if (search) {
      conditions.push(
        or(
          ilike(foodsTable.nameAr, `%${search}%`),
          ilike(foodsTable.nameEn, `%${search}%`)
        )!
      );
    }

    const foods = await db
      .select()
      .from(foodsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(Math.min(parseInt(limit), 200))
      .offset(parseInt(offset));

    res.json(foods);
  } catch (err) {
    req.log.error({ err }, "Failed to list foods");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/foods/bulk", async (req, res) => {
  try {
    const { foods } = req.body as { foods: Array<{ nameAr: string; nameEn: string; category: string; status: string; reason?: string | null; notes?: string | null }> };
    if (!Array.isArray(foods) || foods.length === 0) {
      return res.status(400).json({ error: "foods array required" });
    }

    const errors: string[] = [];
    const valid: typeof foods = [];

    for (let i = 0; i < foods.length; i++) {
      const f = foods[i];
      if (!f.nameAr?.trim() || !f.nameEn?.trim() || !f.category?.trim()) {
        errors.push(`Row ${i + 1}: missing nameAr, nameEn, or category`);
        continue;
      }
      if (!["allowed", "forbidden", "conditional"].includes(f.status)) {
        errors.push(`Row ${i + 1}: status must be allowed, forbidden, or conditional`);
        continue;
      }
      valid.push(f);
    }

    let created = 0;
    if (valid.length > 0) {
      const inserted = await db
        .insert(foodsTable)
        .values(
          valid.map((f) => ({
            nameAr: f.nameAr.trim(),
            nameEn: f.nameEn.trim(),
            category: f.category.trim(),
            status: f.status as "allowed" | "forbidden" | "conditional",
            reason: f.reason?.trim() || null,
            notes: f.notes?.trim() || null,
          })),
        )
        .returning();
      created = inserted.length;
    }

    res.json({ created, skipped: errors.length, errors });
  } catch (err) {
    req.log.error({ err }, "Failed to bulk create foods");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/foods/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [food] = await db.select().from(foodsTable).where(eq(foodsTable.id, id));
    if (!food) return res.status(404).json({ error: "Not found" });
    res.json(food);
  } catch (err) {
    req.log.error({ err }, "Failed to get food");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/foods", async (req, res) => {
  try {
    const { nameAr, nameEn, category, status, reason, notes } = req.body;
    if (!nameAr || !nameEn || !category || !status) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const [food] = await db
      .insert(foodsTable)
      .values({ nameAr, nameEn, category, status, reason, notes })
      .returning();
    res.status(201).json(food);
  } catch (err) {
    req.log.error({ err }, "Failed to create food");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/foods/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nameAr, nameEn, category, status, reason, notes } = req.body;
    const updates: Record<string, unknown> = {};
    if (nameAr !== undefined) updates.nameAr = nameAr;
    if (nameEn !== undefined) updates.nameEn = nameEn;
    if (category !== undefined) updates.category = category;
    if (status !== undefined) updates.status = status;
    if (reason !== undefined) updates.reason = reason;
    if (notes !== undefined) updates.notes = notes;

    const [food] = await db
      .update(foodsTable)
      .set(updates)
      .where(eq(foodsTable.id, id))
      .returning();
    if (!food) return res.status(404).json({ error: "Not found" });
    res.json(food);
  } catch (err) {
    req.log.error({ err }, "Failed to update food");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/foods/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(foodsTable).where(eq(foodsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete food");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

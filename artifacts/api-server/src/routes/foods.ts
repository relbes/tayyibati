import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { foodsTable, usersTable } from "@workspace/db";
import { eq, ilike, and, or, sql, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAdmin } from "./admin";
import { requireAuth } from "../middleware/requireAuth";

import { getKnowledgeCache, normalizeName, stripArticle } from "../lib/knowledgeCache";
import { CanonicalSearchEngine, SearchMode } from "../lib/canonicalSearchEngine";

const router = Router();

// Category taxonomy translation helper
const CATEGORY_TRANSLATIONS: Record<string, { ar: string; en: string }> = {
  "لحوم": { ar: "لحوم", en: "Meat & Poultry" },
  "مأكولات بحرية": { ar: "مأكولات بحرية", en: "Seafood" },
  "ألبان": { ar: "ألبان", en: "Dairy" },
  "حبوب": { ar: "حبوب", en: "Grains" },
  "خضروات": { ar: "خضروات", en: "Vegetables" },
  "فواكه": { ar: "فواكه", en: "Fruits" },
  "بقوليات": { ar: "بقوليات", en: "Legumes" },
  "مكسرات وبذور": { ar: "مكسرات وبذور", en: "Nuts & Seeds" },
  "زيوت": { ar: "زيوت", en: "Oils" },
  "دهون": { ar: "دهون", en: "Fats" },
  "مشروبات": { ar: "مشروبات", en: "Beverages" },
  "إضافات": { ar: "إضافات", en: "Additives" },
  "توابل": { ar: "توابل", en: "Spices" },
  "صلصات": { ar: "صلصات", en: "Sauces" },
  "أعشاب": { ar: "أعشاب", en: "Herbs" },
  "حلويات": { ar: "حلويات", en: "Sweets" },
  "محليات": { ar: "محليات", en: "Sweeteners" },
  "نكهات": { ar: "نكهات", en: "Flavors" },
  "بروتين": { ar: "بروتين", en: "Protein" },
  "أخرى": { ar: "أخرى", en: "Other" },
  "مواد كيميائية": { ar: "مواد كيميائية", en: "Chemicals" },
  "ألوان": { ar: "ألوان", en: "Colorings" },
};

let cachedFreeBrowsePayload: any = null;
let cachedPremiumBrowsePayload: any = null;
let lastCacheFoodCount = -1;

function getBrowseCatalogPayloads(allFoods: any[]) {
  if (
    cachedFreeBrowsePayload &&
    cachedPremiumBrowsePayload &&
    lastCacheFoodCount === allFoods.length
  ) {
    return { freePayload: cachedFreeBrowsePayload, premiumPayload: cachedPremiumBrowsePayload };
  }

  const FREE_APPROVED_CATEGORIES = ["خضروات", "فواكه", "حبوب"];

  // 1. FREE Payload (3 categories x 10 foods)
  const freeCategories: any[] = [];
  for (const catName of FREE_APPROVED_CATEGORIES) {
    const catFoods = allFoods
      .filter((f) => f.category === catName)
      .sort((a, b) => a.id - b.id)
      .slice(0, 10);

    const trans = CATEGORY_TRANSLATIONS[catName] || { ar: catName, en: catName };
    freeCategories.push({
      categoryKey: catName,
      nameAr: trans.ar,
      nameEn: trans.en,
      foods: catFoods.map((f) => ({
        id: f.id,
        nameAr: f.nameAr,
        nameEn: f.nameEn,
        status: f.status,
      })),
    });
  }

  cachedFreeBrowsePayload = {
    isPremium: false,
    totalCategories: freeCategories.length,
    totalFoods: freeCategories.reduce((sum, c) => sum + c.foods.length, 0),
    totalDatabase: allFoods.length,
    categories: freeCategories,
  };

  // 2. PREMIUM Payload (All DB categories)
  const groupedMap = new Map<string, any[]>();
  for (const f of allFoods) {
    const catName = f.category?.trim() || "أخرى";
    if (!groupedMap.has(catName)) groupedMap.set(catName, []);
    groupedMap.get(catName)!.push(f);
  }

  const premiumCategories: any[] = [];
  for (const [catName, catFoods] of groupedMap.entries()) {
    const sortedFoods = [...catFoods].sort((a, b) => a.id - b.id);
    const trans = CATEGORY_TRANSLATIONS[catName] || { ar: catName, en: catName };

    premiumCategories.push({
      categoryKey: catName,
      nameAr: trans.ar,
      nameEn: trans.en,
      foods: sortedFoods.map((f) => ({
        id: f.id,
        nameAr: f.nameAr,
        nameEn: f.nameEn,
        status: f.status,
      })),
    });
  }

  cachedPremiumBrowsePayload = {
    isPremium: true,
    totalCategories: premiumCategories.length,
    totalFoods: premiumCategories.reduce((sum, c) => sum + c.foods.length, 0),
    totalDatabase: allFoods.length,
    categories: premiumCategories,
  };

  lastCacheFoodCount = allFoods.length;
  return { freePayload: cachedFreeBrowsePayload, premiumPayload: cachedPremiumBrowsePayload };
}

router.get("/foods/browse", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return void res.status(401).json({ error: "Authentication required" });
    }

    // 1. Check User Premium Status from DB
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const isPremium = String(user?.isPremium) === "true" || (user as any)?.isPremium === true;

    // 2. Serve from server-side memory catalog cache
    const cache = await getKnowledgeCache();
    const { freePayload, premiumPayload } = getBrowseCatalogPayloads(cache.foods || []);

    res.json(isPremium ? premiumPayload : freePayload);
  } catch (err) {
    req.log.error({ err }, "Failed to browse foods");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/foods/autocomplete", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 2) {
      return void res.json({ suggestions: [], searchOutcome: "NOT_FOUND" });
    }

    const searchRes = await CanonicalSearchEngine.search(q, { mode: SearchMode.AUTOCOMPLETE });

    const suggestions: Array<{
      labelAr: string;
      labelEn: string;
      query: string;
      entityType: string;
      canonicalId: number | string;
    }> = [];

    if (searchRes.searchOutcome === "FOUND") {
      suggestions.push({
        labelAr: searchRes.canonicalName,
        labelEn: searchRes.canonicalName,
        query: searchRes.canonicalName,
        entityType: searchRes.canonicalEntityType,
        canonicalId: searchRes.canonicalId,
      });
    } else if (searchRes.searchOutcome === "AMBIGUOUS" && searchRes.candidateDishes) {
      for (const cand of searchRes.candidateDishes) {
        suggestions.push({
          labelAr: cand.canonicalName,
          labelEn: cand.canonicalName,
          query: cand.canonicalName,
          entityType: cand.canonicalEntityType,
          canonicalId: cand.canonicalId,
        });
      }
    }

    // Deduplicate suggestions by labelAr & entityType
    const seen = new Set<string>();
    const uniqueSuggestions = suggestions.filter((s) => {
      const key = `${s.entityType}:${s.canonicalId}:${s.labelAr}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return void res.json({
      searchOutcome: searchRes.searchOutcome,
      suggestions: uniqueSuggestions,
    });
  } catch (err) {
    console.error("[AUTOCOMPLETE API ERROR]", err);
    req.log.error({ err }, "Autocomplete failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

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

router.post("/foods/bulk", requireAdmin, async (req, res) => {
  try {
    const { foods } = req.body as { foods: Array<{ nameAr: string; nameEn: string; category: string; status: string; reason?: string | null; notes?: string | null }> };
    if (!Array.isArray(foods) || foods.length === 0) {
      return void res.status(400).json({ error: "foods array required" });
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

router.delete("/foods/bulk", requireAdmin, async (req, res) => {
  try {
    const { ids, status } = req.body as { ids?: number[]; status?: string };

    if (status) {
      if (!["allowed", "forbidden", "conditional"].includes(status)) {
        return void res.status(400).json({ error: "Invalid status" });
      }
      const deleted = await db
        .delete(foodsTable)
        .where(eq(foodsTable.status, status as any))
        .returning({ id: foodsTable.id });
      return void res.json({ deleted: deleted.length });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return void res.status(400).json({ error: "Provide ids array or status string" });
    }

    const deleted = await db
      .delete(foodsTable)
      .where(inArray(foodsTable.id, ids))
      .returning({ id: foodsTable.id });

    res.json({ deleted: deleted.length });
  } catch (err) {
    req.log.error({ err }, "Failed to bulk delete foods");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/foods/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [food] = await db.select().from(foodsTable).where(eq(foodsTable.id, id));
    if (!food) return void res.status(404).json({ error: "Not found" });
    res.json(food);
  } catch (err) {
    req.log.error({ err }, "Failed to get food");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/foods", requireAdmin, async (req, res) => {
  try {
    const { nameAr, nameEn, category, status, reason, notes } = req.body;
    if (!nameAr || !nameEn || !category || !status) {
      return void res.status(400).json({ error: "Missing required fields" });
    }

    const trimmedAr = String(nameAr).trim();
    const trimmedEn = String(nameEn).trim();
    const normInput = normalizeName(trimmedAr);

    const allFoods = await db.select({ id: foodsTable.id, nameAr: foodsTable.nameAr }).from(foodsTable);
    const isDuplicate = allFoods.some((f) => normalizeName(f.nameAr) === normInput);

    if (isDuplicate) {
      return void res.status(409).json({
        error: "food_already_exists",
        message: "This food already exists in the database.",
        messageAr: "هذا الطعام موجود بالفعل في قاعدة البيانات.",
      });
    }

    const [food] = await db
      .insert(foodsTable)
      .values({
        nameAr: trimmedAr,
        nameEn: trimmedEn,
        category: String(category).trim(),
        status,
        reason: reason ? String(reason).trim() : null,
        notes: notes ? String(notes).trim() : null,
      })
      .returning();
    res.status(201).json(food);
  } catch (err) {
    req.log.error({ err }, "Failed to create food");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/foods/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
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
    if (!food) return void res.status(404).json({ error: "Not found" });
    res.json(food);
  } catch (err) {
    req.log.error({ err }, "Failed to update food");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/foods/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(foodsTable).where(eq(foodsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete food");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

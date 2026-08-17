import { Router } from "express";
import { db, dishes, dishIngredients, foodsTable } from "@workspace/db";
import { eq, ilike, or, desc, sql } from "drizzle-orm";
import { requireAdmin } from "./admin";

const router = Router();

// GET /api/dishes - List dishes with search, category, and pagination
router.get("/dishes", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const pageSize = Math.max(1, Math.min(200, parseInt(String(req.query.pageSize || "50"), 10) || 50));
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";

    let conditions: any[] = [];
    if (search) {
      conditions.push(
        or(
          ilike(dishes.nameAr, `%${search}%`),
          ilike(dishes.nameEn, `%${search}%`),
          ilike(dishes.description, `%${search}%`)
        )
      );
    }
    if (category && category !== "all") {
      conditions.push(eq(dishes.category, category));
    }

    const whereClause = conditions.length > 0
      ? (conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`)
      : undefined;

    const allDishes = await db
      .select()
      .from(dishes)
      .where(whereClause)
      .orderBy(desc(dishes.createdAt));

    const totalItems = allDishes.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedDishes = allDishes.slice(startIndex, startIndex + pageSize);

    // Fetch ingredients for these dishes
    const dishIds = paginatedDishes.map((d) => d.id);
    let ingredientsMap = new Map<number, any[]>();
    if (dishIds.length > 0) {
      const ingRows = await db
        .select()
        .from(dishIngredients);
      for (const ing of ingRows) {
        if (dishIds.includes(ing.dishId)) {
          const list = ingredientsMap.get(ing.dishId) || [];
          list.push(ing);
          ingredientsMap.set(ing.dishId, list);
        }
      }
    }

    const items = paginatedDishes.map((d) => {
      const ings = ingredientsMap.get(d.id) || [];
      const ingredientNames = ings.map((i) => i.rawIngredientName).join(", ");
      return {
        ...d,
        ingredients: ings,
        ingredientNames,
        compatibility: "مسموح",
        status: "active",
      };
    });

    res.json({
      success: true,
      page: currentPage,
      pageSize,
      totalItems,
      totalPages,
      items,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch dishes" });
  }
});

// GET /api/dishes/:id
router.get("/dishes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid dish ID" });

    const [dish] = await db.select().from(dishes).where(eq(dishes.id, id)).limit(1);
    if (!dish) return res.status(404).json({ error: "Dish not found" });

    const ings = await db.select().from(dishIngredients).where(eq(dishIngredients.dishId, id));

    res.json({ success: true, dish: { ...dish, ingredients: ings } });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to fetch dish" });
  }
});

// POST /api/dishes - Create new dish (Admin)
router.post("/dishes", requireAdmin, async (req, res) => {
  try {
    const { nameAr, nameEn, category, description, ingredientNames } = req.body || {};
    if (!nameAr || typeof nameAr !== "string") {
      return res.status(400).json({ error: "Arabic name is required" });
    }

    const [created] = await db
      .insert(dishes)
      .values({
        nameAr: nameAr.trim(),
        nameEn: nameEn ? String(nameEn).trim() : null,
        category: category ? String(category).trim() : "main_dish",
        description: description ? String(description).trim() : null,
      })
      .returning();

    if (ingredientNames) {
      const list = Array.isArray(ingredientNames)
        ? ingredientNames
        : String(ingredientNames).split(",").map((s) => s.trim()).filter(Boolean);

      for (const rawName of list) {
        if (rawName) {
          await db.insert(dishIngredients).values({
            dishId: created.id,
            rawIngredientName: rawName,
            requirementType: "required",
            confidence: "HIGH",
          });
        }
      }
    }

    res.status(201).json({ success: true, dish: created });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to create dish" });
  }
});

// PUT /api/dishes/:id - Update dish (Admin)
router.put("/dishes/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid dish ID" });

    const { nameAr, nameEn, category, description, ingredientNames } = req.body || {};
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (nameAr) updates.nameAr = String(nameAr).trim();
    if (nameEn !== undefined) updates.nameEn = nameEn ? String(nameEn).trim() : null;
    if (category) updates.category = String(category).trim();
    if (description !== undefined) updates.description = description ? String(description).trim() : null;

    const [updated] = await db
      .update(dishes)
      .set(updates)
      .where(eq(dishes.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Dish not found" });

    if (ingredientNames !== undefined) {
      await db.delete(dishIngredients).where(eq(dishIngredients.dishId, id));
      const list = Array.isArray(ingredientNames)
        ? ingredientNames
        : String(ingredientNames).split(",").map((s) => s.trim()).filter(Boolean);

      for (const rawName of list) {
        if (rawName) {
          await db.insert(dishIngredients).values({
            dishId: id,
            rawIngredientName: rawName,
            requirementType: "required",
            confidence: "HIGH",
          });
        }
      }
    }

    res.json({ success: true, dish: updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to update dish" });
  }
});

// DELETE /api/dishes/:id - Delete dish (Admin)
router.delete("/dishes/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid dish ID" });

    await db.delete(dishes).where(eq(dishes.id, id));
    res.json({ success: true, message: "Dish deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to delete dish" });
  }
});

export default router;

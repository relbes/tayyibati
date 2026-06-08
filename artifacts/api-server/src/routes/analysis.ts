import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { foodsTable, analysisHistoryTable, userUsageTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const FREE_DAILY_LIMIT = 10;

async function checkAndIncrementUsage(userId: string): Promise<{ allowed: boolean; dailyCount: number }> {
  const today = new Date().toISOString().split("T")[0];

  const existing = await db
    .select()
    .from(userUsageTable)
    .where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, today)));

  if (existing.length === 0) {
    await db.insert(userUsageTable).values({ userId, date: today, count: 1, isPremium: "false" });
    return { allowed: true, dailyCount: 1 };
  }

  const row = existing[0];
  if (row.isPremium === "true") {
    await db.update(userUsageTable).set({ count: row.count + 1 }).where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, today)));
    return { allowed: true, dailyCount: row.count + 1 };
  }

  if (row.count >= FREE_DAILY_LIMIT) {
    return { allowed: false, dailyCount: row.count };
  }

  await db.update(userUsageTable).set({ count: row.count + 1 }).where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, today)));
  return { allowed: true, dailyCount: row.count + 1 };
}

interface IngredientResult {
  name: string;
  nameAr: string;
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  reason: string | null;
}

async function lookupIngredients(ingredients: string[]): Promise<{
  allowed: IngredientResult[];
  forbidden: IngredientResult[];
  conditional: IngredientResult[];
  unknown: IngredientResult[];
  score: number;
}> {
  const allFoods = await db.select().from(foodsTable);

  const allowed: IngredientResult[] = [];
  const forbidden: IngredientResult[] = [];
  const conditional: IngredientResult[] = [];
  const unknown: IngredientResult[] = [];

  for (const ingredient of ingredients) {
    const cleaned = ingredient.trim().toLowerCase();
    const match = allFoods.find(
      (f) =>
        f.nameEn.toLowerCase() === cleaned ||
        f.nameAr === cleaned ||
        f.nameEn.toLowerCase().includes(cleaned) ||
        cleaned.includes(f.nameEn.toLowerCase())
    );

    if (!match) {
      unknown.push({ name: ingredient, nameAr: ingredient, status: "unknown", reason: null });
    } else if (match.status === "allowed") {
      allowed.push({ name: match.nameEn, nameAr: match.nameAr, status: "allowed", reason: match.reason ?? null });
    } else if (match.status === "forbidden") {
      forbidden.push({ name: match.nameEn, nameAr: match.nameAr, status: "forbidden", reason: match.reason ?? null });
    } else {
      conditional.push({ name: match.nameEn, nameAr: match.nameAr, status: "conditional", reason: match.reason ?? null });
    }
  }

  const total = ingredients.length;

  let score = 100;
  if (total > 0) {
    const forbiddenPenalty = (forbidden.length / total) * 100;
    const conditionalPenalty = (conditional.length / total) * 30;
    const unknownPenalty = (unknown.length / total) * 10;
    score = Math.max(0, Math.round(100 - forbiddenPenalty - conditionalPenalty - unknownPenalty));
    if (forbidden.length > 0) score = Math.min(score, 30);
  }

  return { allowed, forbidden, conditional, unknown, score };
}

router.post("/analysis/text", async (req, res) => {
  try {
    const { query, userId } = req.body as { query: string; userId?: string | null };
    if (!query) return res.status(400).json({ error: "query is required" });

    const systemPrompt = `You are a food ingredient extractor. Given a food name, meal description, or product, extract ALL ingredients as a JSON object with key "ingredients" containing an array of English ingredient name strings.
Rules:
- Extract only ingredient names, no quantities or measurements
- Be thorough and include all possible sub-ingredients
- Respond ONLY with JSON like: {"ingredients": ["ingredient1", "ingredient2"]}
- If you cannot extract ingredients, return {"ingredients": []}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    let ingredients: string[] = [];
    try {
      const parsed = JSON.parse(completion.choices[0].message.content || "{}");
      ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
    } catch {
      ingredients = [];
    }

    const { allowed, forbidden, conditional, unknown, score } = await lookupIngredients(ingredients);

    const explanationParts: string[] = [];
    if (forbidden.length > 0) {
      explanationParts.push(`تحتوي على مكونات محظورة: ${forbidden.map((f) => f.nameAr).join("، ")}`);
    }
    if (conditional.length > 0) {
      explanationParts.push(`تحتوي على مكونات مشروطة: ${conditional.map((f) => f.nameAr).join("، ")}`);
    }
    if (unknown.length > 0) {
      explanationParts.push(`مكونات غير موجودة في قاعدة البيانات: ${unknown.slice(0, 3).map((f) => f.name).join("، ")}${unknown.length > 3 ? "..." : ""}`);
    }
    if (forbidden.length === 0 && conditional.length === 0) {
      explanationParts.push("جميع المكونات المعروفة مسموح بها");
    }

    const suggestions = forbidden.map((f) => `استبدل ${f.nameAr} ببديل مسموح به من قاعدة بيانات طيبات`);

    const report = {
      query,
      compatibilityScore: score,
      allowed,
      forbidden,
      conditional,
      unknown,
      explanation: explanationParts.join(". ") || "تم تحليل المكونات",
      suggestions,
      analysisType: "text" as const,
    };

    if (userId) {
      await db.insert(analysisHistoryTable).values({
        userId,
        query,
        analysisType: "text",
        compatibilityScore: score,
        report,
      }).catch((err) => req.log.warn({ err }, "Failed to save history"));
    }

    res.json(report);
  } catch (err) {
    req.log.error({ err }, "Failed to analyze text");
    res.status(500).json({ error: "Analysis failed" });
  }
});

router.post("/analysis/image", async (req, res) => {
  try {
    const { imageBase64, mimeType, userId, analysisType } = req.body as {
      imageBase64: string;
      mimeType: string;
      userId?: string | null;
      analysisType: "food" | "label";
    };
    if (!imageBase64 || !mimeType) return res.status(400).json({ error: "imageBase64 and mimeType required" });

    const isLabel = analysisType === "label";
    const systemPrompt = isLabel
      ? `You are a food label OCR expert. Extract the ingredients list from the product label image. Return a JSON object: {"ingredients": ["ingredient1", "ingredient2"]}. Extract only ingredient names in English, no additive codes or quantities.`
      : `You are a food recognition expert. Identify all visible food items and their likely ingredients from the image. Return JSON: {"ingredients": ["ingredient1", "ingredient2"]}. Be thorough.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            {
              type: "text",
              text: isLabel ? "Extract all ingredients from this product label." : "What food items and ingredients do you see?",
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    let ingredients: string[] = [];
    try {
      const parsed = JSON.parse(completion.choices[0].message.content || "{}");
      ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
    } catch {
      ingredients = [];
    }

    const query = isLabel ? "مسح ملصق المنتج" : "تحليل صورة الطعام";
    const { allowed, forbidden, conditional, unknown, score } = await lookupIngredients(ingredients);

    const explanationParts: string[] = [];
    if (forbidden.length > 0) {
      explanationParts.push(`تحتوي على مكونات محظورة: ${forbidden.map((f) => f.nameAr).join("، ")}`);
    }
    if (conditional.length > 0) {
      explanationParts.push(`تحتوي على مكونات مشروطة`);
    }
    if (forbidden.length === 0 && conditional.length === 0) {
      explanationParts.push("جميع المكونات المعروفة مسموح بها");
    }

    const report = {
      query,
      compatibilityScore: score,
      allowed,
      forbidden,
      conditional,
      unknown,
      explanation: explanationParts.join(". ") || "تم تحليل الصورة",
      suggestions: forbidden.map((f) => `استبدل ${f.nameAr} ببديل مسموح به`),
      analysisType: isLabel ? ("label" as const) : ("image" as const),
    };

    if (userId) {
      await db.insert(analysisHistoryTable).values({
        userId,
        query,
        analysisType: isLabel ? "label" : "image",
        compatibilityScore: score,
        report,
      }).catch((err) => req.log.warn({ err }, "Failed to save history"));
    }

    res.json(report);
  } catch (err) {
    req.log.error({ err }, "Failed to analyze image");
    res.status(500).json({ error: "Image analysis failed" });
  }
});

export default router;

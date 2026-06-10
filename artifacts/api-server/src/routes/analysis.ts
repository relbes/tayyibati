import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { foodsTable, analysisHistoryTable, userUsageTable, appConfigTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

async function getOpenAIClient(): Promise<OpenAI> {
  try {
    const [row] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "openai_api_key"));
    const key = row?.value?.trim();
    if (key && key.length > 10) {
      return new OpenAI({ apiKey: key });
    }
  } catch {
    // fall through to env var
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

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

interface AnalysisReport {
  query: string;
  compatibilityScore: number;
  allowed: IngredientResult[];
  forbidden: IngredientResult[];
  conditional: IngredientResult[];
  unknown: IngredientResult[];
  explanation: string;
  suggestions: string[];
  analysisType: "text" | "image" | "label";
}

type FoodRow = typeof foodsTable.$inferSelect;

function buildCatalog(foods: FoodRow[]): string {
  return foods
    .map((f) => `${f.id}|${f.nameEn}|${f.nameAr}|${f.status}`)
    .join("\n");
}

function scoreFromResults(
  allowed: IngredientResult[],
  forbidden: IngredientResult[],
  conditional: IngredientResult[],
  unknown: IngredientResult[],
): number {
  const total = allowed.length + forbidden.length + conditional.length + unknown.length;
  if (total === 0) return 100;
  const forbiddenPenalty = (forbidden.length / total) * 100;
  const conditionalPenalty = (conditional.length / total) * 30;
  const unknownPenalty = (unknown.length / total) * 10;
  let score = Math.max(0, Math.round(100 - forbiddenPenalty - conditionalPenalty - unknownPenalty));
  if (forbidden.length > 0) score = Math.min(score, 30);
  return score;
}

function buildReport(
  foods: FoodRow[],
  matchedIds: number[],
  additionalFlags: string[],
  query: string,
  analysisType: AnalysisReport["analysisType"],
): AnalysisReport {
  const allowed: IngredientResult[] = [];
  const forbidden: IngredientResult[] = [];
  const conditional: IngredientResult[] = [];
  const unknown: IngredientResult[] = [];

  const foodMap = new Map(foods.map((f) => [f.id, f]));

  for (const id of matchedIds) {
    const f = foodMap.get(id);
    if (!f) continue;
    const item: IngredientResult = {
      name: f.nameEn,
      nameAr: f.nameAr,
      status: f.status as IngredientResult["status"],
      reason: f.reason ?? null,
    };
    if (f.status === "allowed") allowed.push(item);
    else if (f.status === "forbidden") forbidden.push(item);
    else conditional.push(item);
  }

  for (const flag of additionalFlags) {
    unknown.push({ name: flag, nameAr: flag, status: "unknown", reason: null });
  }

  const score = scoreFromResults(allowed, forbidden, conditional, unknown);

  const explanationParts: string[] = [];
  if (forbidden.length > 0) {
    explanationParts.push(`تحتوي على مكونات محظورة: ${forbidden.map((f) => f.nameAr).join("، ")}`);
  }
  if (conditional.length > 0) {
    explanationParts.push(`تحتوي على مكونات مشروطة: ${conditional.map((f) => f.nameAr).join("، ")}`);
  }
  if (unknown.length > 0) {
    explanationParts.push(`مكونات تحتاج تحقق: ${unknown.slice(0, 3).map((f) => f.name).join("، ")}${unknown.length > 3 ? "..." : ""}`);
  }
  if (forbidden.length === 0 && conditional.length === 0 && (allowed.length > 0 || unknown.length === 0)) {
    explanationParts.push("جميع المكونات المعروفة مسموح بها");
  }

  const suggestions = forbidden.map((f) => `استبدل ${f.nameAr} ببديل مسموح به من قاعدة بيانات طيبات`);

  return {
    query,
    compatibilityScore: score,
    allowed,
    forbidden,
    conditional,
    unknown,
    explanation: explanationParts.join(". ") || "تم تحليل المكونات",
    suggestions,
    analysisType,
  };
}

/**
 * Smart text analysis: one AI call that understands user intent AND maps to DB food IDs.
 * The AI receives the full food catalog so it can match semantically, not just by keyword.
 */
async function analyzeTextWithIntent(query: string, allFoods: FoodRow[]): Promise<{ matchedIds: number[]; additionalFlags: string[] }> {
  const catalog = buildCatalog(allFoods);

  const systemPrompt = `You are a halal food compliance expert with deep knowledge of Islamic dietary laws (Tayyibat system).

Your task:
1. Understand what the user is asking about — it could be a dish name, brand name, ingredient, product, or meal in ANY language (Arabic, English, or mixed).
2. Think about ALL the ingredients that would typically be found in that food/product/dish.
3. From the provided food database, identify which food IDs are relevant — match by concept, not just exact name. For example:
   - "كنتاكي" → includes chicken, flour, oil, spices, etc.
   - "KFC" → same as above
   - "بيتزا" → flour, cheese, tomato sauce, yeast, etc.
   - "هوت دوج" → pork sausage or beef sausage, bread, etc.
   - "جيلاتين" → gelatin
   - A brand name → think about its typical ingredients
4. Also list any ingredients you know are in this food that are NOT in the database but may be of halal concern (like specific additives, E-numbers, or animal-derived ingredients not listed).

Food database (format: ID|English name|Arabic name|status):
${catalog}

Respond ONLY with valid JSON in this exact format:
{
  "matchedIds": [1, 2, 3],
  "additionalFlags": ["ingredient not in db that may be concern"]
}

Rules:
- matchedIds must only contain integer IDs from the database above
- Be thorough — if a dish contains an ingredient that's in the DB, include it
- additionalFlags should only contain ingredients with genuine halal concern
- If the query is vague or unrecognizable, return empty arrays`;

  const openai = await getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ],
    response_format: { type: "json_object" },
    max_tokens: 600,
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message.content || "{}");
    const matchedIds: number[] = Array.isArray(parsed.matchedIds)
      ? parsed.matchedIds.filter((id: unknown) => typeof id === "number")
      : [];
    const additionalFlags: string[] = Array.isArray(parsed.additionalFlags)
      ? parsed.additionalFlags.filter((s: unknown) => typeof s === "string").slice(0, 10)
      : [];
    return { matchedIds, additionalFlags };
  } catch {
    return { matchedIds: [], additionalFlags: [] };
  }
}

/**
 * Smart ingredient-to-DB mapping: given extracted ingredient strings (from image OCR/vision),
 * maps them semantically to DB food IDs using AI rather than naive string matching.
 */
async function mapIngredientsToIds(ingredients: string[], allFoods: FoodRow[]): Promise<{ matchedIds: number[]; additionalFlags: string[] }> {
  if (ingredients.length === 0) return { matchedIds: [], additionalFlags: [] };

  const catalog = buildCatalog(allFoods);

  const systemPrompt = `You are a halal food compliance expert. 
Given a list of extracted ingredients, map each one to the best matching entry in the food database.
Match semantically — "monosodium glutamate" matches "MSG", "beef fat" matches "beef", "pork gelatin" matches "gelatin" AND "pork", etc.

Food database (format: ID|English name|Arabic name|status):
${catalog}

Respond ONLY with valid JSON:
{
  "matchedIds": [1, 2, 3],
  "additionalFlags": ["ingredient of halal concern not found in db"]
}

Rules:
- matchedIds must only contain integer IDs from the database
- For each ingredient, find ALL relevant DB entries (e.g., "pork gelatin" → both pork ID and gelatin ID)
- additionalFlags: ingredients with halal concern that have NO match in the DB
- Do NOT include benign ingredients (salt, water, sugar, common spices) in additionalFlags unless they're genuinely concerning`;

  const openai = await getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Ingredients to map:\n${ingredients.join("\n")}` },
    ],
    response_format: { type: "json_object" },
    max_tokens: 600,
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message.content || "{}");
    const matchedIds: number[] = Array.isArray(parsed.matchedIds)
      ? parsed.matchedIds.filter((id: unknown) => typeof id === "number")
      : [];
    const additionalFlags: string[] = Array.isArray(parsed.additionalFlags)
      ? parsed.additionalFlags.filter((s: unknown) => typeof s === "string").slice(0, 10)
      : [];
    return { matchedIds, additionalFlags };
  } catch {
    return { matchedIds: [], additionalFlags: [] };
  }
}

router.post("/analysis/text", async (req, res) => {
  try {
    const { query, userId } = req.body as { query: string; userId?: string | null };
    if (!query) return void res.status(400).json({ error: "query is required" });

    const allFoods = await db.select().from(foodsTable);
    const { matchedIds, additionalFlags } = await analyzeTextWithIntent(query, allFoods);

    const report = buildReport(allFoods, matchedIds, additionalFlags, query, "text");

    if (userId) {
      await db.insert(analysisHistoryTable).values({
        userId,
        query,
        analysisType: "text",
        compatibilityScore: report.compatibilityScore,
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
    if (!imageBase64 || !mimeType) return void res.status(400).json({ error: "imageBase64 and mimeType required" });

    const isLabel = analysisType === "label";

    // Step 1: Extract raw ingredients from the image via vision
    const visionPrompt = isLabel
      ? `You are a food label OCR expert. Extract the complete ingredients list from this product label image.
Return JSON: {"ingredients": ["ingredient1", "ingredient2"]}
Rules: Extract only ingredient names in English. No additive codes (E-numbers are ok as names like "sodium benzoate"). No quantities.`
      : `You are a food recognition expert. Identify all visible food items and their likely ingredients from this image.
Return JSON: {"ingredients": ["ingredient1", "ingredient2"]}
Be thorough — include the main foods and their key ingredients.`;

    const visionCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: visionPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            {
              type: "text",
              text: isLabel
                ? "Extract all ingredients from this product label."
                : "What food items and ingredients do you see in this image?",
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    let extractedIngredients: string[] = [];
    try {
      const parsed = JSON.parse(visionCompletion.choices[0].message.content || "{}");
      extractedIngredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
    } catch {
      extractedIngredients = [];
    }

    // Step 2: Smart semantic mapping to DB food IDs
    const allFoods = await db.select().from(foodsTable);
    const { matchedIds, additionalFlags } = await mapIngredientsToIds(extractedIngredients, allFoods);

    const query = isLabel ? "مسح ملصق المنتج" : "تحليل صورة الطعام";
    const report = buildReport(allFoods, matchedIds, additionalFlags, query, isLabel ? "label" : "image");

    if (userId) {
      await db.insert(analysisHistoryTable).values({
        userId,
        query,
        analysisType: isLabel ? "label" : "image",
        compatibilityScore: report.compatibilityScore,
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

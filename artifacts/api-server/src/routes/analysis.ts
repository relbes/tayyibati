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
    if (key && key.length > 10) return new OpenAI({ apiKey: key });
  } catch {
    // fall through
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function getFreeDailyLimit(): Promise<number> {
  try {
    const [row] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "free_daily_limit"));
    const val = parseInt(row?.value ?? "10", 10);
    return isNaN(val) ? 10 : val;
  } catch {
    return 10;
  }
}

async function checkAndIncrementUsage(userId: string): Promise<{ allowed: boolean; dailyCount: number }> {
  const today = new Date().toISOString().split("T")[0];
  const limit = await getFreeDailyLimit();

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

  if (row.count >= limit) return { allowed: false, dailyCount: row.count };

  await db.update(userUsageTable).set({ count: row.count + 1 }).where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, today)));
  return { allowed: true, dailyCount: row.count + 1 };
}

export interface IngredientResult {
  name: string;
  nameAr: string;
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  reason: string | null;
}

export interface AnalysisReport {
  query: string;
  compatibilityScore: number;
  allowed: IngredientResult[];
  forbidden: IngredientResult[];
  conditional: IngredientResult[];
  unknown: IngredientResult[];
  explanation: string;
  suggestions: string[];
  analysisType: "text" | "image" | "label";
  notFound?: boolean;
}

type FoodRow = typeof foodsTable.$inferSelect;

function buildCatalog(foods: FoodRow[]): string {
  return foods.map((f) => `${f.id}|${f.nameEn}|${f.nameAr}|${f.status}`).join("\n");
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

function buildNotFoundReport(query: string, analysisType: AnalysisReport["analysisType"]): AnalysisReport {
  return {
    query,
    compatibilityScore: 0,
    allowed: [],
    forbidden: [],
    conditional: [],
    unknown: [],
    explanation: "لم يتم التعرف على هذا البحث في قاعدة بيانات طيبات.",
    suggestions: [],
    analysisType,
    notFound: true,
  };
}

/**
 * Analyzes a text query with semantic Arabic-aware AI matching.
 * Returns notFound=true if the AI cannot identify this as a food item.
 */
async function analyzeTextWithIntent(
  query: string,
  allFoods: FoodRow[],
): Promise<{ matchedIds: number[]; additionalFlags: string[]; recognized: boolean }> {
  const catalog = buildCatalog(allFoods);

  const systemPrompt = `You are a halal food compliance expert specializing in the Tayyibat dietary system with deep knowledge of Arabic food culture, dialects, and terminology.

TASK: Identify which foods/ingredients in the provided database are present in or implied by the user's query.

═══ ARABIC LANGUAGE HANDLING (CRITICAL) ═══

The query may use ANY Arabic dialect or spelling. You MUST handle:

1. SPELLING NORMALIZATION (treat these as identical):
   • Hamza variants: أ / إ / آ / ا → same letter
   • Ta marbuta: ة / ه → same ending  
   • Alef maqsura: ى / ي → same letter
   • Ignore all tashkeel (harakat/diacritics)
   • "جيلاتين" = "جلاتين" = "جيلاتين" (gelatin)
   • "كيتشب" = "كاتشب" = "كيتشاب" (ketchup)

2. ARABIC DIALECT AWARENESS:
   • Gulf/Saudi: فروج = دجاج (chicken), حلوف = خنزير (pork)
   • Egyptian: عيش = خبز (bread), بطاطس (potatoes)
   • Levantine: بندورة = طماطم (tomato), شنكليش (cheese)
   • All dialects are valid — do NOT reject a query for using dialect terms

3. BRAND NAMES → map to their ingredients:
   • كنتاكي / كي اف سي / KFC → chicken, flour, oil, spices, MSG
   • ماكدونالدز / ماكدونالد / ماك / McDonald's → beef, bread, cheese, sauce
   • هاردي / هارديز / Hardee's → beef, bread, cheese, oil
   • برجر كنج / Burger King → beef, bread, oil
   • بيتزا هت / Pizza Hut / دومينوز → flour, cheese, tomato sauce, yeast
   • ريد بول / Red Bull → caffeine, sugars
   • Any fast food chain → enumerate ALL typical ingredients

4. IMPLICIT INGREDIENT KNOWLEDGE:
   • Dishes contain multiple ingredients — list them all
   • "شاورما" → chicken/beef/lamb, bread, sauce, vegetables, spices
   • "بيتزا" → flour, yeast, cheese, tomato sauce, oil
   • "هوت دوج" → sausage (pork OR beef — flag BOTH), bread, mustard, ketchup
   • "كيك" / "حلويات" → flour, eggs, butter, sugar, may contain gelatin or lard
   • "مارشميلو" → gelatin (usually pork-derived), sugar
   • "جيلي" / "جلي" → gelatin, sugar, food coloring
   • "ايس كريم" → milk, cream, sugar, may contain emulsifiers (E471, E472)
   • E-numbers → identify what they are (E120=carmine, E441=gelatin, E471=mono/diglycerides)

═══ RECOGNITION CHECK ═══

Set "recognized": true for:
• Any food, dish, meal, snack, beverage, ingredient, food brand, additive, E-number
• Even if you're uncertain — if there's ANY chance it's food-related, recognize it
• Partial/misspelled food names should still be recognized

Set "recognized": false ONLY for:
• Clearly non-food: cars, countries, people's names, random numbers, abstract concepts
• Pure gibberish with zero food meaning
• When in doubt → recognize it (set true)

═══ FOOD DATABASE ═══
Format: ID|English name|Arabic name|status
${catalog}

═══ RESPONSE FORMAT ═══
Return ONLY valid JSON:
{
  "recognized": true,
  "matchedIds": [1, 2, 3],
  "additionalFlags": ["ingredient with halal concern not in DB"]
}

Rules:
• matchedIds: integer IDs from the database ONLY — semantic matches, not just exact names
• Be thorough — if a dish likely contains an ingredient from the DB, include it
• additionalFlags: ONLY ingredients with genuine halal concern not found in DB (pork derivatives, alcohol, blood products, uncertain E-numbers, etc.)
• Do NOT include water, salt, sugar, common spices, harmless vegetables in additionalFlags
• If recognized=false, return empty arrays for matchedIds and additionalFlags`;

  const openai = await getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ],
    response_format: { type: "json_object" },
    max_tokens: 700,
    temperature: 0.1,
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message.content || "{}");
    const recognized: boolean = parsed.recognized !== false;
    const matchedIds: number[] = Array.isArray(parsed.matchedIds)
      ? parsed.matchedIds.filter((id: unknown) => typeof id === "number")
      : [];
    const additionalFlags: string[] = Array.isArray(parsed.additionalFlags)
      ? parsed.additionalFlags.filter((s: unknown) => typeof s === "string").slice(0, 10)
      : [];
    return { matchedIds, additionalFlags, recognized };
  } catch {
    return { matchedIds: [], additionalFlags: [], recognized: false };
  }
}

/**
 * Maps extracted ingredients (from image OCR / vision) to DB food IDs.
 * Uses semantic Arabic-aware matching.
 */
async function mapIngredientsToIds(
  ingredients: string[],
  allFoods: FoodRow[],
): Promise<{ matchedIds: number[]; additionalFlags: string[]; recognized: boolean }> {
  if (ingredients.length === 0) return { matchedIds: [], additionalFlags: [], recognized: false };

  const catalog = buildCatalog(allFoods);

  const systemPrompt = `You are a halal food compliance expert specializing in the Tayyibat dietary system.
Given a list of ingredients extracted from a food product label or image, map each to the food database.

SEMANTIC MATCHING RULES:
• Match by CONCEPT, not exact name — "monosodium glutamate" = MSG, "beef fat" → beef, "pork gelatin" → gelatin + pork
• For E-numbers: identify what they are (E120=carmine from insects, E441=gelatin, E471=mono/diglycerides from animal/plant, E472=DATEM, E481=sodium stearoyl-2-lactylate)
• Arabic ingredient names: normalize spelling before matching (ة=ه, ى=ي, ignore diacritics)
• OCR errors: "gelat1n" likely means "gelatin", "p0rk" means "pork" — be tolerant of OCR artifacts
• "shortening" or "lard" → likely pork fat — match to lard/pork if in DB
• "rennet" → may be animal-derived — flag it
• "carmine" / "E120" → insect-derived food coloring — flag it
• "vanilla extract" may contain alcohol — flag if alcohol is in DB
• Brand-specific ingredients: identify their halal concerns

FOOD DATABASE (format: ID|English name|Arabic name|status):
${catalog}

Return ONLY valid JSON:
{
  "recognized": true,
  "matchedIds": [1, 2, 3],
  "additionalFlags": ["ingredient with halal concern not in DB"]
}

Rules:
• recognized: false only if the ingredient list is empty or clearly not food
• matchedIds: DB IDs only, semantic matches
• For each ingredient, find ALL relevant DB entries (e.g. "pork gelatin" → match both pork ID AND gelatin ID if both exist)
• additionalFlags: only ingredients with GENUINE halal concern that have NO match in DB
• Do NOT flag salt, water, sugar, citric acid, vitamin C, natural colors from plants, harmless spices`;

  const openai = await getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Ingredients to analyze:\n${ingredients.join("\n")}` },
    ],
    response_format: { type: "json_object" },
    max_tokens: 700,
    temperature: 0.1,
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message.content || "{}");
    const recognized: boolean = parsed.recognized !== false;
    const matchedIds: number[] = Array.isArray(parsed.matchedIds)
      ? parsed.matchedIds.filter((id: unknown) => typeof id === "number")
      : [];
    const additionalFlags: string[] = Array.isArray(parsed.additionalFlags)
      ? parsed.additionalFlags.filter((s: unknown) => typeof s === "string").slice(0, 10)
      : [];
    return { matchedIds, additionalFlags, recognized };
  } catch {
    return { matchedIds: [], additionalFlags: [], recognized: false };
  }
}

router.post("/analysis/text", async (req, res) => {
  try {
    const { query, userId } = req.body as { query: string; userId?: string | null };
    if (!query?.trim()) return void res.status(400).json({ error: "query is required" });

    const allFoods = await db.select().from(foodsTable);
    const { matchedIds, additionalFlags, recognized } = await analyzeTextWithIntent(query.trim(), allFoods);

    // If AI didn't recognize this as food, or found nothing at all → not found
    const totalFound = matchedIds.length + additionalFlags.length;
    if (!recognized || totalFound === 0) {
      const report = buildNotFoundReport(query.trim(), "text");
      return void res.json(report);
    }

    const report = buildReport(allFoods, matchedIds, additionalFlags, query.trim(), "text");

    if (userId) {
      await db.insert(analysisHistoryTable).values({
        userId,
        query: query.trim(),
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

    const visionPrompt = isLabel
      ? `You are a food label OCR expert. Extract the COMPLETE ingredients list from this product label.
Return JSON: {"ingredients": ["ingredient1", "ingredient2"], "found_ingredients": true}
Rules:
• Extract only ingredient names in English (translate if Arabic/other language)
• Include E-numbers as full names when possible (E471 = "mono and diglycerides")
• Include ALL ingredients — even minor ones like emulsifiers, preservatives, colorings
• If no ingredients list is visible, return {"ingredients": [], "found_ingredients": false}`
      : `You are a food recognition expert. Identify all food items and their key ingredients visible in this image.
Return JSON: {"ingredients": ["ingredient1", "ingredient2"], "found_ingredients": true}
Rules:
• Include the main food items AND their typical ingredients
• Be specific about meat types (beef, pork, chicken, lamb)
• If the image contains no recognizable food, return {"ingredients": [], "found_ingredients": false}`;

    const openai = await getOpenAIClient();
    const visionCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: visionPrompt },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            {
              type: "text",
              text: isLabel
                ? "Extract all ingredients from this product label."
                : "What food items and ingredients are in this image?",
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 900,
      temperature: 0.1,
    });

    let extractedIngredients: string[] = [];
    let foundIngredients = true;
    try {
      const parsed = JSON.parse(visionCompletion.choices[0].message.content || "{}");
      extractedIngredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
      foundIngredients = parsed.found_ingredients !== false;
    } catch {
      extractedIngredients = [];
      foundIngredients = false;
    }

    const imageAnalysisType = isLabel ? "label" : "image";
    const queryLabel = isLabel ? "مسح ملصق المنتج" : "تحليل صورة الطعام";

    if (!foundIngredients || extractedIngredients.length === 0) {
      return void res.json(buildNotFoundReport(queryLabel, imageAnalysisType));
    }

    const allFoods = await db.select().from(foodsTable);
    const { matchedIds, additionalFlags, recognized } = await mapIngredientsToIds(extractedIngredients, allFoods);

    if (!recognized || (matchedIds.length === 0 && additionalFlags.length === 0)) {
      return void res.json(buildNotFoundReport(queryLabel, imageAnalysisType));
    }

    const report = buildReport(allFoods, matchedIds, additionalFlags, queryLabel, imageAnalysisType);

    if (userId) {
      await db.insert(analysisHistoryTable).values({
        userId,
        query: queryLabel,
        analysisType: imageAnalysisType,
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

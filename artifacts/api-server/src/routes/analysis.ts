import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { foodsTable, analysisHistoryTable, userUsageTable, appConfigTable, usersTable, subscriptionPlansTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { optionalAuth } from "../middleware/requireAuth";

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

async function getFreeMonthlyLimit(): Promise<number> {
  try {
    const [row] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "free_monthly_limit"));
    const val = parseInt(row?.value ?? "10", 10);
    return isNaN(val) ? 10 : val;
  } catch {
    return 10;
  }
}

async function isUserPremium(userId: string): Promise<boolean> {
  try {
    const [account] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    return account?.isPremium === "true";
  } catch {
    return false;
  }
}

/**
 * Returns the user's plan limits.
 * Priority: assigned plan → free plan in DB → config fallback.
 * -1 means unlimited.
 */
async function getUserPlanLimits(userId: string): Promise<{ textLimit: number; imageLimit: number }> {
  const freeText = await getFreeMonthlyLimit();
  const hardFallback = { textLimit: freeText, imageLimit: Math.ceil(freeText / 2) };
  try {
    const [account] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

    if (account?.planId) {
      const [plan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, account.planId));
      if (plan) return { textLimit: plan.dailyTextLimit, imageLimit: plan.dailyImageLimit };
    }

    // No plan assigned — use the free plan's limits from the DB
    const [freePlan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.billingCycle, "free"))
      .limit(1);
    if (freePlan) return { textLimit: freePlan.dailyTextLimit, imageLimit: freePlan.dailyImageLimit };

    return hardFallback;
  } catch {
    return hardFallback;
  }
}

/**
 * Checks whether the user is within their plan's per-type monthly limit, then
 * increments the counter if allowed.
 *
 * Premium users bypass quota entirely (unlimited). For free users, limits come
 * from the subscription_plans table. A limit value of -1 means unlimited.
 * The `date` column stores "YYYY-MM" (month granularity) to give monthly quotas.
 */
async function checkAndIncrementUsage(
  userId: string,
  type: "text" | "image"
): Promise<{ allowed: boolean; monthlyCount: number; textCount: number; imageCount: number }> {
  // Premium users always get unlimited access — no quota check needed
  const premium = await isUserPremium(userId);
  if (premium) {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const existing = await db
      .select()
      .from(userUsageTable)
      .where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, currentMonth)));
    const row = existing[0];
    const newTextCount = (row?.textCount ?? 0) + (type === "text" ? 1 : 0);
    const newImageCount = (row?.imageCount ?? 0) + (type === "image" ? 1 : 0);
    const newCount = (row?.count ?? 0) + 1;
    if (!row) {
      await db.insert(userUsageTable).values({ userId, date: currentMonth, count: 1, textCount: newTextCount, imageCount: newImageCount, isPremium: "true" });
    } else {
      await db.update(userUsageTable).set({ count: newCount, textCount: newTextCount, imageCount: newImageCount }).where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, currentMonth)));
    }
    return { allowed: true, monthlyCount: newCount, textCount: newTextCount, imageCount: newImageCount };
  }

  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const limits = await getUserPlanLimits(userId);
  const typeLimit = type === "text" ? limits.textLimit : limits.imageLimit;

  const existing = await db
    .select()
    .from(userUsageTable)
    .where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, currentMonth)));

  if (existing.length === 0) {
    // Check limit before first insert (handles limit=0 edge case)
    if (typeLimit >= 0 && 0 >= typeLimit) {
      return { allowed: false, monthlyCount: 0, textCount: 0, imageCount: 0 };
    }
    const newTextCount = type === "text" ? 1 : 0;
    const newImageCount = type === "image" ? 1 : 0;
    const premium = await isUserPremium(userId);
    await db.insert(userUsageTable).values({
      userId,
      date: currentMonth,
      count: 1,
      textCount: newTextCount,
      imageCount: newImageCount,
      isPremium: premium ? "true" : "false",
    });
    return { allowed: true, monthlyCount: 1, textCount: newTextCount, imageCount: newImageCount };
  }

  const row = existing[0];
  const typeCount = type === "text" ? row.textCount : row.imageCount;

  // Enforce limit for ALL users — -1 means unlimited
  if (typeLimit >= 0 && typeCount >= typeLimit) {
    return { allowed: false, monthlyCount: row.count, textCount: row.textCount, imageCount: row.imageCount };
  }

  const newTextCount = row.textCount + (type === "text" ? 1 : 0);
  const newImageCount = row.imageCount + (type === "image" ? 1 : 0);
  const newCount = row.count + 1;

  await db
    .update(userUsageTable)
    .set({ count: newCount, textCount: newTextCount, imageCount: newImageCount })
    .where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, currentMonth)));
  return { allowed: true, monthlyCount: newCount, textCount: newTextCount, imageCount: newImageCount };
}

export type IngredientStatus = "allowed" | "forbidden" | "conditional" | "unknown";
export type IngredientFrequency = "basic" | "daily" | "weekly" | "occasional" | null;

export interface IngredientResult {
  name: string;
  nameAr: string;
  status: IngredientStatus;
  frequency?: IngredientFrequency;
  reason: string | null;
  notes?: string | null;
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
  possibleFoods?: string[];
}

type FoodRow = typeof foodsTable.$inferSelect;

/**
 * Builds an extraction-only prompt.
 * The AI identifies food names from the query/image but does NOT classify them.
 * All classification is done server-side using the Foods Database exclusively.
 */
function buildExtractionPrompt(mode: "text" | "image" | "label"): string {
  const extractionInstr =
    mode === "label"
      ? `استخرج قائمة المكونات الكاملة من ملصق المنتج في الصورة (بما فيها الأرقام E، المستحلبات، المواد الحافظة، الألوان). ترجم كل مكوّن للعربية.`
      : mode === "image"
        ? `حلّل الصورة بالكامل: حدّد الطبق وكل مكوّناته الظاهرة والمكوّنات الضمنية المعتادة. كن دقيقاً في نوع اللحم (بقري / دجاج / غنم / سمك / إلخ). إذا كانت الصورة غامضة أو يصعب تحديد نوع الطعام بثقة، أضف حقل "possibleFoods" بقائمة من 2-5 احتمالات باللغة العربية.`
        : `حلّل نص المستخدم: حدّد الطبق/الصنف وكل مكوّناته (الظاهرة والضمنية). تعامل مع جميع اللهجات العربية وأخطاء الإملاء وأسماء العلامات التجارية. كن دقيقاً في نوع اللحم — حدّده: لحم بقري، دجاج، غنم، أرنب، سمك، إلخ.`;

  return `أنت مساعد متخصص في استخراج أسماء الأطعمة والمكونات.

مهمتك الوحيدة: ${extractionInstr}

قواعد صارمة:
• استخرج أسماء المكونات والأطعمة فقط — لا تُصنّف أي منها ولا تحكم عليه.
• لا تستخدم معرفتك المسبقة لتحديد ما إذا كان الطعام مسموحاً أو ممنوعاً.
• مهمتك هي الاستخراج والتسمية فقط، وليس التقييم.

أعِد JSON صالحاً فقط بهذا الشكل:
{
  "isFood": true,
  "dishName": "اسم الطبق أو الصنف بالعربية",
  "items": [
    {"nameAr": "الاسم بالعربية", "nameEn": "English name"}
  ],
  "possibleFoods": ["احتمال1 بالعربية", "احتمال2"]
}

قواعد الإخراج:
• isFood=false فقط إذا لم تكن الصورة/النص متعلقة بطعام إطلاقاً (سيارة، شخص، كلام عشوائي). عندها أعِد items فارغة.
• possibleFoods: أضفه فقط عند الغموض الحقيقي (صورة غير واضحة). لا تضعه إذا كان الطعام واضحاً.
• كن شاملاً: اذكر جميع المكونات الظاهرة والضمنية المعتادة للطبق.`;
}

const FREQUENCIES: ReadonlyArray<NonNullable<IngredientFrequency>> = ["basic", "daily", "weekly", "occasional"];

function normalizeFrequency(raw: unknown): IngredientFrequency {
  if (typeof raw === "string" && (FREQUENCIES as readonly string[]).includes(raw)) {
    return raw as IngredientFrequency;
  }
  return null;
}

function normalizeStatus(raw: unknown): IngredientStatus {
  if (raw === "allowed" || raw === "forbidden" || raw === "conditional" || raw === "unknown") return raw;
  return "unknown";
}

/** Raw extraction result from the AI — names only, no classifications. */
interface ExtractionResult {
  isFood: boolean;
  dishName: string;
  rawItems: { nameAr: string; nameEn: string }[];
  possibleFoods: string[];
}

function parseExtraction(content: string): ExtractionResult {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(content || "{}");
  } catch {
    return { isFood: false, dishName: "", rawItems: [], possibleFoods: [] };
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems
    .map((it: unknown): { nameAr: string; nameEn: string } | null => {
      if (typeof it !== "object" || it === null) return null;
      const o = it as Record<string, unknown>;
      const nameAr = typeof o.nameAr === "string" ? o.nameAr.trim() : "";
      const nameEn = typeof o.nameEn === "string" ? o.nameEn.trim() : "";
      if (!nameAr && !nameEn) return null;
      return { nameAr: nameAr || nameEn, nameEn: nameEn || nameAr };
    })
    .filter((x): x is { nameAr: string; nameEn: string } => x !== null);

  const possibleFoods = Array.isArray(parsed.possibleFoods)
    ? parsed.possibleFoods.filter((s) => typeof s === "string" && s.trim().length > 0).slice(0, 6)
    : [];

  return {
    isFood: parsed.isFood !== false,
    dishName: typeof parsed.dishName === "string" ? parsed.dishName.trim() : "",
    rawItems: items,
    possibleFoods,
  };
}

/** Normalize an Arabic/English food name for comparison against the DB. */
function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "") // strip Arabic diacritics
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ـ]/g, "") // tatweel
    .replace(/\s+/g, " ");
}

/** Strip the Arabic definite article "ال" (and "al-" in English) from the start. */
function stripArticle(s: string): string {
  return s.replace(/^ال/, "").replace(/^al-?/i, "").trim();
}

/**
 * Classifies extracted food items using ONLY the Foods Database.
 * Uses a multi-tier fuzzy matching strategy:
 *   1. Exact normalized match
 *   2. Match after stripping "ال" definite article from either side
 *   3. Substring match (query contained in DB name, or DB name contained in query)
 *   4. Word-level match (every significant word of query found in DB entry)
 * Items with no DB match → status="unknown".
 * No AI pretrained knowledge is used for classification.
 */
function classifyFromDb(
  rawItems: { nameAr: string; nameEn: string }[],
  allFoods: FoodRow[],
): IngredientResult[] {
  // Pre-compute all normalized forms for the DB
  const normalized = allFoods.map((f) => ({
    row: f,
    nAr: normalizeName(f.nameAr),
    nEn: normalizeName(f.nameEn),
    sAr: stripArticle(normalizeName(f.nameAr)),
    sEn: stripArticle(normalizeName(f.nameEn)),
  }));

  // Build lookup maps for O(1) exact + stripped lookups
  const byExact = new Map<string, FoodRow>();
  const byStripped = new Map<string, FoodRow>();
  for (const e of normalized) {
    if (e.nAr) byExact.set(e.nAr, e.row);
    if (e.nEn) byExact.set(e.nEn, e.row);
    if (e.sAr) byStripped.set(e.sAr, e.row);
    if (e.sEn) byStripped.set(e.sEn, e.row);
  }

  function findMatch(nameAr: string, nameEn: string): FoodRow | undefined {
    const nAr = normalizeName(nameAr);
    const nEn = normalizeName(nameEn);
    const sAr = stripArticle(nAr);
    const sEn = stripArticle(nEn);

    // Tier 1: exact normalized match
    const t1 = byExact.get(nAr) ?? byExact.get(nEn);
    if (t1) return t1;

    // Tier 2: strip definite article from query then match
    const t2 = byStripped.get(sAr) ?? byStripped.get(sEn);
    if (t2) return t2;

    // Tier 3: substring — query contained in DB name, or DB name in query
    for (const e of normalized) {
      const qAr = sAr, qEn = sEn;
      if (qAr.length >= 3 && (e.sAr.includes(qAr) || qAr.includes(e.sAr))) return e.row;
      if (qEn.length >= 3 && (e.sEn.includes(qEn) || qEn.includes(e.sEn))) return e.row;
    }

    // Tier 4: every significant word (≥3 chars) in the query appears in a DB entry
    const arWords = sAr.split(" ").filter((w) => w.length >= 3);
    if (arWords.length > 0) {
      for (const e of normalized) {
        if (arWords.every((w) => e.sAr.includes(w) || e.nAr.includes(w))) return e.row;
      }
    }
    const enWords = sEn.split(" ").filter((w) => w.length >= 3);
    if (enWords.length > 0) {
      for (const e of normalized) {
        if (enWords.every((w) => e.sEn.includes(w) || e.nEn.includes(w))) return e.row;
      }
    }

    return undefined;
  }

  return rawItems.map((item): IngredientResult => {
    const match = findMatch(item.nameAr, item.nameEn);

    if (match) {
      return {
        name: item.nameEn || item.nameAr,
        nameAr: item.nameAr || item.nameEn,
        status: match.status as IngredientStatus,
        frequency: null,
        reason: match.reason ?? null,
        notes: match.notes ?? null,
      };
    }

    return {
      name: item.nameEn || item.nameAr,
      nameAr: item.nameAr || item.nameEn,
      status: "unknown",
      frequency: null,
      reason: "هذا الطعام غير متوفر في قاعدة بيانات طيباتي",
      notes: null,
    };
  });
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

function buildReportFromExtraction(
  result: ExtractionResult,
  query: string,
  analysisType: AnalysisReport["analysisType"],
  allFoods: FoodRow[],
): AnalysisReport {
  const items = classifyFromDb(result.rawItems, allFoods);
  const allowed = items.filter((i) => i.status === "allowed");
  const forbidden = items.filter((i) => i.status === "forbidden");
  const conditional = items.filter((i) => i.status === "conditional");
  const unknown = items.filter((i) => i.status === "unknown");

  const score = scoreFromResults(allowed, forbidden, conditional, unknown);

  // Build summary entirely from DB results — no AI-generated text
  const parts: string[] = [];
  if (forbidden.length > 0)
    parts.push(`يحتوي على مكونات ممنوعة: ${forbidden.map((f) => f.nameAr).join("، ")}`);
  if (conditional.length > 0)
    parts.push(`مكونات مشروطة: ${conditional.map((f) => f.nameAr).join("، ")}`);
  if (forbidden.length === 0 && conditional.length === 0 && allowed.length > 0)
    parts.push("جميع المكونات الموجودة في قاعدة البيانات مسموح بها");
  if (allowed.length === 0 && forbidden.length === 0 && conditional.length === 0 && unknown.length > 0)
    parts.push("لم يتم العثور على أي من المكونات في قاعدة بيانات طيباتي");
  const explanation = parts.join(". ") || "تم تحليل المكونات";

  // Suggest allowed DB items from the same category as any forbidden item
  const forbiddenCategories = new Set(
    forbidden.flatMap((fi) => {
      const row = allFoods.find(
        (f) =>
          normalizeName(f.nameAr) === normalizeName(fi.nameAr) ||
          normalizeName(f.nameEn) === normalizeName(fi.name),
      );
      return row?.category ? [row.category] : [];
    }),
  );
  const suggestions = forbiddenCategories.size > 0
    ? allFoods
        .filter((f) => f.status === "allowed" && forbiddenCategories.has(f.category))
        .slice(0, 6)
        .map((f) => f.nameAr)
    : [];

  return {
    query: result.dishName || query,
    compatibilityScore: score,
    allowed,
    forbidden,
    conditional,
    unknown,
    explanation,
    suggestions,
    analysisType,
    possibleFoods: result.possibleFoods?.length ? result.possibleFoods : undefined,
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
    explanation: "لم يتم التعرف على طعام في هذا الإدخال. حاول بصورة أوضح أو اكتب اسم الطعام.",
    suggestions: [],
    analysisType,
    notFound: true,
  };
}

// optionalAuth extracts userId from the verified Bearer token.
// Body/query userId fields are intentionally ignored to prevent cross-user quota abuse.
router.post("/analysis/text", optionalAuth, async (req, res) => {
  try {
    const { query } = req.body as { query: string };
    if (!query?.trim()) return void res.status(400).json({ error: "query is required" });

    const userId = req.userId ?? null;

    if (userId) {
      const usage = await checkAndIncrementUsage(userId, "text");
      if (!usage.allowed) {
        return void res.status(429).json({
          error: "limit_reached",
          message: "لقد وصلت إلى حد البحث النصي لهذا الشهر. يتجدد في أول الشهر القادم. قم بالترقية إلى بريميوم للاستخدام غير المحدود.",
        });
      }
    }

    const allFoods = await db.select().from(foodsTable);
    const openai = await getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildExtractionPrompt("text") },
        { role: "user", content: query.trim() },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.1,
    });

    const result = parseExtraction(completion.choices[0].message.content || "{}");

    if (!result.isFood || result.rawItems.length === 0) {
      return void res.json(buildNotFoundReport(query.trim(), "text"));
    }

    const report = buildReportFromExtraction(result, query.trim(), "text", allFoods);

    if (userId) {
      await db.insert(analysisHistoryTable).values({
        userId,
        query: report.query,
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

router.post("/analysis/image", optionalAuth, async (req, res) => {
  try {
    const { imageBase64, mimeType, analysisType } = req.body as {
      imageBase64: string;
      mimeType: string;
      analysisType: "food" | "label";
    };
    if (!imageBase64 || !mimeType) return void res.status(400).json({ error: "imageBase64 and mimeType required" });

    const userId = req.userId ?? null;

    if (userId) {
      const usage = await checkAndIncrementUsage(userId, "image");
      if (!usage.allowed) {
        return void res.status(429).json({
          error: "limit_reached",
          message: "لقد وصلت إلى حد تحليل الصور لهذا الشهر. يتجدد في أول الشهر القادم. قم بالترقية إلى بريميوم للاستخدام غير المحدود.",
        });
      }
    }

    const isLabel = analysisType === "label";
    const mode = isLabel ? "label" : "image";
    const imageAnalysisType = isLabel ? "label" : "image";
    const queryLabel = isLabel ? "مسح ملصق المنتج" : "تحليل صورة الطعام";

    const allFoods = await db.select().from(foodsTable);
    const openai = await getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildExtractionPrompt(mode) },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            {
              type: "text",
              text: isLabel
                ? "استخرج كل المكونات من ملصق المنتج."
                : "ما الأطعمة والمكونات في هذه الصورة؟",
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.1,
    });

    const result = parseExtraction(completion.choices[0].message.content || "{}");

    if (!result.isFood) {
      return void res.json(buildNotFoundReport(queryLabel, imageAnalysisType));
    }
    if (result.rawItems.length === 0 && result.possibleFoods.length > 0) {
      return void res.json({ ...buildNotFoundReport(queryLabel, imageAnalysisType), possibleFoods: result.possibleFoods, notFound: false });
    }
    if (result.rawItems.length === 0) {
      return void res.json(buildNotFoundReport(queryLabel, imageAnalysisType));
    }

    const report = buildReportFromExtraction(result, queryLabel, imageAnalysisType, allFoods);

    if (userId) {
      await db.insert(analysisHistoryTable).values({
        userId,
        query: report.query,
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

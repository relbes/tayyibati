import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { foodsTable, analysisHistoryTable, userUsageTable, appConfigTable, usersTable, subscriptionPlansTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { optionalAuth } from "../middleware/requireAuth";
import { getFreeMonthlyLimit } from "../lib/config";

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
        ? `حلّل الصورة: حدّد الطبق وكل مكوّناته. قواعد التسمية للصور:
- استخدم الاسم القياسي القصير للمكوّن لا وصفه البصري (مثال: اكتب "شوكولاتة" لا "كرات شوكولاتة بنية"، اكتب "دجاج" لا "قطعة دجاج مقلية").
- اذكر نوع المكوّن الجوهري فقط: "شوكولاتة بيضاء"، "شوكولاتة داكنة"، "لحم بقري"، "دجاج"، إلخ.
- كن دقيقاً في نوع اللحم: لحم بقري / دجاج / غنم / أرنب / سمك.
- اذكر المكونات الضمنية المعتادة للطبق أيضاً.
- إذا كانت الصورة غامضة، أضف "possibleFoods".`
        : `حلّل نص المستخدم: حدّد الطبق/الصنف وكل مكوّناته (الظاهرة والضمنية). تعامل مع جميع اللهجات العربية وأخطاء الإملاء وأسماء العلامات التجارية. كن دقيقاً في نوع اللحم — حدّده: لحم بقري، دجاج، غنم، أرنب، سمك، إلخ.`;

  return `أنت مساعد متخصص في استخراج أسماء الأطعمة والمكونات.

مهمتك الوحيدة: ${extractionInstr}

قواعد صارمة:
• استخرج أسماء المكونات والأطعمة فقط — لا تُصنّف أي منها ولا تحكم عليه.
• لا تستخدم معرفتك المسبقة لتحديد ما إذا كان الطعام مسموحاً أو ممنوعاً.
• مهمتك هي الاستخراج والتسمية فقط، وليس التقييم.
• كل مكوّن يجب أن يكون اسماً قياسياً قابلاً للبحث، لا وصفاً بصرياً.

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
 * Check whether `needle` appears as a complete word inside `haystack`.
 * A word boundary in Arabic is a space, the start, or the end of the string.
 * This prevents "دجاج" from matching inside "الدجاج" (no preceding space).
 */
function wholeWordMatch(haystack: string, needle: string): boolean {
  if (!needle) return false;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    const before = idx === 0 || haystack[idx - 1] === " ";
    const after = idx + needle.length === haystack.length || haystack[idx + needle.length] === " ";
    if (before && after) return true;
    idx++;
  }
  return false;
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
/** Flip allowed↔forbidden; conditional/unknown unchanged. */
function flipStatus(s: string): string {
  if (s === "allowed") return "forbidden";
  if (s === "forbidden") return "allowed";
  return s;
}

/**
 * Extract the exception text that follows "ما عدا" in an Arabic food name.
 * Stops at the first parenthesis, comma، or qualifier word (مرفوض/ممنوع/مسموح).
 * Returns the trimmed exception string, or null if the pattern isn't found.
 */
function extractMaAdaException(nameAr: string): { mainPart: string; exceptions: string[] } | null {
  const idx = nameAr.indexOf("ما عدا");
  if (idx === -1) return null;

  // Main part is everything before "ما عدا", stripping any trailing "(" context
  const mainPart = nameAr.slice(0, idx).replace(/\s*\(.*$/, "").trim();

  // Exception text: after "ما عدا ", trimmed at terminators
  let excRaw = nameAr.slice(idx + "ما عدا".length).trim();
  // Stop at opening paren or qualifier words
  excRaw = excRaw.split(/[\(،,]|(?:\s+(?:مرفوضه|مرفوضة|ممنوعه|ممنوع|مسموحه|مسموح))/)[0].trim();

  if (!excRaw) return null;

  // Split multiple exceptions joined by " و "
  const exceptions = excRaw.split(/\s+و\s+/).map((s) => s.trim()).filter(Boolean);
  return { mainPart: mainPart || nameAr, exceptions };
}

function classifyFromDb(
  rawItems: { nameAr: string; nameEn: string }[],
  allFoods: FoodRow[],
): IngredientResult[] {
  // MatchEntry wraps a DB row with optional effectiveStatus for exception-derived
  // entries (where the status is the FLIP of the parent row's status).
  type MatchEntry = {
    row: FoodRow;
    nAr: string;
    nEn: string;
    sAr: string;
    sEn: string;
    effectiveStatus?: string;
  };

  // Build the normalized list, expanding "ما عدا" exception patterns into
  // separate entries with flipped status. Exception entries are appended AFTER
  // all regular entries so that a dedicated DB entry (e.g. "دجاج و فراخ") always
  // wins over an exception-derived one when both give the same answer.
  const normalized: MatchEntry[] = [];
  const exceptionEntries: MatchEntry[] = [];

  for (const f of allFoods) {
    const nAr = normalizeName(f.nameAr);
    const nEn = normalizeName(f.nameEn);
    const exc = extractMaAdaException(f.nameAr);

    if (exc) {
      // Main entry: keyed by the part BEFORE "ما عدا" so it doesn't accidentally
      // match exception food names.
      const mainNar = normalizeName(exc.mainPart);
      normalized.push({ row: f, nAr: mainNar, nEn, sAr: stripArticle(mainNar), sEn: stripArticle(nEn) });

      // Exception entries: each item after "ما عدا" → flipped status
      const flipped = flipStatus(f.status);
      for (const excWord of exc.exceptions) {
        const excNar = normalizeName(excWord);
        exceptionEntries.push({
          row: f,
          nAr: excNar,
          nEn: "",
          sAr: stripArticle(excNar),
          sEn: "",
          effectiveStatus: flipped,
        });
      }
    } else {
      normalized.push({ row: f, nAr, nEn, sAr: stripArticle(nAr), sEn: stripArticle(nEn) });
    }
  }

  // Combine: regular entries first so dedicated rows take priority
  const all = [...normalized, ...exceptionEntries];

  // Build lookup maps for O(1) exact + stripped lookups
  const byExact = new Map<string, MatchEntry>();
  const byStripped = new Map<string, MatchEntry>();
  for (const e of all) {
    if (e.nAr && !byExact.has(e.nAr)) byExact.set(e.nAr, e);
    if (e.nEn && !byExact.has(e.nEn)) byExact.set(e.nEn, e);
    if (e.sAr && !byStripped.has(e.sAr)) byStripped.set(e.sAr, e);
    if (e.sEn && !byStripped.has(e.sEn)) byStripped.set(e.sEn, e);
  }

  function findMatch(nameAr: string, nameEn: string): MatchEntry | undefined {
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

    // Tier 3: whole-word match — query is a whole word inside DB name, or DB
    // name is a whole word inside query. Whole-word prevents "دجاج" matching
    // inside "الدجاج" (part of the livestock-liver exception entry).
    for (const e of all) {
      const qAr = sAr, qEn = sEn;
      if (qAr.length >= 3 && (wholeWordMatch(e.sAr, qAr) || wholeWordMatch(qAr, e.sAr))) return e;
      if (qEn.length >= 3 && (wholeWordMatch(e.sEn, qEn) || wholeWordMatch(qEn, e.sEn))) return e;
    }

    // Tier 4: every significant word (≥3 chars) in the query appears as a whole
    // word in a DB entry
    const arWords = sAr.split(" ").filter((w) => w.length >= 3);
    if (arWords.length > 0) {
      for (const e of all) {
        if (arWords.every((w) => wholeWordMatch(e.sAr, w) || wholeWordMatch(e.nAr, w))) return e;
      }
    }
    const enWords = sEn.split(" ").filter((w) => w.length >= 3);
    if (enWords.length > 0) {
      for (const e of all) {
        if (enWords.every((w) => wholeWordMatch(e.sEn, w) || wholeWordMatch(e.nEn, w))) return e;
      }
    }

    // Tier 5: individual significant-word fallback for compound names
    const arSigWords = sAr.split(" ").filter((w) => w.length >= 5);
    for (const word of arSigWords) {
      for (const e of all) {
        if (wholeWordMatch(e.sAr, word) || wholeWordMatch(e.nAr, word)) return e;
      }
    }
    const enSigWords = sEn.split(" ").filter((w) => w.length >= 5);
    for (const word of enSigWords) {
      for (const e of all) {
        if (wholeWordMatch(e.sEn, word) || wholeWordMatch(e.nEn, word)) return e;
      }
    }

    return undefined;
  }

  return rawItems.map((item): IngredientResult => {
    const match = findMatch(item.nameAr, item.nameEn);

    if (match) {
      const effectiveStatus = match.effectiveStatus ?? match.row.status;
      return {
        name: item.nameEn || item.nameAr,
        nameAr: item.nameAr || item.nameEn,
        status: effectiveStatus as IngredientStatus,
        frequency: null,
        reason: match.row.reason ?? null,
        notes: match.row.notes ?? null,
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
      temperature: 0,
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
      temperature: 0,
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

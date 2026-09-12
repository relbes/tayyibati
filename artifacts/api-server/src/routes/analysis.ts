/**
 * Tayyibati Analysis Route Gateway
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/ANALYSIS_PIPELINE_SPEC.md for complete 10-stage pipeline
 * - See docs/ARCHITECTURE_RULES.md (Rules 1-8)
 * - See docs/ENGINEERING_PRINCIPLES.md (Knowledge Before AI, Cache First)
 */
import { Router } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { foodsTable, analysisHistoryTable, userUsageTable, appConfigTable, usersTable, subscriptionPlansTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getFreeMonthlyLimit } from "../lib/config";
import { UnifiedAnalysisEngine } from "../lib/unifiedAnalysisEngine";
import { analyzeDishCompatibility } from "../lib/dishCompatibilityEngine";
import { CanonicalSearchEngine, MatchType } from "../lib/canonicalSearchEngine";

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

export async function getUserPlanLimits(userId: string): Promise<{ textLimit: number; imageLimit: number }> {
  try {
    const [account] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

    if (account?.planId != null) {
      const [plan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, account.planId));
      if (plan) return { textLimit: plan.dailyTextLimit, imageLimit: plan.dailyImageLimit };
    }

    if (account?.isPremium === "true") {
      return { textLimit: -1, imageLimit: -1 };
    }

    // Primary source: free plan from subscription_plans table in DB
    const [freePlan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.billingCycle, "free"))
      .limit(1);
    if (freePlan) return { textLimit: freePlan.dailyTextLimit, imageLimit: freePlan.dailyImageLimit };

    const freeText = await getFreeMonthlyLimit();
    return { textLimit: freeText, imageLimit: Math.ceil(freeText / 2) };
  } catch {
    return { textLimit: 15, imageLimit: 3 };
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
): Promise<{ allowed: boolean; monthlyCount: number; textCount: number; imageCount: number; count: number; limit: number; remaining: number }> {
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
    return { allowed: true, monthlyCount: newCount, textCount: newTextCount, imageCount: newImageCount, count: newCount, limit: -1, remaining: 9999 };
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
      return { allowed: false, monthlyCount: 0, textCount: 0, imageCount: 0, count: 0, limit: typeLimit, remaining: 0 };
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
    const rem = typeLimit >= 0 ? Math.max(0, typeLimit - 1) : 9999;
    return { allowed: true, monthlyCount: 1, textCount: newTextCount, imageCount: newImageCount, count: 1, limit: typeLimit, remaining: rem };
  }

  const row = existing[0];
  const typeCount = type === "text" ? row.textCount : row.imageCount;

  // Enforce limit for ALL users — -1 means unlimited
  if (typeLimit >= 0 && typeCount >= typeLimit) {
    const rem = Math.max(0, typeLimit - typeCount);
    return { allowed: false, monthlyCount: row.count, textCount: row.textCount, imageCount: row.imageCount, count: row.count, limit: typeLimit, remaining: rem };
  }

  const newTextCount = row.textCount + (type === "text" ? 1 : 0);
  const newImageCount = row.imageCount + (type === "image" ? 1 : 0);
  const newCount = row.count + 1;
  const newTypeCount = typeCount + 1;
  const rem = typeLimit >= 0 ? Math.max(0, typeLimit - newTypeCount) : 9999;

  await db
    .update(userUsageTable)
    .set({ count: newCount, textCount: newTextCount, imageCount: newImageCount })
    .where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, currentMonth)));
  return { allowed: true, monthlyCount: newCount, textCount: newTextCount, imageCount: newImageCount, count: newCount, limit: typeLimit, remaining: rem };
}

export type IngredientStatus = "allowed" | "forbidden" | "conditional" | "unknown";
export type IngredientFrequency = "basic" | "daily" | "weekly" | "occasional" | null;

export interface IngredientResult {
  name: string;
  nameAr: string;
  nameEn?: string;
  status: IngredientStatus;
  frequency?: IngredientFrequency;
  reason: string | null;
  notes?: string | null;
  proteinCategory?: string;
  proteinSpecificity?: string;
  priority?: string;
}

export interface AnalysisReport {
  query: string;
  displayQuery?: string;
  canonicalResult?: any;
  dish?: string;
  proteinCategory?: string;
  proteinSpecificity?: string;
  resultMode?: "EXACT_FOOD" | "GENERAL_RULE" | "GENERAL_RULE_EXCEPTIONS" | "SPECIFIC_INHERITED" | "MIXED_CATEGORY" | "COMPOSITE_FOOD" | "UNKNOWN_FOOD" | "NOT_FOUND";
  needsClarification?: boolean;
  clarificationType?: string;
  questionAr?: string;
  resolutionState?: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";
  aiConfidence?: number;

  primaryRuling?: {
    status: "allowed" | "forbidden" | "conditional" | "unknown";
    nameAr: string;
    nameEn: string;
    dbReason: string | null;
    dbNotes: string | null;
    isInherited: boolean;
    inheritsFrom?: { nameAr: string; nameEn: string };
  };

  subtypes?: {
    allowed: IngredientResult[];
    forbidden: IngredientResult[];
    conditional: IngredientResult[];
  };

  categoryItems?: {
    allowed: IngredientResult[];
    forbidden: IngredientResult[];
    conditional: IngredientResult[];
  };

  ingredients?: IngredientResult[];

  compatibilityScore: number | null;
  /** 0-100: fraction of all ingredients that are known. null if no ingredients. Drops when unknowns exist. */
  ingredientConfidence?: number | null;
  scoreAvailable?: boolean;

  allowed: IngredientResult[];
  forbidden: IngredientResult[];
  conditional: IngredientResult[];
  unknown: IngredientResult[];
  explanation: string;
  suggestions: string[];
  suggestions_legacy?: string[];
  analysisType: "text" | "image" | "label";
  notFound?: boolean;
  /**
   * Smart fallback suggestions — present ONLY when notFound === true.
   * These are real existing Tayyibati food/dish records that are similar to
   * the unresolved query. They are alternatives, NOT confirmed identifications.
   * Old clients that do not know this field will safely ignore it.
   */
  fallbackSuggestions?: Array<{
    canonicalId: number;
    canonicalEntityType: "food" | "dish";
    nameAr: string;
    nameEn: string;
  }>;
  imageRecognition?: {
    status: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN" | "INSUFFICIENT_IMAGE";
    imageType: "SINGLE_FOOD" | "MULTIPLE_FOODS" | "DISH" | "PACKAGED_PRODUCT" | "AMBIGUOUS";
    candidates: {
      nameAr: string;
      nameEn: string;
      recognitionScore: number;
      resolution?: {
        resolved: boolean;
        canonicalNameAr: string;
        canonicalNameEn: string;
        resolutionType: string;
      };
    }[];
    visibleComponents: string[];
    likelyIngredients: string[];
    confirmedIngredients: string[];
  };
}

type FoodRow = typeof foodsTable.$inferSelect;

function buildTextExtractionPrompt(): string {
  return `أنت مساعد متخصص في استخراج أسماء الأطعمة والمكونات وتحليل نية المستخدم.

مهمتك: حلّل نص المستخدم: حدّد الطبق/الصنف وكل مكوّناته (الظاهرة والضمنية). تعامل مع جميع اللهجات العربية وأخطاء الإملاء وأسماء العلامات التجارية. كن دقيقاً في نوع اللحم — حدّده: لحم بقري، دجاج، غنم، أرنب، سمك، إلخ.

قواعد صارمة:
• استخرج أسماء المكونات والأطعمة فقط — لا تُصنّف أي منها ولا تحكم عليه.
• لا تستخدم معرفتك المسبقة لتحديد ما إذا كان الطعام مسموحاً أو ممنوعاً.
• كل مكوّن يجب أن يكون اسماً قياسياً قابلاً للبحث، لا وصفاً بصرياً.

1. حدد نية المستخدم "userIntent" من بين الخيارات التالية فقط:
   - "SPECIFIC_INGREDIENT" (مكون محدد مثل "زيت زيتون")
   - "BROAD_FOOD_CATEGORY" (فئة طعام عامة مثل "خبز"، "جبنة"، "أرز"، "شوربة"، "قهوة")
   - "SPECIFIC_DISH" (طبق محدد مثل "منسف دجاج"، "شاورما لحم")
   - "AMBIGUOUS_DISH_FOOD" (طبق/طعام غامض أو غير محدد مثل "منسف"، "مقلوبة")
   - "PRODUCT_BRAND" (منتج تجاري)
   - "INGREDIENT_LIST" (قائمة مكونات)
   - "FREE_FORM_MEAL" (وصف وجبة حرة)
   - "UNKNOWN" (غير معروف)

2. حدد ما إذا كان البحث غامضاً أو عاماً "isAmbiguous" (true أو false). يكون true فقط عند البحث عن فئات عامة أو أطباق غير محددة (مثل "خبز"، "جبنة"، "منسف").

3. إذا كان البحث غامضاً (isAmbiguous = true)، اقترح قائمة تصل إلى 5 خيارات/أنواع مختلفة متعلقة بالبحث في "aiRefinementSuggestions" (مثال لـ "خبز": خبز عربي، خبز أسمر، خبز صاج، توست، إلخ).
   - تحذير: لا تولد أي اقتراحات للمكونات أو الأطباق المحددة (مثل "صدور دجاج" أو "زيت زيتون" أو "خبز شراك")، اتركها قائمة فارغة في هذه الحالات.

أعِد JSON صالحاً فقط بهذا الشكل:
{
  "isFood": true,
  "userIntent": "نية المستخدم",
  "isAmbiguous": true_or_false,
  "dishName": "اسم الطبق أو الصنف بالعربية",
  "items": [
    {"nameAr": "الاسم بالعربية", "nameEn": "English name"}
  ],
  "aiRefinementSuggestions": [
    {"labelAr": "النوع بالعربية", "labelEn": "English name", "query": "الاستعلام للبحث"}
  ]
}

قواعد الإخراج:
• isFood=false فقط إذا لم تكن الصورة/النص متعلقة بطعام إطلاقاً.`;
}

function buildImageExtractionPrompt(mode: "image" | "label"): string {
  const isLabel = mode === "label";
  return `أنت مساعد خبير ومحافظ في تحليل الصور والتعرف على الأطعمة والمكونات والمنتجات بدقة وموثوقية عالية.

مهمتك:
${isLabel
  ? "استخراج قائمة المكونات الكاملة والبيانات المقروءة فقط من ملصق المنتج في الصورة (بما فيها الأرقام E، المستحلبات، المواد الحافظة، الألوان). لا تخمّن أي مكوّن غير مقروء."
  : "فحص الصورة لتحديد ما إذا كانت تحتوي على طعام واضح، أو منتج معبأ، أو وجبة/طبق، أو صورة غامضة/غير واضحة، أو غير متعلقة بالطعام."
}

قواعد أساسية صارمة لمكافحة التخمين (Anti-Hallucination & Uncertainty Rules):
1. عدم التخمين: إذا كانت الصورة ضبابية، غير واضحة، الإضاءة سيئة، العنصر محجوباً، أو لا تظهر المعالم المميزة بوضوح، لا تخمّن طعاماً محدداً ولا تجزم به أبداً.
2. التمييز بين اليقين والاحتمال:
   - "CONFIDENT": فقط إذا كان الطعام ظاهراً بالكامل بوضوح تام، وتظهر تفاصيله المميزة التي لا يمكن الخلط بينها وبين طعام آخر (مثلاً تفاحة حمراء واضحة جداً، أو موزة كاملة ناضجة بقشرتها المميزة وظاهرة بوضوح تام).
   - "AMBIGUOUS": إذا كان الطعام يشبه أكثر من شيء (مثلاً مسحوق أصفر قد يكون كركم أو كاري، حساء غير واضح المكونات، فاكهة تشبه الموز أو الكوسة أو غيرها، أو طعام محجوب جزئياً). ضع هنا من 2 إلى 3 خيارات مرجحة فقط.
   - "INSUFFICIENT_IMAGE": إذا كانت الصورة مشوشة، باهتة، بعيدة جداً، أو لا تكفي للحكم.
   - "NON_FOOD": إذا كانت الصورة لا تحوي طعاماً إطلاقاً.
3. المنتجات المعبأة (PACKAGED_PRODUCT): إذا كانت العبوة ظاهرة لكن الاسم أو المكونات غير مقروءة بوضوح، لا تخترع اسماً للمنتج، بل صنفه كمنتج معبأ واذكر الاحتمالات الظاهرة إن وجدت دون الجزم.
4. درجة الثقة (recognitionScore):
   - يجب أن تعكس اليقين البصري الحقيقي (0.90 فأعلى: يقين قاطع وميزات بصرية فريدة واضحة؛ 0.50 إلى 0.84: ترجيح مع وجود شك أو إمكانية شبه؛ أقل من 0.50: شك كبير أو صورة غير كافية).

أعِد JSON صالحاً فقط بهذا الشكل بدقة:
{
  "isFood": true,
  "imageRecognition": {
    "imageType": "SINGLE_FOOD" | "MULTIPLE_FOODS" | "DISH" | "PACKAGED_PRODUCT" | "AMBIGUOUS",
    "imageQuality": "CLEAR" | "BLURRY" | "POOR_LIGHTING" | "OBSTRUCTED" | "PARTIAL",
    "visualClarity": "HIGH" | "MEDIUM" | "LOW",
    "distinctiveFeaturesVisible": true,
    "uncertaintyReason": "سبب الشك إن وجد (مثل: الصورة غير واضحة أو العنصر يشبه عدة أطعمة)",
    "candidates": [
      {
        "nameAr": "الاسم بالعربية",
        "nameEn": "English name",
        "recognitionScore": 0.85
      }
    ],
    "visibleComponents": ["مكون مرئي 1", "مكون مرئي 2"],
    "likelyIngredients": ["مكون محتمل 1", "مكون محتمل 2"],
    "confirmedIngredients": ["مكون مؤكد مقروء من الملصق فقط"]
  }
}

قواعد المخرجات:
- استخدم الاسم القياسي القصير للمكوّن (مثل "شوكولاتة" بدلاً من "كرات شوكولاتة").
- اذكر من 1 إلى 3 مرشحين كحد أقصى في candidates مرتبين بالأعلى احتمالاً.
- لا تقدم مرشحين متطابقين أو مجرد اختلافات إملائية لنفس الطعام.
- إذا كانت الصورة لا تحوي طعاماً، ضع isFood=false.`;
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
  userIntent?: string;
  isAmbiguous?: boolean;
  aiRefinementSuggestions?: { labelAr: string; labelEn: string; query?: string }[];
  
  imageRecognition?: {
    imageType: "SINGLE_FOOD" | "MULTIPLE_FOODS" | "DISH" | "PACKAGED_PRODUCT" | "AMBIGUOUS";
    imageQuality?: "CLEAR" | "BLURRY" | "POOR_LIGHTING" | "OBSTRUCTED" | "PARTIAL";
    visualClarity?: "HIGH" | "MEDIUM" | "LOW";
    distinctiveFeaturesVisible?: boolean;
    uncertaintyReason?: string;
    candidates: {
      nameAr: string;
      nameEn: string;
      recognitionScore: number;
    }[];
    visibleComponents: string[];
    likelyIngredients: string[];
    confirmedIngredients: string[];
  };
}

function parseExtraction(content: string): ExtractionResult {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(content || "{}");
  } catch {
    return { isFood: false, dishName: "", rawItems: [] };
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

  const aiRefinementSuggestions = Array.isArray(parsed.aiRefinementSuggestions)
    ? parsed.aiRefinementSuggestions
        .map((s: any) => {
          if (typeof s !== "object" || s === null) return null;
          return {
            labelAr: typeof s.labelAr === "string" ? s.labelAr.trim() : "",
            labelEn: typeof s.labelEn === "string" ? s.labelEn.trim() : "",
            query: typeof s.query === "string" ? s.query.trim() : "",
          };
        })
        .filter((x) => x !== null && x.labelAr.length > 0)
    : undefined;

  let imageRecognition: ExtractionResult["imageRecognition"] = undefined;
  if (parsed.imageRecognition && typeof parsed.imageRecognition === "object") {
    const ir = parsed.imageRecognition as Record<string, any>;
    imageRecognition = {
      imageType: typeof ir.imageType === "string" ? ir.imageType as any : "AMBIGUOUS",
      imageQuality: typeof ir.imageQuality === "string" ? ir.imageQuality as any : undefined,
      visualClarity: typeof ir.visualClarity === "string" ? ir.visualClarity as any : undefined,
      distinctiveFeaturesVisible: typeof ir.distinctiveFeaturesVisible === "boolean" ? ir.distinctiveFeaturesVisible : undefined,
      uncertaintyReason: typeof ir.uncertaintyReason === "string" ? ir.uncertaintyReason.trim() : undefined,
      candidates: Array.isArray(ir.candidates)
        ? ir.candidates.map((c: any) => ({
            nameAr: typeof c.nameAr === "string" ? c.nameAr.trim() : "",
            nameEn: typeof c.nameEn === "string" ? c.nameEn.trim() : "",
            recognitionScore: typeof c.recognitionScore === "number" ? Math.max(0, Math.min(1, c.recognitionScore)) : 0.5
          })).filter((c: any) => c.nameAr.length > 0)
        : [],
      visibleComponents: Array.isArray(ir.visibleComponents) ? ir.visibleComponents.map(String).map(s => s.trim()).filter(Boolean) : [],
      likelyIngredients: Array.isArray(ir.likelyIngredients) ? ir.likelyIngredients.map(String).map(s => s.trim()).filter(Boolean) : [],
      confirmedIngredients: Array.isArray(ir.confirmedIngredients) ? ir.confirmedIngredients.map(String).map(s => s.trim()).filter(Boolean) : [],
    };
  }

  return {
    isFood: parsed.isFood !== false,
    dishName: typeof parsed.dishName === "string" ? parsed.dishName.trim() : "",
    rawItems: items,
    userIntent: typeof parsed.userIntent === "string" ? parsed.userIntent : undefined,
    isAmbiguous: typeof parsed.isAmbiguous === "boolean" ? parsed.isAmbiguous : undefined,
    aiRefinementSuggestions: aiRefinementSuggestions as any[],
    imageRecognition,
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

/**
 * Split a compound DB entry name into its individual matchable components.
 * Strips parenthetical explanatory notes, then splits at "/" and " و ".
 * Examples:
 *   "شوكولاتة / شوكولاتة بالحليب (دارك وغير دارك)" → ["شوكولاتة", "شوكولاتة بالحليب"]
 *   "دجاج و فراخ" → ["دجاج", "فراخ"]
 *   "أرز / رز ابيض مصري" → ["أرز", "رز ابيض مصري"]
 *   "بطاطس" → ["بطاطس"] (single component unchanged)
 */
function splitComponents(nameAr: string): string[] {
  const clean = nameAr.replace(/\s*\([^)]*\)/g, "").trim();
  const parts = (clean || nameAr)
    .split(/\/|\s+و\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [nameAr.trim()];
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

  // Build the normalized list:
  //  • Each DB entry is split into individual components (at "/" and " و ") so
  //    "دجاج و فراخ" produces separate matchable entries for "دجاج" and "فراخ".
  //  • "ما عدا" entries produce a main entry plus exception entries with flipped
  //    status. Exception entries are appended last so a dedicated DB row always
  //    wins over an exception-derived one when both yield the same answer.
  const normalized: MatchEntry[] = [];
  const exceptionEntries: MatchEntry[] = [];

  for (const f of allFoods) {
    const nEn = normalizeName(f.nameEn);
    const exc = extractMaAdaException(f.nameAr);

    if (exc) {
      // Split the main part (before "ما عدا") into components too
      for (const comp of splitComponents(exc.mainPart)) {
        const compNar = normalizeName(comp);
        normalized.push({ row: f, nAr: compNar, nEn, sAr: stripArticle(compNar), sEn: stripArticle(nEn) });
      }

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
      // Split compound names into independent matchable components
      for (const comp of splitComponents(f.nameAr)) {
        const compNar = normalizeName(comp);
        normalized.push({ row: f, nAr: compNar, nEn, sAr: stripArticle(compNar), sEn: stripArticle(nEn) });
      }
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

    // Tier 3: whole-word match — query is a whole word inside a DB component,
    // or a DB component is a whole word inside the query.
    for (const e of all) {
      const qAr = sAr, qEn = sEn;
      if (qAr.length >= 3 && (wholeWordMatch(e.sAr, qAr) || wholeWordMatch(qAr, e.sAr))) return e;
      if (qEn.length >= 3 && (wholeWordMatch(e.sEn, qEn) || wholeWordMatch(qEn, e.sEn))) return e;
    }

    // Tier 4: every significant word (≥4 chars) in the query appears as a whole
    // word in a DB component. Requires ALL significant words to match so that
    // short/common words don't create false positives.
    const arWords = sAr.split(" ").filter((w) => w.length >= 4);
    if (arWords.length > 0) {
      for (const e of all) {
        if (arWords.every((w) => wholeWordMatch(e.sAr, w) || wholeWordMatch(e.nAr, w))) return e;
      }
    }
    const enWords = sEn.split(" ").filter((w) => w.length >= 4);
    if (enWords.length > 0) {
      for (const e of all) {
        if (enWords.every((w) => wholeWordMatch(e.sEn, w) || wholeWordMatch(e.nEn, w))) return e;
      }
    }

    // No confident match found → return unknown rather than guess.
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


import { DecisionEngine } from "../lib/decisionEngine.js";
import {
  getKnowledgeCache,
  resolveEntity,
  resolveWithInheritance,
  resolveFoodIdentity,
  resolveUnresolvedTermsWithAI,
  rerankImageCandidates,
  buildVariantSuggestions,
  buildUnifiedSuggestions,
  Provenance,
  EvidenceClass,
  UserIntent,
  type ResolvedEntity,
  type DishCandidate,
  type IngredientHypothesis,
  type EffectiveRecipe,
  type RefinementSuggestion
} from "../lib/knowledgeCache";

export function buildReportFromHypotheses(
  hypotheses: IngredientHypothesis[],
  query: string,
  analysisType: AnalysisReport["analysisType"],
  resolvedEntity: ResolvedEntity | null,
  resolvedVariant: any | null,
  knowledgeCache: any,
  userIntent?: UserIntent,
  isAmbiguous?: boolean,
  aiSuggestions?: { labelAr: string; labelEn: string; query?: string }[],
): AnalysisReport {
  // Map hypotheses to allowed, forbidden, conditional, unknown arrays
  const allowed: any[] = [];
  const forbidden: any[] = [];
  const conditional: any[] = [];
  const unknown: any[] = [];

  for (const h of hypotheses) {
    const foodId = h.resolvedFood?.id || (h.inferredEntity?.foodId ?? null);
    const foodRow = h.resolvedFood || (foodId && knowledgeCache?.foods ? knowledgeCache.foods.find((f: any) => f.id === foodId) : null);
    const dbReason = foodRow?.reason ?? null;
    const dbNotes = foodRow?.notes ?? null;

    let matchType: MatchType = "EXACT";
    if (!foodRow && !h.inferredEntity) {
      matchType = "UNKNOWN";
    } else if (h.observedEntity && h.inferredEntity && h.observedEntity.id !== h.inferredEntity.id) {
      matchType = "RECIPE_INFERRED";
    } else if (h.observedEntity) {
      if (h.observedEntity.matchScore === 60) {
        matchType = "PARENT_ENTITY";
      } else if (h.observedEntity.matchScore === 90) {
        matchType = "ALIAS";
      } else {
        matchType = "EXACT";
      }
    } else if (h.resolvedFood) {
      matchType = "EXACT";
    } else {
      matchType = "UNKNOWN";
    }

    const matchedEntity = h.inferredEntity ? {
      id: h.inferredEntity.id,
      nameAr: h.inferredEntity.nameAr,
      nameEn: h.inferredEntity.nameEn,
      type: h.inferredEntity.type,
    } : null;

    let confidence: "HIGH" | "MEDIUM" | "LOW" = "HIGH";
    const mt = matchType as string;
    if (mt === "EXACT" || mt === "ALIAS" || mt === "VARIANT") {
      confidence = "HIGH";
    } else if (mt === "PARENT_ENTITY" || mt === "FUZZY") {
      confidence = "MEDIUM";
    } else {
      confidence = "LOW";
    }

    const itemResult = {
      name: h.rawNameEn || h.inferredEntity?.nameEn || h.rawNameAr,
      nameAr: h.rawNameAr || h.inferredEntity?.nameAr || h.rawNameEn,
      status: h.compatibilityStatus,
      frequency: null,
      reason: dbReason || (h.compatibilityStatus === "unknown" ? "هذا الطعام غير متوفر في قاعدة بيانات طيباتي" : null),
      notes: dbNotes,
      
      // Diagnostic and explainability properties
      dbReason,
      dbNotes,
      matchType,
      matchedEntity,

      // Raw observed names
      rawNameAr: h.rawNameAr || null,
      rawNameEn: h.rawNameEn || null,

      // Additive properties for UI/API compatibility
      observedEntity: h.observedEntity,
      observationProvenance: h.observationProvenance,
      inferredEntity: h.inferredEntity,
      inferenceProvenance: h.inferenceProvenance,
      contextSupport: h.contextSupport,
      recipeProvenance: h.recipeProvenance,
      evidenceClass: h.evidenceClass,
      confidence: h.resolvedFood ? "HIGH" : confidence,
      visualConfidence: h.visualConfidence,
    };

    if (h.compatibilityStatus === "allowed") allowed.push(itemResult);
    else if (h.compatibilityStatus === "forbidden") forbidden.push(itemResult);
    else if (h.compatibilityStatus === "conditional") conditional.push(itemResult);
    else unknown.push(itemResult);
  }

  // SSoT: scoring delegated exclusively to DecisionEngine
  const { compatibilityScore: score } = DecisionEngine.computeScores(allowed.length, forbidden.length, conditional.length, unknown.length);

  // Build summary explanation
  const parts: string[] = [];
  if (forbidden.length > 0)
    parts.push(`يحتوي على مكونات ممنوعة: ${forbidden.map((f) => f.nameAr).join("، ")}`);
  if (conditional.length > 0)
    parts.push(`مكونات مشروطة: ${conditional.map((f) => f.nameAr).join("، ")}`);
  if (forbidden.length === 0 && conditional.length === 0 && allowed.length > 0)
    parts.push("جميع المكونات الموجودة في قاعدة البيانات مسموح بها");
  if (allowed.length === 0 && forbidden.length === 0 && conditional.length === 0 && unknown.length > 0)
    parts.push("لم يتم العثور على أي من المكونات في قاعدة بيانات طيباتي");
  
  let explanation = parts.join(". ");
  if (!explanation) {
    if (score === null || (allowed.length === 0 && forbidden.length === 0 && conditional.length === 0)) {
      explanation = "لم نتمكن من التعرف على هذه المادة أو العثور على معلومات كافية لتحليل مدى ملاءمتها.";
    } else if (isAmbiguous) {
      explanation = "الرجاء تحديد نوع الطعام من الاقتراحات للحصول على تحليل دقيق لمدى ملاءمته.";
    } else {
      explanation = "تم تحليل المكونات";
    }
  }

  // Build hybrid unified suggestions
  const refinementSuggestions = buildUnifiedSuggestions(resolvedEntity, aiSuggestions || [], knowledgeCache);
  const relevantVariants = refinementSuggestions.map(s => ({
    nameAr: s.labelAr,
    query: s.query
  }));

  // Determine overall confidence
  let overallConfidence: "HIGH" | "MEDIUM" | "LOW" = "HIGH";
  let overallConfidenceReasonCode: "EXACT_MATCH" | "ALIAS_MATCH" | "VARIANT_MATCH" | "PARENT_ENTITY" | "FALLBACK_AI" | "NO_FOOD_FOUND" | "AMBIGUOUS" = "EXACT_MATCH";

  if (isAmbiguous) {
    overallConfidence = "MEDIUM";
    overallConfidenceReasonCode = "AMBIGUOUS";
  } else if (resolvedEntity) {
    if (resolvedVariant) {
      overallConfidence = "HIGH";
      overallConfidenceReasonCode = "VARIANT_MATCH";
    } else if (resolvedEntity.matchScore === 90) {
      overallConfidence = "HIGH";
      overallConfidenceReasonCode = "ALIAS_MATCH";
    } else if (resolvedEntity.matchScore === 60) {
      overallConfidence = "MEDIUM";
      overallConfidenceReasonCode = "PARENT_ENTITY";
    } else {
      overallConfidence = "HIGH";
      overallConfidenceReasonCode = "EXACT_MATCH";
    }
  } else if (hypotheses.length > 0) {
    overallConfidence = "MEDIUM";
    overallConfidenceReasonCode = "FALLBACK_AI";
  } else {
    overallConfidence = "LOW";
    overallConfidenceReasonCode = "NO_FOOD_FOUND";
  }

  const isUnknownFood = score === null || (allowed.length === 0 && forbidden.length === 0 && conditional.length === 0);
  const effectiveIsAmbiguous = isUnknownFood || (hypotheses.length === 0 && refinementSuggestions.length === 0) ? false : !!isAmbiguous;

  return {
    query: resolvedVariant?.nameAr || query,
    compatibilityScore: score,
    allowed,
    forbidden,
    conditional,
    unknown,
    explanation,
    suggestions: [],
    analysisType,
    resultMode: isUnknownFood ? "UNKNOWN_FOOD" : (effectiveIsAmbiguous ? "AMBIGUOUS_FOOD" : "EXACT_FOOD"),
    // Additive report options
    ...({
      resolvedDish: resolvedEntity && (resolvedEntity.type === "dish" || resolvedEntity.type === "dessert")
        ? { nameAr: resolvedEntity.nameAr, nameEn: resolvedEntity.nameEn, type: resolvedEntity.type }
        : undefined,
      resolvedVariant: resolvedVariant
        ? { nameAr: resolvedVariant.nameAr, nameEn: resolvedVariant.nameEn, variantKey: resolvedVariant.variantKey }
        : undefined,
      userIntent,
      isAmbiguous: effectiveIsAmbiguous,
      refinementSuggestions: effectiveIsAmbiguous ? refinementSuggestions : [],
      relevantVariants,
      hypotheses,
      overallConfidence: isUnknownFood ? "LOW" : overallConfidence,
      overallConfidenceReasonCode: isUnknownFood ? "NO_FOOD_FOUND" : overallConfidenceReasonCode,
    } as any),
  };
}

function buildNotFoundReport(query: string, analysisType: AnalysisReport["analysisType"]): AnalysisReport {
  return {
    query,
    compatibilityScore: null,
    allowed: [],
    forbidden: [],
    conditional: [],
    unknown: [],
    explanation: "لم نتمكن من التعرف على هذه المادة أو العثور على معلومات كافية لتحليل مدى ملاءمتها.",
    suggestions: [],
    analysisType,
    resultMode: "UNKNOWN_FOOD",
    notFound: true,
    ...({
      overallConfidence: "LOW",
      overallConfidenceReasonCode: "NO_FOOD_FOUND",
    } as any),
  };
}

router.post("/analysis/text", requireAuth, async (req, res) => {
  const tStart = performance.now();
  let queryText = "";
  try {
    const { query, displayQuery, entityType, canonicalId } = req.body as {
      query: string;
      displayQuery?: string;
      entityType?: string;
      canonicalId?: number | string;
    };
    queryText = typeof query === "string" ? query.trim() : "";
    const displayQueryText = typeof displayQuery === "string" ? displayQuery.trim() : queryText;

    if (!queryText) return void res.status(400).json({ error: "query is required" });

    const userId = req.userId!;

    const usage = await checkAndIncrementUsage(userId, "text");
    if (!usage.allowed) {
      return void res.status(429).json({
        error: "limit_reached",
        code: "TEXT_LIMIT_REACHED",
        message: "لقد وصلت إلى حد البحث النصي لهذا الشهر. يتجدد في أول الشهر القادم. قم بالترقية إلى بريميوم للاستخدام غير المحدود.",
      });
    }

    // Execute Universal Pipeline via UnifiedAnalysisEngine
    const unifiedResult = await UnifiedAnalysisEngine.analyze({
      query: queryText,
      displayQuery: displayQueryText,
      inputType: "text",
      userId,
      entityType: entityType as any,
      canonicalId,
    });

    const report = unifiedResult.report;
    const durationMs = Math.round(performance.now() - tStart);

    if (userId) {
      db.insert(analysisHistoryTable).values({
        userId,
        query: report.query,
        analysisType: "text",
        compatibilityScore: report.compatibilityScore,
        report: report as any,
      }).catch((err) => req.log.warn({ err }, "Failed to save history"));
    }

    const jsonResponse = {
      report,
      usage: { currentMonthCount: usage.count, limit: usage.limit, remaining: usage.remaining },
      performance: { durationMs, cacheHit: true },
    };

    const isDebug = process.env.SEARCH_DEBUG === "true" || process.env.NODE_ENV === "development";
    if (isDebug) {
      const dishRes = unifiedResult.dishAnalysisResult;
      const canonicalDish = dishRes?.dish;
      const diag = (dishRes as any)?.searchResult?.diagnostics || (unifiedResult as any).diagnostics || {};
      const resolvedIngs = dishRes ? dishRes.ingredientAnalysis.map((i) => i.canonicalFoodAr) : [];

      const traceBlock = [
        "\n========================================================",
        "SEARCH TRACE",
        "========================================================",
        "Query:",
        queryText,
        "",
        "Normalized:",
        CanonicalSearchEngine.normalize(queryText),
        "",
        "Food Alias Matches:",
        `${diag.foodAliasMatches || 0}${diag.foodAliasDetails?.length ? " -> " + diag.foodAliasDetails.join(", ") : ""}`,
        "",
        "Food Matches:",
        `${diag.foodMatches || 0}${diag.foodDetails?.length ? " -> " + diag.foodDetails.join(", ") : ""}`,
        "",
        "Dish Alias Matches:",
        `${diag.dishAliasMatches || 0}${diag.dishAliasDetails?.length ? " -> " + diag.dishAliasDetails.join(", ") : ""}`,
        "",
        "Dish Matches:",
        `${diag.dishMatches || 0}${diag.dishDetails?.length ? " -> " + diag.dishDetails.join(", ") : ""}`,
        "",
        "Selected Dish:",
        `ID: ${canonicalDish?.id ?? diag.canonicalId ?? "N/A"}`,
        `Name: ${canonicalDish?.nameAr ?? diag.canonicalName ?? report.query}`,
        "",
        "Recipe Loaded:",
        dishRes && dishRes.dish ? "YES" : "NO",
        "",
        "Ingredient Count:",
        dishRes ? dishRes.ingredientAnalysis.length : 0,
        "",
        "Resolved Ingredients:",
        resolvedIngs.length > 0 ? resolvedIngs.join(", ") : "None",
        "",
        "Decision:",
        report.primaryRuling?.status || dishRes?.finalCompatibility || "unknown",
        "",
        "Compatibility Score:",
        report.compatibilityScore !== null ? report.compatibilityScore : "N/A",
        "",
        "Final JSON:",
        JSON.stringify(jsonResponse, null, 2),
        "========================================================\n"
      ].join("\n");

      console.log(traceBlock);
    }

    return void res.json(jsonResponse);
  } catch (err) {
    console.error("ANALYSIS_TEXT_ERROR", {
      query: queryText,
      error: err,
      stack: err instanceof Error ? err.stack : undefined,
    });
    req.log.error({ err }, "Failed to analyze text");
    res.status(500).json({ error: "Analysis failed" });
  }
});

router.post("/analysis/dish", requireAuth, async (req, res) => {
  const tStart = performance.now();
  try {
    const { dishId } = req.body as { dishId: number };
    const idNum = Number(dishId);
    if (!idNum || isNaN(idNum)) {
      return void res.status(400).json({ error: "dishId is required and must be a number" });
    }

    const userId = req.userId!;

    const usage = await checkAndIncrementUsage(userId, "text");
    if (!usage.allowed) {
      return void res.status(429).json({
        error: "limit_reached",
        code: "TEXT_LIMIT_REACHED",
        message: "لقد وصلت إلى حد البحث النصي لهذا الشهر. يتجدد في أول الشهر القادم. قم بالترقية إلى بريميوم للاستخدام غير المحدود.",
      });
    }

    const unifiedResult = await UnifiedAnalysisEngine.analyze({
      dishId: idNum,
      inputType: "text",
      userId,
    });

    const report = unifiedResult.report;
    const durationMs = Math.round(performance.now() - tStart);

    if (userId) {
      db.insert(analysisHistoryTable).values({
        userId,
        query: report.query,
        analysisType: "text",
        compatibilityScore: report.compatibilityScore,
        report: report as any,
      }).catch((err) => req.log.warn({ err }, "Failed to save history"));
    }

    return void res.json({
      report,
      usage: { currentMonthCount: usage.count, limit: usage.limit, remaining: usage.remaining },
      performance: { durationMs, cacheHit: true },
    });
  } catch (err) {
    console.error("ANALYSIS_DISH_ERROR", err);
    res.status(500).json({ error: "Analysis by dishId failed" });
  }
});

function evaluateImageRecognition(ir: NonNullable<ExtractionResult["imageRecognition"]>): "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN" | "INSUFFICIENT_IMAGE" {
  // 1. Poor visual quality or clarity: never confident, require clearer image
  if (
    ir.imageQuality === "BLURRY" ||
    ir.imageQuality === "POOR_LIGHTING" ||
    ir.imageQuality === "OBSTRUCTED" ||
    ir.imageQuality === "PARTIAL" ||
    ir.visualClarity === "LOW"
  ) {
    return "INSUFFICIENT_IMAGE";
  }

  // 2. Explicit ambiguous image type from vision model
  if (ir.imageType === "AMBIGUOUS") {
    return "AMBIGUOUS";
  }

  // 3. Multiple foods handling: confident only when separate components are genuinely clear and reliable.
  // Never guess or invent an entire meal name if only components are visible.
  if (ir.imageType === "MULTIPLE_FOODS") {
    const isQualityClear = ir.imageQuality === "CLEAR" || ir.imageQuality === undefined;
    const isClarityHigh = ir.visualClarity === "HIGH";
    const hasFeatures = ir.distinctiveFeaturesVisible !== false;
    if (ir.visibleComponents.length >= 2 && isQualityClear && isClarityHigh && hasFeatures && !ir.uncertaintyReason) {
      return "CONFIDENT";
    }
    return "AMBIGUOUS";
  }

  // 4. No candidates provided
  if (!ir.candidates || ir.candidates.length === 0) {
    if (ir.visibleComponents.length > 0 || ir.likelyIngredients.length > 0 || ir.confirmedIngredients.length > 0) {
      return "AMBIGUOUS";
    }
    return "UNKNOWN";
  }

  const top = ir.candidates[0];
  const second = ir.candidates.length > 1 ? ir.candidates[1] : null;

  // 5. Very low score indicates extreme doubt, unrecognizable object, or non-food
  if (top.recognitionScore < 0.45) {
    return "UNKNOWN";
  }

  // 6. Strict CONFIDENT requirements:
  // - Top score must be high (>= 0.88)
  // - Distinctive visual features must be present
  // - Visual clarity must be acceptable (not LOW)
  // - If a second candidate exists, the top candidate must lead by a decisive margin (>= 0.20).
  //   If the gap is < 0.20, the model itself saw a viable alternative, which is visually ambiguous.
  const isHighConfidence = top.recognitionScore >= 0.88;
  const hasDistinctiveFeatures = ir.distinctiveFeaturesVisible !== false;
  const isQualityClear = ir.imageQuality === "CLEAR" || ir.imageQuality === undefined;
  const isClarityHigh = ir.visualClarity === "HIGH" || ir.visualClarity === undefined;
  const hasDecisiveMargin = !second || (top.recognitionScore - second.recognitionScore >= 0.20);

  if (isHighConfidence && hasDistinctiveFeatures && isQualityClear && isClarityHigh && hasDecisiveMargin) {
    return "CONFIDENT";
  }

  // 7. Otherwise, any doubt, competing alternative, or moderate score must route to AMBIGUOUS
  return "AMBIGUOUS";
}

router.post("/analysis/image", requireAuth, async (req, res) => {
  try {
    const { imageBase64, mimeType, analysisType } = req.body as {
      imageBase64: string;
      mimeType: string;
      analysisType: "food" | "label";
    };
    if (!imageBase64 || !mimeType) return void res.status(400).json({ error: "imageBase64 and mimeType required" });

    const userId = req.userId!;

    const usage = await checkAndIncrementUsage(userId, "image");
    if (!usage.allowed) {
      return void res.status(429).json({
        error: "limit_reached",
        code: "IMAGE_LIMIT_REACHED",
        message: "لقد وصلت إلى حد تحليل الصور لهذا الشهر. يتجدد في أول الشهر القادم. قم بالترقية إلى بريميوم للاستخدام غير المحدود.",
      });
    }

    const isLabel = analysisType === "label";
    const mode = isLabel ? "label" : "image";
    const imageAnalysisType = isLabel ? "label" : "image";
    const queryLabel = isLabel ? "مسح ملصق المنتج" : "تحليل صورة الطعام";

    const promptMode = isLabel ? "label" : "image";
    const promptText = buildImageExtractionPrompt(promptMode);

    const openai = await getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: promptText },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            {
              type: "text",
              text: isLabel ? "استخرج كل المكونات من ملصق المنتج." : "ما الأطعمة والمكونات في هذه الصورة؟",
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

    const ir = result.imageRecognition;
    if (!ir) {
      return void res.json(buildNotFoundReport(queryLabel, imageAnalysisType));
    }

    const status = evaluateImageRecognition(ir);
    const knowledgeCache = await getKnowledgeCache();

    // Enrich and deduplicate candidates: maximum 3 genuinely distinct candidates
    const enrichedCandidates: any[] = [];
    const seenNames = new Set<string>();

    for (const c of ir.candidates.slice(0, 3)) {
      const normC = normalize(c.nameAr);
      const stripC = stripArticle(normC);
      if (!stripC || seenNames.has(stripC)) continue;
      seenNames.add(stripC);

      const resolution = resolveWithInheritance(c.nameAr, knowledgeCache);
      const canonicalNameAr = (resolution as any)?.primaryFood?.nameAr || (resolution as any)?.resolvedEntity?.nameAr || c.nameAr;
      const normCanonical = stripArticle(normalize(canonicalNameAr));
      if (seenNames.has(normCanonical) && normCanonical !== stripC) continue;
      seenNames.add(normCanonical);

      enrichedCandidates.push({
        ...c,
        resolution: resolution ? {
          resolved: true,
          canonicalNameAr,
          canonicalNameEn: (resolution as any)?.primaryFood?.nameEn || (resolution as any)?.resolvedEntity?.nameEn || c.nameEn,
          resolutionType: resolution.matchType
        } : undefined
      });
      if (enrichedCandidates.length >= 3) break;
    }
    ir.candidates = enrichedCandidates as any;

    if ((status as any) === "AMBIGUOUS" || (status as any) === "UNKNOWN" || (status as any) === "INSUFFICIENT_IMAGE") {
      const isPackaged = ir.imageType === "PACKAGED_PRODUCT";
      let explanation = "";
      if (status === "INSUFFICIENT_IMAGE") {
        explanation = isPackaged
          ? "لم نتمكن من تحديد المنتج بدقة. حاول التقاط صورة أوضح للعبوة، ويفضل إظهار الاسم والمكونات."
          : "لم نتمكن من تحديد الطعام بدقة. حاول التقاط صورة أوضح للمنتج أو العبوة، ويفضل إظهار الاسم والمكونات.";
      } else if (status === "AMBIGUOUS") {
        explanation = isPackaged
          ? "لم نتمكن من تحديد المنتج بدقة. ربما تقصد أحد هذه الخيارات:"
          : "لم نتمكن من تحديد الطعام بدقة. ربما تقصد أحد هذه الخيارات:";
      } else {
        explanation = isPackaged
          ? "لم نتمكن من تحديد المنتج بدقة. حاول التقاط صورة أوضح للعبوة، ويفضل إظهار الاسم والمكونات."
          : "لم نتمكن من تحديد الطعام بدقة. حاول التقاط صورة أوضح، ويفضل إظهار الطعام والمكونات بوضوح.";
      }

      const report: AnalysisReport = {
        query: queryLabel,
        analysisType: imageAnalysisType,
        scoreAvailable: false,
        compatibilityScore: null,
        allowed: [], forbidden: [], conditional: [], unknown: [],
        explanation,
        suggestions: [],
        imageRecognition: { ...ir, status, candidates: enrichedCandidates }
      };
      return void res.json(report);
    }

    // CONFIDENT state
    // We run resolution on either the top candidate (if single food/dish) or all visible components (if multiple foods)
    let finalQuery = queryLabel;
    let componentsToResolve: string[] = [];

    if (ir.imageType === "MULTIPLE_FOODS" && ir.visibleComponents.length > 0) {
      componentsToResolve = ir.visibleComponents;
      finalQuery = "وجبة متعددة الأصناف";
    } else if (ir.candidates.length > 0) {
      componentsToResolve = [ir.candidates[0].nameAr];
      finalQuery = ir.candidates[0].nameAr;
    } else if (ir.confirmedIngredients.length > 0) {
      componentsToResolve = ir.confirmedIngredients;
      finalQuery = "ملصق منتج";
    } else {
      // Fallback
      componentsToResolve = ir.visibleComponents.length > 0 ? ir.visibleComponents : (ir.likelyIngredients.length > 0 ? ir.likelyIngredients : []);
    }

    const allowed: IngredientResult[] = [];
    const forbidden: IngredientResult[] = [];
    const conditional: IngredientResult[] = [];
    const unknown: IngredientResult[] = [];
    let primaryRuling: AnalysisReport["primaryRuling"] = undefined;
    let resultMode: AnalysisReport["resultMode"] = "COMPOSITE_FOOD";

    // If it's a single dish/food and we have a strong db ruling for it directly:
    if (componentsToResolve.length === 1) {
      const resolution = resolveWithInheritance(componentsToResolve[0], knowledgeCache);
      if (resolution && (resolution.matchType === "EXACT_FOOD" || resolution.matchType === "SPECIFIC_INHERITED")) {
         resultMode = resolution.matchType as any;
         primaryRuling = {
           status: resolution.food.status,
           nameAr: resolution.food.nameAr,
           nameEn: resolution.food.nameEn,
           dbReason: resolution.food.reason,
           dbNotes: resolution.food.notes,
           isInherited: resolution.matchType === "SPECIFIC_INHERITED",
           inheritsFrom: resolution.inheritsFrom ? { nameAr: resolution.inheritsFrom.nameAr, nameEn: resolution.inheritsFrom.nameEn } : undefined
         };
         if (resolution.food.status === "allowed") allowed.push({ name: resolution.food.nameEn, nameAr: resolution.food.nameAr, status: "allowed", reason: resolution.food.reason });
         else if (resolution.food.status === "forbidden") forbidden.push({ name: resolution.food.nameEn, nameAr: resolution.food.nameAr, status: "forbidden", reason: resolution.food.reason });
         else if (resolution.food.status === "conditional") conditional.push({ name: resolution.food.nameEn, nameAr: resolution.food.nameAr, status: "conditional", reason: resolution.food.reason });
      }
    }

    // If we didn't get a primary ruling, we resolve each component/ingredient using the shared food identity resolver
    if (!primaryRuling) {
       let items = ir.confirmedIngredients.length > 0 ? ir.confirmedIngredients : (ir.visibleComponents.length > 0 ? ir.visibleComponents : ir.likelyIngredients);
       if (componentsToResolve.length > 1) items = componentsToResolve;
       
       // Step 1: Batch deterministic resolution of all image-extracted ingredients
       const deterministicResolved = new Map<string, any>();
       const unresolvedStrings: string[] = [];

       for (const comp of items) {
          const identity = resolveFoodIdentity(comp, knowledgeCache);
          if (identity) {
             deterministicResolved.set(comp, identity);
          } else {
             unresolvedStrings.push(comp);
          }
       }

       // Step 2: Controlled AI identity interpretation fallback for any unresolved ingredients (batched)
       let aiResolved = new Map<string, any>();
       if (unresolvedStrings.length > 0) {
          aiResolved = await resolveUnresolvedTermsWithAI(unresolvedStrings, knowledgeCache, getOpenAIClient);
       }

       // Step 3: Map each ingredient to its resolved DB food ruling
       for (const comp of items) {
          const identity = deterministicResolved.get(comp) || aiResolved.get(comp);
          if (identity) {
             const f = identity.food;
             const st = f.status as IngredientStatus;
             const resObj = { name: f.nameEn || comp, nameAr: comp, status: st, reason: f.reason || null, notes: f.notes || null };
             if (st === "allowed") allowed.push(resObj);
             else if (st === "forbidden") forbidden.push(resObj);
             else if (st === "conditional") conditional.push(resObj);
             else unknown.push(resObj);
          } else {
             unknown.push({ name: comp, nameAr: comp, status: "unknown", reason: null });
          }
       }
    }

    // SSoT: scoring delegated exclusively to DecisionEngine
    const { compatibilityScore: finalScore, ingredientConfidence, scoreAvailable } = DecisionEngine.computeScores(
      allowed.length, forbidden.length, conditional.length, unknown.length
    );
    let explanation = "تم التعرف على الطعام.";

    if (forbidden.length > 0 || primaryRuling?.status === "forbidden") {
       explanation = primaryRuling?.dbReason || "تحتوي الوجبة على مكونات ممنوعة.";
    } else if (conditional.length > 0 || primaryRuling?.status === "conditional") {
       explanation = primaryRuling?.dbReason || "تحتوي الوجبة على مكونات مشبوهة أو تعتمد على طريقة التحضير.";
    } else if (unknown.length > 0 && !primaryRuling) {
       explanation = "النتيجة غير مكتملة، نحتاج لمعلومات إضافية حول بعض المكونات.";
    } else if (allowed.length > 0 || primaryRuling?.status === "allowed") {
       explanation = primaryRuling?.dbReason || "مسموح حسب المعلومات المتوفرة.";
    }

    const report: AnalysisReport = {
      query: finalQuery,
      analysisType: imageAnalysisType,
      scoreAvailable,
      compatibilityScore: finalScore,
      ingredientConfidence,
      resultMode,
      primaryRuling,
      allowed,
      forbidden,
      conditional,
      unknown,
      explanation,
      suggestions: [],
      imageRecognition: { ...ir, status: "CONFIDENT", candidates: enrichedCandidates }
    };

    if (userId) {
      await db.insert(analysisHistoryTable).values({
        userId,
        query: report.query,
        analysisType: imageAnalysisType,
        compatibilityScore: report.compatibilityScore ?? 0,
        report: report as any,
      }).catch((err) => req.log.warn({ err }, "Failed to save history"));
    }

    res.json(report);
  } catch (err) {
    req.log.error({ err }, "Failed to analyze image");
    res.status(500).json({ error: "Image analysis failed" });
  }
});

export default router;

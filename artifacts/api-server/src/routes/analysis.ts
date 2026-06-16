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

async function isUserPremium(userId: string): Promise<boolean> {
  try {
    const [account] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    return account?.isPremium === "true";
  } catch {
    return false;
  }
}

/** Returns the user's plan limits, or free defaults if they have no plan. */
async function getUserPlanLimits(userId: string): Promise<{ textLimit: number; imageLimit: number }> {
  const freeText = await getFreeDailyLimit();
  const freeImage = Math.ceil(freeText / 2);
  try {
    const [account] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!account?.planId) return { textLimit: freeText, imageLimit: freeImage };
    const [plan] = await db.select().from(subscriptionPlansTable).where(eq(subscriptionPlansTable.id, account.planId));
    if (!plan) return { textLimit: freeText, imageLimit: freeImage };
    return {
      textLimit: plan.dailyTextLimit,
      imageLimit: plan.dailyImageLimit,
    };
  } catch {
    return { textLimit: freeText, imageLimit: freeImage };
  }
}

async function checkAndIncrementUsage(
  userId: string,
  type: "text" | "image"
): Promise<{ allowed: boolean; dailyCount: number; textCount: number; imageCount: number }> {
  const today = new Date().toISOString().split("T")[0];
  const premium = await isUserPremium(userId);
  const limits = await getUserPlanLimits(userId);

  const existing = await db
    .select()
    .from(userUsageTable)
    .where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, today)));

  if (existing.length === 0) {
    const newTextCount = type === "text" ? 1 : 0;
    const newImageCount = type === "image" ? 1 : 0;
    await db.insert(userUsageTable).values({
      userId,
      date: today,
      count: 1,
      textCount: newTextCount,
      imageCount: newImageCount,
      isPremium: premium ? "true" : "false",
    });
    return { allowed: true, dailyCount: 1, textCount: newTextCount, imageCount: newImageCount };
  }

  const row = existing[0];
  const newTextCount = row.textCount + (type === "text" ? 1 : 0);
  const newImageCount = row.imageCount + (type === "image" ? 1 : 0);
  const newCount = row.count + 1;

  if (!premium && row.isPremium !== "true") {
    const typeCount = type === "text" ? row.textCount : row.imageCount;
    const typeLimit = type === "text" ? limits.textLimit : limits.imageLimit;
    if (typeLimit >= 0 && typeCount >= typeLimit) {
      return { allowed: false, dailyCount: row.count, textCount: row.textCount, imageCount: row.imageCount };
    }
  }

  await db
    .update(userUsageTable)
    .set({ count: newCount, textCount: newTextCount, imageCount: newImageCount })
    .where(and(eq(userUsageTable.userId, userId), eq(userUsageTable.date, today)));
  return { allowed: true, dailyCount: newCount, textCount: newTextCount, imageCount: newImageCount };
}

export type IngredientStatus = "allowed" | "forbidden" | "conditional" | "unknown";
export type IngredientFrequency = "basic" | "daily" | "weekly" | "occasional" | null;

export interface IngredientResult {
  name: string;
  nameAr: string;
  status: IngredientStatus;
  frequency?: IngredientFrequency;
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
  possibleFoods?: string[];
}

type FoodRow = typeof foodsTable.$inferSelect;

/**
 * The Tayyibat dietary system, distilled from Dr. Diaa Al-Awadi's book.
 * The AI classifies EVERY ingredient against these rules — the small DB is only
 * an authoritative override for specific items the admin has curated.
 */
const TAYYIBAT_SYSTEM = `نظام الطيبات — للدكتور ضياء العوضي رحمه الله.

المبدأ الجوهري للتصنيف:
• الطعام الطبيعي كما خلقه الله (طيّب) = مسموح. الطعام المصنّع أو المعدّل صناعياً أو المهرمن = ممنوع.
• «الطعام الطيب هو ما خرج من الأرض كما خلقه الله، فإذا تدخّل فيه الإنسان أفسده».
• عند الشك في صنف غير مذكور صراحةً: طبّق المبدأ — هل هو طبيعي بسيط (مسموح) أم مصنّع/مكرر/مهرمن (ممنوع)؟

مؤشر التكرار (frequency) للأصناف المسموحة:
• basic (أساسي): يؤكل بلا قيود في معظم الوجبات — أرز، تمر، سمن بلدي، بطاطا، زبدة بلدي، زيت زيتون، قشطة، عسل.
• daily (يوميًا): مرة في اليوم — عسل، تمر، توست قمح كامل، جبنة مطبوخة، زيتون، مكسرات.
• weekly (أسبوعيًا): اللحوم المسموحة بالتناوب، السمك، الفواكه المسموحة، الأجبان المطبوخة.
• occasional (أحيانًا): شوكولاتة داكنة، مربيات، محشي خضار، جوافة.

═══ قواعد التصنيف الدقيقة (أولوية قصوى) ═══
• اللحوم المسموحة (weekly): لحم البقري/البتلو/الكندوز/الجاموسي، الإبل (جمل)، الضأن (خروف/غنم)، الماعز، الأرانب، الحمام، السمك بجميع أنواعه.
• اللحوم الممنوعة: الدجاج، الفراخ، البط، الديك الرومي، البيض بأنواعه.
• الكبدة: من البقر/الضأن/الماعز/الجاموس = مسموح weekly. كبدة الدجاج/الفراخ = ممنوع.
• الأرانب: مسموح weekly. لا تخلط بين الأرانب (مسموح) والدجاج (ممنوع).
• الزبدة البلدية (طبيعية من الحليب) = مسموح basic. الزبدة المكررة/الصناعية/النباتية = ممنوع.
• الألبان: اللبن البلدي الطازج غير المبستر = ممنوع (تدخل صناعي). القشطة الطبيعية، السمن البلدي = مسموح.
• الفواكه المسموحة (weekly): العنب، الرمان، التفاح المقشر، الموز، الكرز، الفراولة، المشمش، البرقوق، الجوافة بدون بذر، التين، التمر، الزبيب، الفواكه المجففة. كل ما عداها = ممنوع.
• الفواكه الممنوعة: البطيخ، الشمام، الموالح (برتقال/ليمون/كيوي/جريبفروت)، الأفوكادو، البابايا، الخيار، الكوسة.
• الخضار: المسموح مطبوخ فقط (حشو بالأرز). الخضار النيء/السلطات = ممنوع. البطاطا/البطاطس = مسموح basic.
• الحبوب: الأرز = مسموح basic. القمح/الدقيق الأبيض = ممنوع (مكرر). توست القمح الكامل = مسموح daily.
• الحلويات: العسل الطبيعي = مسموح basic. الشوكولاتة الداكنة = مسموح occasional. السكر الأبيض المكرر = مشروط.
• المشروبات: الماء والعصائر الطبيعية المعصورة مباشرة = مسموح. المشروبات الغازية، الشاي المعبأ، القهوة الصناعية = ممنوع.
• اللبنيات: الجبنة المطبوخة (مثلثات لاف) = مسموح daily. الجبنة البيضاء الطازجة = مسموح. الجبنة المصنعة الأخرى = ممنوع.
• المكسرات الطبيعية = مسموح daily. المكسرات المحمصة بالملح/الزيوت الصناعية = ممنوع.
• أمثلة شائعة: برجر = لحم بقري (مسموح) + خبز أبيض (ممنوع) + جبنة مصنعة (ممنوع). كنتاكي/KFC = دجاج (ممنوع). شاورما لحم = لحم غنم/بقر (مسموح) + خبز (ممنوع). تونة = سمك (مسموح). سوشي = أرز (مسموح) + سمك (مسموح).

═══ غير معروف (status=unknown) ═══
فقط للمكونات التي لا يمكن تصنيفها إطلاقاً حسب المبدأ (نادر جداً). حاول دائماً التصنيف حسب المبدأ الجوهري أولاً.`;

function buildCatalog(foods: FoodRow[]): string {
  if (foods.length === 0) return "(لا توجد عناصر مخصصة)";
  return foods.map((f) => `${f.nameEn} | ${f.nameAr} | ${f.status}${f.reason ? " | " + f.reason : ""}`).join("\n");
}

function buildClassificationPrompt(allFoods: FoodRow[], mode: "text" | "image" | "label"): string {
  const catalog = buildCatalog(allFoods);

  const extractionInstr =
    mode === "label"
      ? `استخرج قائمة المكونات الكاملة من ملصق المنتج في الصورة (بما فيها الأرقام E، المستحلبات، المواد الحافظة، الألوان). ترجم كل مكوّن للعربية.`
      : mode === "image"
        ? `حلّل الصورة بالكامل: حدّد الطبق وكل مكوّناته الظاهرة والمكوّنات الضمنية المعتادة. كن دقيقاً في نوع اللحم. إذا كانت الصورة غامضة أو يصعب تحديد نوع الطعام بثقة، أضف حقل "possibleFoods" بقائمة من 2-5 احتمالات باللغة العربية.`
        : `حلّل نص المستخدم: حدّد الطبق/الصنف وكل مكوّناته (الظاهرة والضمنية). تعامل مع جميع اللهجات العربية وأخطاء الإملاء وأسماء العلامات التجارية. كن دقيقاً في نوع اللحم — لا تكتب "لحم" عام، حدّد نوعه: لحم بقري أو دجاج أو غنم أو أرنب. أمثلة: برجر (معروف) = لحم بقري (مسموح) + خبز أبيض (ممنوع) + جبنة (ممنوع) + صوص (ممنوع). كنتاكي = دجاج (ممنوع) + دقيق (ممنوع). تونة = تونة (مسموح).`

  return `أنت خبير في نظام الطيبات الغذائي. مهمتك: ${extractionInstr}

ثم صنّف كل مكوّن حسب نظام الطيبات أدناه. صنّف كل المكونات — لا تتجاهل أي مكوّن.

${TAYYIBAT_SYSTEM}

═══ قاعدة بيانات مخصصة (لها الأولوية المطلقة) ═══
إذا تطابق مكوّن مع عنصر في هذه القائمة، استخدم تصنيفها هي وليس استنتاجك:
${catalog}

═══ صيغة الإخراج ═══
أعِد JSON صالحاً فقط بهذا الشكل:
{
  "isFood": true,
  "dishName": "اسم الطبق أو الصنف بالعربية",
  "items": [
    {
      "nameAr": "الاسم بالعربية",
      "nameEn": "English name",
      "status": "allowed | forbidden | conditional | unknown",
      "frequency": "basic | daily | weekly | occasional | null",
      "reason": "سبب مختصر بالعربية حسب نظام الطيبات"
    }
  ],
  "summary": "ملخص قصير بالعربية لحكم الطبق إجمالاً",
  "suggestions": ["بدائل عملية بالعربية للمكونات الممنوعة، من النظام نفسه"],
  "possibleFoods": ["احتمال1 بالعربية", "احتمال2"]
}

قواعد:
• isFood=false فقط إذا لم تكن الصورة/النص متعلقة بطعام إطلاقاً (سيارة، شخص، كلام عشوائي). عندها أعِد items فارغة.
• frequency تُملأ للأصناف allowed فقط؛ للممنوع والمشروط وغير المعروف ضع null.
• reason إلزامي لكل مكوّن: لماذا مسموح/ممنوع حسب النظام.
• suggestions: لكل مكوّن ممنوع اقترح بديلاً من النظام (مثلاً: استبدل الدجاج بالحمام أو السمك؛ استبدل الخبز الأبيض بتوست القمح الكامل أو الأرز؛ استبدل اللبن بالزبدة البلدي).
• كن شاملاً: الوجبة المركّبة تحتوي عدة مكونات، اذكرها كلها.
• possibleFoods: أضفه فقط عند الغموض الحقيقي (صورة غير واضحة أو مشروب/وجبة لا يمكن تمييزها). لا تضعه إذا كان الطعام واضحاً.`;
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

interface ClassificationResult {
  isFood: boolean;
  dishName: string;
  items: IngredientResult[];
  summary: string;
  suggestions: string[];
  possibleFoods: string[];
}

function parseClassification(content: string): ClassificationResult {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(content || "{}");
  } catch {
    return { isFood: false, dishName: "", items: [], summary: "", suggestions: [], possibleFoods: [] };
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items: IngredientResult[] = rawItems
    .map((it: unknown): IngredientResult | null => {
      if (typeof it !== "object" || it === null) return null;
      const o = it as Record<string, unknown>;
      const nameAr = typeof o.nameAr === "string" ? o.nameAr.trim() : "";
      const nameEn = typeof o.nameEn === "string" ? o.nameEn.trim() : "";
      if (!nameAr && !nameEn) return null;
      const status = normalizeStatus(o.status);
      return {
        name: nameEn || nameAr,
        nameAr: nameAr || nameEn,
        status,
        frequency: status === "allowed" ? normalizeFrequency(o.frequency) : null,
        reason: typeof o.reason === "string" && o.reason.trim() ? o.reason.trim() : null,
      };
    })
    .filter((x): x is IngredientResult => x !== null);

  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 6)
    : [];

  const possibleFoods = Array.isArray(parsed.possibleFoods)
    ? parsed.possibleFoods.filter((s) => typeof s === "string" && s.trim().length > 0).slice(0, 6)
    : [];

  return {
    isFood: parsed.isFood !== false,
    dishName: typeof parsed.dishName === "string" ? parsed.dishName.trim() : "",
    items,
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    suggestions,
    possibleFoods,
  };
}

/** Normalize an Arabic/English food name for exact-match comparison against the DB. */
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

/**
 * Authoritative DB override: if a classified item exactly matches a curated DB
 * entry (by normalized Arabic or English name), the DB ruling wins over the AI.
 */
function applyDbOverride(items: IngredientResult[], allFoods: FoodRow[]): IngredientResult[] {
  if (allFoods.length === 0) return items;
  const byName = new Map<string, FoodRow>();
  for (const f of allFoods) {
    byName.set(normalizeName(f.nameAr), f);
    byName.set(normalizeName(f.nameEn), f);
  }
  return items.map((item) => {
    const match = byName.get(normalizeName(item.nameAr)) ?? byName.get(normalizeName(item.name));
    if (!match) return item;
    const status = match.status as IngredientStatus;
    return {
      ...item,
      status,
      frequency: status === "allowed" ? item.frequency ?? null : null,
      reason: match.reason ?? item.reason,
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

function buildReportFromClassification(
  result: ClassificationResult,
  query: string,
  analysisType: AnalysisReport["analysisType"],
  allFoods: FoodRow[],
): AnalysisReport {
  const items = applyDbOverride(result.items, allFoods);
  const allowed = items.filter((i) => i.status === "allowed");
  const forbidden = items.filter((i) => i.status === "forbidden");
  const conditional = items.filter((i) => i.status === "conditional");
  const unknown = items.filter((i) => i.status === "unknown");

  const score = scoreFromResults(allowed, forbidden, conditional, unknown);

  let explanation = result.summary;
  if (!explanation) {
    const parts: string[] = [];
    if (forbidden.length > 0) parts.push(`يحتوي على مكونات ممنوعة: ${forbidden.map((f) => f.nameAr).join("، ")}`);
    if (conditional.length > 0) parts.push(`مكونات مشروطة: ${conditional.map((f) => f.nameAr).join("، ")}`);
    if (forbidden.length === 0 && conditional.length === 0 && allowed.length > 0) {
      parts.push("جميع المكونات مسموح بها في نظام الطيبات");
    }
    explanation = parts.join(". ") || "تم تحليل المكونات";
  }

  const queryLabel = result.dishName || query;

  return {
    query: queryLabel,
    compatibilityScore: score,
    allowed,
    forbidden,
    conditional,
    unknown,
    explanation,
    suggestions: result.suggestions,
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
          message: "لقد وصلت إلى الحد اليومي للبحث النصي. قم بالترقية إلى بريميوم للمتابعة.",
        });
      }
    }

    const allFoods = await db.select().from(foodsTable);
    const openai = await getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildClassificationPrompt(allFoods, "text") },
        { role: "user", content: query.trim() },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.1,
    });

    const result = parseClassification(completion.choices[0].message.content || "{}");

    if (!result.isFood || result.items.length === 0) {
      return void res.json(buildNotFoundReport(query.trim(), "text"));
    }

    const report = buildReportFromClassification(result, query.trim(), "text", allFoods);

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
          message: "لقد وصلت إلى الحد اليومي لتحليل الصور. قم بالترقية إلى بريميوم للمتابعة.",
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
        { role: "system", content: buildClassificationPrompt(allFoods, mode) },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            {
              type: "text",
              text: isLabel
                ? "استخرج كل المكونات من ملصق المنتج وصنّفها حسب نظام الطيبات."
                : "ما الأطعمة والمكونات في هذه الصورة؟ صنّفها كلها حسب نظام الطيبات.",
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.1,
    });

    const result = parseClassification(completion.choices[0].message.content || "{}");

    if (!result.isFood) {
      return void res.json(buildNotFoundReport(queryLabel, imageAnalysisType));
    }
    if (result.items.length === 0 && result.possibleFoods.length > 0) {
      return void res.json({ ...buildNotFoundReport(queryLabel, imageAnalysisType), possibleFoods: result.possibleFoods, notFound: false });
    }
    if (result.items.length === 0) {
      return void res.json(buildNotFoundReport(queryLabel, imageAnalysisType));
    }

    const report = buildReportFromClassification(result, queryLabel, imageAnalysisType, allFoods);

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

import { getKnowledgeCache, resolveFoodIdentity } from "./knowledgeCache";
import { warmDishEngineCache, getProteinFields } from "./dishCompatibilityEngine";
import { normalize, stripArticle, stripAlefLam } from "./arabicNormalization";
import { determineFoodSource } from "./unifiedAnalysisEngine";

export interface MultiItemResultItem {
  id?: number;
  rawQuery: string;
  nameAr: string;
  nameEn?: string;
  itemType: "food" | "dish" | "category" | "unknown";
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  reason?: string | null;
  notes?: string | null;
  categoryAr?: string;
  sourceType?: string;
  categoryStats?: {
    total: number;
    allowedCount: number;
    forbiddenCount: number;
    conditionalCount: number;
    isFullyForbidden: boolean;
    exceptions: string[];
    hasMore: boolean;
  };
  sampleItems?: {
    allowed: any[];
    forbidden: any[];
    conditional: any[];
  };
}

export interface MultiItemDecompositionResult {
  isMultiItem: boolean;
  items: MultiItemResultItem[];
  rawTokens: string[];
}

export class MultiItemEngine {
  private static CATEGORY_KEYWORDS: Record<string, string> = {
    ورقيات: "خضروات",
    الورقيات: "خضروات",
    خضروات: "خضروات",
    الخضروات: "خضروات",
    خضار: "خضروات",
    الخضار: "خضروات",
    بقوليات: "بقوليات",
    البقوليات: "بقوليات",
    فواكه: "فواكه",
    الفواكه: "فواكه",
    فاكهه: "فواكه",
    الفاكهه: "فواكه",
    فاكهة: "فواكه",
    الفاكهة: "فواكه",
    لحوم: "لحوم",
    اللحوم: "لحوم",
    حبوب: "حبوب",
    الحبوب: "حبوب",
    نشويات: "حبوب",
    النشويات: "حبوب",
    مكسرات: "مكسرات",
    المكسرات: "مكسرات",
    البان: "ألبان",
    الألبان: "ألبان",
    ألبان: "ألبان",
  };

  /**
   * Parse Arabic conjunctions ('و', '،', ',') while strictly protecting multi-word foods,
   * single entities, and composite dishes from accidental fragmentation.
   */
  public static splitArabicQuery(rawQuery: string): string[] {
    if (!rawQuery || typeof rawQuery !== "string") return [];

    let cleaned = rawQuery.trim();

    // Replace explicit list separators with standard space-waw-space
    cleaned = cleaned.replace(/[،,;\n]+/g, " و ");

    // Split on space followed by conjunction 'و'
    // Matches: " و " or " و" directly attached to the next Arabic word
    const parts: string[] = [];
    const tokens = cleaned.split(/\s+/);

    let currentItemParts: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i].trim();
      if (!t) continue;

      if (t === "و") {
        if (currentItemParts.length > 0) {
          parts.push(currentItemParts.join(" "));
          currentItemParts = [];
        }
      } else if (t.startsWith("و") && t.length > 2 && i > 0) {
        // Word attached to 'و' (e.g. 'وشمام', 'وتفاح', 'والبيض', 'والورقيات')
        // Only treat as conjunction boundary if preceding parts already exist
        if (currentItemParts.length > 0) {
          parts.push(currentItemParts.join(" "));
          currentItemParts = [];
        }
        // Strip the leading conjunction 'و'
        currentItemParts.push(t.substring(1));
      } else {
        currentItemParts.push(t);
      }
    }

    if (currentItemParts.length > 0) {
      parts.push(currentItemParts.join(" "));
    }

    // Filter empty and return distinct trimmed items
    return parts.map((p) => p.trim()).filter((p) => p.length > 0);
  }

  /**
   * Deterministically evaluate if a query contains multiple distinct recognizable foods/categories,
   * preserving genuine composite dishes and browse intents intact.
   */
  public static async decomposeAndEvaluate(
    rawQuery: string,
    isPremium: boolean = false
  ): Promise<MultiItemDecompositionResult> {
    const trimmed = rawQuery.trim();

    // Rule 1: Never decompose browse or generic intent queries
    if (
      trimmed.includes("مسموح") ||
      trimmed.includes("ممنوع") ||
      trimmed.includes("سعرات") ||
      trimmed.includes("دايت") ||
      trimmed.includes("رجيم") ||
      trimmed.includes("حساب") ||
      trimmed.includes("خطة")
    ) {
      return { isMultiItem: false, items: [], rawTokens: [] };
    }

    // Rule 2: Split query into candidate tokens
    const tokens = this.splitArabicQuery(trimmed);
    if (tokens.length < 2) {
      return { isMultiItem: false, items: [], rawTokens: tokens };
    }

    // Rule 3: Check if the whole query already matches a single dish or food directly
    const foodCache = await getKnowledgeCache();
    const dishCache = await warmDishEngineCache();

    const nWhole = normalize(trimmed);
    const bWhole = stripArticle(trimmed);
    if (
      dishCache.foodsByNormAr.has(nWhole) ||
      dishCache.foodsByNormAr.has(bWhole) ||
      dishCache.dishesByNormAr.has(nWhole) ||
      dishCache.dishesByNormAr.has(bWhole) ||
      dishCache.dishAliasesByNormAr.has(nWhole) ||
      dishCache.dishAliasesByNormAr.has(bWhole)
    ) {
      return { isMultiItem: false, items: [], rawTokens: tokens };
    }

    // Rule 3.5: Check if query represents a composite dish variant with protein (e.g. "برياني بالخضار واللحم" or "شاورما والدجاج")
    if (tokens.length === 2) {
      const n0 = normalize(tokens[0]);
      const b0 = stripArticle(tokens[0]);
      const l0 = stripAlefLam(tokens[0]);
      const isDish0 =
        dishCache.dishesByNormAr.has(n0) ||
        dishCache.dishesByNormAr.has(b0) ||
        dishCache.dishesByNormAr.has(l0) ||
        dishCache.dishAliasesByNormAr.has(n0) ||
        dishCache.dishAliasesByNormAr.has(b0) ||
        dishCache.dishAliasesByNormAr.has(l0);

      const prot1 = getProteinFields(tokens[1]);
      if (isDish0 && prot1.proteinCategory !== "NONE") {
        return { isMultiItem: false, items: [], rawTokens: tokens };
      }
    }

    // Rule 4: Evaluate each candidate item against the database & categories
    const results: MultiItemResultItem[] = [];
    let recognizedCount = 0;

    for (const rawToken of tokens) {
      const nToken = normalize(rawToken);
      const bToken = stripArticle(rawToken);
      const nbToken = normalize(bToken);

      // A. Check if token is a category
      const catKey =
        this.CATEGORY_KEYWORDS[rawToken] ||
        this.CATEGORY_KEYWORDS[bToken] ||
        this.CATEGORY_KEYWORDS[nToken] ||
        this.CATEGORY_KEYWORDS[nbToken];

      if (catKey) {
        recognizedCount++;
        const catReport = this.evaluateCategoryItem(catKey, rawToken, foodCache.foods, isPremium);
        results.push(catReport);
        continue;
      }

      // B. Check if token is a known food
      const matchedFoods =
        dishCache.foodsByNormAr.get(nToken) ||
        dishCache.foodsByNormAr.get(nbToken) ||
        dishCache.foodAliasesByNormAr.get(nToken) ||
        dishCache.foodAliasesByNormAr.get(nbToken);

      let targetFood: any = null;
      if (matchedFoods && matchedFoods.length > 0) {
        targetFood = matchedFoods[0].canonicalFood || matchedFoods[0];
      } else {
        const idMatch = resolveFoodIdentity(rawToken, foodCache);
        if (idMatch?.food) {
          targetFood = idMatch.food;
        }
      }

      if (targetFood) {
        recognizedCount++;
        const status = (targetFood.status || "conditional").toLowerCase();
        const normStatus = status === "allowed" || status === "forbidden" || status === "conditional" ? status : "conditional";

        results.push({
          id: targetFood.id,
          rawQuery: rawToken,
          nameAr: targetFood.nameAr,
          nameEn: targetFood.nameEn || undefined,
          itemType: "food",
          status: normStatus as any,
          reason: targetFood.reason || (normStatus === "allowed" ? "مسموح في نظام طيباتي" : normStatus === "forbidden" ? "ممنوع في نظام طيباتي" : "مشروط في نظام طيباتي"),
          notes: targetFood.notes || null,
          categoryAr: targetFood.category,
          sourceType: determineFoodSource(targetFood.nameAr, undefined, targetFood.category),
        });
        continue;
      }

      // C. Check if token is a known dish
      const matchedDishes =
        dishCache.dishesByNormAr.get(nToken) ||
        dishCache.dishesByNormAr.get(nbToken) ||
        dishCache.dishAliasesByNormAr.get(nToken) ||
        dishCache.dishAliasesByNormAr.get(nbToken);

      if (matchedDishes && matchedDishes.length > 0) {
        recognizedCount++;
        const targetDish = matchedDishes[0].canonicalDish || matchedDishes[0];
        results.push({
          id: targetDish.id,
          rawQuery: rawToken,
          nameAr: targetDish.nameAr,
          nameEn: targetDish.nameEn || undefined,
          itemType: "dish",
          status: "conditional",
          reason: "طبق مركب يعتمد حكمه على طريقة تحضيره ومكوناته.",
          notes: null,
          categoryAr: targetDish.category,
        });
        continue;
      }

      // D. Token unresolved
      results.push({
        rawQuery: rawToken,
        nameAr: rawToken,
        itemType: "unknown",
        status: "unknown",
        reason: "غير متوفر حالياً في قاعدة بيانات طيباتي",
        notes: null,
      });
    }

    // Rule 5: A multi-item query MUST contain at least 2 recognized items
    if (recognizedCount < 2) {
      return { isMultiItem: false, items: [], rawTokens: tokens };
    }

    return {
      isMultiItem: true,
      items: results,
      rawTokens: tokens,
    };
  }

  private static evaluateCategoryItem(
    categoryKey: string,
    rawQuery: string,
    allFoods: any[],
    isPremium: boolean
  ): MultiItemResultItem {
    let matchedFoods = allFoods.filter((f) => {
      const c = (f.category || "").toLowerCase();
      if (categoryKey === "خضروات") {
        return c.includes("vegetable") || c.includes("خضار") || c.includes("خضروات");
      }
      if (categoryKey === "فواكه") {
        return c.includes("fruit") || c.includes("فواكه") || c.includes("فاكه");
      }
      if (categoryKey === "بقوليات") {
        return c.includes("legume") || c.includes("بقول");
      }
      if (categoryKey === "لحوم") {
        return c.includes("meat") || c.includes("لحوم") || c.includes("poultry") || c.includes("دواجن");
      }
      if (categoryKey === "حبوب") {
        return c.includes("grain") || c.includes("حبوب") || c.includes("نشويات") || c.includes("starch");
      }
      return c.includes(categoryKey.toLowerCase());
    });

    const allowed = matchedFoods.filter((f) => (f.status || "").toLowerCase() === "allowed");
    const forbidden = matchedFoods.filter((f) => (f.status || "").toLowerCase() === "forbidden");
    const conditional = matchedFoods.filter((f) => (f.status || "").toLowerCase() === "conditional");

    const total = matchedFoods.length;
    const isFullyForbidden = total > 0 && forbidden.length === total;

    // Document conditional exceptions (e.g. Yellow Lentil Soup for Legumes)
    const exceptions: string[] = [];
    if (categoryKey === "بقوليات") {
      exceptions.push("شوربة العدس الأصفر استثناء مشروط وفق السياسة المعتمدة");
    }

    const freeLimit = 10;
    const hasMore = !isPremium && total > freeLimit;

    let status: "allowed" | "forbidden" | "conditional" = "conditional";
    if (isFullyForbidden) {
      status = "forbidden";
    } else if (forbidden.length === 0 && allowed.length > 0) {
      status = "allowed";
    }

    return {
      rawQuery,
      nameAr: `قسم ${categoryKey}`,
      itemType: "category",
      status,
      reason: isFullyForbidden
        ? `جميع أصناف هذا القسم محظورة (${total} أصناف مسجلة)`
        : `يحتوي قسم ${categoryKey} على ${allowed.length} صنف مسموح و ${forbidden.length} صنف ممنوع`,
      categoryStats: {
        total,
        allowedCount: allowed.length,
        forbiddenCount: forbidden.length,
        conditionalCount: conditional.length,
        isFullyForbidden,
        exceptions,
        hasMore,
      },
      sampleItems: {
        allowed: allowed.slice(0, isPremium ? undefined : freeLimit),
        forbidden: forbidden.slice(0, isPremium ? undefined : freeLimit),
        conditional: conditional.slice(0, isPremium ? undefined : freeLimit),
      },
    };
  }
}

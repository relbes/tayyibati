/**
 * Tayyibati Dish Compatibility Engine
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/ANALYSIS_PIPELINE_SPEC.md for complete 10-stage pipeline
 * - See docs/ARCHITECTURE_RULES.md (Rules 1, 2, 6, 7, 8)
 * - See docs/DISH_ENGINE_SPEC.md & docs/DECISION_ENGINE_SPEC.md
 * - See docs/ENGINEERING_PRINCIPLES.md (Explainability, Deterministic Results)
 */
import { db, foodsTable, foodAliases, dishes, dishAliases, dishIngredients, countries, dishCountries } from "@workspace/db";
import { DecisionEngine } from "./decisionEngine.js";
import { eq, or, ilike, inArray } from "drizzle-orm";
import { CanonicalSearchEngine } from "./canonicalSearchEngine";
import { norm, stripAlefLam, normalize, normalizeName, stripArticle } from "./arabicNormalization";

export { norm, stripAlefLam, normalize, normalizeName, stripArticle };

export interface IngredientAnalysisItem {
  rawIngredientName: string;
  foodId: number | null;
  canonicalFoodAr: string;
  canonicalFoodEn: string;
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  reason: string;
  notes: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  confidenceScore: number;
  requirementType: "required" | "typical" | "optional" | "variation";
  source: string;
  resolvedBy: "food" | "alias" | "unknown";
  provenance: "exact_food" | "food_alias" | "dish_recipe" | "ocr" | "ai_extracted";
}

export interface EnrichedUnknownIngredient {
  rawName: string;
  normalizedName: string;
  needsReview: boolean;
  suggestedCanonical: string | null;
  confidence: "LOW";
  confidenceScore: number;
  language: "ar" | "en";
  whyUnknown: string;
  status: "unknown";
  reason: string;
  notes: string | null;
  resolvedBy: "unknown";
  provenance: "dish_recipe" | "ai_extracted";
}

export interface DishAnalysisResult {
  dish: {
    id: number | null;
    nameAr: string;
    nameEn: string | null;
    category: string | null;
    countryOrigins: string[];
  } | null;
  ingredientAnalysis: IngredientAnalysisItem[];
  allowedIngredients: IngredientAnalysisItem[];
  forbiddenIngredients: IngredientAnalysisItem[];
  conditionalIngredients: IngredientAnalysisItem[];
  unknownIngredients: EnrichedUnknownIngredient[];
  recognitionStats: {
    totalDetected: number;
    totalResolved: number;
    totalUnknown: number;
    recognitionPercentage: number;
    averageConfidence: number;
    highestConfidence: number;
    lowestConfidence: number;
  };
  finalCompatibility: "allowed" | "forbidden" | "conditional" | "unknown";
  explanation: {
    summaryAr: string;
    summaryEn: string;
    detailedReasonAr: string;
    detailedReasonEn: string;
  };
}

// In-Memory Cache Store for Fast Sub-Millisecond Lookups
interface DishEngineCache {
  foodsById: Map<number, any>;
  foodsByNormAr: Map<string, any[]>;
  foodAliasesByNormAr: Map<string, any[]>;
  dishesById: Map<number, any>;
  dishesByNormAr: Map<string, any[]>;
  dishAliasesByNormAr: Map<string, any[]>;
  ingredientsByDishId: Map<number, any[]>;
  countriesByDishId: Map<number, string[]>;
  dishes: any[];
  lastLoaded: number;
}

let dishEngineCache: DishEngineCache | null = null;
const CACHE_TTL = 3600000; // 1 hour TTL



function detectLanguage(str: string): "ar" | "en" {
  return /[\u0600-\u06FF]/.test(str) ? "ar" : "en";
}

export async function warmDishEngineCache(): Promise<DishEngineCache> {
  const now = Date.now();
  if (dishEngineCache && now - dishEngineCache.lastLoaded < CACHE_TTL) {
    return dishEngineCache;
  }

  const [foodsList, foodAliasesList, dishesList, dishAliasesList, dishIngredientsList, dishCountriesList] =
    await Promise.all([
      db.select().from(foodsTable),
      db.select().from(foodAliases),
      db.select().from(dishes),
      db.select().from(dishAliases),
      db.select().from(dishIngredients),
      db.select().from(dishCountries),
    ]);

  if (!dishesList.some((d) => d.nameAr === "شاورما")) {
    dishesList.push({
      id: 9999,
      nameAr: "شاورما",
      nameEn: "Shawarma",
      category: "أطباق رئيسية",
    } as any);
  }

  const foodsById = new Map<number, any>();
  const foodsByNormAr = new Map<string, any[]>();
  const foodAliasesByNormAr = new Map<string, any[]>();
  const dishesById = new Map<number, any>();
  const dishesByNormAr = new Map<string, any[]>();
  const dishAliasesByNormAr = new Map<string, any[]>();
  const ingredientsByDishId = new Map<number, any[]>();
  const countriesByDishId = new Map<number, string[]>();

  foodsList.forEach((f) => {
    foodsById.set(f.id, f);
    const n = norm(f.nameAr);
    const b = stripAlefLam(f.nameAr);

    if (!foodsByNormAr.has(n)) foodsByNormAr.set(n, []);
    foodsByNormAr.get(n)!.push(f);

    if (b !== n) {
      if (!foodsByNormAr.has(b)) foodsByNormAr.set(b, []);
      foodsByNormAr.get(b)!.push(f);
    }

    if (f.nameEn) {
      const nEn = norm(f.nameEn);
      if (!foodsByNormAr.has(nEn)) foodsByNormAr.set(nEn, []);
      foodsByNormAr.get(nEn)!.push(f);
    }
  });

  foodAliasesList.forEach((a) => {
    const targetFood = foodsById.get(a.foodId);
    if (targetFood) {
      const aliasObj = { ...a, canonicalFood: targetFood };
      const nAl = norm(a.aliasAr);
      const bAl = stripAlefLam(a.aliasAr);

      if (!foodAliasesByNormAr.has(nAl)) foodAliasesByNormAr.set(nAl, []);
      foodAliasesByNormAr.get(nAl)!.push(aliasObj);

      if (bAl !== nAl) {
        if (!foodAliasesByNormAr.has(bAl)) foodAliasesByNormAr.set(bAl, []);
        foodAliasesByNormAr.get(bAl)!.push(aliasObj);
      }

      if (a.aliasEn) {
        const nEn = norm(a.aliasEn);
        if (!foodAliasesByNormAr.has(nEn)) foodAliasesByNormAr.set(nEn, []);
        foodAliasesByNormAr.get(nEn)!.push(aliasObj);
      }
    }
  });

  dishesList.forEach((d) => {
    dishesById.set(d.id, d);
    const n = norm(d.nameAr);
    const b = stripAlefLam(d.nameAr);

    if (!dishesByNormAr.has(n)) dishesByNormAr.set(n, []);
    dishesByNormAr.get(n)!.push(d);

    if (b !== n) {
      if (!dishesByNormAr.has(b)) dishesByNormAr.set(b, []);
      dishesByNormAr.get(b)!.push(d);
    }

    if (d.nameEn) {
      const nEn = norm(d.nameEn);
      if (!dishesByNormAr.has(nEn)) dishesByNormAr.set(nEn, []);
      dishesByNormAr.get(nEn)!.push(d);
    }
  });

  dishAliasesList.forEach((da) => {
    const targetDish = dishesById.get(da.dishId);
    if (targetDish) {
      const aliasObj = { ...da, canonicalDish: targetDish };
      const nAl = norm(da.aliasAr);
      const bAl = stripAlefLam(da.aliasAr);

      if (!dishAliasesByNormAr.has(nAl)) dishAliasesByNormAr.set(nAl, []);
      dishAliasesByNormAr.get(nAl)!.push(aliasObj);

      if (bAl !== nAl) {
        if (!dishAliasesByNormAr.has(bAl)) dishAliasesByNormAr.set(bAl, []);
        dishAliasesByNormAr.get(bAl)!.push(aliasObj);
      }
    }
  });

  dishCountriesList.forEach((dc) => {
    if (!countriesByDishId.has(dc.dishId)) countriesByDishId.set(dc.dishId, []);
    countriesByDishId.get(dc.dishId)!.push(dc.countryName);
  });

  dishIngredientsList.forEach((di) => {
    if (!ingredientsByDishId.has(di.dishId)) ingredientsByDishId.set(di.dishId, []);
    ingredientsByDishId.get(di.dishId)!.push(di);
  });

  dishEngineCache = {
    foodsById,
    foodsByNormAr,
    foodAliasesByNormAr,
    dishesById,
    dishesByNormAr,
    dishAliasesByNormAr,
    ingredientsByDishId,
    countriesByDishId,
    dishes: dishesList,
    lastLoaded: now,
  };

  return dishEngineCache;
}

export function getDishEngineCache(): DishEngineCache {
  if (!dishEngineCache) {
    throw new Error("Dish Engine cache not warmed. Call warmDishEngineCache() first.");
  }
  return dishEngineCache;
}

/**
 * Resolves an individual raw ingredient name and calculates confidence score based on the FINAL MATCH QUALITY:
 * - 98 = exact food match (exact_food)
 * - 95 = food alias match (food_alias)
 * - 90 = OCR variant match (ocr)
 * - 80 = dish alias match (dish_recipe)
 * - 70 = partial substring match
 * - 0  = unresolved (unknown)
 * Original detection source (e.g. AI extraction vs recipe) is preserved in `provenance` and `source`.
 */
export function resolveSingleIngredient(
  rawName: string,
  cache: DishEngineCache,
  isAiExtracted: boolean = false
): IngredientAnalysisItem {
  const n = norm(rawName);
  const b = stripAlefLam(rawName);

  // 1. Food Alias Match (Final Match Quality Score: 95 for alias, 90 for OCR)
  if (cache.foodAliasesByNormAr.has(n) || cache.foodAliasesByNormAr.has(b)) {
    const list = cache.foodAliasesByNormAr.get(n) || cache.foodAliasesByNormAr.get(b) || [];
    const aliasObj = list[0];
    if (aliasObj) {
      const f = aliasObj.canonicalFood;
      const isOcr = aliasObj.aliasType === "ocr";
      return {
        rawIngredientName: rawName,
        foodId: f.id,
        canonicalFoodAr: f.nameAr,
        canonicalFoodEn: f.nameEn || f.nameAr,
        status: (f.status as any) || "allowed",
        reason: f.reason || "مرادف معروف لمكون غذائي",
        notes: f.isException ? "استثناء خاص" : null,
        confidence: "HIGH",
        confidenceScore: isOcr ? 90 : 95, // Final match quality score
        requirementType: "required",
        source: isAiExtracted ? "AI Extracted Text (Alias Match)" : isOcr ? "OCR Alias Engine" : "Food Aliases Knowledge Engine",
        resolvedBy: "alias",
        provenance: isOcr ? "ocr" : isAiExtracted ? "ai_extracted" : "food_alias",
      };
    }
  }

  // 2. Canonical Food Match (Final Match Quality Score: 98 for exact food match)
  if (cache.foodsByNormAr.has(n) || cache.foodsByNormAr.has(b)) {
    const list = cache.foodsByNormAr.get(n) || cache.foodsByNormAr.get(b) || [];
    const f = list[0];
    if (f) {
      return {
        rawIngredientName: rawName,
        foodId: f.id,
        canonicalFoodAr: f.nameAr,
        canonicalFoodEn: f.nameEn || f.nameAr,
        status: (f.status as any) || "allowed",
        reason: f.reason || "مكون معروف وطبيعي",
        notes: f.isException ? "استثناء خاص" : null,
        confidence: "HIGH",
        confidenceScore: 98, // Final match quality score
        requirementType: "required",
        source: isAiExtracted ? "AI Extracted Text (Exact Food Match)" : "Foods Knowledge Engine",
        resolvedBy: "food",
        provenance: isAiExtracted ? "ai_extracted" : "exact_food",
      };
    }
  }

  // 3. Dish Alias Match (Final Match Quality Score: 80 for dish alias)
  if (cache.dishAliasesByNormAr.has(n) || cache.dishAliasesByNormAr.has(b)) {
    const aliasList = cache.dishAliasesByNormAr.get(n) || cache.dishAliasesByNormAr.get(b) || [];
    const dishObj = aliasList[0];
    if (dishObj) {
      const d = dishObj.canonicalDish;
      return {
        rawIngredientName: rawName,
        foodId: null,
        canonicalFoodAr: d.nameAr,
        canonicalFoodEn: d.nameEn || d.nameAr,
        status: "allowed",
        reason: `طبق معروف (${d.nameAr})`,
        notes: null,
        confidence: "MEDIUM",
        confidenceScore: 80, // Final match quality score
        requirementType: "required",
        source: isAiExtracted ? "AI Extracted Text (Dish Alias Match)" : "Dish Aliases Knowledge Engine",
        resolvedBy: "alias",
        provenance: "dish_recipe",
      };
    }
  }

  // 4. Substring Partial Match (Final Match Quality Score: 70)
  for (const [foodNorm, fList] of cache.foodsByNormAr.entries()) {
    const f = fList[0];
    if (f && foodNorm.length >= 3 && (n.includes(foodNorm) || foodNorm.includes(n))) {
      return {
        rawIngredientName: rawName,
        foodId: f.id,
        canonicalFoodAr: f.nameAr,
        canonicalFoodEn: f.nameEn || f.nameAr,
        status: (f.status as any) || "allowed",
        reason: f.reason || "طابق جزئي لمكون معروف",
        notes: null,
        confidence: "MEDIUM",
        confidenceScore: 70, // Final match quality score
        requirementType: "required",
        source: isAiExtracted ? "AI Extracted Text (Substring Match)" : "Partial Substring Match",
        resolvedBy: "food",
        provenance: isAiExtracted ? "ai_extracted" : "exact_food",
      };
    }
  }

  // 4.5. Word Token Match for Compound Phrases (e.g. "صدر دجاج" -> "دجاج", "خبز برغر" -> "خبز")
  const tokens = n.split(/\s+/).map(t => stripAlefLam(t)).filter(t => t.length >= 3);
  for (const token of tokens) {
    if (cache.foodAliasesByNormAr.has(token)) {
      const aliasObj = cache.foodAliasesByNormAr.get(token)![0];
      if (aliasObj) {
        const f = aliasObj.canonicalFood;
        return {
          rawIngredientName: rawName,
          foodId: f.id,
          canonicalFoodAr: f.nameAr,
          canonicalFoodEn: f.nameEn || f.nameAr,
          status: (f.status as any) || "allowed",
          reason: f.reason || "مطابقة كلمة مرادفة لمكون غذائي",
          notes: f.isException ? "استثناء خاص" : null,
          confidence: "MEDIUM",
          confidenceScore: 85,
          requirementType: "required",
          source: isAiExtracted ? "AI Extracted Text (Word Token Match)" : "Food Aliases Engine",
          resolvedBy: "alias",
          provenance: isAiExtracted ? "ai_extracted" : "food_alias",
        };
      }
    }

    if (cache.foodsByNormAr.has(token)) {
      const f = cache.foodsByNormAr.get(token)![0];
      if (f) {
        return {
          rawIngredientName: rawName,
          foodId: f.id,
          canonicalFoodAr: f.nameAr,
          canonicalFoodEn: f.nameEn || f.nameAr,
          status: (f.status as any) || "allowed",
          reason: f.reason || "مطابقة كلمة لمكون غذائي معروف",
          notes: f.isException ? "استثناء خاص" : null,
          confidence: "MEDIUM",
          confidenceScore: 88,
          requirementType: "required",
          source: isAiExtracted ? "AI Extracted Text (Word Token Match)" : "Foods Engine",
          resolvedBy: "food",
          provenance: isAiExtracted ? "ai_extracted" : "exact_food",
        };
      }
    }
  }

  // 5. Unresolved Ingredient (Final Match Quality Score: 0)
  return {
    rawIngredientName: rawName,
    foodId: null,
    canonicalFoodAr: rawName,
    canonicalFoodEn: rawName,
    status: "unknown",
    reason: "غير متوفر حالياً في قاعدة بيانات طيباتي",
    notes: "يتطلب مراجعة أو تحليل مخصص",
    confidence: "LOW",
    confidenceScore: 0, // Unresolved score
    requirementType: "required",
    source: isAiExtracted ? "AI Extracted Text (Unresolved)" : "Unresolved Text",
    resolvedBy: "unknown",
    provenance: isAiExtracted ? "ai_extracted" : "dish_recipe",
  };
}

/**
 * Finds closest suggested canonical food for unknown ingredients
 */
function findSuggestedCanonical(rawName: string, cache: DishEngineCache): string | null {
  const n = norm(rawName);
  for (const [foodNorm, f] of cache.foodsByNormAr.entries()) {
    if (foodNorm.length >= 3 && n.slice(0, 3) === foodNorm.slice(0, 3)) {
      return f.nameAr;
    }
  }
  return null;
}

/**
 * Analyzes a dish by ID or query string with Phase 5.1B Confidence Recalculation after Final Ingredient Resolution:
 * Match Quality Confidence Scores:
 * - 100 = canonical recipe pre-mapped ingredient (dish_recipe)
 * - 98  = exact food match (exact_food)
 * - 95  = food alias match (food_alias)
 * - 90  = OCR variant match (ocr)
 * - 80  = dish alias match (dish_recipe)
 * - 70  = partial substring match
 * - 0   = unresolved (unknown)
 *
 * Original Detection Source (e.g. AI Extraction vs Recipe) is preserved in `provenance` and `source`.
 */
export async function analyzeDishCompatibility(
  dishIdentifier: number | string,
  rawIngredientNamesOverride?: string[]
): Promise<DishAnalysisResult> {
  const cache = await warmDishEngineCache();

  let targetDish: any = null;
  let countryOrigins: string[] = ["الوطن العربي"];

  if (typeof dishIdentifier === "number") {
    targetDish = cache.dishesById.get(dishIdentifier) || null;
  } else {
    const searchResult = await CanonicalSearchEngine.search(dishIdentifier, { debug: false });
    if (searchResult && searchResult.entity_type === "dish" && typeof searchResult.canonical_id === "number") {
      targetDish = cache.dishesById.get(searchResult.canonical_id) || null;
    }

    if (!targetDish) {
      const nQ = norm(dishIdentifier);
      const bQ = stripAlefLam(dishIdentifier);
      if (cache.dishesByNormAr.has(nQ) || cache.dishesByNormAr.has(bQ)) {
        targetDish = cache.dishesByNormAr.get(nQ) || cache.dishesByNormAr.get(bQ);
      } else if (cache.dishAliasesByNormAr.has(nQ) || cache.dishAliasesByNormAr.has(bQ)) {
        const aliasObj = cache.dishAliasesByNormAr.get(nQ) || cache.dishAliasesByNormAr.get(bQ);
        targetDish = aliasObj.canonicalDish;
      }
    }
  }

  const recipeIngredientsToAnalyze: { rawName: string; reqType: "required" | "typical" | "optional" | "variation"; foodId?: number | null; isAi: boolean }[] = [];

  if (targetDish) {
    countryOrigins = cache.countriesByDishId.get(targetDish.id) || ["الوطن العربي"];
    const recipeIngredients = cache.ingredientsByDishId.get(targetDish.id) || [];
    recipeIngredients.forEach((ri) => {
      recipeIngredientsToAnalyze.push({
        rawName: ri.rawIngredientName,
        reqType: (ri.requirementType as any) || "required",
        foodId: ri.foodId,
        isAi: false,
      });
    });
  }

  if (rawIngredientNamesOverride && rawIngredientNamesOverride.length > 0) {
    rawIngredientNamesOverride.forEach((name) => {
      const nName = norm(name);
      const existsInRecipe = recipeIngredientsToAnalyze.some((r) => norm(r.rawName) === nName);
      if (!existsInRecipe) {
        recipeIngredientsToAnalyze.push({
          rawName: name,
          reqType: "required",
          isAi: true,
        });
      }
    });
  }

  const seenFoodIds = new Set<number>();
  const seenRawNorms = new Set<string>();

  const ingredientAnalysis: IngredientAnalysisItem[] = [];
  const allowedIngredients: IngredientAnalysisItem[] = [];
  const forbiddenIngredients: IngredientAnalysisItem[] = [];
  const conditionalIngredients: IngredientAnalysisItem[] = [];
  const unknownIngredients: EnrichedUnknownIngredient[] = [];

  recipeIngredientsToAnalyze.forEach((item) => {
    let resolvedItem: IngredientAnalysisItem;

    if (item.foodId && cache.foodsById.has(item.foodId)) {
      const f = cache.foodsById.get(item.foodId);
      resolvedItem = {
        rawIngredientName: item.rawName,
        foodId: f.id,
        canonicalFoodAr: f.nameAr,
        canonicalFoodEn: f.nameEn || f.nameAr,
        status: (f.status as any) || "allowed",
        reason: f.reason || "مكون معروف وطبيعي",
        notes: f.isException ? "استثناء خاص" : null,
        confidence: "HIGH",
        confidenceScore: 100, // 100 for canonical recipe match
        requirementType: item.reqType,
        source: item.isAi ? "AI Extracted (Recipe Match)" : "Pre-Mapped Recipe Ingredient",
        resolvedBy: "food",
        provenance: item.isAi ? "ai_extracted" : "dish_recipe",
      };
    } else {
      resolvedItem = resolveSingleIngredient(item.rawName, cache, item.isAi);
      resolvedItem.requirementType = item.reqType;
    }

    // Deduplication check
    if (resolvedItem.foodId !== null) {
      if (seenFoodIds.has(resolvedItem.foodId)) return;
      seenFoodIds.add(resolvedItem.foodId);
    } else {
      const nRaw = norm(resolvedItem.rawIngredientName);
      if (seenRawNorms.has(nRaw)) return;
      seenRawNorms.add(nRaw);
    }

    ingredientAnalysis.push(resolvedItem);

    if (resolvedItem.status === "forbidden") {
      forbiddenIngredients.push(resolvedItem);
    } else if (resolvedItem.status === "conditional") {
      conditionalIngredients.push(resolvedItem);
    } else if (resolvedItem.status === "allowed") {
      allowedIngredients.push(resolvedItem);
    } else {
      const nRaw = norm(resolvedItem.rawIngredientName);
      unknownIngredients.push({
        rawName: resolvedItem.rawIngredientName,
        normalizedName: nRaw,
        needsReview: true,
        suggestedCanonical: findSuggestedCanonical(resolvedItem.rawIngredientName, cache),
        confidence: "LOW",
        confidenceScore: 0,
        language: detectLanguage(resolvedItem.rawIngredientName),
        whyUnknown: "غير متوفر حالياً في قاعدة بيانات طيباتي",
        status: "unknown",
        reason: "غير متوفر حالياً في قاعدة بيانات طيباتي",
        notes: "يتطلب مراجعة أو تحليل مخصص",
        resolvedBy: "unknown",
        provenance: item.isAi ? "ai_extracted" : "dish_recipe",
      });
    }
  });

  // Calculate Dynamic Compatibility Ruling
  let finalCompatibility: "allowed" | "forbidden" | "conditional" | "unknown" = "allowed";

  if (ingredientAnalysis.length === 0) {
    finalCompatibility = "unknown";
  } else if (forbiddenIngredients.length > 0) {
    finalCompatibility = "forbidden";
  } else if (conditionalIngredients.length > 0) {
    finalCompatibility = "conditional";
  } else if (unknownIngredients.length > 0 && allowedIngredients.length === 0) {
    finalCompatibility = "unknown";
  }

  // Calculate Recognition Statistics
  const totalDetected = ingredientAnalysis.length;
  const totalResolved = ingredientAnalysis.filter((i) => i.foodId !== null).length;
  const totalUnknown = unknownIngredients.length;
  const recognitionPercentage = totalDetected > 0 ? Math.round((totalResolved / totalDetected) * 100) : 0;

  const allScores = ingredientAnalysis.map((i) => i.confidenceScore);
  const averageConfidence = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
  const highestConfidence = allScores.length > 0 ? Math.max(...allScores) : 0;
  const lowestConfidence = allScores.length > 0 ? Math.min(...allScores) : 0;

  // Generate Explanation Summary
  const dishTitle = targetDish ? targetDish.nameAr : typeof dishIdentifier === "string" ? dishIdentifier : "الطبق المودع";

  let summaryAr = "";
  let summaryEn = "";
  let detailedReasonAr = "";
  let detailedReasonEn = "";

  if (finalCompatibility === "forbidden") {
    const forbiddenNames = forbiddenIngredients.map((i) => i.canonicalFoodAr).join("، ");
    summaryAr = `طبق غير مسموح لوجود مكونات محظورة (${forbiddenNames}).`;
    summaryEn = `Dish is forbidden due to forbidden ingredients (${forbiddenIngredients.map((i) => i.canonicalFoodEn).join(", ")}).`;
    detailedReasonAr = `تم تحليل ${totalDetected} مكونات في طبق "${dishTitle}". تم العثور على ${forbiddenIngredients.length} مكونات محظورة وهي: ${forbiddenNames}.`;
    detailedReasonEn = `Analyzed ${totalDetected} ingredients for "${dishTitle}". Found ${forbiddenIngredients.length} forbidden ingredient(s): ${forbiddenIngredients.map((i) => i.canonicalFoodEn).join(", ")}.`;
  } else if (finalCompatibility === "conditional") {
    const conditionalNames = conditionalIngredients.map((i) => i.canonicalFoodAr).join("، ");
    summaryAr = `طبق مشروط يتطلب الانتباه للمكونات (${conditionalNames}).`;
    summaryEn = `Dish is conditional. Pay attention to ingredients (${conditionalIngredients.map((i) => i.canonicalFoodEn).join(", ")}).`;
    detailedReasonAr = `طبق "${dishTitle}" يحتوي على مكونات مشروطة مثل (${conditionalNames}). ينصح بالتحقق من المصدر أو طريقة التحضير.`;
    detailedReasonEn = `"${dishTitle}" contains conditional ingredients like (${conditionalIngredients.map((i) => i.canonicalFoodEn).join(", ")}). Verify preparation method.`;
  } else if (finalCompatibility === "allowed") {
    summaryAr = `طبق مسموح وصحي. جميع المكونات مسموحة.`;
    summaryEn = `Dish is allowed and healthy. All ingredients are allowed.`;
    detailedReasonAr = `تم تحليل ${totalDetected} مكونات في طبق "${dishTitle}". جميع المكونات المحددة مسموحة وطبيعية.`;
    detailedReasonEn = `Analyzed ${totalDetected} ingredients for "${dishTitle}". All identified ingredients are allowed.`;
  } else {
    summaryAr = `النتيجة غير معروفة لعدم توفر مكونات الطبق في قاعدة البيانات.`;
    summaryEn = `Unknown result as ingredients are not in database.`;
    detailedReasonAr = `لم يتم التعرف على مكونات طبق "${dishTitle}" في قاعدة بيانات طيباتي.`;
    detailedReasonEn = `Ingredients for "${dishTitle}" are not found in Tayyibati database.`;
  }

  return {
    dish: targetDish
      ? {
          id: targetDish.id,
          nameAr: targetDish.nameAr,
          nameEn: targetDish.nameEn,
          category: targetDish.category,
          countryOrigins,
        }
      : typeof dishIdentifier === "string"
      ? {
          id: null,
          nameAr: dishIdentifier,
          nameEn: dishIdentifier,
          category: "free_form",
          countryOrigins,
        }
      : null,
    ingredientAnalysis,
    allowedIngredients,
    forbiddenIngredients,
    conditionalIngredients,
    unknownIngredients,
    recognitionStats: {
      totalDetected,
      totalResolved,
      totalUnknown,
      recognitionPercentage,
      averageConfidence,
      highestConfidence,
      lowestConfidence,
    },
    finalCompatibility,
    explanation: {
      summaryAr,
      summaryEn,
      detailedReasonAr,
      detailedReasonEn,
    },
  };
}

export function detectMainProtein(dishNameAr: string, ingredients: string[] = []): string {
  const allText = (dishNameAr + " " + ingredients.join(" ")).toLowerCase();
  
  if (allText.includes("دجاج") || allText.includes("دجاجة") || allText.includes("chicken")) {
    return "🐔 دجاج";
  }
  if (allText.includes("حاشي") || allText.includes("جمل") || allText.includes("إبل") || allText.includes("camel")) {
    return "🐪 لحم جمل";
  }
  if (allText.includes("ضأن") || allText.includes("خروف") || allText.includes("غنم") || allText.includes("lamb") || allText.includes("mutton")) {
    return "🐑 لحم ضأن";
  }
  if (allText.includes("بقر") || allText.includes("عجل") || allText.includes("beef") || allText.includes("veal")) {
    return "🥩 لحم بقر";
  }
  if (allText.includes("سمك") || allText.includes("أسماك") || allText.includes("فيليه سمك") || allText.includes("fish")) {
    return "🐟 سمك";
  }
  if (allText.includes("روبيان") || allText.includes("ربيان") || allText.includes("جمبري") || allText.includes("shrimp") || allText.includes("prawn")) {
    return "🦐 روبيان";
  }
  if (allText.includes("لحم") || allText.includes("لحوم") || allText.includes("meat")) {
    return "🐑 لحم ضأن";
  }
  return "🥗 نباتي";
}

export interface DishLightweightPreview {
  allowed: number;
  forbidden: number;
  conditional: number;
  unknown: number;
  compatibilityScore: number | null;
  compatibilityStatus: "allowed" | "forbidden" | "conditional" | "unknown";
}

export function getDishLightweightPreview(dishId: number): DishLightweightPreview {
  const cache = getDishEngineCache();
  const recipeIngredients = cache.ingredientsByDishId.get(dishId) || [];

  let allowed = 0;
  let forbidden = 0;
  let conditional = 0;
  let unknown = 0;

  recipeIngredients.forEach((ri) => {
    let status = "unknown";
    if (ri.foodId && cache.foodsById.has(ri.foodId)) {
      const f = cache.foodsById.get(ri.foodId);
      status = (f.status as any) || "allowed";
    } else {
      const resolved = resolveSingleIngredient(ri.rawIngredientName, cache, false);
      status = resolved.status;
    }

    if (status === "forbidden") forbidden++;
    else if (status === "conditional") conditional++;
    else if (status === "allowed") allowed++;
    else unknown++;
  });

  let compatibilityStatus: "allowed" | "forbidden" | "conditional" | "unknown" = "allowed";
  if (forbidden > 0) compatibilityStatus = "forbidden";
  else if (conditional > 0) compatibilityStatus = "conditional";
  else if (unknown > 0 && allowed === 0) compatibilityStatus = "unknown";

  // SSoT: scoring delegated exclusively to DecisionEngine
  const { compatibilityScore } = DecisionEngine.computeScores(allowed, forbidden, conditional, unknown);

  return {
    allowed,
    forbidden,
    conditional,
    unknown,
    compatibilityScore,
    compatibilityStatus,
  };
}


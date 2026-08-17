import { getDishEngineCache, getProteinFields, getClarificationData, isPureProteinQuery } from "./dishCompatibilityEngine";
import { getKnowledgeCache, resolveFoodIdentity } from "./knowledgeCache";

export type ResolutionState = "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN";
export type ClarificationType =
  | "PROTEIN_SPECIFICATION"
  | "FOOD_IDENTIFICATION"
  | "DISH_VARIANT"
  | "INGREDIENT_IDENTIFICATION"
  | "IMAGE_UNCERTAIN";

export interface ResolutionResult {
  state: ResolutionState;
  clarificationType?: ClarificationType;
  questionAr?: string;
  suggestions?: { label: string; query?: string; proteinCategory?: string; proteinSpecificity?: string }[];
  selectedCandidate?: any;
  candidates?: any[];
  proteinCategory?: string;
  proteinSpecificity?: string;
  needsClarification: boolean;
}

export class FoodResolutionEngine {
  /**
   * Centralized food identification and ambiguity resolution engine.
   * Combined logic for:
   * - AI extraction confidence
   * - Database exact/normalized matches
   * - Recipe protein consistency
   * - Plausible candidates count
   */
  public static async resolve(
    query: string,
    modality: "text" | "camera" | "ocr" | "barcode" | "voice",
    aiConfidence: number,
    aiIngredients: string[] = [],
    aiCanonicalName?: string
  ): Promise<ResolutionResult> {
    const dishCache = getDishEngineCache();
    const foodCache = await getKnowledgeCache();

    const queryProtein = getProteinFields(query);

    // 1. PURE PROTEIN QUERY RESOLUTION (e.g. "لحم" or "طيور")
    if (isPureProteinQuery(query) && queryProtein.proteinCategory !== "NONE") {
      if (queryProtein.proteinSpecificity === "UNSPECIFIED") {
        const clar = getClarificationData(query, queryProtein.proteinCategory);
        if (clar) {
          // Suggestions come from DB food names (e.g. "لحم غنم", "لحم بقر")
          const suggestions = clar.suggestions.map((s) => {
            const dbFood = foodCache.foods.find(
              (f) => f.nameAr === s.label || f.nameEn?.toLowerCase() === s.label.toLowerCase()
            );
            return {
              label: dbFood?.nameAr || s.label,
              query: dbFood?.nameAr || s.label,
              proteinCategory: s.proteinCategory,
              proteinSpecificity: s.proteinSpecificity,
            };
          });

          return {
            state: "AMBIGUOUS",
            clarificationType: "PROTEIN_SPECIFICATION",
            questionAr: clar.questionAr,
            suggestions,
            needsClarification: true,
            proteinCategory: queryProtein.proteinCategory,
            proteinSpecificity: queryProtein.proteinSpecificity,
          };
        }
      }
      // Specific protein query like "لحم غنم"
      return {
        state: "CONFIDENT",
        needsClarification: false,
        proteinCategory: queryProtein.proteinCategory,
        proteinSpecificity: queryProtein.proteinSpecificity,
      };
    }

    // 1.5 CANONICAL FOOD ENTITY DIRECT RESOLUTION (e.g. "أرز", "رز", "خبز", "جبن", "زيت")
    const identityMatch = resolveFoodIdentity(query, foodCache);
    if (identityMatch && identityMatch.food) {
      return {
        state: "CONFIDENT",
        selectedCandidate: { ...identityMatch.food, type: "food" },
        needsClarification: false,
        proteinCategory: queryProtein.proteinCategory,
        proteinSpecificity: queryProtein.proteinSpecificity,
      };
    }

    // 2. SEARCH DATABASE FOR CANDIDATES (Foods and Dishes)
    const normQuery = query.trim().replace(/^ال/, "");
    const candidates: any[] = [];

    // Search Dishes
    for (const [id, dish] of dishCache.dishesById.entries()) {
      if (dish.nameAr.includes(normQuery) || normQuery.includes(dish.nameAr)) {
        candidates.push({ ...dish, type: "dish" });
      }
    }

    // Search Foods
    for (const [id, food] of foodCache.foodById.entries()) {
      if (food.nameAr.includes(normQuery) || normQuery.includes(food.nameAr)) {
        candidates.push({ ...food, type: "food" });
      }
    }

    // 3. DECISION TIERS
    const confidence = aiConfidence;

    // A. CONFIDENT: High confidence AI + exact/strong single match
    if (confidence >= 0.70 && candidates.length === 1) {
      const candidate = candidates[0];
      if (candidate.type === "dish") {
        const recipeIngredients = dishCache.ingredientsByDishId.get(candidate.id) || [];
        const dishHasProtein = recipeIngredients.some((ri) => {
          const riProtein = getProteinFields(ri.rawIngredientName);
          return riProtein.proteinCategory !== "NONE";
        });
        const queryHasProtein = queryProtein.proteinCategory !== "NONE";

        // Ambiguity check: dish has protein but query doesn't specify one
        if (dishHasProtein && !queryHasProtein) {
          return this.triggerDishVariantClarification(candidate, foodCache.foods);
        }
      }

      return {
        state: "CONFIDENT",
        selectedCandidate: candidate,
        needsClarification: false,
        proteinCategory: queryProtein.proteinCategory,
        proteinSpecificity: queryProtein.proteinSpecificity,
      };
    }

    // B. MEDIUM CONFIDENCE OR MULTIPLE DB CANDIDATES
    if (candidates.length > 1) {
      // Check if there is exactly one dominant candidate (highest match/exact match)
      const exactMatch = candidates.find((c) => c.nameAr === query);
      if (exactMatch) {
        if (exactMatch.type === "dish") {
          const recipeIngredients = dishCache.ingredientsByDishId.get(exactMatch.id) || [];
          const dishHasProtein = recipeIngredients.some((ri) => {
            const riProtein = getProteinFields(ri.rawIngredientName);
            return riProtein.proteinCategory !== "NONE";
          });
          const queryHasProtein = queryProtein.proteinCategory !== "NONE";

          if (dishHasProtein && !queryHasProtein) {
            return this.triggerDishVariantClarification(exactMatch, foodCache.foods);
          }
        }

        return {
          state: "CONFIDENT",
          selectedCandidate: exactMatch,
          needsClarification: false,
          proteinCategory: queryProtein.proteinCategory,
          proteinSpecificity: queryProtein.proteinSpecificity,
        };
      }

      // If multiple candidates remain plausible, trigger clarification
      const suggestions = candidates.slice(0, 5).map((c) => ({
        label: c.nameAr,
        query: c.nameAr,
      }));

      return {
        state: "AMBIGUOUS",
        clarificationType: modality === "camera" ? "IMAGE_UNCERTAIN" : "FOOD_IDENTIFICATION",
        questionAr: "هل تقصد أحد هذه الأطعمة؟",
        suggestions,
        candidates,
        needsClarification: true,
      };
    }

    // C. LOW CONFIDENCE & NO DB MATCHES
    if (confidence < 0.70 && candidates.length === 0) {
      return {
        state: "UNKNOWN",
        clarificationType: modality === "camera" ? "IMAGE_UNCERTAIN" : "FOOD_IDENTIFICATION",
        questionAr: "تعذر التعرف على الطعام بشكل موثوق. يرجى تحديد اسم الطعام بدقة.",
        needsClarification: true,
      };
    }

    // Default Fallback
    return {
      state: "CONFIDENT",
      needsClarification: false,
      proteinCategory: queryProtein.proteinCategory,
      proteinSpecificity: queryProtein.proteinSpecificity,
    };
  }

  private static triggerDishVariantClarification(dish: any, dbFoods: any[]): ResolutionResult {
    const suggestions: { label: string; query: string; proteinCategory: string; proteinSpecificity: string }[] = [];
    const lambFood = dbFoods.find((f) => f.nameAr && (f.nameAr === "لحم غنم" || f.nameAr.includes("غنم") || f.nameAr.includes("ضأ") || f.nameAr.includes("ضاني") || f.nameAr.includes("خروف")));
    const beefFood = dbFoods.find((f) => f.nameAr && (f.nameAr === "لحم بقر" || f.nameAr.includes("بقر") || f.nameAr.includes("بقري") || f.nameAr.includes("بتلو") || f.nameAr.includes("كندوز")));
    const chickenFood = dbFoods.find((f) => f.nameAr && (f.nameAr === "دجاج" || f.nameAr.includes("دجاج") || f.nameAr.includes("فراخ") || f.nameAr.includes("جاج")));

    if (lambFood) {
      suggestions.push({
        label: `${dish.nameAr} لحم غنم`,
        query: `${dish.nameAr} لحم غنم`,
        proteinCategory: "MEAT",
        proteinSpecificity: "LAMB",
      });
    }
    if (beefFood) {
      suggestions.push({
        label: `${dish.nameAr} بقري`,
        query: `${dish.nameAr} بقري`,
        proteinCategory: "MEAT",
        proteinSpecificity: "BEEF",
      });
    }
    if (chickenFood) {
      suggestions.push({
        label: `${dish.nameAr} دجاج`,
        query: `${dish.nameAr} دجاج`,
        proteinCategory: "POULTRY",
        proteinSpecificity: "CHICKEN",
      });
    }

    return {
      state: "AMBIGUOUS",
      clarificationType: "DISH_VARIANT",
      questionAr: `ما نوع ${dish.nameAr} الذي تقصده؟`,
      suggestions,
      needsClarification: true,
    };
  }
}

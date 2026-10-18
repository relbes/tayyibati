import { getDishEngineCache, getProteinFields, getClarificationData, isPureProteinQuery } from "./dishCompatibilityEngine";
import { getKnowledgeCache, resolveFoodIdentity } from "./knowledgeCache";
import { normalize } from "./arabicNormalization";

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
      // Generic MEAT is ALLOWED directly without requiring clarification
      if (queryProtein.proteinCategory === "MEAT" && queryProtein.proteinSpecificity === "UNSPECIFIED") {
        return {
          state: "CONFIDENT",
          needsClarification: false,
          proteinCategory: "MEAT",
          proteinSpecificity: "UNSPECIFIED",
        };
      }

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
      if (identityMatch.isAmbiguous && identityMatch.candidates && identityMatch.candidates.length > 1) {
        return {
          state: "AMBIGUOUS",
          clarificationType: "FOOD_IDENTIFICATION",
          questionAr: "يرجى تحديد النوع المطلوب:",
          suggestions: identityMatch.candidates.map((c: any) => ({
            label: c.nameAr,
            query: c.nameAr,
          })),
          candidates: identityMatch.candidates,
          needsClarification: true,
          proteinCategory: queryProtein.proteinCategory,
          proteinSpecificity: queryProtein.proteinSpecificity,
        };
      }
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

    // 2.5 GENERIC DISH VARIANT CLARIFICATION GATE (e.g. "برياني", "شاورما", "برياني بالخضار")
    const isGenericAmbiguousDish =
      (normQuery === "برياني" ||
        normQuery === "شاورما" ||
        normQuery === "برجر" ||
        normQuery === "كفتة" ||
        normQuery === "برياني بالخضار" ||
        normQuery === "البرياني بالخضار" ||
        normQuery === "برياني خضار" ||
        normQuery === "البرياني خضار") &&
      queryProtein.proteinCategory === "NONE";

    if (isGenericAmbiguousDish) {
      const genericDish =
        candidates.find(
          (c) =>
            c.nameAr === query ||
            normalize(c.nameAr) === normQuery ||
            c.id === 1009
        ) || candidates[0] || { nameAr: query, id: 0 };
      return this.triggerDishVariantClarification(genericDish, foodCache.foods);
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
    const isBiryaniVegetables =
      dish.id === 1009 ||
      dish.nameAr === "البرياني بالخضار" ||
      dish.nameAr === "برياني بالخضار" ||
      (dish.nameAr.includes("برياني") && (dish.nameAr.includes("خضار") || dish.nameAr.includes("خضروات")));

    if (isBiryaniVegetables) {
      return {
        state: "AMBIGUOUS",
        clarificationType: "DISH_VARIANT",
        questionAr: "هل تقصد برياني بالخضار باللحم أم بالدجاج؟",
        suggestions: [
          {
            label: "برياني بالخضار واللحم",
            query: "برياني بالخضار باللحم",
            proteinCategory: "MEAT",
            proteinSpecificity: "UNSPECIFIED",
          },
          {
            label: "برياني بالخضار والدجاج",
            query: "برياني بالخضار بالدجاج",
            proteinCategory: "POULTRY",
            proteinSpecificity: "CHICKEN",
          },
        ],
        selectedCandidate: dish,
        needsClarification: true,
      };
    }

    const meatSuggestions: { label: string; query: string; proteinCategory: string; proteinSpecificity: string }[] = [];
    const poultrySuggestions: { label: string; query: string; proteinCategory: string; proteinSpecificity: string }[] = [];
    const otherSuggestions: { label: string; query: string; proteinCategory: string; proteinSpecificity: string }[] = [];

    const dishCache = getDishEngineCache();
    const recipeIngredients = dish.id ? (dishCache.ingredientsByDishId.get(dish.id) || []) : [];
    const seenLabels = new Set<string>();

    const addSuggestion = (list: typeof meatSuggestions, item: (typeof meatSuggestions)[0]) => {
      if (!seenLabels.has(item.label)) {
        seenLabels.add(item.label);
        list.push(item);
      }
    };

    if (recipeIngredients.length > 0) {
      for (const ri of recipeIngredients) {
        const rawName = (ri.rawIngredientName || "").trim();
        const proteinInfo = getProteinFields(rawName);

        if (proteinInfo.proteinCategory === "MEAT") {
          // If generic meat (e.g. "لحم"), expand into the preferred meat choices: beef & lamb
          if (proteinInfo.proteinSpecificity === "UNSPECIFIED") {
            addSuggestion(meatSuggestions, {
              label: `${dish.nameAr} لحم بقر`,
              query: `${dish.nameAr} لحم بقر`,
              proteinCategory: "MEAT",
              proteinSpecificity: "BEEF",
            });
            addSuggestion(meatSuggestions, {
              label: `${dish.nameAr} لحم غنم`,
              query: `${dish.nameAr} لحم غنم`,
              proteinCategory: "MEAT",
              proteinSpecificity: "LAMB",
            });
          } else {
            const cleanProteinName = rawName.replace(/^ال/, "");
            addSuggestion(meatSuggestions, {
              label: `${dish.nameAr} ${cleanProteinName}`,
              query: `${dish.nameAr} ${cleanProteinName}`,
              proteinCategory: "MEAT",
              proteinSpecificity: proteinInfo.proteinSpecificity,
            });
          }
        } else if (proteinInfo.proteinCategory === "POULTRY") {
          const cleanProteinName = rawName.replace(/^ال/, "");
          addSuggestion(poultrySuggestions, {
            label: `${dish.nameAr} ${cleanProteinName}`,
            query: `${dish.nameAr} ${cleanProteinName}`,
            proteinCategory: "POULTRY",
            proteinSpecificity: proteinInfo.proteinSpecificity,
          });
        } else if (proteinInfo.proteinCategory !== "NONE") {
          const cleanProteinName = rawName.replace(/^ال/, "");
          addSuggestion(otherSuggestions, {
            label: `${dish.nameAr} ${cleanProteinName}`,
            query: `${dish.nameAr} ${cleanProteinName}`,
            proteinCategory: proteinInfo.proteinCategory,
            proteinSpecificity: proteinInfo.proteinSpecificity,
          });
        }
      }
    }

    // Safe fallback ONLY if the dish has no usable protein ingredients in recipe
    if (meatSuggestions.length === 0 && poultrySuggestions.length === 0 && otherSuggestions.length === 0) {
      if (dish.nameAr === "برياني" || normalize(dish.nameAr).includes("برياني")) {
        addSuggestion(meatSuggestions, {
          label: "برياني لحم",
          query: "برياني لحم",
          proteinCategory: "MEAT",
          proteinSpecificity: "UNSPECIFIED",
        });
        addSuggestion(meatSuggestions, {
          label: "برياني لحم غنم",
          query: "برياني لحم غنم",
          proteinCategory: "MEAT",
          proteinSpecificity: "LAMB",
        });
        addSuggestion(poultrySuggestions, {
          label: "برياني دجاج",
          query: "برياني دجاج",
          proteinCategory: "POULTRY",
          proteinSpecificity: "CHICKEN",
        });
      } else {
        addSuggestion(meatSuggestions, {
          label: `${dish.nameAr} لحم بقر`,
          query: `${dish.nameAr} لحم بقر`,
          proteinCategory: "MEAT",
          proteinSpecificity: "BEEF",
        });
        addSuggestion(meatSuggestions, {
          label: `${dish.nameAr} لحم غنم`,
          query: `${dish.nameAr} لحم غنم`,
          proteinCategory: "MEAT",
          proteinSpecificity: "LAMB",
        });
        addSuggestion(poultrySuggestions, {
          label: `${dish.nameAr} دجاج`,
          query: `${dish.nameAr} دجاج`,
          proteinCategory: "POULTRY",
          proteinSpecificity: "CHICKEN",
        });
      }
    }

    // Meat choices (beef, lamb) ALWAYS come first so chicken never becomes the default!
    const suggestions = [...meatSuggestions, ...poultrySuggestions, ...otherSuggestions];

    return {
      state: "AMBIGUOUS",
      clarificationType: "DISH_VARIANT",
      questionAr: `ما نوع ${dish.nameAr} الذي تقصده؟`,
      suggestions,
      needsClarification: true,
    };
  }
}

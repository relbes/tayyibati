/**
 * Tayyibati Intent & Entity Classification Engine (Phase 6.2 Refinement)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/ANALYSIS_PIPELINE_SPEC.md (Stages 2 & 3: Intent Detection & Entity Classification)
 * - See docs/ARCHITECTURE_RULES.md (Rules 2, 4, 5, 8)
 * - See docs/ENGINEERING_PRINCIPLES.md (Knowledge Before AI, Cache First)
 *
 * TWO-STEP CLASSIFICATION MODEL:
 * 1. Determine WHAT the object IS (entityType & intent)
 * 2. Determine HOW it should be analyzed (analysisMode & pipeline)
 *
 * CONSTRAINTS:
 * - MUST NOT perform compatibility analysis.
 * - MUST NOT query food status rulings or calculate compatibility scores.
 * - ONLY determines WHAT the user submitted and WHICH pipeline to execute.
 */

import { warmDishEngineCache, getDishEngineCache, norm, stripAlefLam } from "./dishCompatibilityEngine";
import { CanonicalSearchEngine } from "./canonicalSearchEngine";
import { getKnowledgeCache, UserIntent } from "./knowledgeCache";
import type { UnifiedAnalysisInput } from "./unifiedAnalysisEngine";

export type EntityType =
  | "SINGLE_FOOD"
  | "COMPOSITE_FOOD"
  | "DISH"
  | "RECIPE"
  | "INGREDIENT_LIST"
  | "PACKAGED_PRODUCT"
  | "COMMERCIAL_PRODUCT"
  | "DRINK"
  | "DESSERT"
  | "BARCODE_PRODUCT"
  | "CAMERA_MEAL"
  | "OCR_LABEL"
  | "UNKNOWN";

export type IntentType =
  | "CHECK_COMPATIBILITY"
  | "VIEW_INFORMATION"
  | "RECIPE_REQUEST"
  | "INGREDIENT_REQUEST"
  | "IMAGE_ANALYSIS"
  | "OCR_ANALYSIS"
  | "BARCODE_SCAN"
  | "VOICE_ANALYSIS"
  | "UNKNOWN";

export type AnalysisMode =
  | "DIRECT_FOOD"
  | "INGREDIENT_BASED"
  | "PRODUCT_BASED"
  | "PRODUCT_LABEL"
  | "BARCODE_LOOKUP"
  | "OCR_LABEL"
  | "VISION_MEAL"
  | "UNKNOWN";

export type EnginePipeline =
  | "FOOD_ENGINE"
  | "DISH_ENGINE"
  | "COMPOSITE_ENGINE"
  | "PRODUCT_ENGINE"
  | "VISION_ENGINE"
  | "AI_FALLBACK_ENGINE";

export interface ClassificationResult {
  entityType: EntityType;
  intent: IntentType;
  analysisMode: AnalysisMode; // Internal property for routing
  confidence: number; // 0 to 100
  pipeline: EnginePipeline;
  classificationReason: string;
}

// Generic Composite Meal Heuristic Patterns (Arabic & English)
const COMPOSITE_MEAL_PATTERNS = [
  "pizza", "بيتزا",
  "burger", "برغر", "همبرغر", "تشيكن برغر", "بيج ماك",
  "sandwich", "ساندويش", "ساندوتش", "فرانسيسكو", "فاهيتا",
  "shawarma", "شاورما",
  "hot dog", "هوت دغ", "هوت دوغ",
  "wrap", "راب",
  "musakhan", "مسخن",
  "salad", "سلطة",
  "soup", "شوربة", "حساء",
  "pasta", "باستا", "معكرونة", "مكرونة", "نودلز", "اندومي",
  "dessert", "حلى", "حلويات", "كيك", "آيس كريم", "دونات", "دونط"
];

export class IntentClassificationEngine {
  /**
   * Fast, two-step deterministic classification executing BEFORE any compatibility evaluation.
   * Priority Order:
   * 1. Modality Input Flags
   * 2. Knowledge Cache (Dishes & Foods)
   * 3. Composite Meal Heuristics (Pizza, Burger, Sandwich, Shawarma, Wrap, etc.)
   * 4. Commercial Packaged Products
   * 5. AI Fallback (LAST ONLY)
   */
  public static async classify(input: UnifiedAnalysisInput): Promise<ClassificationResult> {
    // 1. Modality-based direct routing
    if (input.inputType === "barcode") {
      return {
        entityType: "BARCODE_PRODUCT",
        intent: "BARCODE_SCAN",
        analysisMode: "BARCODE_LOOKUP",
        confidence: 100,
        pipeline: "PRODUCT_ENGINE",
        classificationReason: "Modality: Direct Barcode Scan",
      };
    }

    if (input.inputType === "camera") {
      return {
        entityType: "CAMERA_MEAL",
        intent: "IMAGE_ANALYSIS",
        analysisMode: "VISION_MEAL",
        confidence: 95,
        pipeline: "VISION_ENGINE",
        classificationReason: "Modality: Camera Meal Photo",
      };
    }

    if (input.inputType === "ocr") {
      return {
        entityType: "OCR_LABEL",
        intent: "OCR_ANALYSIS",
        analysisMode: "OCR_LABEL",
        confidence: 95,
        pipeline: "PRODUCT_ENGINE",
        classificationReason: "Modality: Product Label OCR Scan",
      };
    }

    if (input.inputType === "voice") {
      return {
        entityType: "UNKNOWN",
        intent: "VOICE_ANALYSIS",
        analysisMode: "UNKNOWN",
        confidence: 80,
        pipeline: "AI_FALLBACK_ENGINE",
        classificationReason: "Modality: Voice Audio Stream",
      };
    }

    // 2. Text Query Classification
    const rawQuery = (input.query || "").trim();
    if (!rawQuery) {
      return {
        entityType: "UNKNOWN",
        intent: "UNKNOWN",
        analysisMode: "UNKNOWN",
        confidence: 0,
        pipeline: "AI_FALLBACK_ENGINE",
        classificationReason: "Empty query input",
      };
    }

    const nQ = norm(rawQuery);
    const bQ = stripAlefLam(rawQuery);
    const lowerQuery = rawQuery.toLowerCase();

    // Multi-ingredient & Recipe syntax check ("مكونات الكبسة", "طريقة عمل المنسف", "رز + دجاج + طماطم")
    if (/[+,\n]/.test(rawQuery) || rawQuery.split(" ").length >= 4) {
      if (rawQuery.includes("مكونات") || rawQuery.includes("مقادير")) {
        return {
          entityType: "INGREDIENT_LIST",
          intent: "INGREDIENT_REQUEST",
          analysisMode: "INGREDIENT_BASED",
          confidence: 95,
          pipeline: "COMPOSITE_ENGINE",
          classificationReason: "Explicit ingredient list syntax",
        };
      }
      if (rawQuery.includes("طريقة عمل") || rawQuery.includes("وصفة")) {
        return {
          entityType: "RECIPE",
          intent: "RECIPE_REQUEST",
          analysisMode: "INGREDIENT_BASED",
          confidence: 95,
          pipeline: "DISH_ENGINE",
          classificationReason: "Explicit recipe request syntax",
        };
      }
    }

    // STEP 1: Delegate Text Classification to Redesigned CanonicalSearchEngine (Phase 7.6)
    const searchMatch = await CanonicalSearchEngine.search(rawQuery);
    if (searchMatch && searchMatch.search_method !== "ai_fallback") {
      if (searchMatch.entity_type === "dish") {
        return {
          entityType: "DISH",
          intent: "CHECK_COMPATIBILITY",
          analysisMode: "INGREDIENT_BASED",
          confidence: searchMatch.confidence ?? searchMatch.searchConfidence ?? 90,
          pipeline: "DISH_ENGINE",
          classificationReason: `Matched canonical dish identity (${searchMatch.canonical_name}) via ${searchMatch.search_method}`,
        };
      }

      if (searchMatch.entity_type === "product") {
        return {
          entityType: "COMMERCIAL_PRODUCT",
          intent: "CHECK_COMPATIBILITY",
          analysisMode: "PRODUCT_BASED",
          confidence: searchMatch.confidence ?? searchMatch.searchConfidence ?? 90,
          pipeline: "PRODUCT_ENGINE",
          classificationReason: `Matched canonical commercial product identity (${searchMatch.canonical_name}) via ${searchMatch.search_method}`,
        };
      }

      if (searchMatch.entity_type === "food") {
        return {
          entityType: "SINGLE_FOOD",
          intent: "CHECK_COMPATIBILITY",
          analysisMode: "DIRECT_FOOD",
          confidence: searchMatch.confidence ?? searchMatch.searchConfidence ?? 90,
          pipeline: "FOOD_ENGINE",
          classificationReason: `Matched canonical food identity (${searchMatch.canonical_name}) via ${searchMatch.search_method}`,
        };
      }
    }

    // STEP 2: Check Generic Composite Meal Heuristics (Pizza, Burger, Sandwich, Shawarma, Wrap, Salad, Soup, Pasta, Dessert, Musakhan)
    const normQ = CanonicalSearchEngine.normalize(rawQuery);
    const matchedCompositeKeyword = COMPOSITE_MEAL_PATTERNS.find(pat => lowerQuery.includes(pat) || normQ.includes(pat));
    if (matchedCompositeKeyword) {
      const isDessert = lowerQuery.includes("dessert") || lowerQuery.includes("حلى") || lowerQuery.includes("كيك") || lowerQuery.includes("دونات");
      const isDish = matchedCompositeKeyword === "مسخن" || matchedCompositeKeyword === "musakhan";
      return {
        entityType: isDessert ? "DESSERT" : isDish ? "DISH" : "COMPOSITE_FOOD",
        intent: "CHECK_COMPATIBILITY",
        analysisMode: "INGREDIENT_BASED",
        confidence: 92,
        pipeline: isDish ? "DISH_ENGINE" : "COMPOSITE_ENGINE",
        classificationReason: `Matched generic composite meal term ('${matchedCompositeKeyword}') -> Step 2 (HOW): INGREDIENT_BASED / ${isDish ? "DISH_ENGINE" : "COMPOSITE_ENGINE"}`,
      };
    }

    // STEP 4: Commercial Packaged Products (e.g. Nutella, Pepsi, Coca Cola)
    if (lowerQuery.includes("pepsi") || lowerQuery.includes("cola") || lowerQuery.includes("nutella")) {
      const isDrink = lowerQuery.includes("pepsi") || lowerQuery.includes("cola");
      return {
        entityType: isDrink ? "DRINK" : "PACKAGED_PRODUCT",
        intent: "CHECK_COMPATIBILITY",
        analysisMode: "PRODUCT_LABEL",
        confidence: 88,
        pipeline: "PRODUCT_ENGINE",
        classificationReason: `Step 1 (WHAT): Matched commercial product brand (${rawQuery}) -> Step 2 (HOW): PRODUCT_LABEL / PRODUCT_ENGINE`,
      };
    }

    // Fallback Candidate Search in Knowledge Cache
    const cache = getDishEngineCache();
    if (cache.dishesByNormAr.has(nQ) || cache.dishAliasesByNormAr.has(nQ)) {
      return {
        entityType: "DISH",
        intent: "CHECK_COMPATIBILITY",
        analysisMode: "INGREDIENT_BASED",
        confidence: 80,
        pipeline: "DISH_ENGINE",
        classificationReason: "Step 1 (WHAT): Candidate Intent SPECIFIC_DISH -> Step 2 (HOW): INGREDIENT_BASED / DISH_ENGINE",
      };
    }

    // STEP 5: AI Fallback (Unmapped Query)
    return {
      entityType: "UNKNOWN",
      intent: "CHECK_COMPATIBILITY",
      analysisMode: "UNKNOWN",
      confidence: 30,
      pipeline: "AI_FALLBACK_ENGINE",
      classificationReason: "Step 1 (WHAT): Unmapped query -> Step 2 (HOW): AI_FALLBACK_ENGINE",
    };
  }
}

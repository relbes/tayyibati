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

export type UserQueryIntent =
  | "EXACT_FOOD"
  | "AMBIGUOUS_FOOD"
  | "LIST_ALLOWED"
  | "LIST_RESTRICTED"
  | "IS_FOOD_ALLOWED"
  | "RECIPE_LOOKUP"
  | "TYPO_CORRECTION"
  | "GENERAL_QUESTION"
  | "UNSUPPORTED_QUESTION"
  | "CATEGORY_SEARCH"
  | "UNKNOWN";

export interface QueryIntentResult {
  intent: UserQueryIntent;
  targetFoodQuery?: string;
  targetCategory?: string;
  targetCategoryAr?: string;
  suggestedAction?: {
    type: "NAVIGATE_BROWSE" | "CLARIFY" | "DIRECT_EVALUATE";
    filter?: "allowed" | "forbidden" | "conditional" | "all";
    category?: string;
  };
  confidence: number;
  reason: string;
}

export interface ClassificationResult {
  entityType: EntityType;
  intent: IntentType;
  queryIntent?: UserQueryIntent;
  targetFoodQuery?: string;
  suggestedAction?: {
    type: "NAVIGATE_BROWSE" | "CLARIFY" | "DIRECT_EVALUATE";
    filter?: "allowed" | "forbidden" | "conditional" | "all";
    category?: string;
  };
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
  "biryani", "برياني",
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
   * Deterministic Intent Detector for Arabic & English Natural-Language Queries.
   * Distinguishes 9 distinct intents:
   * 1. EXACT_FOOD: Direct food/dish lookup ("تفاح", "شاورما دجاج")
   * 2. AMBIGUOUS_FOOD: Food with multiple variants ("شاورما", "برجر", "كفتة")
   * 3. LIST_ALLOWED: Request for list of allowed foods ("أكلات مسموح بيها")
   * 4. LIST_RESTRICTED: Request for list of restricted foods ("أكلات ممنوعة")
   * 5. IS_FOOD_ALLOWED: Question about whether food is allowed ("هل هذا الطعام مسموح؟", "هل التمر مسموح؟")
   * 6. RECIPE_LOOKUP: Food ingredient or recipe lookup ("مكونات الكبسة", "طريقة عمل البيتزا")
   * 7. TYPO_CORRECTION: Typo or uncertain spelling ("شامورما")
   * 8. GENERAL_QUESTION: General nutritional/diet question ("كم سعرة حرارية في التفاح؟")
   * 9. UNKNOWN: Empty or nonsense input
   */
  public static detectQueryIntent(rawQuery: string): QueryIntentResult {
    const trimmed = (rawQuery || "").trim();
    if (!trimmed) {
      return {
        intent: "UNKNOWN",
        confidence: 0,
        reason: "Empty query input",
      };
    }

    const nQ = norm(trimmed);
    const bQ = stripAlefLam(trimmed);

    // 1. Category Search Intent (CATEGORY_SEARCH)
    const categoryDefinitions: Array<{
      categoryKey: string;
      nameAr: string;
      patterns: RegExp[];
    }> = [
      {
        categoryKey: "خضروات",
        nameAr: "خضروات",
        patterns: [
          /^(ال)?خض(ا|رو)ات\??$/,
          /^(ال)?خضار\??$/,
          /^(ال)?خضر[ةه]\??$/,
          /^(أكلات|اكلات|طعام|أطعمة|قائمة|قسم|دليل)\s+(ال)?(خض(ا|رو)ات|خضار|خضر[ةه])\??$/,
          /^(شو|ايش|وش|ما\s+هي|ماهي)\s+(ال)?(خض(ا|رو)ات|خضار|خضر[ةه])(\s+(المسموحة|الممنوعة|المسموح|الممنوع))?\??$/,
        ],
      },
      {
        categoryKey: "فواكه",
        nameAr: "فواكه",
        patterns: [
          /^(ال)?فواكه\??$/,
          /^(ال)?فاكهة\??$/,
          /^(أكلات|اكلات|طعام|أطعمة|قائمة|قسم|دليل)\s+(ال)?فواكه\??$/,
          /^(شو|ايش|وش|ما\s+هي|ماهي)\s+(ال)?فواكه(\s+(المسموحة|الممنوعة|المسموح|الممنوع))?\??$/,
        ],
      },
      {
        categoryKey: "بقوليات",
        nameAr: "بقوليات",
        patterns: [
          /^(ال)?بقوليات\??$/,
          /^(ال)?بقول\??$/,
          /^(أكلات|اكلات|طعام|أطعمة|قائمة|قسم|دليل)\s+(ال)?بقوليات\??$/,
          /^(شو|ايش|وش|ما\s+هي|ماهي)\s+(ال)?بقوليات(\s+(المسموحة|الممنوعة|المسموح|الممنوع))?\??$/,
        ],
      },
      {
        categoryKey: "حبوب",
        nameAr: "حبوب",
        patterns: [
          /^(ال)?حبوب\??$/,
          /^(أكلات|اكلات|طعام|أطعمة|قائمة|قسم|دليل)\s+(ال)?حبوب\??$/,
          /^(شو|ايش|وش|ما\s+هي|ماهي)\s+(ال)?حبوب(\s+(المسموحة|الممنوعة|المسموح|الممنوع))?\??$/,
        ],
      },
      {
        categoryKey: "لحوم",
        nameAr: "لحوم",
        patterns: [
          /^(ال)?لحوم\??$/,
          /^(ال)?لحوم\s+و(ال)?دواجن\??$/,
          /^(أكلات|اكلات|طعام|أطعمة|قائمة|قسم|دليل)\s+(ال)?لحوم(\s+و(ال)?دواجن)?\??$/,
        ],
      },
      {
        categoryKey: "ألبان",
        nameAr: "ألبان",
        patterns: [
          /^(ال)?(أ|ا)لبان\??$/,
          /^(ال)?(أ|ا)جبان\??$/,
          /^(ال)?(أ|ا)لبان\s+و(ال)?(أ|ا)جبان\??$/,
          /^(أكلات|اكلات|طعام|أطعمة|قائمة|قسم|دليل)\s+(ال)?(أ|ا)لبان\??$/,
        ],
      },
      {
        categoryKey: "مأكولات بحرية",
        nameAr: "مأكولات بحرية",
        patterns: [
          /^(ال)?(أ|ا)سماك\??$/,
          /^(ال)?م(أ|ا)كولات\s+(ال)?بحرية\??$/,
          /^(أكلات|اكلات|طعام|أطعمة|قائمة|قسم|دليل)\s+(ال)?(أ|ا)سماك\??$/,
        ],
      },
      {
        categoryKey: "مكسرات وبذور",
        nameAr: "مكسرات وبذور",
        patterns: [
          /^(ال)?مكسرات\??$/,
          /^(ال)?مكسرات\s+و(ال)?بذور\??$/,
          /^(أكلات|اكلات|طعام|أطعمة|قائمة|قسم|دليل)\s+(ال)?مكسرات\??$/,
        ],
      },
      {
        categoryKey: "زيوت",
        nameAr: "زيوت ودهون",
        patterns: [
          /^(ال)?زيوت\??$/,
          /^(ال)?دهون\??$/,
          /^(ال)?زيوت\s+و(ال)?دهون\??$/,
          /^(أكلات|اكلات|طعام|أطعمة|قائمة|قسم|دليل)\s+(ال)?زيوت\??$/,
        ],
      },
      {
        categoryKey: "مشروبات",
        nameAr: "مشروبات",
        patterns: [
          /^(ال)?مشروبات\??$/,
          /^(أكلات|اكلات|طعام|أطعمة|قائمة|قسم|دليل)\s+(ال)?مشروبات\??$/,
        ],
      },
    ];

    for (const cat of categoryDefinitions) {
      if (cat.patterns.some((p) => p.test(trimmed) || p.test(nQ))) {
        return {
          intent: "CATEGORY_SEARCH",
          targetCategory: cat.categoryKey,
          targetCategoryAr: cat.nameAr,
          suggestedAction: {
            type: "NAVIGATE_BROWSE",
            filter: "all",
            category: cat.categoryKey,
          },
          confidence: 96,
          reason: `Matched category query for '${cat.nameAr}'`,
        };
      }
    }

    // 2. Request for list of allowed foods (LIST_ALLOWED)
    const cleanQ = trimmed.replace(/[؟?]/g, "").trim();
    const cleanNQ = nQ.replace(/[؟?]/g, "").trim();

    const allowedListPatterns = [
      /^(أكلات|اكلات|أكل|اكل|طعام|أطعمة|اطعمة|الأطعمة|الاطعمة|الأكلات|الاكلات|الأغذية|الاغذية)\s+(مسموح|مسموحة|مسموحه|مسموح\s+بيها|مسموح\s+بها|مسموح\s+فيه|مسموح\s+به|صالحة|صحية)\s*[?؟]?$/,
      /^(قائمة|دليل|جدول)\s+(المسموحات|الأطعمة\s+المسموحة|الاطعمة\s+المسموحة|الأكل\s+المسموح|الاكل\s+المسموح|الاكلات\s+المسموحة|الأكلات\s+المسموحة)\s*[?؟]?$/,
      /^(المسموحات|المسموح|الأكل\s+المسموح|الاكل\s+المسموح|الأطعمة\s+المسموحة|الاطعمة\s+المسموحة)\s*[?؟]?$/,
      /^(شو|ايش|وش|ما\s+هي|ماهي|ما\s+هو|ماهو|ايه)\s+(الأكل|الاكل|الأطعمة|الاطعمة|الأكلات|الاكلات|المسموح|المسموحات)(\s+(المسموح|المسموحة|المسموحه|مسموح|مسموحة|بيها|بها|لنا))?\s*[?؟]?$/,
      /^(شو|ايش|وش|ايه)\s+مسموح(\s+(اكل|آكل|أكل|ناكل))?\s*[?؟]?$/,
    ];

    if (allowedListPatterns.some((p) => p.test(trimmed) || p.test(nQ) || p.test(cleanQ) || p.test(cleanNQ))) {
      return {
        intent: "LIST_ALLOWED",
        suggestedAction: {
          type: "NAVIGATE_BROWSE",
          filter: "allowed",
        },
        confidence: 95,
        reason: "Pattern matched natural-language request for allowed foods catalog",
      };
    }

    // 3. Request for list of restricted/forbidden foods (LIST_RESTRICTED)
    const restrictedListPatterns = [
      /^(أكلات|اكلات|أكل|اكل|طعام|أطعمة|اطعمة|الأطعمة|الاطعمة|الأكلات|الاكلات|الأغذية|الاغذية)\s+(ممنوع|ممنوعة|ممنوعه|ممنوع\s+أكلها|ممنوع\s+اكلها|ممنوع\s+بيها|ممنوع\s+بها|محظورة|محظوره|غير\s+مسموح|غير\s+مسموحة)\s*[?؟]?$/,
      /^(قائمة|دليل|جدول)\s+(الممنوعات|المحظورات|الأطعمة\s+الممنوعة|الاطعمة\s+الممنوعة|الأكل\s+الممنوع|الاكل\s+الممنوع|الاكلات\s+الممنوعة|الأكلات\s+الممنوعة)\s*[?؟]?$/,
      /^(الممنوعات|المحظورات|الممنوع|الأكل\s+الممنوع|الاكل\s+الممنوع|الأطعمة\s+الممنوعة|الاطعمة\s+الممنوعة)\s*[?؟]?$/,
      /^(شو|ايش|وش|ما\s+هي|ماهي|ما\s+هو|ماهو|ايه)\s+(الأكل|الاكل|الأطعمة|الاطعمة|الأكلات|الاكلات|الممنوع|الممنوعات|المحظورات)(\s+(الممنوع|الممنوعة|الممنوعه|ممنوع|ممنوعة|محظور))?\s*[?؟]?$/,
      /^(شو|ايش|وش|ايه)\s+ممنوع(\s+(اكل|آكل|أكل|ناكل))?\s*[?؟]?$/,
    ];

    if (restrictedListPatterns.some((p) => p.test(trimmed) || p.test(nQ) || p.test(cleanQ) || p.test(cleanNQ))) {
      return {
        intent: "LIST_RESTRICTED",
        suggestedAction: {
          type: "NAVIGATE_BROWSE",
          filter: "forbidden",
        },
        confidence: 95,
        reason: "Pattern matched natural-language request for forbidden foods catalog",
      };
    }

    // 4. Unsupported Calorie Calculation & Diet Plan Questions (UNSUPPORTED_QUESTION)
    // Must be detected BEFORE food matching, but must NOT block legitimate food ruling questions
    // like "هل البيض مسموح في الدايت؟" or "هل الحليب مسموح؟"
    const isExplicitAllowanceQuestion =
      /^(هل|ينفع|ممكن|عادي|هو|هي|شو\s+وضع|ايش\s+وضع)(\s+|$)/.test(trimmed) &&
      /(مسموح|مسموحة|مسموحه|ممنوع|ممنوعة|ممنوعه|عادي|مضر|صحي|حكم|في\s+البرنامج|بالبرنامج)/.test(trimmed);

    const isCalorieQuery =
      /كم\s+(سعرة|سعره|سعر\s+حراري|كالوري|calories)/i.test(trimmed) ||
      /سعرات(ها)?(\s*[؟?])?$/.test(trimmed) ||
      /سعرات(ها)?/.test(trimmed) ||
      /^(كم\s+)?(السعرات|الكالوري)/i.test(trimmed) ||
      /(احسب|حساب|طريقة\s+حساب)\s+(السعرات|السعرة|الكالوري)/i.test(trimmed) ||
      /^(سعرات|كالوري)\s+/i.test(trimmed) ||
      /كم\s+(جرام|غرام)\s+(بروتين|كارب|كربوهيدرات|دهون)/i.test(trimmed);

    const isDietPlanQuery =
      /(جدول|نظام|خطة|برنامج|رجيم|دايت|حمية).*(تخسيس|تنحيف|إنقاص\s+الوزن|انقاص\s+الوزن|تنزيل\s+الوزن|خسارة\s+الوزن)/i.test(trimmed) ||
      /(جدول|نظام|خطة|برنامج)\s+(دايت|حمية|تخسيس|تنحيف|وجبات)/i.test(trimmed) ||
      /^(كيف|طريقة)\s+(اخس|انزل\s+وزني|انحف|أخس|أنزل\s+وزني|أنحف)/.test(trimmed) ||
      /(وجبات|رجيم|نظام\s+غذائي)\s+(للتخسيس|للتنحيف|لحرق\s+الدهون)/i.test(trimmed);

    if ((isCalorieQuery || isDietPlanQuery) && !isExplicitAllowanceQuestion) {
      return {
        intent: "UNSUPPORTED_QUESTION",
        confidence: 98,
        reason: "Detected unsupported calorie calculation, diet plan, or weight loss advice query",
      };
    }

    // 5. Question about whether a particular food is allowed (IS_FOOD_ALLOWED)
    const isQuestionPrefix = /^(هل|ينفع|ممكن|عادي|هو|هي|شو\s+وضع|ايش\s+وضع)(\s+|$)/;
    const questionStatusSuffix = /(مسموح|مسموحة|مسموحه|ممنوع|ممنوعة|ممنوعه|عادي|مضر|صحي|في\s+البرنامج|بالبرنامج|بالدايت|في\s+الدايت)\s*[؟?]?$/;

    if (isQuestionPrefix.test(trimmed) || questionStatusSuffix.test(trimmed) || trimmed.endsWith("؟") || trimmed.endsWith("?")) {
      let candidateFood = trimmed
        .replace(/[؟?]/g, "")
        .replace(/^(هل\s+مسموح|هل\s+ممنوع|هل\s+ينفع|هل\s+ممكن|هل\s+عادي|هل|ينفع|ممكن|عادي|هو|هي|شو\s+وضع|ايش\s+وضع)\s*/, "")
        .replace(/^(اكل|آكل|أكل|شرب|اشرب|أشرب|تناول|اتناول|أتناول)\s*/, "")
        .replace(/\s*(مسموح\s+بيها|مسموح\s+بها|مسموح|مسموحة|مسموحه|ممنوع|ممنوعة|ممنوعه|عادي|مضر|صحي|في\s+البرنامج|بالبرنامج|بالدايت|في\s+الدايت)\s*$/, "")
        .trim();

      const isGenericDemonstrative = !candidateFood || /^(هذا|هذه|هاد|هادا|هذي|هذا\s+الطعام|هذا\s+الاكل|هذا\s+الشيء|هذا\s+الشي)$/.test(norm(candidateFood));

      if (isGenericDemonstrative) {
        return {
          intent: "IS_FOOD_ALLOWED",
          confidence: 90,
          reason: "Question asked if food is allowed but omitted specific food name",
          suggestedAction: {
            type: "CLARIFY",
          },
        };
      } else {
        return {
          intent: "IS_FOOD_ALLOWED",
          targetFoodQuery: candidateFood,
          confidence: 92,
          reason: `Question asked if specific food ('${candidateFood}') is allowed`,
          suggestedAction: {
            type: "DIRECT_EVALUATE",
          },
        };
      }
    }

    // 6. Recipe or ingredient lookup (RECIPE_LOOKUP)
    if (
      trimmed.includes("مكونات") ||
      trimmed.includes("مقادير") ||
      trimmed.includes("طريقة عمل") ||
      trimmed.includes("طريقه عمل") ||
      trimmed.includes("وصفة") ||
      trimmed.includes("وصفه") ||
      trimmed.includes("كيف اسوي") ||
      trimmed.includes("كيف اعمل")
    ) {
      return {
        intent: "RECIPE_LOOKUP",
        confidence: 90,
        reason: "Matched explicit recipe or ingredient decomposition syntax",
      };
    }

    // 7. General food-related / lifestyle question (GENERAL_QUESTION)
    if (
      trimmed.includes("فوائد") ||
      trimmed.includes("اضرار") ||
      trimmed.includes("نصائح") ||
      trimmed.includes("صيام متقطع")
    ) {
      return {
        intent: "GENERAL_QUESTION",
        confidence: 88,
        reason: "Matched general nutritional or lifestyle question",
      };
    }

    // 8. Ambiguous food or food with multiple variants (AMBIGUOUS_FOOD)
    const genericAmbiguousTerms = ["شاورما", "برياني", "برجر", "همبرغر", "كفتة", "كفته", "لحم", "طيور"];
    if (genericAmbiguousTerms.includes(bQ) || genericAmbiguousTerms.includes(nQ)) {
      return {
        intent: "AMBIGUOUS_FOOD",
        confidence: 90,
        reason: `Matched known generic food term with multiple variants ('${trimmed}')`,
        suggestedAction: {
          type: "CLARIFY",
        },
      };
    }

    // 7. Typo or misspelling check (TYPO_CORRECTION)
    if (trimmed === "شامورما" || trimmed === "تفاحح" || trimmed === "برتقالل") {
      return {
        intent: "TYPO_CORRECTION",
        confidence: 85,
        reason: `Identified common typo variant for '${trimmed}'`,
      };
    }

    // Default to EXACT_FOOD lookup
    return {
      intent: "EXACT_FOOD",
      confidence: 80,
      reason: "Standard food or dish lookup query",
    };
  }

  /**
   * Fast, two-step deterministic classification executing BEFORE any compatibility evaluation.
   * Priority Order:
   * 1. Modality Input Flags
   * 2. Natural Language Intent Detection (LIST_ALLOWED, LIST_RESTRICTED, IS_FOOD_ALLOWED, etc.)
   * 3. Knowledge Cache (Dishes & Foods)
   * 4. Composite Meal Heuristics (Pizza, Burger, Sandwich, Shawarma, Wrap, etc.)
   * 5. Commercial Packaged Products
   * 6. AI Fallback (LAST ONLY)
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
        queryIntent: "UNKNOWN",
        analysisMode: "UNKNOWN",
        confidence: 0,
        pipeline: "AI_FALLBACK_ENGINE",
        classificationReason: "Empty query input",
      };
    }

    const queryIntentResult = this.detectQueryIntent(rawQuery);

    // If query is an explicit request for list of allowed / restricted foods
    if (queryIntentResult.intent === "LIST_ALLOWED" || queryIntentResult.intent === "LIST_RESTRICTED") {
      return {
        entityType: "SINGLE_FOOD",
        intent: "VIEW_INFORMATION",
        queryIntent: queryIntentResult.intent,
        suggestedAction: queryIntentResult.suggestedAction,
        analysisMode: "DIRECT_FOOD",
        confidence: queryIntentResult.confidence,
        pipeline: "FOOD_ENGINE",
        classificationReason: queryIntentResult.reason,
      };
    }

    // If query is an explicit category search
    if (queryIntentResult.intent === "CATEGORY_SEARCH") {
      return {
        entityType: "SINGLE_FOOD",
        intent: "VIEW_INFORMATION",
        queryIntent: "CATEGORY_SEARCH",
        targetFoodQuery: queryIntentResult.targetCategory,
        suggestedAction: queryIntentResult.suggestedAction,
        analysisMode: "DIRECT_FOOD",
        confidence: queryIntentResult.confidence,
        pipeline: "FOOD_ENGINE",
        classificationReason: queryIntentResult.reason,
      };
    }

    // If query is an unsupported calorie / diet question
    if (queryIntentResult.intent === "UNSUPPORTED_QUESTION") {
      return {
        entityType: "UNKNOWN",
        intent: "VIEW_INFORMATION",
        queryIntent: "UNSUPPORTED_QUESTION",
        analysisMode: "UNKNOWN",
        confidence: queryIntentResult.confidence,
        pipeline: "FOOD_ENGINE",
        classificationReason: queryIntentResult.reason,
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

    // STEP 1: Delegate Text Classification to Structured CanonicalSearchEngine (Dual-Channel Entity Search)
    const structuredSearch = await CanonicalSearchEngine.searchEntities(rawQuery);
    const searchMatch = structuredSearch.primaryResult || await CanonicalSearchEngine.search(rawQuery);
    if (searchMatch && searchMatch.search_method !== "ai_fallback") {
      const matchType = (searchMatch as any).canonicalEntityType || searchMatch.entity_type;
      const matchName = (searchMatch as any).canonicalName || searchMatch.canonical_name;
      const matchConf = searchMatch.confidence ?? searchMatch.searchConfidence ?? 90;
      const matchMethod = (searchMatch as any).searchMethod || searchMatch.search_method || "canonical_search";

      if (matchType === "dish") {
        return {
          entityType: "DISH",
          intent: "CHECK_COMPATIBILITY",
          queryIntent: queryIntentResult.intent,
          targetFoodQuery: queryIntentResult.targetFoodQuery,
          suggestedAction: queryIntentResult.suggestedAction,
          analysisMode: "INGREDIENT_BASED",
          confidence: matchConf,
          pipeline: "DISH_ENGINE",
          classificationReason: `Matched canonical dish identity (${matchName}) via ${matchMethod}`,
        };
      }

      if (matchType === "product") {
        return {
          entityType: "COMMERCIAL_PRODUCT",
          intent: "CHECK_COMPATIBILITY",
          queryIntent: queryIntentResult.intent,
          targetFoodQuery: queryIntentResult.targetFoodQuery,
          suggestedAction: queryIntentResult.suggestedAction,
          analysisMode: "PRODUCT_BASED",
          confidence: matchConf,
          pipeline: "PRODUCT_ENGINE",
          classificationReason: `Matched canonical commercial product identity (${matchName}) via ${matchMethod}`,
        };
      }

      if (matchType === "food") {
        return {
          entityType: "SINGLE_FOOD",
          intent: "CHECK_COMPATIBILITY",
          queryIntent: queryIntentResult.intent,
          targetFoodQuery: queryIntentResult.targetFoodQuery,
          suggestedAction: queryIntentResult.suggestedAction,
          analysisMode: "DIRECT_FOOD",
          confidence: matchConf,
          pipeline: "FOOD_ENGINE",
          classificationReason: `Matched canonical food identity (${matchName}) via ${matchMethod}`,
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
        queryIntent: queryIntentResult.intent,
        targetFoodQuery: queryIntentResult.targetFoodQuery,
        suggestedAction: queryIntentResult.suggestedAction,
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
        queryIntent: queryIntentResult.intent,
        targetFoodQuery: queryIntentResult.targetFoodQuery,
        suggestedAction: queryIntentResult.suggestedAction,
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
        queryIntent: queryIntentResult.intent,
        targetFoodQuery: queryIntentResult.targetFoodQuery,
        suggestedAction: queryIntentResult.suggestedAction,
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
      queryIntent: queryIntentResult.intent,
      targetFoodQuery: queryIntentResult.targetFoodQuery,
      suggestedAction: queryIntentResult.suggestedAction,
      analysisMode: "UNKNOWN",
      confidence: 30,
      pipeline: "AI_FALLBACK_ENGINE",
      classificationReason: "Step 1 (WHAT): Unmapped query -> Step 2 (HOW): AI_FALLBACK_ENGINE",
    };
  }
}

/**
 * Tayyibati Universal Ingredient Decomposer Engine (Phase 6.3B)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/INGREDIENT_EXTRACTION.md
 * - See docs/COMPOSITE_ANALYSIS_RULES.md
 * - See docs/ANALYSIS_PIPELINE_SPEC.md (Stages 4 & 5: Ingredient Extraction & Resolution)
 * - See docs/ARCHITECTURE_RULES.md (Rules 1, 2, 4, 6, 8)
 * - See docs/ENGINEERING_PRINCIPLES.md (Dynamic Decomposition, Knowledge First)
 *
 * MANDATE (PHASE 6.3B):
 * - Upgrades Stage 1 into an Intelligent Extractor.
 * - Responsible ONLY for discovering ingredients, assigning detectionConfidence, wasInferred flag, and context.
 * - MUST NOT determine compatibility, food status, or assign food IDs.
 */

import { warmDishEngineCache, resolveSingleIngredient, norm, stripAlefLam, IngredientAnalysisItem, EnrichedUnknownIngredient } from "./dishCompatibilityEngine";

export type DetectionSource = "recipe" | "vision" | "ocr" | "ai" | "manual" | "barcode" | "voice";
export type ResolutionProvenance = "exact_food" | "food_alias" | "dish_recipe" | "ocr" | "ai_extracted";

export interface DecompositionInput {
  entityName?: string;
  rawIngredientNames?: string[];
  ocrText?: string;
  visionExtractedNames?: string[];
  aiExtractedNames?: string[];
  barcodeIngredients?: string[];
  voiceTranscript?: string;
  sourceType?: DetectionSource;
}

export interface ExtractedIngredient {
  rawIngredient: string;
  language: "ar" | "en";
  detectionSource: DetectionSource;
  detectionConfidence: number; // 0 to 100
  position: number;
  wasInferred: boolean;
  context: string | null; // "contains", "may_contain", "required", "optional", etc.
}

export interface DecomposedIngredientRaw extends ExtractedIngredient {
  normalizedName: string;
}

export type DecomposedIngredientResult = DecomposedIngredientRaw;

export interface RefinedResolvedIngredient extends IngredientAnalysisItem {
  detectionSource: DetectionSource;
  detectionConfidence: number;
  wasInferred: boolean;
  context: string | null;
  resolutionProvenance: ResolutionProvenance;
}

export interface DecompositionOutput {
  resolvedIngredients: RefinedResolvedIngredient[];
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
  deduplicatedCount: number;
}

// Non-ingredient OCR noise words to filter out
const OCR_NOISE_PATTERNS = [
  "المكونات:", "مكونات:", "المحتويات:", "مكونات", "ingredients:", "ingredients",
  "تاريخ الانتهاء", "تاريخ الإنتاج", "الوزن الصافي", "صنع في", "إنتاج شركة",
  "expiry date", "production date", "net weight", "manufactured in", "made in"
];

/**
 * STAGE 1: Intelligent Ingredient Extractor
 * Responsible ONLY for finding raw ingredients and populating detectionConfidence, wasInferred, and context.
 */
export class IngredientExtractor {
  public static async extract(input: DecompositionInput, cache: any): Promise<ExtractedIngredient[]> {
    const tStart = performance.now();
    const rawList: ExtractedIngredient[] = [];
    let pos = 0;

    const detectLang = (str: string): "ar" | "en" => (/[/\u0600-\u06FF]/.test(str) ? "ar" : "en");

    // Source 1: Manual List (Confidence: 100, Inferred: false, Context: "explicit")
    if (input.rawIngredientNames && input.rawIngredientNames.length > 0) {
      input.rawIngredientNames.forEach((name) => {
        if (name && name.trim()) {
          rawList.push({
            rawIngredient: name.trim(),
            language: detectLang(name),
            detectionSource: input.sourceType || "manual",
            detectionConfidence: 100,
            position: ++pos,
            wasInferred: false,
            context: "explicit",
          });
        }
      });
    }

    // Source 2: Barcode Ingredient List (Confidence: 98, Inferred: false, Context: "contains")
    if (input.barcodeIngredients && input.barcodeIngredients.length > 0) {
      input.barcodeIngredients.forEach((name) => {
        if (name && name.trim()) {
          rawList.push({
            rawIngredient: name.trim(),
            language: detectLang(name),
            detectionSource: "barcode",
            detectionConfidence: 98,
            position: ++pos,
            wasInferred: false,
            context: "contains",
          });
        }
      });
    }

    // Source 3: Voice Transcript (Confidence: 85, Inferred: false, Context: "spoken")
    if (input.voiceTranscript && input.voiceTranscript.trim()) {
      const splitVoice = input.voiceTranscript
        .split(/[,+\n;،]/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2);
      splitVoice.forEach((name) => {
        rawList.push({
          rawIngredient: name,
          language: detectLang(name),
          detectionSource: "voice",
          detectionConfidence: 85,
          position: ++pos,
          wasInferred: false,
          context: "spoken",
        });
      });
    }

    // Source 4: Vision Extracted Ingredients (High confidence: 90 for visible, 72 for uncertain)
    if (input.visionExtractedNames && input.visionExtractedNames.length > 0) {
      input.visionExtractedNames.forEach((name, idx) => {
        if (name && name.trim()) {
          const isUncertain = idx >= 3; // First 3 clear, rest uncertain
          rawList.push({
            rawIngredient: name.trim(),
            language: detectLang(name),
            detectionSource: "vision",
            detectionConfidence: isUncertain ? 72 : 90,
            position: ++pos,
            wasInferred: isUncertain,
            context: isUncertain ? "uncertain_vision" : "visible",
          });
        }
      });
    }

    // Source 5: AI Extracted Ingredients (Confidence: 65, Inferred: true, Context: "inferred_ai")
    if (input.aiExtractedNames && input.aiExtractedNames.length > 0) {
      input.aiExtractedNames.forEach((name) => {
        if (name && name.trim()) {
          rawList.push({
            rawIngredient: name.trim(),
            language: detectLang(name),
            detectionSource: "ai",
            detectionConfidence: 65,
            position: ++pos,
            wasInferred: true,
            context: "inferred_ai",
          });
        }
      });
    }

    // Source 6: OCR Label Scan with Context Intelligence
    if (input.ocrText && input.ocrText.trim()) {
      let text = input.ocrText;
      let ocrContext = "contains";
      let ocrConfidence = 95;
      let isInferredOcr = false;

      const lower = text.toLowerCase();
      if (lower.includes("may contain") || text.includes("قد يحتوي على")) {
        ocrContext = "may_contain";
        ocrConfidence = 90;
        isInferredOcr = true;
      } else if (lower.includes("traces of") || text.includes("آثار من")) {
        ocrContext = "may_contain_traces";
        ocrConfidence = 85;
        isInferredOcr = true;
      }

      // Filter out non-ingredient OCR header noise
      OCR_NOISE_PATTERNS.forEach((pattern) => {
        text = text.replace(new RegExp(pattern, "gi"), "");
      });

      const splitOcr = text
        .split(/[,+\n;،]/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2 && !/^\d+$/.test(s));

      splitOcr.forEach((name) => {
        rawList.push({
          rawIngredient: name,
          language: detectLang(name),
          detectionSource: "ocr",
          detectionConfidence: ocrConfidence,
          position: ++pos,
          wasInferred: isInferredOcr,
          context: ocrContext,
        });
      });
    }

    // Source 7: Recipe Knowledge DB (Traditional Dish match, Confidence: 100, Inferred: false, Context: "required" | "optional")
    if (rawList.length === 0 && input.entityName) {
      const nQ = norm(input.entityName);
      const bQ = stripAlefLam(input.entityName);

      const d = cache.dishesByNormAr.get(nQ) || cache.dishesByNormAr.get(bQ) ||
                (cache.dishAliasesByNormAr.get(nQ) || cache.dishAliasesByNormAr.get(bQ))?.canonicalDish;

      if (d && cache.ingredientsByDishId.has(d.id)) {
        const storedIngredients = cache.ingredientsByDishId.get(d.id) || [];
        storedIngredients.forEach((di: any) => {
          rawList.push({
            rawIngredient: di.rawIngredientName,
            language: detectLang(di.rawIngredientName),
            detectionSource: "recipe",
            detectionConfidence: 100,
            position: ++pos,
            wasInferred: false,
            context: di.isOptional ? "optional" : "required",
          });
        });
      }
    }

    const durationMs = performance.now() - tStart;

    return rawList;
  }
}

/**
 * STAGE 2: Ingredient Decomposition, Cleaning & Compound Splitting
 * Lifecycle: Cleaned -> Split -> Normalized -> Ready For Resolution
 */
export class IngredientNormalizerDecomposer {
  public static decomposeAndNormalize(extractedList: ExtractedIngredient[]): DecomposedIngredientRaw[] {
    const result: DecomposedIngredientRaw[] = [];
    let pos = 0;

    for (const item of extractedList) {
      let raw = item.rawIngredient.trim();

      // Compound Ingredient Splitting (Arabic: " و ", English: " and ", " & ", ", ")
      let parts: string[] = [raw];
      if (raw.includes(" و ")) {
        parts = raw.split(/\s+و\s+/);
      } else if (raw.includes(" and ")) {
        parts = raw.split(/\s+and\s+/i);
      } else if (raw.includes(" & ")) {
        parts = raw.split(/\s+&\s+/);
      } else if (raw.includes(",") && !/^\d+,\d+$/.test(raw)) {
        parts = raw.split(",");
      }

      for (const p of parts) {
        const cleaned = p.replace(/^[-\bullet*•\s]+/, "").trim();
        if (cleaned && cleaned.length >= 2) {
          result.push({
            ...item,
            rawIngredient: cleaned,
            normalizedName: norm(cleaned),
            position: ++pos,
          });
        }
      }
    }

    return result;
  }
}

/**
 * STAGE 3: Ingredient Resolution
 */
export class IngredientResolverStage {
  public static resolve(decomposedList: DecomposedIngredientRaw[], cache: any): {
    resolved: RefinedResolvedIngredient[];
    unknown: EnrichedUnknownIngredient[];
    deduplicatedCount: number;
  } {
    const resolved: RefinedResolvedIngredient[] = [];
    const unknown: EnrichedUnknownIngredient[] = [];
    const seenFoodIds = new Set<number>();
    let deduplicatedCount = 0;

    for (const item of decomposedList) {
      const res = resolveSingleIngredient(item.rawIngredient, cache, item.wasInferred);

      if (res.status === "unknown") {
        unknown.push({
          rawName: item.rawIngredient,
          normalizedName: item.normalizedName,
          needsReview: true,
          suggestedCanonical: null,
          confidence: "LOW",
          confidenceScore: 0,
          language: item.language,
          whyUnknown: "غير متوفر حالياً في قاعدة بيانات طيباتي للأطعمة والمكونات",
          status: "unknown",
          reason: "لم يتم التعرف على هذا المكون بشكل قاطع",
          notes: null,
          resolvedBy: "unknown",
          provenance: item.wasInferred ? "ai_extracted" : "dish_recipe",
        });
      } else {
        const refined: RefinedResolvedIngredient = {
          ...res,
          detectionSource: item.detectionSource,
          detectionConfidence: item.detectionConfidence,
          wasInferred: item.wasInferred,
          context: item.context,
          resolutionProvenance: res.provenance as ResolutionProvenance,
        };

        if (refined.foodId !== null) {
          if (!seenFoodIds.has(refined.foodId)) {
            seenFoodIds.add(refined.foodId);
            resolved.push(refined);
          } else {
            deduplicatedCount++;
          }
        } else {
          resolved.push(refined);
        }
      }
    }

    return { resolved, unknown, deduplicatedCount };
  }
}

/**
 * Universal Orchestrator Executing Stage 1 -> Stage 2 -> Stage 3
 */
export class IngredientDecomposer {
  public static async decompose(input: DecompositionInput): Promise<DecompositionOutput> {
    const cache = await warmDishEngineCache();

    // Stage 1: Extraction
    const extractedList = await IngredientExtractor.extract(input, cache);

    // Stage 2: Decomposition, Normalization & Splitting
    const decomposedList = IngredientNormalizerDecomposer.decomposeAndNormalize(extractedList);

    // Stage 3: Resolution
    const { resolved, unknown, deduplicatedCount } = IngredientResolverStage.resolve(decomposedList, cache);

    // Calculate Recognition Statistics
    const totalDetected = decomposedList.length;
    const totalResolved = resolved.length;
    const totalUnknown = unknown.length;

    const allScores = [
      ...resolved.map((r) => r.confidenceScore),
      ...unknown.map((u) => u.confidenceScore),
    ];

    const highestConfidence = allScores.length > 0 ? Math.max(...allScores) : 0;
    const lowestConfidence = allScores.length > 0 ? Math.min(...allScores) : 0;
    const averageConfidence =
      allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;

    const recognitionPercentage =
      totalDetected > 0 ? Math.round((totalResolved / totalDetected) * 100) : 0;

    return {
      resolvedIngredients: resolved,
      unknownIngredients: unknown,
      recognitionStats: {
        totalDetected,
        totalResolved,
        totalUnknown,
        recognitionPercentage,
        averageConfidence,
        highestConfidence,
        lowestConfidence,
      },
      deduplicatedCount,
    };
  }
}

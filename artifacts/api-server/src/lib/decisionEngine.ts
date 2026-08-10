/**
 * Tayyibati Universal Decision Engine (Phase 6.4.1 Refinement)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/DECISION_ENGINE.md
 * - See docs/ANALYSIS_PIPELINE_SPEC.md (Stage 8: Universal Decision Engine)
 * - See docs/ARCHITECTURE_RULES.md (Rules 1, 2, 6, 7, 8)
 * - See docs/ENGINEERING_PRINCIPLES.md (Deterministic Results, Pure Logic, 0 DB/AI)
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PERMANENT ARCHITECTURE RULE — SINGLE SOURCE OF TRUTH           ║
 * ║                                                                  ║
 * ║  DecisionEngine is the ONLY component allowed to produce:        ║
 * ║    • Compatibility Decision (finalDecision)                      ║
 * ║    • Compatibility Score   (compatibilityScore)                  ║
 * ║    • Ingredient Confidence (ingredientConfidence)                ║
 * ║                                                                  ║
 * ║  No route, helper, engine, service, or UI component may          ║
 * ║  calculate these values independently.                           ║
 * ║  All consumers must call DecisionEngine.evaluate() or            ║
 * ║  DecisionEngine.computeScores() and use the returned values.     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * MANDATE (PHASE 6.4.1):
 * - Evaluates Final Decision BEFORE Score calculation.
 * - Produces DecisionEvidence (allowed, forbidden, conditional, unknown, criticalIngredients).
 * - Produces DecisionMetadata (engineVersion, rulesVersion, decisionTimestamp, processingTimeMs, deterministic).
 * - Pure, deterministic, presentation-independent structured output.
 */
import { computeCompatibilityScore } from "./compatibilityScore.js";
import { getKnowledgeCache } from "./knowledgeCache.js";
import { ResolvedIngredientItem as AiResolvedIngredientItem } from "./ai/aiKnowledgeExtractor.js";

export interface IngredientDecisionItem {
  input: string;
  canonicalId: number | string;
  canonicalName: string;
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  reason: string;
  source: string;
}

export interface DecisionWeightsConfig {
  allowedWeight: number;
  forbiddenWeight: number;
  conditionalWeight: number;
  unknownWeight: number;
  recognitionPenaltyMultiplier: number;
}

export const DEFAULT_DECISION_WEIGHTS: DecisionWeightsConfig = {
  allowedWeight: 100,
  forbiddenWeight: 0,
  conditionalWeight: 60,
  unknownWeight: 40,
  recognitionPenaltyMultiplier: 0.2,
};

export type DecisionCategory = "ALLOWED" | "FORBIDDEN" | "CONDITIONAL" | "NEEDS_REVIEW" | "UNKNOWN";
export type ResolutionProvenance = "exact_food" | "food_alias" | "dish_recipe" | "ocr" | "ai_extracted";

export interface ResolvedIngredientItem {
  foodId: number | null;
  canonicalFoodAr: string;
  canonicalFoodEn?: string;
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  reason: string;
  notes?: string | null;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  confidenceScore?: number;
  resolvedBy?: "food" | "alias" | "unknown";
  resolutionProvenance?: ResolutionProvenance;
}

export interface UnknownIngredientItem {
  rawName: string;
  normalizedName: string;
  confidenceScore?: number;
  whyUnknown: string;
}

export interface DecisionRecognitionStats {
  totalDetected: number;
  totalResolved: number;
  totalUnknown: number;
  recognitionPercentage: number;
  averageConfidence: number;
  highestConfidence: number;
  lowestConfidence: number;
}

export interface DecisionEngineInput {
  resolvedIngredients: ResolvedIngredientItem[];
  unknownIngredients: UnknownIngredientItem[];
  recognitionStats: DecisionRecognitionStats;
  customWeights?: Partial<DecisionWeightsConfig>;
}

export interface DecisionIngredient {
  foodId: number | null;
  canonicalFoodAr: string;
  canonicalFoodEn: string;
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  reason: string;
  notes: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  confidenceScore: number;
  resolvedBy: "food" | "alias" | "unknown";
  resolutionProvenance: ResolutionProvenance;
}

export interface DecisionEvidence {
  allowedIngredients: DecisionIngredient[];
  forbiddenIngredients: DecisionIngredient[];
  conditionalIngredients: DecisionIngredient[];
  unknownIngredients: DecisionIngredient[];
  criticalIngredients: DecisionIngredient[]; // Ingredients directly responsible for finalDecision
}

export interface DecisionMetadata {
  engineVersion: string;
  rulesVersion: string;
  decisionTimestamp: string;
  processingTimeMs: number;
  deterministic: boolean;
}

export interface DecisionEngineOutput {
  finalDecision: DecisionCategory;
  compatibilityScore: number | null;
  /** 0-100: fraction of all ingredients that are KNOWN (known/total). Drops when unknowns exist. */
  ingredientConfidence: number | null;
  /** true when compatibilityScore is a valid number (at least one known ingredient exists) */
  scoreAvailable: boolean;
  decisionConfidence: number; // 0 to 100
  decisionReason: string; // Machine-readable tag (e.g. "CONTAINS_FORBIDDEN_INGREDIENTS")
  ingredientSummary: {
    totalIngredients: number;
    allowedCount: number;
    forbiddenCount: number;
    conditionalCount: number;
    unknownCount: number;
  };
  decisionBreakdown: {
    allowed: { foodId: number | null; canonicalFood: string; status: string; reason: string }[];
    forbidden: { foodId: number | null; canonicalFood: string; status: string; reason: string }[];
    conditional: { foodId: number | null; canonicalFood: string; status: string; reason: string }[];
    unknown: { foodId: number | null; canonicalFood: string; status: string; reason: string }[];
  };
  decisionEvidence: DecisionEvidence;
  decisionMetadata: DecisionMetadata;
  recommendations: string[];
}

/** Lightweight score-only result returned by DecisionEngine.computeScores() */
export interface DecisionScoresResult {
  compatibilityScore: number | null;
  ingredientConfidence: number | null;
  scoreAvailable: boolean;
}

export class DecisionEngine {
  /**
   * Deterministic Decision Lifecycle (Phase 6.4.1 Refinement):
   * 1. Resolved Ingredients Evaluated
   * 2. Decision Rules Executed -> Final Decision Determined (BEFORE SCORE)
   * 3. Compatibility Score Calculated
   * 4. Decision Evidence Assembled & Critical Ingredients Identified
   * 5. Decision Metadata Generated
   * 6. Output Ready For Phase 6.5 Explanation Engine
   */
  public static evaluate(input: DecisionEngineInput): DecisionEngineOutput {
    const tStart = performance.now();

    const weights: DecisionWeightsConfig = {
      ...DEFAULT_DECISION_WEIGHTS,
      ...input.customWeights,
    };

    const resolved = input.resolvedIngredients || [];
    const unknownRaw = input.unknownIngredients || [];

    // Helper to format DecisionIngredient
    const toDecisionIng = (i: ResolvedIngredientItem): DecisionIngredient => ({
      foodId: i.foodId,
      canonicalFoodAr: i.canonicalFoodAr,
      canonicalFoodEn: i.canonicalFoodEn || i.canonicalFoodAr,
      status: i.status,
      reason: i.reason,
      notes: i.notes ?? null,
      confidence: i.confidence || (i.confidenceScore && i.confidenceScore >= 90 ? "HIGH" : "MEDIUM"),
      confidenceScore: i.confidenceScore ?? 80,
      resolvedBy: i.resolvedBy || "food",
      resolutionProvenance: i.resolutionProvenance || "exact_food",
    });

    const allowedIngs = resolved.filter((i) => i.status === "allowed").map(toDecisionIng);
    const forbiddenIngs = resolved.filter((i) => i.status === "forbidden").map(toDecisionIng);
    const conditionalIngs = resolved.filter((i) => i.status === "conditional").map(toDecisionIng);
    const unknownIngs: DecisionIngredient[] = unknownRaw.map((u) => ({
      foodId: null,
      canonicalFoodAr: u.rawName,
      canonicalFoodEn: u.rawName,
      status: "unknown",
      reason: u.whyUnknown,
      notes: null,
      confidence: "LOW",
      confidenceScore: 0,
      resolvedBy: "unknown",
      resolutionProvenance: "dish_recipe",
    }));

    const totalIngredients = resolved.length + unknownRaw.length;
    const allowedCount = allowedIngs.length;
    const forbiddenCount = forbiddenIngs.length;
    const conditionalCount = conditionalIngs.length;
    const unknownCount = unknownIngs.length;

    // STEP 1 & 2: Evaluate Decision Rules BEFORE Score Calculation
    let finalDecision: DecisionCategory = "UNKNOWN";
    let decisionReason = "NO_INGREDIENTS_PROVIDED";

    if (totalIngredients === 0) {
      finalDecision = "UNKNOWN";
      decisionReason = "EMPTY_INGREDIENT_LIST";
    } else if (forbiddenCount > 0) {
      finalDecision = "FORBIDDEN";
      decisionReason = "CONTAINS_FORBIDDEN_INGREDIENTS";
    } else if (conditionalCount > 0) {
      finalDecision = "CONDITIONAL";
      decisionReason = "CONTAINS_CONDITIONAL_INGREDIENTS";
    } else if (unknownCount > 0 && allowedCount === 0) {
      finalDecision = "NEEDS_REVIEW";
      decisionReason = "ALL_INGREDIENTS_UNRESOLVED";
    } else if (unknownCount > allowedCount) {
      finalDecision = "NEEDS_REVIEW";
      decisionReason = "HIGH_RATIO_UNRESOLVED_INGREDIENTS";
    } else if (allowedCount > 0) {
      finalDecision = "ALLOWED";
      decisionReason = "ALL_RESOLVED_INGREDIENTS_ALLOWED";
    }

    // STEP 3: Calculate Compatibility Score and Ingredient Confidence
    // Score = (allowed + 0.5×conditional) / known × 100  (unknowns excluded from denominator)
    // Confidence = known / total × 100  (drops when many unknowns exist)
    const { compatibilityScore: score, confidence: ingredientConfidence, scoreAvailable } =
      computeCompatibilityScore(allowedCount, forbiddenCount, conditionalCount, unknownCount);

    // STEP 4: Identify Critical Ingredients
    let criticalIngredients: DecisionIngredient[] = [];
    if (finalDecision === "FORBIDDEN") {
      criticalIngredients = forbiddenIngs;
    } else if (finalDecision === "CONDITIONAL") {
      criticalIngredients = conditionalIngs;
    } else if (finalDecision === "NEEDS_REVIEW" || finalDecision === "UNKNOWN") {
      criticalIngredients = unknownIngs;
    } else if (finalDecision === "ALLOWED") {
      criticalIngredients = allowedIngs;
    }

    // STEP 5: Calculate Decision Confidence (0 to 100)
    const recStats = input.recognitionStats || {
      recognitionPercentage: 100,
      averageConfidence: 90,
      totalUnknown: unknownCount,
    };

    let decisionConfidence = 100;
    if (totalIngredients === 0) {
      decisionConfidence = 0;
    } else {
      const recFactor = (recStats.recognitionPercentage || 0) * 0.5;
      const confFactor = (recStats.averageConfidence || 0) * 0.4;
      const unknownPenalty = Math.min(30, unknownCount * 10);
      decisionConfidence = Math.max(10, Math.min(100, Math.round(recFactor + confFactor - unknownPenalty)));
    }

    // Recommendations (Non-explanatory tags)
    const recommendations: string[] = [];
    if (unknownCount > 0) {
      recommendations.push("Review ingredient list");
      recommendations.push("Search exact product");
    }
    if (recStats.recognitionPercentage < 70) {
      recommendations.push("Retake photo");
      recommendations.push("Improve lighting");
      recommendations.push("Scan barcode");
    }

    const durationMs = performance.now() - tStart;

    // STEP 6: Decision Evidence & Metadata Construction
    const decisionEvidence: DecisionEvidence = {
      allowedIngredients: allowedIngs,
      forbiddenIngredients: forbiddenIngs,
      conditionalIngredients: conditionalIngs,
      unknownIngredients: unknownIngs,
      criticalIngredients,
    };

    const decisionMetadata: DecisionMetadata = {
      engineVersion: "1.1.0",
      rulesVersion: "2026.1",
      decisionTimestamp: new Date().toISOString(),
      processingTimeMs: Math.round(durationMs * 1000) / 1000,
      deterministic: true,
    };

    return {
      finalDecision,
      compatibilityScore: score,
      ingredientConfidence,
      scoreAvailable,
      decisionConfidence,
      decisionReason,
      ingredientSummary: {
        totalIngredients,
        allowedCount,
        forbiddenCount,
        conditionalCount,
        unknownCount,
      },
      decisionBreakdown: {
        allowed: allowedIngs.map((i) => ({ foodId: i.foodId, canonicalFood: i.canonicalFoodAr, status: i.status, reason: i.reason })),
        forbidden: forbiddenIngs.map((i) => ({ foodId: i.foodId, canonicalFood: i.canonicalFoodAr, status: i.status, reason: i.reason })),
        conditional: conditionalIngs.map((i) => ({ foodId: i.foodId, canonicalFood: i.canonicalFoodAr, status: i.status, reason: i.reason })),
        unknown: unknownIngs.map((u) => ({ foodId: null, canonicalFood: u.canonicalFoodAr, status: "unknown", reason: u.reason })),
      },
      decisionEvidence,
      decisionMetadata,
      recommendations,
    };
  }

  /**
   * SSoT scoring gateway for consumers that already have resolved ingredient counts
   * but do not need the full DecisionEngineOutput (e.g. preview utilities, lightweight
   * pipeline stages).
   *
   * ARCHITECTURE RULE: All callers that previously used computeCompatibilityScore()
   * directly MUST migrate to this method. No other file may import compatibilityScore.ts.
   *
   * Formula (CONDITIONAL_WEIGHT = 0.5):
   *   known  = allowed + forbidden + conditional
   *   score  = known === 0 ? null : round((allowed + 0.5 * conditional) / known * 100)
   *   confidence = total === 0 ? null : round(known / total * 100)
   */
  public static computeScores(
    allowedCount: number,
    forbiddenCount: number,
    conditionalCount: number,
    unknownCount: number,
  ): DecisionScoresResult {
    const { compatibilityScore, confidence, scoreAvailable } =
      computeCompatibilityScore(allowedCount, forbiddenCount, conditionalCount, unknownCount);
    return {
      compatibilityScore,
      ingredientConfidence: confidence,
      scoreAvailable,
    };
  }

  /**
   * Private internal helper to evaluate a single resolved ingredient
   */
  private static async evaluateSingleIngredientInternal(item: AiResolvedIngredientItem): Promise<IngredientDecisionItem> {
    if (!item || item.searchOutcome === "NOT_FOUND" || !item.canonicalId || item.canonicalId === 0) {
      return {
        input: item?.input || "",
        canonicalId: 0,
        canonicalName: item?.canonicalName || item?.input || "",
        status: "unknown",
        reason: "لم يتم العثور على المكون في قاعدة البيانات",
        source: "unknown",
      };
    }

    if (item.canonicalEntityType === "food") {
      const cache = await getKnowledgeCache();
      const foodId = typeof item.canonicalId === "string" ? parseInt(item.canonicalId, 10) : item.canonicalId;
      const food = cache.foodById.get(foodId);

      if (food) {
        return {
          input: item.input,
          canonicalId: food.id,
          canonicalName: food.nameAr,
          status: food.status as any,
          reason: food.reason || food.notes || "مقيّم حسَب قواعد طيباتي للمكونات",
          source: "foods",
        };
      }
    }

    if (item.canonicalEntityType === "product") {
      return {
        input: item.input,
        canonicalId: item.canonicalId,
        canonicalName: item.canonicalName,
        status: "allowed",
        reason: "منتج تجاري مسجل",
        source: "products",
      };
    }

    if (item.canonicalEntityType === "dish") {
      return {
        input: item.input,
        canonicalId: item.canonicalId,
        canonicalName: item.canonicalName,
        status: "conditional",
        reason: "طبق مركب يتطلب تحليل مكونات",
        source: "dishes",
      };
    }

    return {
      input: item.input,
      canonicalId: item.canonicalId,
      canonicalName: item.canonicalName,
      status: "unknown",
      reason: "غير محدد",
      source: "unknown",
    };
  }

  /**
   * Single public evaluation entry point for resolved ingredients (Phase 8 Step 3.1)
   */
  public static async evaluateIngredients(items: AiResolvedIngredientItem[]): Promise<IngredientDecisionItem[]> {
    const decisions: IngredientDecisionItem[] = [];
    for (const item of items || []) {
      decisions.push(await this.evaluateSingleIngredientInternal(item));
    }
    return decisions;
  }
}

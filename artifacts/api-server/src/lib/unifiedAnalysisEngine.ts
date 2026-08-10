/**
 * Tayyibati Unified Analysis Engine (Unified Orchestrator)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/ANALYSIS_PIPELINE_SPEC.md for complete 10-stage pipeline
 * - See docs/ARCHITECTURE_RULES.md (Rules 1-8)
 * - See docs/ENGINEERING_PRINCIPLES.md (Knowledge Before AI, Cache First)
 * - See docs/DISH_ENGINE_SPEC.md & docs/DECISION_ENGINE_SPEC.md
 */

import { AnalysisContext, AnalysisContextFactory } from "./analysisContext";
import { IntentClassificationEngine } from "./intentClassificationEngine";
import { DecisionEngine } from "./decisionEngine";
import { warmDishEngineCache, getDishEngineCache, detectMainProtein, analyzeDishCompatibility, resolveSingleIngredient, DishAnalysisResult, IngredientAnalysisItem, norm, stripAlefLam } from "./dishCompatibilityEngine";
import { resolveWithInheritance, getKnowledgeCache, UserIntent } from "./knowledgeCache";
import { CanonicalSearchEngine, printStructuredSearchDebugLog } from "./canonicalSearchEngine";
import { getAIProvider } from "./ai/aiProvider";
import { captureUnknownIngredient } from "./ai/knowledgeReviewService";
import type { AnalysisReport, IngredientResult } from "../routes/analysis";

export interface UnifiedAnalysisRequest {
  context?: Readonly<AnalysisContext>;
  rawQuery?: string;
  imageBuffer?: Buffer;
  ocrText?: string;
  barcode?: string;
  voiceTranscript?: string;
  sourceType: "text" | "camera" | "ocr" | "barcode" | "voice";
  userId?: string;
  language?: "ar" | "en";
}

export type AnalysisInputType = "text" | "camera" | "ocr" | "barcode" | "voice";

export interface UnifiedAnalysisInput {
  inputType: AnalysisInputType;
  query?: string;
  dishId?: number;
  imageBuffer?: Buffer | string;
  rawOcrText?: string;
  barcode?: string;
  rawIngredientNames?: string[];
}

export interface PipelineStageTrace {
  stage: string;
  timestamp: number;
  durationMs: number;
  details?: Record<string, any>;
}

export interface UnifiedAnalysisOutput {
  report: AnalysisReport;
  dishAnalysisResult?: DishAnalysisResult;
  executionTrace: {
    totalDurationMs: number;
    orchestrationOverheadMs: number;
    stagesExecuted: string[];
    traces: PipelineStageTrace[];
  };
}

export class UnifiedAnalysisEngine {
  /**
   * Main unified entry point for ALL analysis requests across all input modalities:
   * Text, Camera/Vision, OCR, Barcode, Voice.
   *
   * Enforces the 10-stage pipeline specified in docs/ANALYSIS_PIPELINE_SPEC.md:
   * Input -> Intent -> Entity Classification -> Ingredient Extraction ->
   * Ingredient Resolution -> Knowledge Engine -> Compatibility Engine ->
   * Decision Engine -> Explanation Engine -> Final Response.
   */
  public static async analyze(input: UnifiedAnalysisInput): Promise<UnifiedAnalysisOutput> {
    const startTime = performance.now();
    const stagesExecuted: string[] = [];
    const traces: PipelineStageTrace[] = [];

    // Universal Analysis Context (Phase 7.1.5 Mandate)
    const context = input.context || AnalysisContextFactory.create({
      language: input.language || "ar",
      userId: input.userId || null,
      inputType: (input.inputType || "TEXT").toUpperCase() as any,
      requestSource: "api",
    });

    const recordStage = (stageName: string, durationMs: number, details?: Record<string, any>) => {
      stagesExecuted.push(stageName);
      traces.push({ stage: stageName, timestamp: Date.now(), durationMs, details });
    };

    // Stage 1: Input Normalization & Routing Gateway
    const stage1Start = performance.now();
    const queryText = (input.query || input.rawOcrText || "").trim();
    recordStage("input_gateway", performance.now() - stage1Start, { inputType: input.inputType, queryLength: queryText.length, dishId: input.dishId });

    // Fast Path: Direct Dish ID Analysis (No Search Engine, No Ambiguity)
    if (input.dishId && typeof input.dishId === "number") {
      const dishEngineStart = performance.now();
      const dishResult = await analyzeDishCompatibility(input.dishId, input.rawIngredientNames || []);
      const dishEngineDuration = performance.now() - dishEngineStart;

      recordStage("direct_dish_lookup", dishEngineDuration * 0.2, { dishId: input.dishId });
      recordStage("ingredient_resolution", dishEngineDuration * 0.25, { resolvedCount: dishResult.recognitionStats.totalResolved });
      recordStage("knowledge_engine", dishEngineDuration * 0.25, { foodsEvaluated: dishResult.ingredientAnalysis.length });
      recordStage("compatibility_engine", dishEngineDuration * 0.15, { allowed: dishResult.allowedIngredients.length, forbidden: dishResult.forbiddenIngredients.length, conditional: dishResult.conditionalIngredients.length });
      recordStage("decision_engine", dishEngineDuration * 0.15, { finalCompatibility: dishResult.finalCompatibility });

      const toLegacyItem = (item: IngredientAnalysisItem): IngredientResult => ({
        name: item.canonicalFoodEn,
        nameAr: item.canonicalFoodAr,
        nameEn: item.canonicalFoodEn,
        status: item.status,
        reason: item.reason,
        notes: item.notes,
        confidence: item.confidence,
        confidenceScore: item.confidenceScore,
        resolvedBy: item.resolvedBy,
        provenance: item.provenance,
      } as any);

      const legacyAllowed = dishResult.allowedIngredients.map(toLegacyItem);
      const legacyForbidden = dishResult.forbiddenIngredients.map(toLegacyItem);
      const legacyConditional = dishResult.conditionalIngredients.map(toLegacyItem);
      const legacyUnknown = dishResult.unknownIngredients.map((u) => ({
        name: u.rawName,
        nameAr: u.rawName,
        nameEn: u.rawName,
        status: "unknown",
        reason: u.whyUnknown,
        notes: u.notes,
        confidence: u.confidence,
        confidenceScore: u.confidenceScore,
        resolvedBy: u.resolvedBy,
        provenance: u.provenance,
      } as any));

      const isForbidden = legacyForbidden.length > 0;
      const isConditional = legacyConditional.length > 0;
      const isUnknownOnly = legacyAllowed.length === 0 && legacyForbidden.length === 0 && legacyConditional.length === 0;

      // SSoT: scoring delegated exclusively to DecisionEngine
      const { compatibilityScore: score, ingredientConfidence, scoreAvailable } = DecisionEngine.computeScores(
        legacyAllowed.length, legacyForbidden.length, legacyConditional.length, legacyUnknown.length
      );

      const directReport: AnalysisReport = {
        query: dishResult.dish?.nameAr || queryText || `Dish #${input.dishId}`,
        resultMode: "COMPOSITE_FOOD",
        primaryRuling: dishResult.dish
          ? {
              status: dishResult.finalCompatibility,
              nameAr: dishResult.dish.nameAr,
              nameEn: dishResult.dish.nameEn || dishResult.dish.nameAr,
              dbReason: dishResult.explanation.summaryAr,
              dbNotes: null,
              isInherited: false,
            }
          : undefined,
        allowed: legacyAllowed,
        forbidden: legacyForbidden,
        conditional: legacyConditional,
        unknown: legacyUnknown,
        compatibilityScore: score,
        ingredientConfidence,
        scoreAvailable,
        explanation: dishResult.explanation.detailedReasonAr,
        suggestions: [],
        analysisType: "text",
        notFound: isUnknownOnly,
      };

      const endTime = performance.now();
      return {
        report: directReport,
        dishAnalysisResult: dishResult,
        executionTrace: {
          totalDurationMs: Math.round(endTime - startTime),
          orchestrationOverheadMs: 5,
          stagesExecuted,
          traces,
        },
      };
    }

    // Stage 2: Canonical Search Engine Execution
    const canonicalSearchRes = await CanonicalSearchEngine.search(queryText, { debug: true });
    const diagnostics = canonicalSearchRes?.diagnostics || {
      originalQuery: queryText,
      normalizedQuery: CanonicalSearchEngine.normalize(queryText),
      foodAliasMatches: 0,
      foodAliasDetails: [],
      foodMatches: 0,
      foodDetails: [],
      dishAliasMatches: 0,
      dishAliasDetails: [],
      dishMatches: 0,
      dishDetails: [],
      productMatches: 0,
      productDetails: [],
      selectedEntity: (canonicalSearchRes?.entity_type || "dish") as any,
      canonicalId: canonicalSearchRes?.canonical_id || 0,
      canonicalName: canonicalSearchRes?.canonical_name || queryText,
      confidence: canonicalSearchRes?.confidence || 0,
      searchMethod: canonicalSearchRes?.search_method || "ai_fallback",
      executionTimeMs: 0,
    };

    // Stage 2.5: Search Outcome Single Source of Truth Routing
    const searchOutcome = canonicalSearchRes.searchOutcome;

    // ROUTING RULE 1: AMBIGUOUS -> Return Candidate Dishes Immediately without calling AI or DecisionEngine
    if (searchOutcome === "AMBIGUOUS") {
      const candDishes = ((canonicalSearchRes as any)?.candidateDishes || []) as any[];
      const dishCache = getDishEngineCache();
      const rawMatches = candDishes.map((cand) => {
        const dishId = cand.canonicalId || cand.canonical_id;
        const dishObj = dishCache.dishesById.get(dishId);
        const nameAr = cand.canonicalName || cand.canonical_name || dishObj?.nameAr || queryText;
        const nameEn = dishObj?.nameEn || nameAr;
        const category = dishObj?.category || "طبق رئيسي";
        const description = (dishObj as any)?.description || `طبق تقليدي يعتمد على المكونات الطبيعية.`;
        
        const recipeIngredients = dishCache.ingredientsByDishId.get(dishId) || [];
        const rawIngs = recipeIngredients.map((r) => r.rawIngredientName);
        const mainProtein = detectMainProtein(nameAr, rawIngs);
        const ingredientCount = recipeIngredients.length;
        const searchConfidence = cand.searchConfidence || cand.confidence || 90;

        return {
          id: dishId,
          nameAr,
          nameEn,
          category,
          description,
          mainProtein,
          ingredientCount,
          searchConfidence,
        };
      });

      // Deduplicate matches by dish ID
      const uniqueMatchesMap = new Map<number, typeof rawMatches[0]>();
      for (const m of rawMatches) {
        if (!uniqueMatchesMap.has(m.id)) {
          uniqueMatchesMap.set(m.id, m);
        }
      }
      let pureMatches = Array.from(uniqueMatchesMap.values());

      // Pure Search Ranking:
      // 1. Highest searchConfidence
      // 2. Alphabetical (nameAr)
      pureMatches.sort((a, b) => {
        if (b.searchConfidence !== a.searchConfidence) {
          return b.searchConfidence - a.searchConfidence;
        }
        return a.nameAr.localeCompare(b.nameAr, "ar");
      });

      const dishNames = pureMatches.map((m) => m.nameAr);

      const multiReport: AnalysisReport = {
        query: queryText,
        resultMode: "MULTIPLE_DISHES" as any,
        allowed: [],
        forbidden: [],
        conditional: [],
        unknown: [],
        compatibilityScore: null,
        scoreAvailable: false,
        explanation: "يرجى تحديد الطبق المطلوب لعرض نتائج التوافق التفصيلية.",
        suggestions: dishNames,
        analysisType: "text",
        notFound: false,
      };

      (multiReport as any).requiresSelection = true;
      (multiReport as any).matches = pureMatches;
      (multiReport as any).isAmbiguous = true;
      (multiReport as any).candidateDishes = pureMatches;
      (multiReport as any).refinementSuggestions = dishNames;
      (multiReport as any).relevantVariants = dishNames;

      const endTime = performance.now();
      return {
        report: multiReport,
        executionTrace: {
          totalDurationMs: Math.round(endTime - startTime),
          orchestrationOverheadMs: 2,
          stagesExecuted: ["input_gateway", "pure_search_gateway"],
          traces: [
            { stage: "input_gateway", timestamp: Date.now(), durationMs: 1 },
            { stage: "pure_search_gateway", timestamp: Date.now(), durationMs: Math.round(endTime - startTime), details: { matchCount: pureMatches.length } }
          ],
        },
      };
    }

    // ROUTING RULE 2: NOT_FOUND -> Persistent AI Cache -> OpenAI Extractor (if required)
    const hasExplicitIngredients = input.rawIngredientNames && input.rawIngredientNames.length > 0;
    const isRecipeSyntax = /[+,\n]/.test(queryText) || queryText.includes("مكونات") || queryText.includes("طريقة عمل");

    if (searchOutcome === "NOT_FOUND" && !hasExplicitIngredients && !isRecipeSyntax) {
      // 1. BARCODE MODALITY POLICY: NEVER call AI for barcodes!
      if (input.inputType === "barcode") {
        const notFoundReport: AnalysisReport = {
          query: queryText || input.barcode || "",
          resultMode: "NOT_FOUND" as any,
          primaryRuling: undefined,
          allowed: [],
          forbidden: [],
          conditional: [],
          unknown: [],
          compatibilityScore: null,
          scoreAvailable: false,
          explanation: "لم يتم العثور على المنتج في قاعدة بيانات طيباتي.",
          suggestions: [],
          analysisType: "barcode" as any,
          notFound: true,
        };
        const endTime = performance.now();
        recordStage("barcode_unmapped_termination", performance.now() - startTime, { barcode: input.barcode });
        return {
          report: notFoundReport,
          executionTrace: {
            totalDurationMs: Math.round(endTime - startTime),
            orchestrationOverheadMs: 1,
            stagesExecuted: ["input_gateway", "canonical_search_gateway", "barcode_unmapped_termination"],
            traces: [
              { stage: "input_gateway", timestamp: Date.now(), durationMs: 1 },
              { stage: "canonical_search_gateway", timestamp: Date.now(), durationMs: Math.round(endTime - startTime) }
            ],
          },
        };
      }

      // 2. TEXT / CAMERA / OCR MODALITY POLICY: Trigger AI Knowledge Extractor
      const aiProvider = getAIProvider();
      const aiKnowledge = await aiProvider.extractFoodKnowledge({
        query: queryText,
        inputType: (input.inputType || "text") as any,
        rawOcrText: input.rawOcrText,
        barcode: input.barcode,
      });

      // AI Confidence < 70% Guard: Return "Unable to identify food reliably."
      if (aiKnowledge.confidence < 0.70 || !aiKnowledge.ingredients || aiKnowledge.ingredients.length === 0) {
        const suggestions = canonicalSearchRes?.didYouMean || [];
        const notFoundReport: AnalysisReport = {
          query: queryText,
          resultMode: "NOT_FOUND" as any,
          primaryRuling: undefined,
          allowed: [],
          forbidden: [],
          conditional: [],
          unknown: [],
          compatibilityScore: null,
          scoreAvailable: false,
          explanation: "تعذر التعرف على الطعام بشكل موثوق.",
          suggestions,
          analysisType: input.inputType === "ocr" ? "label" : input.inputType === "camera" ? "image" : "text",
          notFound: true,
        };

        const endTime = performance.now();
        recordStage("ai_fallback_low_confidence_termination", performance.now() - startTime, { query: queryText, aiConfidence: aiKnowledge.confidence });

        return {
          report: notFoundReport,
          executionTrace: {
            totalDurationMs: Math.round(endTime - startTime),
            orchestrationOverheadMs: 1,
            stagesExecuted: ["input_gateway", "canonical_search_gateway", "ai_knowledge_extractor", "ai_fallback_low_confidence_termination"],
            traces: [
              { stage: "input_gateway", timestamp: Date.now(), durationMs: 1 },
              { stage: "canonical_search_gateway", timestamp: Date.now(), durationMs: 5 },
              { stage: "ai_knowledge_extractor", timestamp: Date.now(), durationMs: Math.round(endTime - startTime) }
            ],
          },
        };
      }

      // AI Confidence ≥ 70%: Pass extracted Arabic ingredients into CanonicalSearchEngine -> DecisionEngine -> ExplanationEngine
      const extractedArabicIngredientNames = aiKnowledge.ingredients.map(ing => ing.name);
      const dishResult = await analyzeDishCompatibility(aiKnowledge.canonicalNameAr || queryText, extractedArabicIngredientNames);

      const toLegacyItem = (item: IngredientAnalysisItem): IngredientResult => ({
        name: item.canonicalFoodEn,
        nameAr: item.canonicalFoodAr,
        nameEn: item.canonicalFoodEn,
        status: item.status,
        reason: item.reason,
        notes: item.notes,
        confidence: item.confidence,
        confidenceScore: item.confidenceScore,
        resolvedBy: item.resolvedBy,
        provenance: item.provenance,
      } as any);

      // Capture every unresolved unknown ingredient into pending_knowledge_reviews queue for admin review
      for (const u of dishResult.unknownIngredients) {
        captureUnknownIngredient({
          ingredientName: u.rawName,
          sourceQuery: queryText,
          sourceDish: aiKnowledge.canonicalNameAr || queryText,
          sourceType: (input.inputType || "text") as any,
          aiConfidence: aiKnowledge.confidence,
        }).catch((err) => console.error("[REVIEW_QUEUE] Capture error:", err));
      }

      const legacyAllowed = dishResult.allowedIngredients.map(toLegacyItem);
      const legacyForbidden = dishResult.forbiddenIngredients.map(toLegacyItem);
      const legacyConditional = dishResult.conditionalIngredients.map(toLegacyItem);
      const legacyUnknown = dishResult.unknownIngredients.map((u) => ({
        name: u.rawName,
        nameAr: u.rawName,
        nameEn: u.rawName,
        status: "unknown",
        reason: u.whyUnknown,
        notes: u.notes,
        confidence: u.confidence,
        confidenceScore: u.confidenceScore,
        resolvedBy: u.resolvedBy,
        provenance: u.provenance,
      } as any));

      const { compatibilityScore: score, ingredientConfidence, scoreAvailable } = DecisionEngine.computeScores(
        legacyAllowed.length, legacyForbidden.length, legacyConditional.length, legacyUnknown.length
      );

      const aiFallbackReport: AnalysisReport = {
        query: queryText,
        resultMode: "COMPOSITE_FOOD",
        primaryRuling: {
          status: dishResult.finalCompatibility,
          nameAr: aiKnowledge.canonicalNameAr || queryText,
          nameEn: aiKnowledge.canonicalNameEn || queryText,
          dbReason: dishResult.explanation.summaryAr,
          dbNotes: null,
          isInherited: false,
        },
        allowed: legacyAllowed,
        forbidden: legacyForbidden,
        conditional: legacyConditional,
        unknown: legacyUnknown,
        compatibilityScore: score,
        ingredientConfidence,
        scoreAvailable,
        explanation: dishResult.explanation.detailedReasonAr,
        suggestions: [],
        analysisType: input.inputType === "ocr" ? "label" : input.inputType === "camera" ? "image" : "text",
        notFound: false,
      };

      const endTime = performance.now();
      recordStage("ai_knowledge_extractor", performance.now() - startTime, {
        extractedCount: aiKnowledge.ingredients.length,
        resolvedCount: dishResult.recognitionStats.totalResolved,
        unknownCount: dishResult.recognitionStats.totalUnknown,
      });

      if (process.env.SEARCH_DEBUG === "true") {
        console.log(`[SEARCH_DEBUG_DIAGNOSTICS] SearchPath: ${aiKnowledge.debugMetadata?.cacheHit ? "Persistent Cache -> Resolution" : "OpenAI Extractor -> Resolution"} | SearchTime: ${canonicalSearchRes?.diagnostics?.executionTimeMs || 0}ms | CacheHit: ${Boolean(aiKnowledge.debugMetadata?.cacheHit)} | OpenAIUsed: ${!aiKnowledge.debugMetadata?.cacheHit} | UnknownIngredients: ${dishResult.unknownIngredients.length} | DecisionTime: ${Math.round(endTime - startTime)}ms | TotalPipelineTime: ${Math.round(endTime - startTime)}ms`);
      }

      return {
        report: aiFallbackReport,
        dishAnalysisResult: dishResult,
        executionTrace: {
          totalDurationMs: Math.round(endTime - startTime),
          orchestrationOverheadMs: 5,
          stagesExecuted: ["input_gateway", "canonical_search_gateway", "ai_knowledge_extractor", "ingredient_resolution", "decision_engine", "explanation_engine"],
          traces,
        },
      };
    }

    // Stage 3: Intent Detection & Entity Classification
    const stageClassifyStart = performance.now();
    const classification = await IntentClassificationEngine.classify(input);
    const classificationDuration = performance.now() - stageClassifyStart;

    recordStage("intent_detection", classificationDuration * 0.5, { intent: classification.intent, confidence: classification.confidence });
    recordStage("entity_classification", classificationDuration * 0.5, { entityType: classification.entityType, pipeline: classification.pipeline, classificationReason: classification.classificationReason });

    const isSingleFoodHit = canonicalSearchRes && canonicalSearchRes.confidence > 0 && canonicalSearchRes.entity_type === "food" && (!input.rawIngredientNames || input.rawIngredientNames.length === 0);

    const isComposite = !isSingleFoodHit && (
      classification.pipeline === "DISH_ENGINE" ||
      classification.pipeline === "COMPOSITE_ENGINE" ||
      classification.pipeline === "PRODUCT_ENGINE" ||
      classification.pipeline === "VISION_ENGINE" ||
      (input.rawIngredientNames && input.rawIngredientNames.length > 0)
    );

    // Branching Orchestration Execution based on EntityType & Modality
    let dishResult: DishAnalysisResult | undefined;
    let report: AnalysisReport;

    if (isComposite) {
      // Stage 4: Ingredient Extraction
      const stage4Start = performance.now();
      const extractedIngredients = input.rawIngredientNames || [];
      recordStage("ingredient_extraction", performance.now() - stage4Start, { extractedCount: extractedIngredients.length });

      // Stage 5 - 9: Execute Dish Compatibility Engine Pipeline
      const dishEngineStart = performance.now();
      dishResult = await analyzeDishCompatibility(queryText || "وجبة مكس", extractedIngredients);
      const dishEngineDuration = performance.now() - dishEngineStart;

      recordStage("ingredient_resolution", dishEngineDuration * 0.25, { resolvedCount: dishResult.recognitionStats.totalResolved });
      recordStage("knowledge_engine", dishEngineDuration * 0.25, { foodsEvaluated: dishResult.ingredientAnalysis.length });
      recordStage("compatibility_engine", dishEngineDuration * 0.2, { allowed: dishResult.allowedIngredients.length, forbidden: dishResult.forbiddenIngredients.length, conditional: dishResult.conditionalIngredients.length });
      recordStage("decision_engine", dishEngineDuration * 0.15, { finalCompatibility: dishResult.finalCompatibility });
      recordStage("explanation_engine", dishEngineDuration * 0.15, { hasExplanation: !!dishResult.explanation.summaryAr });

      // Construct AnalysisReport
      const toLegacyItem = (item: IngredientAnalysisItem): IngredientResult => ({
        name: item.canonicalFoodEn,
        nameAr: item.canonicalFoodAr,
        nameEn: item.canonicalFoodEn,
        status: item.status,
        reason: item.reason,
        notes: item.notes,
        confidence: item.confidence,
        confidenceScore: item.confidenceScore,
        resolvedBy: item.resolvedBy,
        provenance: item.provenance,
      } as any);

      const legacyAllowed = dishResult.allowedIngredients.map(toLegacyItem);
      const legacyForbidden = dishResult.forbiddenIngredients.map(toLegacyItem);
      const legacyConditional = dishResult.conditionalIngredients.map(toLegacyItem);
      const legacyUnknown = dishResult.unknownIngredients.map((u) => ({
        name: u.rawName,
        nameAr: u.rawName,
        nameEn: u.rawName,
        status: "unknown",
        reason: u.whyUnknown,
        notes: u.notes,
        confidence: u.confidence,
        confidenceScore: u.confidenceScore,
        resolvedBy: u.resolvedBy,
        provenance: u.provenance,
      } as any));

      const isForbidden = legacyForbidden.length > 0;
      const isConditional = legacyConditional.length > 0;
      const isEmptyAnalysis = legacyAllowed.length === 0 && legacyForbidden.length === 0 && legacyConditional.length === 0 && legacyUnknown.length === 0;

      // SSoT: scoring delegated exclusively to DecisionEngine
      const { compatibilityScore: score, ingredientConfidence, scoreAvailable } = DecisionEngine.computeScores(
        legacyAllowed.length, legacyForbidden.length, legacyConditional.length, legacyUnknown.length
      );

      if (isEmptyAnalysis) {
        // MANDATORY SAFEGUARD: An empty analysis (0/0/0/0) can NEVER produce a compatibility ruling ("allowed")
        report = {
          query: queryText,
          resultMode: "NOT_FOUND",
          primaryRuling: undefined,
          allowed: [],
          forbidden: [],
          conditional: [],
          unknown: [],
          compatibilityScore: null,
          scoreAvailable: false,
          explanation: "لم يتم العثور على الطبق أو أي مكونات قابلة للتحليل في قاعدة بيانات طيباتي.",
          suggestions: (canonicalSearchRes as any)?.didYouMean || [],
          analysisType: input.inputType === "ocr" ? "label" : input.inputType === "camera" ? "image" : "text",
          notFound: true,
        };
      } else {
        report = {
          query: queryText,
          resultMode: "COMPOSITE_FOOD",
          primaryRuling: dishResult.dish
            ? {
                status: dishResult.finalCompatibility,
                nameAr: dishResult.dish.nameAr,
                nameEn: dishResult.dish.nameEn || dishResult.dish.nameAr,
                dbReason: dishResult.explanation.summaryAr,
                dbNotes: null,
                isInherited: false,
              }
            : undefined,
          allowed: legacyAllowed,
          forbidden: legacyForbidden,
          conditional: legacyConditional,
          unknown: legacyUnknown,
          compatibilityScore: score,
          ingredientConfidence,
          scoreAvailable,
          explanation: dishResult.explanation.detailedReasonAr,
          suggestions: [],
          analysisType: input.inputType === "ocr" ? "label" : input.inputType === "camera" ? "image" : "text",
          notFound: false,
        };
      }

    } else {
      // Single Food Flow (Direct Resolution)
      const stageSingleStart = performance.now();
      const knowledgeCache = await getKnowledgeCache();
      const singleResolved = resolveWithInheritance(queryText, knowledgeCache);
      const singleDuration = performance.now() - stageSingleStart;

      recordStage("ingredient_resolution", singleDuration * 0.4);
      recordStage("knowledge_engine", singleDuration * 0.3);
      recordStage("compatibility_engine", singleDuration * 0.1);
      recordStage("decision_engine", singleDuration * 0.1);
      recordStage("explanation_engine", singleDuration * 0.1);

      if (singleResolved && singleResolved.food) {
        const f = singleResolved.food;
        const itemResult: IngredientResult = {
          name: f.nameEn || f.nameAr,
          nameAr: f.nameAr,
          nameEn: f.nameEn || f.nameAr,
          status: f.status,
          reason: f.reason,
          notes: f.notes,
        };

        const allowed = f.status === "allowed" ? [itemResult] : [];
        const forbidden = f.status === "forbidden" ? [itemResult] : [];
        const conditional = f.status === "conditional" ? [itemResult] : [];
        const unknown = f.status === "unknown" ? [itemResult] : [];

        // SSoT: scoring delegated exclusively to DecisionEngine
        const { compatibilityScore: _score, scoreAvailable: _scoreAvailable } = DecisionEngine.computeScores(
          allowed.length, forbidden.length, conditional.length, unknown.length
        );

        report = {
          query: queryText,

          resultMode: (singleResolved.resultMode as any) || "EXACT_FOOD",
          primaryRuling: {
            status: f.status,
            nameAr: f.nameAr,
            nameEn: f.nameEn || f.nameAr,
            dbReason: f.reason,
            dbNotes: f.notes,
            isInherited: singleResolved.inherited || false,
            inheritsFrom: singleResolved.inheritsFrom,
          },
          allowed,
          forbidden,
          conditional,
          unknown,
          compatibilityScore: _score,
          scoreAvailable: _scoreAvailable,
          explanation: f.reason || `حكم المكون ${f.nameAr} هو ${f.status}`,
          suggestions: [],
          analysisType: "text",
          notFound: false,
        };
      } else {
        // Unknown Single Food Fallback
        const legacyUnknownItem: IngredientResult = {
          name: queryText,
          nameAr: queryText,
          nameEn: queryText,
          status: "unknown",
          reason: "غير متوفر حالياً في قاعدة بيانات طيباتي",
          notes: "يتطلب مراجعة أو تحليل مخصص",
        };

        report = {
          query: queryText,
          resultMode: "UNKNOWN_FOOD",
          allowed: [],
          forbidden: [],
          conditional: [],
          unknown: [legacyUnknownItem],
          compatibilityScore: null,
          scoreAvailable: false,
          explanation: "لم يتم العثور على المكون في قاعدة بيانات طيباتي.",
          suggestions: [],
          analysisType: "text",
          notFound: true,
        };
      }
    }

    const totalDurationMs = Math.round((performance.now() - startTime) * 100) / 100;
    const engineWorkMs = traces.reduce((acc, t) => acc + t.durationMs, 0);
    const orchestrationOverheadMs = Math.max(0, totalDurationMs - engineWorkMs);

    recordStage("final_response", 0.05);

    // PRINT ONE FORMATTED STRUCTURED DEBUG LOG BLOCK FOR DEVELOPMENT
    printStructuredSearchDebugLog({
      diagnostics,
      recipeDetails: dishResult ? {
        recipeFound: !!dishResult.dish,
        ingredientCount: dishResult.ingredientAnalysis.length,
        resolvedIngredients: dishResult.ingredientAnalysis.map((i) => i.canonicalFoodAr),
        ingredientCompatibilitySummary: `Allowed: ${dishResult.allowedIngredients.length}, Forbidden: ${dishResult.forbiddenIngredients.length}, Conditional: ${dishResult.conditionalIngredients.length}`,
      } : undefined,
      decisionEngine: {
        allowedCount: report.allowed?.length || 0,
        forbiddenCount: report.forbidden?.length || 0,
        conditionalCount: report.conditional?.length || 0,
        unknownCount: report.unknown?.length || 0,
        compatibilityScore: report.compatibilityScore,
        finalDecision: report.primaryRuling?.status || (report.forbidden?.length > 0 ? "forbidden" : report.conditional?.length > 0 ? "conditional" : "allowed"),
      },
      totalExecutionTimeMs: totalDurationMs,
    });

    return {
      report,
      dishAnalysisResult: dishResult,
      executionTrace: {
        totalDurationMs,
        orchestrationOverheadMs: Math.round(orchestrationOverheadMs * 100) / 100,
        stagesExecuted,
        traces,
      },
    };
  }
}

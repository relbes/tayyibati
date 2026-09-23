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
import { warmDishEngineCache, getDishEngineCache, detectMainProtein, analyzeDishCompatibility, resolveSingleIngredient, DishAnalysisResult, IngredientAnalysisItem, norm, stripAlefLam, detectDishProteinInfo, getProteinFields, isPureProteinQuery, resolveProteinIngredient, getClarificationData } from "./dishCompatibilityEngine";
import { resolveWithInheritance, getKnowledgeCache, UserIntent, aggregateFoodFamilySafety } from "./knowledgeCache";
import { CanonicalSearchEngine, printStructuredSearchDebugLog } from "./canonicalSearchEngine";
import { getAIProvider } from "./ai/aiProvider";
import { captureUnknownIngredient } from "./ai/knowledgeReviewService";
import type { AnalysisReport, IngredientResult } from "../routes/analysis";
import { extractBaseEntity, isMeaningfulQuery, formatAmbiguityQuestion } from "./arabicNormalization";
import { FoodResolutionEngine } from "./foodResolutionEngine";
import { SmartFallbackEngine } from "./smartFallbackEngine";

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
  inputType?: AnalysisInputType;
  query?: string;
  displayQuery?: string;
  userId?: string;
  context?: AnalysisContext;
  language?: string;
  dishId?: number;
  foodId?: number | string;
  entityType?: "food" | "dish" | "product";
  canonicalId?: number | string;
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
      language: input.language === "en" ? "en" : "ar",
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

    // Fast Path: Direct Food ID Analysis (No Search Engine, No Ambiguity)
    let targetFoodId: number | null = input.foodId ? Number(input.foodId) : (input.entityType === "food" && input.canonicalId ? Number(input.canonicalId) : null);
    if (!targetFoodId && input.dishId && typeof input.dishId === "number") {
      const dishCache = getDishEngineCache();
      if (!dishCache.dishesById.has(input.dishId)) {
        const foodCache = await getKnowledgeCache();
        if (foodCache.foodById.has(input.dishId)) {
          targetFoodId = input.dishId;
        }
      }
    }

    if (targetFoodId && !isNaN(targetFoodId)) {
      const foodEngineStart = performance.now();
      const foodCache = await getKnowledgeCache();
      const targetFood = foodCache.foodById.get(targetFoodId);

      if (targetFood) {
        const proteinInfo = getProteinFields(targetFood.nameAr);
        const itemResult: IngredientResult = {
          name: targetFood.nameEn || targetFood.nameAr,
          nameAr: targetFood.nameAr,
          nameEn: targetFood.nameEn || targetFood.nameAr,
          status: (targetFood.status as any) || "allowed",
          frequency: null,
          reason: targetFood.reason,
          notes: targetFood.notes,
          proteinCategory: proteinInfo.proteinCategory,
          proteinSpecificity: proteinInfo.proteinSpecificity,
          priority: targetFood.priority !== "none" ? targetFood.priority : undefined,
        };

        const allowed = targetFood.status === "allowed" ? [itemResult] : [];
        const forbidden = targetFood.status === "forbidden" ? [itemResult] : [];
        const conditional = targetFood.status === "conditional" ? [itemResult] : [];
        const unknown: IngredientResult[] = [];

        const { compatibilityScore: score, ingredientConfidence, scoreAvailable } = DecisionEngine.computeScores(
          allowed.length, forbidden.length, conditional.length, unknown.length
        );

        let explanation = targetFood.reason || "";
        if (!explanation) {
          explanation = targetFood.status === "allowed"
            ? "مسموح حسب قواعد البرنامج"
            : targetFood.status === "forbidden"
            ? "محظور حسب قواعد البرنامج"
            : "مشروط حسب قواعد البرنامج";
        }

        const directFoodReport: AnalysisReport = {
          query: targetFood.nameAr,
          displayQuery: input.displayQuery || targetFood.nameAr,
          dish: targetFood.nameAr,
          proteinCategory: proteinInfo.proteinCategory,
          proteinSpecificity: proteinInfo.proteinSpecificity,
          resultMode: "EXACT_FOOD",
          primaryRuling: {
            status: targetFood.status as any,
            nameAr: targetFood.nameAr,
            nameEn: targetFood.nameEn || targetFood.nameAr,
            dbReason: targetFood.reason,
            dbNotes: targetFood.notes,
            isInherited: false,
          },
          allowed,
          forbidden,
          conditional,
          unknown,
          compatibilityScore: score,
          ingredientConfidence,
          scoreAvailable,
          explanation,
          suggestions: [],
          analysisType: input.inputType === "ocr" ? "label" : input.inputType === "camera" ? "image" : "text",
          notFound: false,
        };

        const endTime = performance.now();
        recordStage("direct_food_lookup", endTime - foodEngineStart, { foodId: targetFoodId, nameAr: targetFood.nameAr });

        const finalizedDirectReport = finalizeReport(directFoodReport, {
          canonicalId: targetFood.id,
          canonical_id: targetFood.id,
          canonicalName: targetFood.nameAr,
          canonical_name: targetFood.nameAr,
          canonicalEntityType: "food",
          entity_type: "food",
          searchConfidence: 100,
          confidence: 100,
          matchType: "EXACT",
          searchOutcome: "FOUND",
        } as any, null);

        return {
          report: finalizedDirectReport,
          executionTrace: {
            totalDurationMs: Math.round(endTime - startTime),
            orchestrationOverheadMs: 2,
            stagesExecuted,
            traces,
          },
        };
      }
    }

    // Fast Path: Direct Dish ID Analysis (No Search Engine, No Ambiguity)
    if (input.dishId && typeof input.dishId === "number") {
      const dishEngineStart = performance.now();
      const dishResult = await analyzeDishCompatibility(input.dishId, input.rawIngredientNames || [], queryText);
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
        proteinCategory: item.proteinCategory,
        proteinSpecificity: item.proteinSpecificity,
        priority: item.priority,
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
        dish: dishResult.dish?.nameAr || queryText || undefined,
        proteinCategory: dishResult.proteinCategory,
        proteinSpecificity: dishResult.proteinSpecificity,
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
        notFound: isUnknownOnly,
      };

      const finalizedDirectReport = finalizeReport(directReport, null, dishResult);

      const endTime = performance.now();
      return {
        report: finalizedDirectReport,
        dishAnalysisResult: dishResult,
        executionTrace: {
          totalDurationMs: Math.round(endTime - startTime),
          orchestrationOverheadMs: 5,
          stagesExecuted,
          traces,
        },
      };
    }

    if (isPureProteinQuery(queryText)) {
      const proteinInfo = resolveProteinIngredient(queryText);
      if (proteinInfo) {
        if (proteinInfo.proteinSpecificity === "UNSPECIFIED") {
          const clar = getClarificationData(queryText, proteinInfo.proteinCategory);
          if (clar) {
            const report: AnalysisReport = {
              query: queryText,
              resultMode: "NOT_FOUND",
              needsClarification: true,
              clarificationType: clar.clarificationType,
              questionAr: clar.questionAr,
              suggestions: (clar.suggestions || []).map((s: any) => typeof s === "string" ? s : s.label || s.query || ""),
              allowed: [],
              forbidden: [],
              conditional: [],
              unknown: [],
              compatibilityScore: null,
              scoreAvailable: false,
              explanation: clar.questionAr,
              suggestions_legacy: [],
              analysisType: input.inputType === "ocr" ? "label" : input.inputType === "camera" ? "image" : "text",
              notFound: true,
            };

            const endTime = performance.now();
            recordStage("protein_resolution", performance.now() - startTime);

            const reportWithCanonical = finalizeReport(report, null, null);

            return {
              report: reportWithCanonical,
              executionTrace: {
                totalDurationMs: Math.round(endTime - startTime),
                orchestrationOverheadMs: 1,
                stagesExecuted: ["input_gateway", "protein_resolution"],
                traces: [
                  { stage: "input_gateway", timestamp: Date.now(), durationMs: 1 },
                  { stage: "protein_resolution", timestamp: Date.now(), durationMs: Math.round(endTime - startTime) }
                ],
              },
            };
          }
        }

        const itemResult: IngredientResult = {
          name: proteinInfo.canonicalFoodEn,
          nameAr: proteinInfo.canonicalFoodAr,
          nameEn: proteinInfo.canonicalFoodEn,
          status: proteinInfo.status,
          reason: proteinInfo.reason,
          notes: null,
          proteinCategory: proteinInfo.proteinCategory,
          proteinSpecificity: proteinInfo.proteinSpecificity,
          priority: proteinInfo.priority !== "none" ? proteinInfo.priority : undefined,
        };

        const allowed = proteinInfo.status === "allowed" ? [itemResult] : [];
        const forbidden = proteinInfo.status === "forbidden" ? [itemResult] : [];
        const conditional = proteinInfo.status === "conditional" ? [itemResult] : [];
        const unknown: any[] = [];

        const report: AnalysisReport = {
          query: queryText,
          dish: proteinInfo.canonicalFoodAr,
          proteinCategory: proteinInfo.proteinCategory,
          proteinSpecificity: proteinInfo.proteinSpecificity,
          resultMode: "EXACT_FOOD",
          primaryRuling: {
            status: proteinInfo.status,
            nameAr: proteinInfo.canonicalFoodAr,
            nameEn: proteinInfo.canonicalFoodEn,
            dbReason: proteinInfo.reason,
            dbNotes: null,
            isInherited: false,
          },
          allowed,
          forbidden,
          conditional,
          unknown,
          compatibilityScore: proteinInfo.status === "allowed" ? 100 : (proteinInfo.status === "forbidden" ? 0 : 50),
          ingredientConfidence: 95,
          scoreAvailable: true,
          explanation: proteinInfo.reason,
          suggestions: [],
          analysisType: input.inputType === "ocr" ? "label" : input.inputType === "camera" ? "image" : "text",
          notFound: false,
        };

        const endTime = performance.now();
        recordStage("protein_resolution", performance.now() - startTime);

        const reportWithCanonical = finalizeReport(report, null, null);

        return {
          report: reportWithCanonical,
          executionTrace: {
            totalDurationMs: Math.round(endTime - startTime),
            orchestrationOverheadMs: 1,
            stagesExecuted: ["input_gateway", "protein_resolution"],
            traces: [
              { stage: "input_gateway", timestamp: Date.now(), durationMs: 1 },
              { stage: "protein_resolution", timestamp: Date.now(), durationMs: Math.round(endTime - startTime) }
            ],
          },
        };
      }
    }

    // Stage 1.5: Generic Query Validation Gate
    const queryValidation = isMeaningfulQuery(queryText);
    if (!queryValidation.isValid) {
      const notFoundReport: AnalysisReport = {
        query: queryText,
        displayQuery: input.displayQuery || queryText,
        resultMode: "NOT_FOUND" as any,
        primaryRuling: undefined,
        allowed: [],
        forbidden: [],
        conditional: [],
        unknown: [],
        compatibilityScore: null,
        scoreAvailable: false,
        explanation: "لم نفهم ما تبحث عنه. يرجى كتابة اسم طعام أو طبق للحصول على النتيجة.",
        suggestions: [],
        analysisType: (input.inputType === "ocr" ? "label" : input.inputType === "camera" ? "image" : "text") as any,
        notFound: true,
      };

      const endTime = performance.now();
      recordStage("invalid_query_gate", performance.now() - startTime, { query: queryText, reason: queryValidation.reason });

      return {
        report: notFoundReport,
        executionTrace: {
          totalDurationMs: Math.round(endTime - startTime),
          orchestrationOverheadMs: 1,
          stagesExecuted: ["input_gateway", "invalid_query_gate"],
          traces: [{ stage: "invalid_query_gate", timestamp: Date.now(), durationMs: Math.round(endTime - startTime) }],
        },
      };
    }

    // Stage 2: Canonical Search Engine Execution (Dual-Channel Structured Entity Search)
    const structuredSearch = await CanonicalSearchEngine.searchEntities(queryText, { debug: true });
    let canonicalSearchRes = structuredSearch.primaryResult || await CanonicalSearchEngine.search(queryText, { debug: true });

    // If explicit food entity selection or queryIntent is FOOD, force food primary result
    // MANDATE: NEVER overwrite AMBIGUOUS search outcome!
    if (
      (input.entityType === "food" || structuredSearch.queryIntent === "FOOD") &&
      canonicalSearchRes?.searchOutcome !== "AMBIGUOUS" &&
      structuredSearch.primaryResult?.searchOutcome !== "AMBIGUOUS"
    ) {
      if (structuredSearch.displayFoods && structuredSearch.displayFoods.length > 0) {
        canonicalSearchRes = structuredSearch.displayFoods[0];
      }
    }

    // General entity-resolution priority guard:
    // If request is not explicitly selecting a dish, and FoodResolutionEngine finds an exact food
    // with CONFIDENT state, the exact Food resolution takes priority over a competing Dish alias.
    // MANDATE: NEVER overwrite AMBIGUOUS search outcome!
    if (
      input.entityType !== "dish" &&
      !input.dishId &&
      canonicalSearchRes?.searchOutcome !== "AMBIGUOUS" &&
      structuredSearch.primaryResult?.searchOutcome !== "AMBIGUOUS"
    ) {
      const isDishResult = Boolean(
        canonicalSearchRes &&
        ((canonicalSearchRes as any).canonicalEntityType === "dish" || (canonicalSearchRes as any).entity_type === "dish")
      );
      const isDishAlias = Boolean(
        isDishResult && (
          (canonicalSearchRes as any)?.searchMethod === "exact_alias" ||
          (canonicalSearchRes as any)?.search_method === "exact_alias" ||
          canonicalSearchRes?.matchType === "ALIAS" ||
          Boolean((canonicalSearchRes as any)?.matchedAlias) ||
          canonicalSearchRes?.matchedReason?.includes("Dish Alias")
        )
      );

      // Evaluate FoodResolutionEngine if there is a competing Dish alias, or no confident dish match
      if (isDishAlias || !canonicalSearchRes || canonicalSearchRes.searchOutcome === "NOT_FOUND") {
        const foodResolution = await FoodResolutionEngine.resolve(
          queryText,
          (input.inputType || "text") as any,
          0
        );

        const candidate = foodResolution.selectedCandidate;

        if (
          foodResolution.state === "CONFIDENT" &&
          candidate?.type === "food" &&
          candidate?.foodType === "exact_food"
        ) {
          canonicalSearchRes = {
            ...(canonicalSearchRes || {}),
            id: candidate.id,
            canonicalId: candidate.id,
            canonical_id: candidate.id,
            canonicalName: candidate.nameAr,
            canonical_name: candidate.nameAr,
            canonicalEntityType: "food",
            entity_type: "food",
            searchConfidence: 100,
            confidence: 100,
            matchType: "EXACT",
            searchOutcome: "FOUND",
            search_method: "food_resolution_exact",
          } as any;
          if (structuredSearch.primaryResult) {
            structuredSearch.primaryResult = canonicalSearchRes;
          }
        }
      }
    }


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
      selectedEntity: (canonicalSearchRes?.canonicalEntityType || canonicalSearchRes?.entity_type || "food") as any,
      canonicalId: canonicalSearchRes?.canonicalId || canonicalSearchRes?.canonical_id || 0,
      canonicalName: canonicalSearchRes?.canonicalName || canonicalSearchRes?.canonical_name || queryText,
      confidence: canonicalSearchRes?.searchConfidence || canonicalSearchRes?.confidence || 0,
      searchMethod: canonicalSearchRes?.search_method || "exact_canonical",
      expandedVariants: [],
      searchedIndexes: [],
      engineVersion: "1.0",
      executionTimeMs: 0,
    };

    // Stage 2.5: Search Outcome Single Source of Truth Routing
    const searchOutcome = (canonicalSearchRes as any)?.searchOutcome || (canonicalSearchRes ? "FOUND" : "NOT_FOUND");

    // ROUTING RULE 1: AMBIGUOUS -> Return Candidate Items Immediately without calling AI or DecisionEngine
    if (searchOutcome === "AMBIGUOUS") {
      const candList = ((canonicalSearchRes as any)?.candidateDishes || (canonicalSearchRes as any)?.candidateFoods || structuredSearch.displayFoods || structuredSearch.foods || []) as any[];
      const dishCache = getDishEngineCache();
      const foodCache = await getKnowledgeCache();

      const rawMatches = candList.map((cand) => {
        const entId = cand.canonicalId || cand.canonical_id || cand.id;
        const entType = cand.canonicalEntityType || cand.entity_type || (cand.foodType ? "food" : "dish");

        if (entType === "food") {
          const foodObj = foodCache.foodById.get(Number(entId));
          const nameAr = cand.canonicalName || cand.canonical_name || cand.nameAr || foodObj?.nameAr || queryText;
          const nameEn = cand.nameEn || foodObj?.nameEn || nameAr;
          const statusText = foodObj?.status === "allowed" ? "مسموح" : foodObj?.status === "forbidden" ? "ممنوع" : "غير محدد";
          return {
            id: entId,
            canonicalId: entId,
            entityType: "food",
            canonicalEntityType: "food",
            nameAr,
            nameEn,
            category: "طعام",
            description: `طعام (${statusText})`,
            mainProtein: null,
            ingredientCount: 1,
            searchConfidence: cand.searchConfidence || cand.confidence || 90,
          };
        }

        const dishObj = dishCache.dishesById.get(entId);
        const nameAr = cand.canonicalName || cand.canonical_name || dishObj?.nameAr || queryText;
        const nameEn = dishObj?.nameEn || nameAr;
        const category = dishObj?.category || "طبق رئيسي";
        const description = (dishObj as any)?.description || `طبق تقليدي يعتمد على المكونات الطبيعية.`;
        
        const recipeIngredients = dishCache.ingredientsByDishId.get(entId) || [];
        const rawIngs = recipeIngredients.map((r) => r.rawIngredientName);
        const mainProtein = detectMainProtein(nameAr, rawIngs);
        const ingredientCount = recipeIngredients.length;
        const searchConfidence = cand.searchConfidence || cand.confidence || 90;

        return {
          id: entId,
          canonicalId: entId,
          entityType: "dish",
          canonicalEntityType: "dish",
          nameAr,
          nameEn,
          category,
          description,
          mainProtein,
          ingredientCount,
          searchConfidence,
        };
      });

      // Deduplicate matches by ID
      const uniqueMatchesMap = new Map<number | string, typeof rawMatches[0]>();
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

      const candNames = pureMatches.map((m) => m.nameAr);
      const qAr = (canonicalSearchRes as any)?.questionAr || formatAmbiguityQuestion(queryText);

      const multiReport: AnalysisReport = {
        query: queryText,
        questionAr: qAr,
        resultMode: "MULTIPLE_DISHES" as any,
        allowed: [],
        forbidden: [],
        conditional: [],
        unknown: [],
        compatibilityScore: null,
        scoreAvailable: false,
        explanation: qAr,
        suggestions: candNames,
        analysisType: input.inputType === "ocr" ? "label" : input.inputType === "camera" ? "image" : "text",
        notFound: false,
      };

      (multiReport as any).questionAr = qAr;
      (multiReport as any).requiresSelection = true;
      (multiReport as any).matches = pureMatches;
      (multiReport as any).isAmbiguous = true;
      (multiReport as any).candidateDishes = pureMatches;
      (multiReport as any).candidateFoods = pureMatches;
      (multiReport as any).refinementSuggestions = candNames;
      (multiReport as any).relevantVariants = candNames;

      const finalizedMultiReport = finalizeReport(multiReport, canonicalSearchRes, null);

      const endTime = performance.now();
      return {
        report: finalizedMultiReport,
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
        const finalizedReport = finalizeReport(notFoundReport, canonicalSearchRes, null);
        const endTime = performance.now();
        recordStage("barcode_unmapped_termination", performance.now() - startTime, { barcode: input.barcode });
        return {
          report: finalizedReport,
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

      // Smart Fallback Suggestions — runs in-memory only (~2–5ms).
      // Evaluates candidate suggestions from the existing Tayyibati dataset.
      const fallbackResult = await SmartFallbackEngine.suggest(queryText);
      recordStage("smart_fallback_engine", 0, {
        hasSuggestions: fallbackResult.hasSuggestions,
        count: fallbackResult.suggestions.length,
      });

      // ARCHITECTURAL TRIGGER RULE: If strong suggestions exist in our database,
      // return them directly on the NOT_FOUND report without relying on AI confidence or making unnecessary AI calls.
      if (fallbackResult.hasSuggestions && fallbackResult.suggestions.length > 0) {
        let notFoundReport: AnalysisReport = {
          query: queryText,
          resultMode: "NOT_FOUND" as any,
          primaryRuling: undefined,
          allowed: [],
          forbidden: [],
          conditional: [],
          unknown: [],
          compatibilityScore: null,
          scoreAvailable: false,
          explanation: "لم نجد هذا الطعام بالاسم نفسه، لكن ربما تقصد أحد البدائل المقترحة.",
          suggestions: [],
          analysisType: (input.inputType === "ocr" ? "label" : input.inputType === "camera" ? "image" : "text") as any,
          notFound: true,
          fallbackSuggestions: fallbackResult.suggestions.map((s) => ({
            canonicalId: s.canonicalId,
            canonicalEntityType: s.canonicalEntityType,
            nameAr: s.nameAr,
            nameEn: s.nameEn,
          })),
        };

        const finalizedReport = finalizeReport(notFoundReport, canonicalSearchRes, null);
        const endTime = performance.now();
        recordStage("smart_fallback_direct_termination", performance.now() - startTime, {
          query: queryText,
          suggestionsCount: fallbackResult.suggestions.length,
        });

        return {
          report: finalizedReport,
          executionTrace: {
            totalDurationMs: Math.round(endTime - startTime),
            orchestrationOverheadMs: 1,
            stagesExecuted: ["input_gateway", "canonical_search_gateway", "smart_fallback_engine", "smart_fallback_direct_termination"],
            traces: [
              { stage: "input_gateway", timestamp: Date.now(), durationMs: 1 },
              { stage: "canonical_search_gateway", timestamp: Date.now(), durationMs: 5 },
              { stage: "smart_fallback_engine", timestamp: Date.now(), durationMs: Math.round(endTime - startTime) }
            ],
          },
        };
      }

      // 2. TEXT / CAMERA / OCR MODALITY POLICY: Trigger AI Knowledge Extractor only when no DB suggestions exist
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
        let notFoundReport: AnalysisReport = {
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

        notFoundReport = await checkAndApplyClarification(
          notFoundReport,
          queryText,
          (input.inputType || "text") as any,
          aiKnowledge.confidence,
          undefined
        );

        const finalizedReport = finalizeReport(notFoundReport, canonicalSearchRes, null);
        const endTime = performance.now();
        recordStage("ai_fallback_low_confidence_termination", performance.now() - startTime, { query: queryText, aiConfidence: aiKnowledge.confidence });

        return {
          report: finalizedReport,
          executionTrace: {
            totalDurationMs: Math.round(endTime - startTime),
            orchestrationOverheadMs: 1,
            stagesExecuted: ["input_gateway", "canonical_search_gateway", "smart_fallback_engine", "ai_knowledge_extractor", "ai_fallback_low_confidence_termination"],
            traces: [
              { stage: "input_gateway", timestamp: Date.now(), durationMs: 1 },
              { stage: "canonical_search_gateway", timestamp: Date.now(), durationMs: 5 },
              { stage: "ai_knowledge_extractor", timestamp: Date.now(), durationMs: Math.round(endTime - startTime) }
            ],
          },
        };
      }

      // AI Confidence ≥ 70%: Pass extracted Arabic ingredients into CanonicalSearchEngine -> DecisionEngine -> ExplanationEngine
      let extractedArabicIngredientNames = aiKnowledge.ingredients.map(ing => ing.name);

      const dishResult = await analyzeDishCompatibility(aiKnowledge.canonicalNameAr || queryText, extractedArabicIngredientNames, queryText);

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
        proteinCategory: item.proteinCategory,
        proteinSpecificity: item.proteinSpecificity,
        priority: item.priority,
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

      const aiProviderName = (aiKnowledge.debugMetadata?.provider as any) || "openai";
      const hasUncertainIngs = legacyUnknown.length > 0 || (aiKnowledge.missingIngredients && aiKnowledge.missingIngredients.length > 0);
      const aiDisclaimer = `لم نجد هذا الطعام في قاعدة بيانات طيباتي، لذلك تم تحليل مكوناته بالذكاء الاصطناعي.${hasUncertainIngs ? " قد تختلف بعض المكونات حسب طريقة التحضير." : ""}`;
      const detailedExplanation = dishResult.explanation?.detailedReasonAr
        ? `${aiDisclaimer}\n\n${dishResult.explanation.detailedReasonAr}`
        : aiDisclaimer;

      const aiFallbackReport: AnalysisReport = {
        query: queryText,
        dish: extractBaseEntity(aiKnowledge.canonicalNameAr || queryText) || undefined,
        proteinCategory: dishResult.proteinCategory,
        proteinSpecificity: dishResult.proteinSpecificity,
        resultMode: "COMPOSITE_FOOD",
        analysisSource: "ai_fallback",
        aiProvider: aiProviderName,
        aiFallback: true,
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
        explanation: detailedExplanation,
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

      const finalizedReport = await checkAndApplyClarification(
        aiFallbackReport,
        queryText,
        (input.inputType || "text") as any,
        aiKnowledge.confidence,
        dishResult
      );

      const reportWithCanonical = finalizeReport(finalizedReport, canonicalSearchRes, dishResult);

      return {
        report: reportWithCanonical,
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

    const isExplicitFoodSelection = input.entityType === "food" || Boolean(input.foodId);
    const isSingleFoodHit = isExplicitFoodSelection || (
      structuredSearch.queryIntent === "FOOD" ||
      (canonicalSearchRes && (canonicalSearchRes.searchConfidence || canonicalSearchRes.confidence || 0) > 0 && ((canonicalSearchRes as any).canonicalEntityType === "food" || canonicalSearchRes.entity_type === "food") && (!input.rawIngredientNames || input.rawIngredientNames.length === 0))
    );

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
      const targetDishIdentifier = input.dishId
        ? Number(input.dishId)
        : (canonicalSearchRes && (canonicalSearchRes.canonicalEntityType === "dish" || (canonicalSearchRes as any).entity_type === "dish") && (canonicalSearchRes.canonicalId || (canonicalSearchRes as any).canonical_id))
        ? Number(canonicalSearchRes.canonicalId || (canonicalSearchRes as any).canonical_id)
        : (queryText || "وجبة مكس");
      dishResult = await analyzeDishCompatibility(targetDishIdentifier, extractedIngredients, queryText);
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
        proteinCategory: item.proteinCategory,
        proteinSpecificity: item.proteinSpecificity,
        priority: item.priority,
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
          dish: dishResult.dish?.nameAr || queryText || undefined,
          proteinCategory: dishResult.proteinCategory,
          proteinSpecificity: dishResult.proteinSpecificity,
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
      let targetFoodName = queryText;
      const explicitId = input.canonicalId || input.foodId || ((canonicalSearchRes?.canonicalEntityType === "food" || (canonicalSearchRes as any)?.entity_type === "food") ? (canonicalSearchRes?.canonicalId || (canonicalSearchRes as any)?.canonical_id) : undefined);
      if (explicitId) {
        const foundFood = knowledgeCache.foodById.get(Number(explicitId));
        if (foundFood) targetFoodName = foundFood.nameAr;
      }
      const singleResolved = resolveWithInheritance(targetFoodName, knowledgeCache);
      const singleDuration = performance.now() - stageSingleStart;

      recordStage("ingredient_resolution", singleDuration * 0.4);
      recordStage("knowledge_engine", singleDuration * 0.3);
      recordStage("compatibility_engine", singleDuration * 0.1);
      recordStage("decision_engine", singleDuration * 0.1);
      recordStage("explanation_engine", singleDuration * 0.1);

      if (singleResolved && singleResolved.food) {
        const f = singleResolved.food;
        const familySafety = aggregateFoodFamilySafety(f, knowledgeCache, singleResolved.candidates);

        const primaryStatus = familySafety.familyStatus === "mixed" ? (f.status as any) : familySafety.familyStatus;

        const allowedItems: IngredientResult[] = [];
        const forbiddenItems: IngredientResult[] = [];
        const conditionalItems: IngredientResult[] = [];

        const mainItem: IngredientResult = {
          name: f.nameEn || f.nameAr,
          nameAr: f.nameAr,
          nameEn: f.nameEn || f.nameAr,
          status: f.status,
          reason: f.reason,
          notes: f.notes,
        };

        if (f.status === "allowed") allowedItems.push(mainItem);
        else if (f.status === "forbidden") forbiddenItems.push(mainItem);
        else if (f.status === "conditional") conditionalItems.push(mainItem);

        for (const exc of familySafety.allowedExceptions) {
          if (!allowedItems.some((i) => i.nameAr === exc.nameAr)) {
            allowedItems.push({ name: exc.nameEn || exc.nameAr, nameAr: exc.nameAr, nameEn: exc.nameEn || exc.nameAr, status: "allowed", reason: exc.reason });
          }
        }
        for (const exc of familySafety.forbiddenExceptions) {
          if (!forbiddenItems.some((i) => i.nameAr === exc.nameAr)) {
            forbiddenItems.push({ name: exc.nameEn || exc.nameAr, nameAr: exc.nameAr, nameEn: exc.nameEn || exc.nameAr, status: "forbidden", reason: exc.reason });
          }
        }
        for (const exc of familySafety.conditionalExceptions) {
          if (!conditionalItems.some((i) => i.nameAr === exc.nameAr)) {
            conditionalItems.push({ name: exc.nameEn || exc.nameAr, nameAr: exc.nameAr, nameEn: exc.nameEn || exc.nameAr, status: "conditional", reason: exc.reason });
          }
        }

        const { compatibilityScore: _score, scoreAvailable: _scoreAvailable } = DecisionEngine.computeScores(
          allowedItems.length, forbiddenItems.length, conditionalItems.length, 0
        );

        const pInfo = getProteinFields(f.nameAr);
        const explanationText = familySafety.familySummaryAr + (f.reason ? ` — ${f.reason}` : "");

        report = {
          query: queryText,
          displayQuery: input.displayQuery || queryText,
          dish: extractBaseEntity(f.nameAr) || f.nameAr,
          proteinCategory: pInfo.proteinCategory,
          proteinSpecificity: pInfo.proteinSpecificity,
          resultMode: (singleResolved.resultMode as any) || "EXACT_FOOD",
          primaryRuling: {
            status: primaryStatus,
            nameAr: f.nameAr,
            nameEn: f.nameEn || f.nameAr,
            dbReason: explanationText,
            dbNotes: f.notes,
            isInherited: singleResolved.inherited || false,
            inheritsFrom: singleResolved.inheritsFrom,
          },
          allowed: allowedItems,
          forbidden: forbiddenItems,
          conditional: conditionalItems,
          unknown: [],
          compatibilityScore: _score,
          scoreAvailable: _scoreAvailable,
          explanation: explanationText,
          suggestions: [],
          analysisType: input.inputType === "ocr" ? "label" : input.inputType === "camera" ? "image" : "text",
          notFound: false,
        };

        (report as any).familySummary = familySafety.familySummaryAr;
        (report as any).familyStatus = familySafety.familyStatus;
        (report as any).allowedExceptions = familySafety.allowedExceptions;
        (report as any).prohibitedExceptions = familySafety.forbiddenExceptions;
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
          analysisType: input.inputType === "ocr" ? "label" : input.inputType === "camera" ? "image" : "text",
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

    const finalizedReport = await checkAndApplyClarification(
      report,
      queryText,
      (input.inputType || "text") as any,
      1.0,
      dishResult
    );

    const reportWithCanonical = finalizeReport(finalizedReport, canonicalSearchRes, dishResult);

    return {
      report: reportWithCanonical,
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

async function checkAndApplyClarification(
  report: AnalysisReport,
  query: string,
  modality: "text" | "camera" | "ocr" | "barcode" | "voice",
  aiConfidence: number,
  dishResult?: DishAnalysisResult
): Promise<AnalysisReport> {
  const resolution = await FoodResolutionEngine.resolve(
    query,
    modality,
    aiConfidence,
    dishResult ? dishResult.ingredientAnalysis.map((i) => i.canonicalFoodAr) : []
  );

  report.resolutionState = resolution.state;
  report.aiConfidence = aiConfidence;
  const isValidFamilyReport =
    report.primaryRuling?.status != null &&
    (report.resultMode === "EXACT_FOOD" ||
      report.resultMode === "GENERAL_RULE" ||
      report.resultMode === "GENERAL_RULE_EXCEPTIONS" ||
      report.resultMode === "MIXED_CATEGORY");

  const isValidDishReport =
    dishResult?.dish?.id != null &&
    (report.resultMode === "COMPOSITE_FOOD" || report.primaryRuling?.status != null);

  if (resolution.needsClarification && !isValidFamilyReport && !isValidDishReport) {
    return {
      ...report,
      resultMode: "NOT_FOUND",
      needsClarification: true,
      clarificationType: resolution.clarificationType,
      questionAr: resolution.questionAr,
      suggestions: (resolution.suggestions || []).map((s: any) => typeof s === "string" ? s : s.label || s.query || ""),
      allowed: [],
      forbidden: [],
      conditional: [],
      unknown: [],
      compatibilityScore: null,
      scoreAvailable: false,
      explanation: resolution.questionAr || report.explanation || "",
      suggestions_legacy: [],
      notFound: true,
    };
  }
  return report;
}

function finalizeReport(
  report: AnalysisReport,
  canonicalSearchRes?: any,
  dishResult?: any
): AnalysisReport {
  if (canonicalSearchRes) {
    report.canonicalResult = {
      canonicalId:
        canonicalSearchRes.canonicalId ??
        canonicalSearchRes.canonical_id ??
        dishResult?.dish?.id ??
        0,
      canonicalName:
        dishResult?.dish?.nameAr ??
        canonicalSearchRes.canonicalName ??
        canonicalSearchRes.canonical_name ??
        report.query ??
        "",
      canonicalEntityType:
        canonicalSearchRes.canonicalEntityType ??
        canonicalSearchRes.entity_type ??
        "food",
      searchOutcome:
        canonicalSearchRes.searchOutcome ??
        "FOUND",
      confidence:
        canonicalSearchRes.searchConfidence ??
        canonicalSearchRes.confidence ??
        100,
      searchMethod:
        canonicalSearchRes.search_method ??
        "canonical_search",
    };
  } else if (dishResult && dishResult.dish) {
    report.canonicalResult = {
      canonicalId: dishResult.dish.id || 0,
      canonicalName: dishResult.dish.nameAr || "",
      canonicalEntityType: "dish",
      searchOutcome: "FOUND",
      confidence: 100,
      searchMethod: "direct_lookup",
    };
  }
  return report;
}

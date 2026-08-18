/**
 * Tayyibati Phase 8 - Step 1: AI Knowledge Extractor Entry Point
 *
 * ARCHITECTURE GOVERNANCE:
 * - Search Engine is FEATURE_FROZEN.
 * - Sole integration point between SearchOrchestrator and AI Fallback.
 * - STRICT OUTPUT CONTRACT: entityType, canonicalName, confidence, ingredients.
 * - NO Decision Engine, NO Explanation Engine, NO health/religious/dietary judgments.
 * - Confidence Threshold Rule: If confidence < 0.70 -> "Unable to identify food reliably."
 */

import { getAIProvider, SearchModality } from "./aiProvider";
import { CanonicalSearchEngine, SearchMode } from "../canonicalSearchEngine";
import { resolveProteinIngredient, getProteinFields, warmDishEngineCache, resolveSingleIngredient } from "../dishCompatibilityEngine";

export interface AiKnowledgeResponse {
  entityType: "dish" | "food" | "product";
  canonicalName: string;
  confidence: number;
  ingredients: string[];
}

export interface ResolvedIngredientItem {
  input: string;
  searchOutcome: "FOUND" | "AMBIGUOUS" | "NOT_FOUND";
  canonicalId: number | string;
  canonicalEntityType: "food" | "dish" | "product";
  canonicalName: string;
  confidence: number;
  matchedAlias: string | null;
  searchMethod: string;
  proteinCategory?: string;
  proteinSpecificity?: string;
}

export async function resolveAiIngredients(ingredients: string[]): Promise<ResolvedIngredientItem[]> {
  const resolvedList: ResolvedIngredientItem[] = [];
  const cache = await warmDishEngineCache();

  for (const ing of ingredients) {
    const query = ing.trim();
    if (!query) continue;

    const res = await CanonicalSearchEngine.search({
      query,
      mode: SearchMode.INGREDIENT,
    });

    if (res && res.searchOutcome === "FOUND") {
      const pInfo = getProteinFields(res.canonical_name || res.canonicalName || query);
      resolvedList.push({
        input: query,
        searchOutcome: "FOUND",
        canonicalId: res.canonical_id ?? res.canonicalId ?? 0,
        canonicalEntityType: (res.entity_type ?? res.canonicalEntityType ?? "food") as "dish" | "food" | "product",
        canonicalName: res.canonical_name ?? res.canonicalName ?? query,
        confidence: res.confidence || res.searchConfidence || 100,
        matchedAlias: res.matched_alias || res.matchedAlias || null,
        searchMethod: res.search_method || "exact_alias",
        proteinCategory: pInfo.proteinCategory,
        proteinSpecificity: pInfo.proteinSpecificity,
      });
    } else {
      const proteinInfo = resolveProteinIngredient(query);
      if (proteinInfo) {
        resolvedList.push({
          input: query,
          searchOutcome: "FOUND",
          canonicalId: 0,
          canonicalEntityType: "food",
          canonicalName: proteinInfo.canonicalFoodAr,
          confidence: 95,
          matchedAlias: null,
          searchMethod: "protein_resolver",
          proteinCategory: proteinInfo.proteinCategory,
          proteinSpecificity: proteinInfo.proteinSpecificity,
        });
      } else {
        // Fallback: try resolving via resolveSingleIngredient to see if it matches a DB food/alias (e.g. compound bread "خبز برغر" -> "الخبز")
        const resolvedItem = resolveSingleIngredient(query, cache, true);
        if (resolvedItem && resolvedItem.foodId !== null && resolvedItem.resolvedBy !== "unknown") {
          resolvedList.push({
            input: query,
            searchOutcome: "FOUND",
            canonicalId: resolvedItem.foodId,
            canonicalEntityType: "food",
            canonicalName: resolvedItem.canonicalFoodAr,
            confidence: resolvedItem.confidenceScore,
            matchedAlias: resolvedItem.rawIngredientName !== resolvedItem.canonicalFoodAr ? resolvedItem.rawIngredientName : null,
            searchMethod: resolvedItem.resolvedBy === "alias" ? "exact_alias" : "exact_canonical",
            proteinCategory: resolvedItem.proteinCategory,
            proteinSpecificity: resolvedItem.proteinSpecificity,
          });
        } else {
          resolvedList.push({
            input: query,
            searchOutcome: "NOT_FOUND",
            canonicalId: 0,
            canonicalEntityType: "food",
            canonicalName: query,
            confidence: 0,
            matchedAlias: null,
            searchMethod: "not_found",
            proteinCategory: "NONE",
            proteinSpecificity: "NONE",
          });
        }
      }
    }
  }

  return resolvedList;
}

export class AiKnowledgeExtractor {
  /**
   * Extract structured food knowledge from AI for unknown queries
   */
  public static async extract(query: string, inputType: SearchModality = "text"): Promise<AiKnowledgeResponse> {
    try {
      const provider = getAIProvider();
      const rawRes = await provider.extractFoodKnowledge({
        query,
        inputType,
      });

      // Confidence Threshold Rule: If confidence < 0.70, return fallback error response
      if (!rawRes || rawRes.confidence < 0.70) {
        return {
          entityType: "food",
          canonicalName: "Unable to identify food reliably.",
          confidence: rawRes?.confidence || 0,
          ingredients: [],
        };
      }

      const canonicalName = rawRes.canonicalNameAr || rawRes.canonicalNameEn || query;
      let ingredients: string[] = (rawRes.ingredients || [])
        .map((ing) => (ing.name ? ing.name.trim() : ""))
        .filter((n) => n.length > 0);


      return {
        entityType: rawRes.entityType || "dish",
        canonicalName,
        confidence: rawRes.confidence,
        ingredients,
      };
    } catch (err) {
      console.error("[AI_KNOWLEDGE_EXTRACTOR_ERROR]", err);
      return {
        entityType: "food",
        canonicalName: "Unable to identify food reliably.",
        confidence: 0,
        ingredients: [],
      };
    }
  }
}

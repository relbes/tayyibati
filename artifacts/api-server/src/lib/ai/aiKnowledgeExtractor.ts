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
}

export async function resolveAiIngredients(ingredients: string[]): Promise<ResolvedIngredientItem[]> {
  const resolvedList: ResolvedIngredientItem[] = [];

  for (const ing of ingredients) {
    const query = ing.trim();
    if (!query) continue;

    const res = await CanonicalSearchEngine.search({
      query,
      mode: SearchMode.INGREDIENT,
    });

    if (res && res.searchOutcome === "FOUND") {
      resolvedList.push({
        input: query,
        searchOutcome: "FOUND",
        canonicalId: res.canonical_id || res.canonicalId,
        canonicalEntityType: res.entity_type || res.canonicalEntityType,
        canonicalName: res.canonical_name || res.canonicalName,
        confidence: res.confidence || res.searchConfidence || 100,
        matchedAlias: res.matched_alias || res.matchedAlias || null,
        searchMethod: res.search_method || "exact_alias",
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
      });
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
      const ingredients: string[] = (rawRes.ingredients || [])
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

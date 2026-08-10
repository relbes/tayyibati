/**
 * Tayyibati Search Orchestrator & Session Manager Gateway (Phase 3)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/KNOWLEDGE_ENGINE_SPEC.md
 * - Sole manager of search modes, modality policies, and Analysis Trigger rules.
 * - Manages short-lived in-memory SearchSessions (5-min TTL).
 * - Decouples AI extraction from deterministic CanonicalSearchEngine entity resolution.
 */

import { CanonicalSearchEngine, SearchMode, CanonicalSearchResult, SearchContext } from "./canonicalSearchEngine";
import { KnowledgeResolver, ResolvedCanonicalObject } from "./knowledgeResolver";
import { AiKnowledgeExtractor, AiKnowledgeResponse, resolveAiIngredients, ResolvedIngredientItem } from "./ai/aiKnowledgeExtractor";
import { DecisionEngine, IngredientDecisionItem } from "./decisionEngine";
import { MealDecisionEngine, MealDecision } from "./mealDecisionEngine";
import { ExplanationFramework, ExplanationModel } from "./explanationFramework";

export interface SearchSession {
  id: string;
  createdAt: number;
  originalQuery: string;
  candidates: CanonicalSearchResult[];
  selectedCandidate?: CanonicalSearchResult;
}

// In-Memory SearchSession Store with 5-Minute TTL
const SESSION_STORE = new Map<string, SearchSession>();
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of SESSION_STORE.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      SESSION_STORE.delete(id);
    }
  }
}

export interface OrchestrationResult {
  sessionId?: string;
  triggerAction: "ANALYZE_IMMEDIATE" | "PRESENT_SELECTION_SCREEN" | "NOT_FOUND" | "AUTOCOMPLETE_SUGGESTIONS";
  canonicalResult: CanonicalSearchResult | null;
  resolvedObject: ResolvedCanonicalObject | null;
  aiKnowledge?: AiKnowledgeResponse;
  resolvedIngredients?: ResolvedIngredientItem[];
  ingredientDecisions?: IngredientDecisionItem[];
  mealDecision?: MealDecision;
  explanationModel?: ExplanationModel;
  candidates?: CanonicalSearchResult[];
  didYouMean?: string[];
}

export class SearchOrchestrator {
  /**
   * Create a short-lived in-memory SearchSession
   */
  public static createSession(query: string, candidates: CanonicalSearchResult[]): SearchSession {
    cleanExpiredSessions();
    const id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const session: SearchSession = {
      id,
      createdAt: Date.now(),
      originalQuery: query,
      candidates,
    };
    SESSION_STORE.set(id, session);
    return session;
  }

  /**
   * Retrieve an active SearchSession
   */
  public static getSession(id: string): SearchSession | null {
    cleanExpiredSessions();
    const session = SESSION_STORE.get(id);
    if (!session) return null;
    return session;
  }

  /**
   * Close and delete a SearchSession upon analysis completion
   */
  public static closeSession(id: string): void {
    SESSION_STORE.delete(id);
  }

  /**
   * Main Search Orchestrator Entry Point: Executes modality policies & Analysis Trigger Rules
   */
  public static async executeSearch(context: SearchContext): Promise<OrchestrationResult> {
    cleanExpiredSessions();
    const mode = context.mode || SearchMode.TEXT;

    // 1. AUTOCOMPLETE MODE POLICY
    if (mode === SearchMode.AUTOCOMPLETE) {
      const topSuggestion = await CanonicalSearchEngine.search({ ...context, mode: SearchMode.AUTOCOMPLETE });
      return {
        triggerAction: "AUTOCOMPLETE_SUGGESTIONS",
        canonicalResult: topSuggestion,
        resolvedObject: null,
      };
    }

    // 2. BARCODE MODE POLICY
    if (mode === SearchMode.BARCODE) {
      const productHit = await CanonicalSearchEngine.search({ ...context, mode: SearchMode.BARCODE });
      if (productHit && productHit.searchOutcome === "FOUND") {
        const resolved = await KnowledgeResolver.resolveCanonicalObject(productHit.canonical_id, "product");
        return {
          triggerAction: "ANALYZE_IMMEDIATE",
          canonicalResult: productHit,
          resolvedObject: resolved,
        };
      }

      // Barcode NOT_FOUND -> Invoke AI Knowledge Extractor, resolve ingredients, evaluate decisions & generate Explanation
      const aiKnowledge = await AiKnowledgeExtractor.extract(context.query, "barcode");
      const resolvedIngredients = await resolveAiIngredients(aiKnowledge.ingredients || []);
      const ingredientDecisions = await DecisionEngine.evaluateIngredients(resolvedIngredients);
      const mealDecision = MealDecisionEngine.evaluateMeal(ingredientDecisions);
      const explanationModel = ExplanationFramework.generateExplanation(mealDecision, ingredientDecisions, productHit);

      return {
        triggerAction: "NOT_FOUND",
        canonicalResult: productHit || null,
        resolvedObject: null,
        aiKnowledge,
        resolvedIngredients,
        ingredientDecisions,
        mealDecision,
        explanationModel,
      };
    }

    // 3. TEXT / CAMERA / OCR MODE POLICY
    const result = await CanonicalSearchEngine.search(context);

    // FOUND -> Return existing canonical result immediately (NEVER invoke AI)
    if (result.searchOutcome === "FOUND") {
      const resolved = await KnowledgeResolver.resolveCanonicalObject(result.canonical_id, result.entity_type);
      return {
        triggerAction: "ANALYZE_IMMEDIATE",
        canonicalResult: result,
        resolvedObject: resolved,
      };
    }

    // AMBIGUOUS -> Present candidate dishes selection screen (NEVER invoke AI)
    if (result.searchOutcome === "AMBIGUOUS" && result.candidateDishes && result.candidateDishes.length > 1) {
      const session = this.createSession(context.query, result.candidateDishes);
      return {
        sessionId: session.id,
        triggerAction: "PRESENT_SELECTION_SCREEN",
        canonicalResult: result,
        resolvedObject: null,
        candidates: result.candidateDishes,
      };
    }

    // NOT_FOUND -> Invoke AiKnowledgeExtractor, resolve ingredients, evaluate Decisions, aggregate Meal Decision & generate Explanation
    const aiKnowledge = await AiKnowledgeExtractor.extract(context.query, mode === SearchMode.AUTOCOMPLETE ? "text" : (mode as any));
    const resolvedIngredients = await resolveAiIngredients(aiKnowledge.ingredients || []);
    const ingredientDecisions = await DecisionEngine.evaluateIngredients(resolvedIngredients);
    const mealDecision = MealDecisionEngine.evaluateMeal(ingredientDecisions);
    const explanationModel = ExplanationFramework.generateExplanation(mealDecision, ingredientDecisions, result);

    return {
      triggerAction: "NOT_FOUND",
      canonicalResult: result,
      resolvedObject: null,
      aiKnowledge,
      resolvedIngredients,
      ingredientDecisions,
      mealDecision,
      explanationModel,
      didYouMean: result?.didYouMean,
    };
  }
}

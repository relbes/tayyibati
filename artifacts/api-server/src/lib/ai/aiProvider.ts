/**
 * Tayyibati AI Provider Types & Interfaces (Phase 6 - Step 3)
 *
 * ARCHITECTURE GOVERNANCE:
 * - Includes IngredientRole (primary, secondary, bread, sauce, seasoning, garnish, beverage, sweetener, oil, additive).
 * - Arabic preparation values (مقلي, مشوي, مسلوق, مخبوز, مخمر, مجفف, طازج, غير مطهو, غير معروف).
 * - Factory function getAIProvider().
 */

import { AI_CONFIG } from "../config";

export type SearchModality = "text" | "camera" | "ocr" | "barcode";
export type EntityType = "food" | "dish" | "product";

export type IngredientSource =
  | "official_database"
  | "barcode_label"
  | "ocr_label"
  | "brand_recipe"
  | "common_recipe"
  | "estimated";

export type IngredientRole =
  | "primary"
  | "secondary"
  | "bread"
  | "sauce"
  | "seasoning"
  | "garnish"
  | "beverage"
  | "sweetener"
  | "oil"
  | "additive";

export interface FoodKnowledgeRequest {
  query: string;
  inputType: SearchModality;
  imageBuffer?: Buffer;
  mimeType?: string;
  rawOcrText?: string;
  barcode?: string;
}

export interface AIDebugMetadata {
  provider: string;
  model: string;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  success: boolean;
  error?: string;
  cacheHit?: boolean;
}

export interface FoodKnowledgeIngredient {
  name: string; // MUST BE IN ARABIC (e.g. "صدر دجاج", "طحين", "خبز برغر")
  certainty: number; // 0.00 -> 1.00 (Optional ingredients 0.40 -> 0.75)
  isOptional: boolean;
  preparation: string; // e.g. "مقلي", "مشوي", "مسلوق", "مخبوز", "مخمر", "مجفف", "طازج", "غير مطهو", "غير معروف"
  ingredientRole: IngredientRole; // primary, secondary, bread, sauce, seasoning, garnish, beverage, sweetener, oil, additive
}

/**
 * Arabic-First Structured Food Knowledge Response Model
 */
export interface FoodKnowledgeResponse {
  entityType: EntityType;
  canonicalNameAr: string; // Arabic canonical name (Primary SSoT)
  canonicalNameEn: string; // English canonical name
  confidence: number; // 0.00 -> 1.00
  confidenceReason?: string; // Justification string for confidence score
  cuisine?: string;
  foodCategory?: string;
  isCompositeDish?: boolean;
  ingredients: FoodKnowledgeIngredient[];
  missingIngredients?: string[];
  ingredientSource?: IngredientSource;
  debugMetadata?: AIDebugMetadata;
}

export interface AIProvider {
  extractFoodKnowledge(request: FoodKnowledgeRequest): Promise<FoodKnowledgeResponse>;
}

// Provider Factory Function
import { OpenAIProvider } from "./openaiProvider";

export function getAIProvider(overrideProviderName?: string): AIProvider {
  const providerName = overrideProviderName || AI_CONFIG.provider;
  switch (providerName) {
    case "openai":
      return new OpenAIProvider();
    case "gemini":
      throw new Error("GeminiProvider is not yet implemented.");
    case "claude":
      throw new Error("ClaudeProvider is not yet implemented.");
    default:
      return new OpenAIProvider();
  }
}

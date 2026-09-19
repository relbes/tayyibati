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
  | "additive"
  | "spice";

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

export function normalizeAndDeduplicateIngredients(
  items: Array<{ name: string; certainty: number; isOptional: boolean; preparation?: string; ingredientRole?: any }>
): FoodKnowledgeIngredient[] {
  const result: FoodKnowledgeIngredient[] = [];
  const seenNames = new Set<string>();

  for (const item of items) {
    if (!item.name) continue;
    const cleanPrep = item.preparation?.trim() || "غير معروف";

    const itemObj: FoodKnowledgeIngredient = {
      name: item.name.trim(),
      certainty: item.certainty,
      isOptional: Boolean(item.isOptional),
      preparation: cleanPrep,
      ingredientRole: item.ingredientRole || "secondary",
    };

    if (!itemObj.name) continue;

    let isRedundant = false;
    for (let i = 0; i < result.length; i++) {
      const existing = result[i].name;
      if (existing === itemObj.name) {
        isRedundant = true;
        break;
      }
      if (existing.includes(itemObj.name) && existing.length > itemObj.name.length) {
        isRedundant = true;
        break;
      }
      if (itemObj.name.includes(existing) && itemObj.name.length > existing.length) {
        result[i] = { ...itemObj };
        seenNames.delete(existing);
        seenNames.add(itemObj.name);
        isRedundant = true;
        break;
      }
    }

    if (!isRedundant && !seenNames.has(itemObj.name)) {
      seenNames.add(itemObj.name);
      result.push(itemObj);
    }
  }

  return result;
}

/**
 * Determines if an error encountered by a provider qualifies for automatic fallback.
 * Eligible:
 * - 429 / Quota / Rate limits
 * - Network / Timeout / Connection aborts
 * - 5xx Server errors / Provider unavailable
 * - Model unavailable / 404
 *
 * STRICTLY EXCLUDES:
 * - 401 / 403 (Authentication / Key errors - must not mask misconfigured keys)
 * - Client validation / input format errors
 */
export function isFallbackEligibleError(err: any): boolean {
  if (!err) return false;

  const status = Number(err?.status || err?.statusCode || err?.httpStatus || 0);
  const code = String(err?.code || err?.type || "");
  const message = String(err?.message || err || "");

  // 1. Strict Exclusions: 401 Unauthorized, 403 Forbidden
  if (
    status === 401 ||
    status === 403 ||
    code === "invalid_api_key" ||
    code === "PermissionDenied" ||
    message.includes("Incorrect API key") ||
    message.includes("Invalid API Key") ||
    message.includes("Authentication Failed")
  ) {
    return false;
  }

  // 2. Quota & Rate Limits (429, insufficient_quota, RESOURCE_EXHAUSTED)
  if (
    status === 429 ||
    code === "insufficient_quota" ||
    code === "RESOURCE_EXHAUSTED" ||
    code === "QUOTA_EXHAUSTED" ||
    message.includes("quota") ||
    message.includes("insufficient_quota") ||
    message.includes("credit_balance_exhausted") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("Rate limit")
  ) {
    return true;
  }

  // 3. Network / Timeout / Connection aborts
  if (
    status === 408 ||
    status === 504 ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "AbortError" ||
    err?.name === "AbortError" ||
    err?.name === "APIConnectionError" ||
    err?.name === "APITimeoutError" ||
    message.includes("timeout") ||
    message.includes("aborted") ||
    message.includes("fetch failed") ||
    message.includes("Connection error")
  ) {
    return true;
  }

  // 4. 5xx Server Errors (provider unavailable, bad gateway, service unavailable)
  if (
    (status >= 500 && status < 600) ||
    code === "InternalServerError" ||
    code === "ServiceUnavailable" ||
    message.includes("Internal Server Error") ||
    message.includes("Service Unavailable") ||
    message.includes("503") ||
    message.includes("500") ||
    message.includes("502")
  ) {
    return true;
  }

  // 5. Model Unavailable / Not Found
  if (
    status === 404 ||
    code === "NotFoundError" ||
    code === "model_not_found" ||
    code === "NOT_FOUND" ||
    message.includes("model_not_found") ||
    (message.includes("models/") && message.includes("not found"))
  ) {
    return true;
  }

  return false;
}

export interface AIProvider {
  extractFoodKnowledge(
    request: FoodKnowledgeRequest,
    options?: {
      throwOnError?: boolean;
      isFallback?: boolean;
      chainId?: string;
      parentRequestId?: string;
      fallbackReason?: string;
    }
  ): Promise<FoodKnowledgeResponse>;
}

// Provider Implementations & Orchestrator
import crypto from "crypto";
import { OpenAIProvider } from "./openaiProvider";
import { GeminiProvider } from "./geminiProvider";
import { aiCacheGetOrFetch } from "./aiCache";

export class FallbackOrchestratedAIProvider implements AIProvider {
  public async extractFoodKnowledge(
    request: FoodKnowledgeRequest,
    options?: {
      throwOnError?: boolean;
      isFallback?: boolean;
      chainId?: string;
      parentRequestId?: string;
      fallbackReason?: string;
    }
  ): Promise<FoodKnowledgeResponse> {
    return aiCacheGetOrFetch(request.query, request.inputType, async () => {
      const chainId = options?.chainId || `chain_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const openAIRequestId = `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

      // 1. PRIMARY: OpenAI
      const openAI = new OpenAIProvider();
      try {
        const openAIResult = await openAI.extractFoodKnowledge(request, {
          throwOnError: true,
          chainId,
          requestId: openAIRequestId,
          skipCache: true,
        });

        // OpenAI succeeded -> Return immediately. Gemini is NEVER called.
        return openAIResult;
      } catch (openAIError: any) {
        // 2. Check Fallback Eligibility
        if (!isFallbackEligibleError(openAIError)) {
          // Not eligible (e.g. 401/403 or non-provider error) -> Fail immediately without Gemini fallback
          if (options?.throwOnError) {
            throw openAIError;
          }
          return {
            entityType: "food",
            canonicalNameAr: request.query || "طعام غير معروف",
            canonicalNameEn: request.query || "Unknown Food",
            confidence: 0.0,
            confidenceReason: "فشل الاستخراج عبر المزود الأساسي",
            cuisine: "غير محدد",
            foodCategory: "غير محدد",
            isCompositeDish: false,
            ingredients: [],
            missingIngredients: [],
            ingredientSource: "estimated",
          };
        }

        // 3. FALLBACK: Gemini
        const gemini = new GeminiProvider();
        try {
          const geminiResult = await gemini.extractFoodKnowledge(request, {
            isFallback: true,
            chainId,
            parentRequestId: openAIRequestId,
            fallbackReason: `Primary OpenAI provider failed: ${openAIError?.message || openAIError?.code || "Unknown Error"}`,
            throwOnError: options?.throwOnError,
          });

          return geminiResult;
        } catch (geminiError: any) {
          if (options?.throwOnError) {
            throw geminiError;
          }
          return {
            entityType: "food",
            canonicalNameAr: request.query || "طعام غير معروف",
            canonicalNameEn: request.query || "Unknown Food",
            confidence: 0.0,
            confidenceReason: "فشل الاستخراج عبر جميع المزودات",
            cuisine: "غير محدد",
            foodCategory: "غير محدد",
            isCompositeDish: false,
            ingredients: [],
            missingIngredients: [],
            ingredientSource: "estimated",
          };
        }
      }
    });
  }
}

export function getAIProvider(overrideProviderName?: string): AIProvider {
  // Explicit overrides preserved for isolated testing and admin diagnostic tools
  if (overrideProviderName === "openai") {
    return new OpenAIProvider();
  }
  if (overrideProviderName === "gemini") {
    return new GeminiProvider();
  }
  if (overrideProviderName === "claude") {
    throw new Error("ClaudeProvider is not yet implemented.");
  }

  // Standard production entry point: OpenAI PRIMARY with Gemini FALLBACK
  return new FallbackOrchestratedAIProvider();
}

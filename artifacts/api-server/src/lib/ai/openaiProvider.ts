/**
 * Tayyibati OpenAI Provider (Phase 6 - Step 1, 2, 3, 4.5 Refinement)
 *
 * Implements ONLY:
 * - OpenAI communication
 * - Retry logic
 * - Timeout handling
 * - Structured Zod output validation
 * - Conversion into FoodKnowledgeResponse
 * - Dual-layer caching with in-flight request coalescing
 */

import OpenAI from "openai";
import { db, appConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  AIProvider,
  FoodKnowledgeRequest,
  FoodKnowledgeResponse,
  FoodKnowledgeIngredient,
  IngredientSource,
} from "./aiProvider";
import { SYSTEM_FOOD_KNOWLEDGE_PROMPT, buildFoodKnowledgePrompt, FoodKnowledgeResponseSchema } from "./prompts";
import { aiCacheGetOrFetch } from "./aiCache";
import { AI_CONFIG } from "../config";
import { norm } from "../arabicNormalization";

function normalizeAndDeduplicateIngredients(
  items: Array<{ name: string; certainty: number; isOptional: boolean; preparation?: string; ingredientRole?: "primary" | "secondary" | "spice" | "sauce" }>
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

async function getOpenAIClient(): Promise<OpenAI> {
  try {
    const [row] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "openai_api_key"));
    const key = row?.value?.trim();
    if (key && key.length > 10) return new OpenAI({ apiKey: key, timeout: AI_CONFIG.timeoutMs });
  } catch {
    // fall through
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy_key_for_build", timeout: AI_CONFIG.timeoutMs });
}

export class OpenAIProvider implements AIProvider {
  public async extractFoodKnowledge(request: FoodKnowledgeRequest): Promise<FoodKnowledgeResponse> {
    return aiCacheGetOrFetch(request.query, request.inputType, async () => {
      const startTime = performance.now();
      const providerName = "openai";
      const modelName = AI_CONFIG.model;
      const isDebug = process.env.SEARCH_DEBUG === "true";
      let attempts = 0;
      const maxAttempts = 1 + Math.max(0, AI_CONFIG.retryCount);
      let lastError: Error | null = null;

      if (isDebug) {
        console.log(`[AI_KNOWLEDGE_EXTRACTOR] Cache MISS for "${request.inputType}:${request.query}". Invoking OpenAI model=${modelName}...`);
      }

      while (attempts < maxAttempts) {
        attempts++;
        try {
          const openai = await getOpenAIClient();
          const userPromptText = buildFoodKnowledgePrompt(request);

          const userMessageContent: any[] = [];

          if (request.inputType === "camera" && request.imageBuffer) {
            const mime = request.mimeType || "image/jpeg";
            const base64Image = request.imageBuffer.toString("base64");
            userMessageContent.push({
              type: "image_url",
              image_url: { url: `data:${mime};base64,${base64Image}` },
            });
          }

          userMessageContent.push({
            type: "text",
            text: userPromptText,
          });

          const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
              { role: "system", content: SYSTEM_FOOD_KNOWLEDGE_PROMPT },
              { role: "user", content: userMessageContent },
            ],
            response_format: { type: "json_object" },
            temperature: AI_CONFIG.temperature,
            max_tokens: AI_CONFIG.maxTokens,
          });

          const durationMs = Math.round(performance.now() - startTime);
          const rawContent = completion.choices[0]?.message?.content || "{}";
          const rawParsed = JSON.parse(rawContent);

          // Strict Zod Validation
          const validated = FoodKnowledgeResponseSchema.parse(rawParsed);
          const normalizedIngredients = normalizeAndDeduplicateIngredients(validated.ingredients);

          const response: FoodKnowledgeResponse = {
            entityType: validated.entityType,
            canonicalNameAr: validated.canonicalNameAr,
            canonicalNameEn: validated.canonicalNameEn,
            confidence: validated.confidence,
            confidenceReason: validated.confidenceReason,
            cuisine: validated.cuisine,
            foodCategory: validated.foodCategory,
            isCompositeDish: validated.isCompositeDish,
            ingredients: normalizedIngredients,
            missingIngredients: validated.missingIngredients,
            ingredientSource: validated.ingredientSource as IngredientSource,
          };

          if (isDebug) {
            console.log(`[AI_KNOWLEDGE_EXTRACTOR] Success in ${durationMs}ms | Extracted ${normalizedIngredients.length} ingredients`);
            response.debugMetadata = {
              provider: providerName,
              model: modelName,
              durationMs,
              promptTokens: completion.usage?.prompt_tokens,
              completionTokens: completion.usage?.completion_tokens,
              success: true,
              cacheHit: false,
            };
          }

          return response;
        } catch (err: any) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempts >= maxAttempts) {
            break;
          }
        }
      }

      const durationMs = Math.round(performance.now() - startTime);
      const failureResponse: FoodKnowledgeResponse = {
        entityType: "food",
        canonicalNameAr: request.query || "طعام غير معروف",
        canonicalNameEn: request.query || "Unknown Food",
        confidence: 0.0,
        confidenceReason: "فشل الاستخراج عبر النموذج",
        cuisine: "غير محدد",
        foodCategory: "غير محدد",
        isCompositeDish: false,
        ingredients: [],
        missingIngredients: [],
        ingredientSource: "estimated",
      };

      if (isDebug) {
        console.log(`[AI_KNOWLEDGE_EXTRACTOR] Failed after ${attempts} attempts in ${durationMs}ms: ${lastError?.message}`);
        failureResponse.debugMetadata = {
          provider: providerName,
          model: modelName,
          durationMs,
          success: false,
          error: lastError?.message || "OpenAI Provider Extraction Failed",
          cacheHit: false,
        };
      }

      return failureResponse;
    });
  }
}

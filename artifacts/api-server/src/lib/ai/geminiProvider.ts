/**
 * Google Gemini Vision and AI Provider
 *
 * Implements native fetch integration for Gemini 1.5/2.5 Flash with:
 * - Vision (base64 image analysis)
 * - Structured JSON output
 * - Timeout handling
 * - Zero external SDK dependencies
 */

export interface GeminiVisionOptions {
  imageBase64: string;
  mimeType: string;
  promptText: string;
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}

export interface GeminiVisionResult {
  content: string;
  durationMs: number;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
}

export async function callGeminiVision(options: GeminiVisionOptions): Promise<GeminiVisionResult> {
  const {
    imageBase64,
    mimeType,
    promptText,
    apiKey,
    model = "gemini-1.5-flash",
    timeoutMs = 20000,
  } = options;

  const startTime = Date.now();
  // SECURITY: No API key in URL. Pass x-goog-api-key via headers.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // Clean base64 and mimeType
  let cleanBase64 = imageBase64;
  if (cleanBase64.includes(",")) {
    cleanBase64 = cleanBase64.split(",")[1];
  }
  cleanBase64 = cleanBase64.replace(/\s+/g, "");

  let cleanMime = (mimeType || "image/jpeg").toLowerCase().trim();
  if (cleanMime === "image/jpg") cleanMime = "image/jpeg";

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: cleanMime,
              data: cleanBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text();
      let parsedErr: any = null;
      try {
        parsedErr = JSON.parse(errText);
      } catch {}
      const errMsg = parsedErr?.error?.message || errText || `HTTP ${res.status}`;
      const errCode = parsedErr?.error?.status || `HTTP_${res.status}`;
      const error: any = new Error(`Gemini API error (${res.status}): ${errMsg}`);
      error.status = res.status;
      error.code = errCode;
      throw error;
    }

    const data: any = await res.json();
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text || "{}";

    const promptTokens = data.usageMetadata?.promptTokenCount;
    const completionTokens = data.usageMetadata?.candidatesTokenCount;
    const cachedTokens = data.usageMetadata?.cachedContentTokenCount;

    return {
      content: textPart,
      durationMs,
      model,
      promptTokens: typeof promptTokens === "number" ? promptTokens : undefined,
      completionTokens: typeof completionTokens === "number" ? completionTokens : undefined,
      cachedTokens: typeof cachedTokens === "number" ? cachedTokens : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface GeminiGenerateOptions {
  promptText: string;
  apiKey: string;
  systemInstruction?: string;
  imageBuffer?: Buffer;
  mimeType?: string;
  model?: string;
  timeoutMs?: number;
}

export interface GeminiGenerateResult {
  content: string;
  durationMs: number;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
}

export async function callGeminiGenerate(options: GeminiGenerateOptions): Promise<GeminiGenerateResult> {
  const {
    promptText,
    apiKey,
    systemInstruction,
    imageBuffer,
    mimeType,
    model = "gemini-1.5-flash",
    timeoutMs = 20000,
  } = options;

  const startTime = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const parts: any[] = [];
  if (imageBuffer) {
    const cleanMime = (mimeType || "image/jpeg").toLowerCase().trim();
    parts.push({
      inline_data: {
        mime_type: cleanMime === "image/jpg" ? "image/jpeg" : cleanMime,
        data: imageBuffer.toString("base64"),
      },
    });
  }
  parts.push({ text: promptText });

  const payload: any = {
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0,
    },
  };

  if (systemInstruction) {
    payload.system_instruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text();
      let parsedErr: any = null;
      try {
        parsedErr = JSON.parse(errText);
      } catch {}
      const errMsg = parsedErr?.error?.message || errText || `HTTP ${res.status}`;
      const errCode = parsedErr?.error?.status || `HTTP_${res.status}`;
      const error: any = new Error(`Gemini API error (${res.status}): ${errMsg}`);
      error.status = res.status;
      error.code = errCode;
      throw error;
    }

    const data: any = await res.json();
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text || "{}";

    const promptTokens = data.usageMetadata?.promptTokenCount;
    const completionTokens = data.usageMetadata?.candidatesTokenCount;
    const cachedTokens = data.usageMetadata?.cachedContentTokenCount;

    return {
      content: textPart,
      durationMs,
      model,
      promptTokens: typeof promptTokens === "number" ? promptTokens : undefined,
      completionTokens: typeof completionTokens === "number" ? completionTokens : undefined,
      cachedTokens: typeof cachedTokens === "number" ? cachedTokens : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}

import crypto from "crypto";
import { db, appConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  AIProvider,
  FoodKnowledgeRequest,
  FoodKnowledgeResponse,
  IngredientSource,
  normalizeAndDeduplicateIngredients,
} from "./aiProvider";
import { SYSTEM_FOOD_KNOWLEDGE_PROMPT, buildFoodKnowledgePrompt, FoodKnowledgeResponseSchema } from "./prompts";
import { trackAIUsageNonBlocking } from "./aiUsageTracker";

export async function getGeminiApiKey(): Promise<string | undefined> {
  const envGemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (envGemini?.trim() && envGemini.trim().length > 10) {
    return envGemini.trim();
  }
  try {
    const [row] = await db
      .select()
      .from(appConfigTable)
      .where(eq(appConfigTable.key, "gemini_api_key"));
    const key = row?.value?.trim();
    if (key && key.length > 10) return key;
  } catch {
    // fall through
  }
  return undefined;
}

export class GeminiProvider implements AIProvider {
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
    const startTime = performance.now();
    const providerName = "gemini";
    const modelName = "gemini-1.5-flash";
    const isDebug = process.env.SEARCH_DEBUG === "true";
    const isFallback = Boolean(options?.isFallback);
    const requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const chainId = options?.chainId || `chain_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    try {
      const apiKey = await getGeminiApiKey();
      if (!apiKey) {
        const error: any = new Error("Gemini API key is not configured.");
        error.status = 401;
        error.code = "CONFIG_ERROR";
        throw error;
      }

      const userPromptText = buildFoodKnowledgePrompt(request);

      const genResult = await callGeminiGenerate({
        promptText: userPromptText,
        systemInstruction: SYSTEM_FOOD_KNOWLEDGE_PROMPT,
        imageBuffer: request.inputType === "camera" ? request.imageBuffer : undefined,
        mimeType: request.mimeType,
        apiKey,
        model: modelName,
        timeoutMs: 20000,
      });

      const durationMs = Math.round(performance.now() - startTime);
      const rawParsed = JSON.parse(genResult.content);

      // Usage tracking
      trackAIUsageNonBlocking({
        requestId,
        chainId,
        parentRequestId: options?.parentRequestId,
        provider: "gemini",
        model: modelName,
        feature: isFallback ? "AI_FALLBACK" : (request.inputType === "camera" ? "IMAGE_ANALYSIS" : "FOOD_SEARCH"),
        requestStatus: "SUCCESS",
        httpStatus: 200,
        latencyMs: durationMs,
        inputTokens: genResult.promptTokens || 0,
        outputTokens: genResult.completionTokens || 0,
        cachedTokens: genResult.cachedTokens || 0,
        tokensAvailable: typeof genResult.promptTokens === "number",
        isFallback,
        fallbackReason: options?.fallbackReason,
        chainFinalStatus: "SUCCESS",
      });

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
        response.debugMetadata = {
          provider: providerName,
          model: modelName,
          durationMs,
          promptTokens: genResult.promptTokens,
          completionTokens: genResult.completionTokens,
          success: true,
          cacheHit: false,
        };
      }

      return response;
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);

      trackAIUsageNonBlocking({
        requestId,
        chainId,
        parentRequestId: options?.parentRequestId,
        provider: "gemini",
        model: modelName,
        feature: isFallback ? "AI_FALLBACK" : (request.inputType === "camera" ? "IMAGE_ANALYSIS" : "FOOD_SEARCH"),
        requestStatus: "FAILED",
        httpStatus: (err as any)?.status || 500,
        error: err,
        latencyMs: durationMs,
        isFallback,
        fallbackReason: options?.fallbackReason,
        chainFinalStatus: "FAILED",
      });

      if (options?.throwOnError) {
        throw err;
      }

      const failureResponse: FoodKnowledgeResponse = {
        entityType: "food",
        canonicalNameAr: request.query || "طعام غير معروف",
        canonicalNameEn: request.query || "Unknown Food",
        confidence: 0.0,
        confidenceReason: "فشل الاستخراج عبر النموذج البديل",
        cuisine: "غير محدد",
        foodCategory: "غير محدد",
        isCompositeDish: false,
        ingredients: [],
        missingIngredients: [],
        ingredientSource: "estimated",
      };

      if (isDebug) {
        failureResponse.debugMetadata = {
          provider: providerName,
          model: modelName,
          durationMs,
          success: false,
          error: err?.message || "Gemini Provider Extraction Failed",
          cacheHit: false,
        };
      }

      return failureResponse;
    }
  }
}


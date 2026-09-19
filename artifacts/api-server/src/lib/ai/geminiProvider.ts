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

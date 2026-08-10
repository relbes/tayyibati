/**
 * Tayyibati Universal Analysis Context (Phase 7.1.5)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/ANALYSIS_CONTEXT.md
 * - See docs/ANALYSIS_PIPELINE_SPEC.md
 * - See docs/ARCHITECTURE_RULES.md
 * - See docs/ENGINEERING_PRINCIPLES.md (Immutable Context, Single Source of Truth)
 *
 * MANDATE:
 * - Immutable AnalysisContext object created ONCE per request.
 * - Passed through every pipeline engine (UnifiedAnalysisEngine, IntentClassificationEngine,
 *   IngredientExtractor, IngredientDecomposer, DecisionEngine, ExplanationEngine,
 *   ProductAnalysisEngine, BarcodeEngine).
 * - Read-only, unmodifiable, and fully frozen.
 */

export interface AnalysisContext {
  readonly requestId: string;
  readonly startedAt: number;
  readonly language: "ar" | "en";
  readonly userId: string | null;
  readonly subscription: "FREE" | "PREMIUM";
  readonly inputType: "TEXT" | "CAMERA" | "OCR" | "BARCODE" | "VOICE";
  readonly entityType: string;
  readonly intentType: string;
  readonly provider: string | null;
  readonly knowledgeVersion: string;
  readonly requestSource: "mobile" | "admin" | "api";
  readonly debug: boolean;

  // Reserved Future Extensions
  readonly voiceLanguage?: string;
  readonly cameraModel?: string;
  readonly ocrEngine?: string;
  readonly barcodeProvider?: string;
  readonly premiumFeatures?: string[];
  readonly devicePlatform?: string;
  readonly deviceVersion?: string;
  readonly country?: string;
  readonly timezone?: string;
  readonly experimentFlags?: Record<string, boolean>;
}

export class AnalysisContextFactory {
  /**
   * Creates an immutable, frozen AnalysisContext instance.
   */
  public static create(input?: Partial<AnalysisContext>): Readonly<AnalysisContext> {
    const ctx: AnalysisContext = {
      requestId: input?.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      startedAt: input?.startedAt || performance.now(),
      language: input?.language || "ar",
      userId: input?.userId ?? null,
      subscription: input?.subscription || "FREE",
      inputType: input?.inputType || "TEXT",
      entityType: input?.entityType || "UNKNOWN",
      intentType: input?.intentType || "UNKNOWN",
      provider: input?.provider ?? null,
      knowledgeVersion: input?.knowledgeVersion || "2.1",
      requestSource: input?.requestSource || "api",
      debug: input?.debug ?? false,
      voiceLanguage: input?.voiceLanguage,
      cameraModel: input?.cameraModel,
      ocrEngine: input?.ocrEngine,
      barcodeProvider: input?.barcodeProvider,
      premiumFeatures: input?.premiumFeatures,
      devicePlatform: input?.devicePlatform,
      deviceVersion: input?.deviceVersion,
      country: input?.country,
      timezone: input?.timezone,
      experimentFlags: input?.experimentFlags,
    };

    return Object.freeze(ctx);
  }
}

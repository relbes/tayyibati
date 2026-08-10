# Universal Analysis Context Specification

**Document Version:** 1.0.0 (Phase 7.1.5)  
**Status:** Permanent Architectural Governance Mandate  
**Target:** Tayyibati Universal Analysis Pipeline Context  

---

## Executive Summary & Non-Negotiable Rules

> [!IMPORTANT]
> **GOVERNANCE MANDATES**:
> 1. **Single Immutable Context**: An `AnalysisContext` object is created **ONCE** at the entry of every analysis request.
> 2. **Pipeline Pass-Through**: Every engine (`UnifiedAnalysisEngine`, `IntentClassificationEngine`, `IngredientExtractor`, `IngredientDecomposer`, `DecisionEngine`, `ExplanationEngine`, `ProductAnalysisEngine`, `BarcodeEngine`) receives `context: Readonly<AnalysisContext>`.
> 3. **Strict Immutability**: No engine may modify, recreate, or duplicate the `AnalysisContext`. It is frozen with `Object.freeze()`.
> 4. **No HTTP Leakage**: No engine reads Express `req` directly after `AnalysisContext` creation.

---

## 1. Schema & Structure

```typescript
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
```

---

## 2. Pipeline Pass-Through Flow

```
                      HTTP Request / API Entry Point
                                      │
                                      ▼
                        AnalysisContextFactory.create()
                          (Object.freeze immutable)
                                      │
                                      ▼
                    UnifiedAnalysisEngine.analyze(context)
                                      │
               ┌──────────────────────┼──────────────────────┐
               ▼                      ▼                      ▼
  IntentClassificationEngine  IngredientDecomposer     DecisionEngine
      (reads context)           (reads context)       (reads context)
               │                      │                      │
               └──────────────────────┼──────────────────────┘
                                      │
                                      ▼
                          ExplanationEngine (reads context)
```

---

## 3. Reserved Future Extensions

The `AnalysisContext` interface contains reserved fields so future capabilities (`cameraModel`, `ocrEngine`, `barcodeProvider`, `experimentFlags`, `premiumFeatures`) require **ZERO signature changes**:
- `voiceLanguage`
- `cameraModel`
- `ocrEngine`
- `barcodeProvider`
- `premiumFeatures`
- `devicePlatform` / `deviceVersion`
- `country` / `timezone`
- `experimentFlags`

---

## 4. Verification & Testing

- `test_analysis_context.ts` verifies immutability (`Object.isFrozen(context) === true`), pass-through integrity, and sub-millisecond context creation latency (< 0.01 ms).

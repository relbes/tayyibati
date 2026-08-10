# Universal Explanation Engine Specification

**Document Version:** 1.0.0 (Phase 6.5)  
**Status:** Permanent Architectural Governance Mandate  
**Target:** Tayyibati Presentation & Explanation Infrastructure  

---

## Executive Summary & Non-Negotiable Rules

> [!IMPORTANT]
> **PRESENTATION-ONLY GOVERNANCE MANDATE**:  
> The **Explanation Engine (`ExplanationEngine`)** is a pure presentation layer.  
> It MUST NEVER recalculate compatibility, override or change the Decision Engine's decision/score, query the database, or call AI models.  
> It ONLY transforms deterministic `DecisionEngineOutput` into clear, human-readable explanations.

---

## 1. Universal Pipeline Position

```
                                  DecisionEngine
                                         │
                                         ▼
                               DecisionEngineOutput
                        (finalDecision, compatibilityScore,
                         decisionEvidence, decisionMetadata)
                                         │
                                         ▼
                         ┌───────────────────────────────┐
                         │   ExplanationEngine.render()  │
                         │   - ExplanationMode           │
                         │   - ExplanationAudience       │
                         │   - Language (ar / en)        │
                         └───────────────┬───────────────┘
                                         │
                                         ▼
                              Response Formatter
```

---

## 2. Explanation Modes (`ExplanationMode`)

- **`SHORT`**: Used for search autocomplete results, history cards, and quick notification banners. Maximum **1–2 sentences**.
- **`NORMAL`**: Default application analysis screen. Maximum **3–5 sentences**.
- **`DETAILED`**: Premium educational reports. Comprehensive breakdowns including ingredient analysis, confidence metrics, and educational rationale.

---

## 3. Explanation Audiences (`ExplanationAudience`)

- **`USER`**: Simple, clear language. Default mobile application experience.
- **`EDUCATIONAL`**: Educational diet rationale for premium subscribers.
- **`ADMIN`**: Internal moderation and knowledge review tool including moderation evidence.
- **`DEBUG`**: Comprehensive developer diagnostics including raw execution metadata, timings, and resolution provenances.

---

## 4. Multilingual & Severity Structure

- **Supported Languages:** Arabic (`ar`), English (`en`). Prepared for future extensions (`fr`, `tr`, `ur`, `ms`).
- **Severity Levels:**
  - `SUCCESS` (Allowed decisions)
  - `INFO` (General information / stats)
  - `WARNING` (Conditional rulings & low confidence warnings)
  - `ERROR` (Forbidden rulings)

---

## 5. Output Payload Contract

```typescript
export interface ExplanationEngineOutput {
  explanationMode: ExplanationMode;
  explanationAudience: ExplanationAudience;
  language: ExplanationLanguage;
  headline: string;
  summary: string;
  severity: SeverityLevel;
  sections: ExplanationSection[];
  ingredientExplanation: string;
  criticalIngredientExplanation: string;
  confidenceExplanation: string;
  warnings: string[];
  recommendations: string[];
  metadata: {
    engineVersion: string;
    renderedTimestamp: string;
    renderTimeMs: number;
    decisionMetadata: any;
  };
}
```

---

## 6. Verification Examples

| Decision Input | Mode | Audience | Headline | Rendered Summary | Render Time |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `FORBIDDEN` (Chicken Burger) | `NORMAL` | `USER` | **الطعام غير متوافق** | هذه الوجبة غير متوافقة لأنها تحتوي على مكونات غير مسموحة. | **0.012 ms** |
| `ALLOWED` (Mansaf) | `SHORT` | `USER` | **الطعام متوافق** | جميع المكونات التي تم التعرف عليها متوافقة. | **0.008 ms** |
| `CONDITIONAL` (Pizza Cheese) | `DETAILED` | `EDUCATIONAL` | **Conditionally Compatible** | This meal is conditionally compatible and requires moderation. | **0.015 ms** |
| `NEEDS_REVIEW` (Unknown) | `DETAILED` | `DEBUG` | **يتطلب المراجعة** | يتطلب هذا العنصر مراجعة إضافية. | **0.020 ms** |

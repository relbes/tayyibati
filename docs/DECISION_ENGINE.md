# Universal Decision Engine Specification

**Document Version:** 1.1.0 (Phase 6.4.1 Refinement)  
**Status:** Permanent Architectural Governance Mandate  
**Target:** Tayyibati Universal Decision Engine  

---

## Executive Summary & Non-Negotiable Rules

> [!IMPORTANT]
> **GOVERNANCE MANDATES**:
> 1. **Decision Before Score**: Final decision is evaluated BEFORE score calculation (`Resolved Ingredients` -> `Decision Rules` -> `Final Decision` -> `Compatibility Score` -> `Ready For Explanation`). The decision NEVER depends on the score.
> 2. **Zero Input Modality Knowledge**: The Decision Engine receives ONLY resolved ingredients, unknown ingredients, and recognition statistics.
> 3. **Zero Text Generation**: The Decision Engine MUST NEVER generate human-readable natural-language text explanations. (Explanation generation belongs exclusively to Phase 6.5 Explanation Engine).
> 4. **Decision Evidence & Metadata**: Output includes `DecisionEvidence` (with `criticalIngredients`) and `DecisionMetadata` for consumption by Phase 6.5.

---

## 1. Decision Lifecycle

```
                     Ingredient Decomposer (Stage 3)
                                   │
                                   ▼
             ┌───────────────────────────────────────────┐
             │ Input Payload:                            │
             │ - resolvedIngredients[]                   │
             │ - unknownIngredients[]                    │
             │ - recognitionStats                        │
             └─────────────────────┬─────────────────────┘
                                   │
                                   ▼
             ┌───────────────────────────────────────────┐
             │ STEP 1: Resolved Ingredients Evaluated    │
             │ Categorizes ingredients into allowed,     │
             │ forbidden, conditional, unknown           │
             └─────────────────────┬─────────────────────┘
                                   │
                                   ▼
             ┌───────────────────────────────────────────┐
             │ STEP 2: Decision Rules Executed           │
             │ Determines Final Decision (BEFORE SCORE)  │
             └─────────────────────┬─────────────────────┘
                                   │
                                   ▼
             ┌───────────────────────────────────────────┐
             │ STEP 3: Compatibility Score Calculated    │
             │ Applies configuration-driven weights      │
             └─────────────────────┬─────────────────────┘
                                   │
                                   ▼
             ┌───────────────────────────────────────────┐
             │ STEP 4: Evidence & Critical Ingredients   │
             │ Identifies exact decision-causing items   │
             └─────────────────────┬─────────────────────┘
                                   │
                                   ▼
             ┌───────────────────────────────────────────┐
             │ STEP 5: Metadata & Recommendations        │
             │ Attaches engineVersion & decisionTimestamp│
             └─────────────────────┬─────────────────────┘
                                   │
                                   ▼
                       Explanation Engine (Phase 6.5)
```

---

## 2. Decision Evidence & Critical Ingredients Schema

`DecisionEvidence` contains structured evidence for decision auditability:

```typescript
export interface DecisionEvidence {
  allowedIngredients: DecisionIngredient[];
  forbiddenIngredients: DecisionIngredient[];
  conditionalIngredients: DecisionIngredient[];
  unknownIngredients: DecisionIngredient[];
  criticalIngredients: DecisionIngredient[]; // Ingredients directly causing the decision
}
```

### Critical Ingredient Assignment Rules
- If `finalDecision === "FORBIDDEN"` $\rightarrow$ `criticalIngredients` = `forbiddenIngredients`
- If `finalDecision === "CONDITIONAL"` $\rightarrow$ `criticalIngredients` = `conditionalIngredients`
- If `finalDecision === "NEEDS_REVIEW"` or `"UNKNOWN"` $\rightarrow$ `criticalIngredients` = `unknownIngredients`
- If `finalDecision === "ALLOWED"` $\rightarrow$ `criticalIngredients` = `allowedIngredients`

---

## 3. Decision Metadata Schema

`DecisionMetadata` provides system execution context:

```typescript
export interface DecisionMetadata {
  engineVersion: string;     // "1.1.0"
  rulesVersion: string;      // "2026.1"
  decisionTimestamp: string; // ISO 8601 timestamp
  processingTimeMs: number;  // Execution latency in ms
  deterministic: boolean;   // Always true
}
```

---

## 4. Configuration-Driven Weight Scoring Matrix

```typescript
export interface DecisionWeightsConfig {
  allowedWeight: number;                // Default: 100
  forbiddenWeight: number;              // Default: 0
  conditionalWeight: number;            // Default: 60
  unknownWeight: number;                // Default: 40
  recognitionPenaltyMultiplier: number; // Default: 0.2
}
```

---

## 5. Verification Examples

| Composite Entity | Final Decision | Critical Ingredients | Score | Metadata Timestamp |
| :--- | :---: | :--- | :---: | :---: |
| **Chicken Burger** | **FORBIDDEN** | Chicken, Bread (Forbidden) | **0** | `2026-08-02T10:46:00.000Z` |
| **Caesar Salad** | **FORBIDDEN** | Lettuce, Chicken (Forbidden) | **0** | `2026-08-02T10:46:00.000Z` |
| **Mansaf** | **ALLOWED** | Rice, Ghee, Almonds (Allowed) | **100** | `2026-08-02T10:46:00.000Z` |

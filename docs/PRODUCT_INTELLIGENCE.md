# Product Intelligence Foundation Specification

**Document Version:** 1.0.0 (Phase 7.0)  
**Status:** Permanent Architectural Governance Mandate  
**Target:** Tayyibati Product Intelligence & Barcode Subsystem  

---

## Executive Summary & Non-Negotiable Rules

> [!IMPORTANT]
> **GOVERNANCE MANDATES**:
> 1. **A Product is NOT a Food**: A Product is a packaged commercial entity that contains an ingredient list text blob.
> 2. **Zero Stored Compatibility**: Products MUST NEVER store compatibility rulings directly. A Product MUST be decomposed into ingredients, resolved via the Knowledge Engine, and evaluated via the Decision Engine.
> 3. **Universal Pipeline Integration**: Products are another input modality into the universal analysis pipeline:  
>    `Product` -> `Ingredient Extraction` -> `Ingredient Resolution` -> `Decision Engine` -> `Explanation Engine`.
> 4. **Knowledge Versioning**: Every Product Intelligence response MUST return `knowledgeVersion` (e.g. `"2.1"`).

---

## 1. Product Entity Schema

```typescript
export interface Product {
  productId: string;
  barcode: string | null;
  brand: string | null;
  productName: string;
  country: string | null;
  manufacturer: string | null;
  ingredientText: string;
  nutritionFacts?: Record<string, any> | null;
  imageUrl?: string | null;
  language: "ar" | "en";
  knowledgeVersion: string; // e.g. "2.1"
}
```

---

## 2. Product Analysis Pipeline Architecture

```
                    Input Sources (Barcode, OCR Label, Manual)
                                      │
                                      ▼
                        ProductAnalysisEngine.analyzeProduct()
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
       Known Product Lookup                      Unknown Product Queue
     (Barcode DB / Product ID)                   (needsAdminReview: true)
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      │
                                      ▼
                       Ingredient Decomposer (Stage 4 & 5)
                     (Decomposes ingredient text list)
                                      │
                                      ▼
                       Universal Decision Engine (Stage 8)
                     (Evaluates compatibility score)
                                      │
                                      ▼
                      Universal Explanation Engine (Stage 9)
                     (Renders presentation explanation)
```

---

## 3. Product Confidence Matrix

Returns 4 distinct confidence metrics:
- **`productConfidence`**: `100` for verified Product DB barcode match, `90` for manual payload, `85` for raw OCR scan, `0` for unknown product.
- **`ingredientConfidence`**: Average confidence of resolved ingredients.
- **`recognitionConfidence`**: Percentage of recognized ingredients.
- **`decisionConfidence`**: Universal Decision Engine confidence score (0–100).

---

## 4. Unknown Product Queue (`needsAdminReview`)

If a barcode or product ID is unknown:
- `isUnknownProduct: true`
- `needsAdminReview: true`
- DO NOT fail or crash. If raw OCR text or manual ingredient input is available, execute ingredient decomposition & compatibility analysis.

---

## 5. Verification Examples

| Scenario | Input | `productConfidence` | Final Decision | Knowledge Version |
| :--- | :--- | :---: | :---: | :---: |
| **Nutella Barcode** | Barcode `629100123456` | **100** | `FORBIDDEN` (Contains Sugar, Palm Oil) | **2.1** |
| **Pepsi Barcode** | Barcode `012000000133` | **100** | `FORBIDDEN` (Contains Sugar) | **2.1** |
| **OCR Product Scan**| Raw OCR ingredient text | **85** | `FORBIDDEN` / `ALLOWED` | **2.1** |
| **Unknown Barcode** | Barcode `629100000000` | **0** | `UNKNOWN` / `NEEDS_REVIEW` | **2.1** |

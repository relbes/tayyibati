# Composite Food Analysis & Decomposition Specification

**Document Version:** 1.1.0 (Phase 6.3A Refinement)  
**Status:** Permanent Architectural Governance Mandate  
**Target:** Tayyibati Knowledge & Decision Infrastructure  

---

## Executive Summary & Non-Negotiable Rule

> [!IMPORTANT]
> **PERMANENT ARCHITECTURAL GOVERNANCE RULE**:  
> **ANY entity containing multiple ingredients MUST be decomposed into ingredients BEFORE compatibility is calculated.**  
> NO composite entity (traditional dish, composite meal, sandwich, pizza, restaurant meal, dessert, salad, soup, recipe, OCR label, camera meal photo, barcode product, voice query) MAY EVER receive a direct compatibility decision without ingredient-level decomposition and resolution.

---

## 1. 3-Stage Universal Pipeline Architecture

Every multi-ingredient entity passes through THREE explicit, independent execution stages:

```
                            Input Modalities
           (Recipe DB, OCR Text, Vision, AI, Manual List)
                                  │
                                  ▼
           ┌──────────────────────────────────────────────┐
           │ STAGE 1: Ingredient Extraction               │
           │ (Finds raw items & detectionProvenance)      │
           └──────────────────────┬───────────────────────┘
                                  │
                                  ▼
           ┌──────────────────────────────────────────────┐
           │ STAGE 2: Decomposition & Normalization       │
           │ (Splits compound strings, cleans, deduplicates)│
           └──────────────────────┬───────────────────────┘
                                  │
                                  ▼
           ┌──────────────────────────────────────────────┐
           │ STAGE 3: Ingredient Resolution               │
           │ (Matches DB canonical foods & records        │
           │  resolutionProvenance separately)            │
           └──────────────────────┬───────────────────────┘
                                  │
                                  ▼
                       Decision Engine Hand-off
```

---

## 2. Separation of Provenances

> [!IMPORTANT]
> **CONCEPTUAL SEPARATION**:  
> `detectionProvenance` and `resolutionProvenance` are **SEPARATE, DISTINCT PROPERTIES**.

- **Detection Provenance (`detectionProvenance`)**: Identifies WHERE the raw ingredient string originated:
  - `"recipe"` (Stored dish formula)
  - `"ocr"` (Product label scan)
  - `"vision"` (Camera photo extraction)
  - `"ai"` (AI text parser)
  - `"manual"` (Direct user input)

- **Resolution Provenance (`resolutionProvenance`)**: Identifies HOW the string was matched in the Knowledge Engine:
  - `"exact_food"` (Matched canonical food row directly)
  - `"food_alias"` (Matched a food alias)
  - `"dish_recipe"` (Matched a traditional dish alias)
  - `"ocr"` (Matched an OCR spelling alias variant)
  - `"ai_extracted"` (Fallback matching)

*Example:* An ingredient extracted from OCR text (`detectionProvenance = "ocr"`) that matches a food alias (`resolutionProvenance = "food_alias"`). Both properties are preserved separately for complete diagnostic auditability.

---

## 3. Supported Entity Types

The `IngredientDecomposer` supports all multi-ingredient input sources:
1. **Traditional Dishes** (`كبسة`, `منسف`, `مقلوبة`, `مسخن`, `كشري`, etc.)
2. **Composite Meals** (`Burger`, `Pizza`, `Sandwich`, `Shawarma`, `Wrap`, etc.)
3. **Restaurant Meals** (Commercial combos, custom plates)
4. **Recipes** (Manual or AI-extracted ingredient formulas)
5. **Ingredient Lists** (Text lists e.g., `"رز + دجاج + طماطم"`)
6. **OCR Ingredient Labels** (Scanned packaged product text)
7. **Camera Meal Photos** (Vision ingredient extractions)
8. **Future Barcode Products**
9. **Future Voice Requests**

---

## 4. Required Ingredient Payload Contract

Every resolved ingredient returned to the Decision Engine contains:
- `rawIngredient`: Original string extracted
- `canonicalFood`: Resolved standard Arabic/English name
- `foodId`: Primary key in `foods` table (or `null` if dish match)
- `status`: Ruling (`allowed` | `forbidden` | `conditional` | `unknown`)
- `reason`: Rule explanation
- `notes`: Exception or dietary note
- `confidence`: (`HIGH` | `MEDIUM` | `LOW`)
- `confidenceScore`: Final match quality score (0–100)
- `resolvedBy`: (`food` | `alias` | `unknown`)
- `detectionProvenance`: (`recipe` | `ocr` | `vision` | `ai` | `manual`)
- `resolutionProvenance`: (`exact_food` | `food_alias` | `dish_recipe` | `ocr` | `ai_extracted`)
- `source`: Diagnostic origin description

---

## 5. Preservation of Unknown Ingredients

Unknown ingredients MUST NEVER disappear or be swallowed. They are returned separately in `unknownIngredients` with full diagnostic metadata:
- `rawName`: Raw ingredient string
- `normalizedName`: Normalized Arabic/English representation
- `language`: (`ar` | `en`)
- `needsReview`: Always `true` for unknowns
- `suggestedCanonical`: `null` (never guess)
- `confidence`: `"LOW"`
- `whyUnknown`: Explanatory message for why resolution failed
- `provenance`: Source origin (`dish_recipe` | `ai_extracted`)

---

## 6. Verification Examples

| Input Composite Entity | Stage 1 (Extract) | Stage 2 (Decompose) | Stage 3 (Resolve) | Detection Provenance | Resolution Provenance |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Chicken Burger** | `"Chicken, Bread"` | `"Chicken"`, `"Bread"` | الدجاج، الخبز العادي | `manual` | `exact_food` |
| **OCR Label** | `"طماطم، ملح وفلفل"` | `"طماطم"`, `"ملح"`, `"فلفل"` | الطماطم، الملح، الفلفل | `ocr` | `food_alias` / `exact_food` |
| **Mansaf Recipe** | `"أرز، جميد"` | `"أرز"`, `"جميد"` | الأرز، الجميد | `recipe` | `exact_food` |

---

## 7. Performance SLA

- 3-stage execution overhead: **< 1.0 ms**
- Cache warming: Single-pass in-memory lookup maps (`foodsById`, `foodAliasesByNormAr`, `dishesByNormAr`).
- DB Queries during decomposition: **0**.

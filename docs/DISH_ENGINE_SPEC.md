# Dish Compatibility Engine Specification

The Dish Compatibility Engine (`dishCompatibilityEngine.ts`) evaluates composite culinary dishes dynamically by analyzing component ingredients against canonical food rulings.

---

## ⚙️ Architecture & Execution Pipeline

```
Query Input (e.g., "كبسة", "منسف", "Chicken Burger")
       │
       ▼
1. Normalize Input (Knowledge Engine String Normalization)
       │
       ▼
2. Resolve Dish / Dish Alias (Lookup in `dishes` & `dish_aliases`)
       │
       ▼
3. Load Recipe Ingredients (Fetch from `dish_ingredients`)
       │
       ▼
4. Merge AI / Extra Ingredients (Appends non-duplicate ingredients)
       │
       ▼
5. Resolve Each Ingredient to Canonical Food / Alias
       │
       ▼
6. Deduplicate Ingredients by Canonical `food_id`
       │
       ▼
7. Fetch Food Compatibility Rulings (from `foods`)
       │
       ▼
8. Calculate Dynamic Dish Compatibility (Decision Engine)
       │
       ▼
9. Generate Human-Readable Arabic & English Explanations
       │
       ▼
10. Calculate Confidence Scores & Recognition Statistics
```

---

## 🔍 Key Engine Capabilities

### 1. Ingredient Normalization & Resolution Priority
Resolution follows a strict 5-tier deterministic hierarchy:
1. **Food Alias** (`food_aliases` match $\rightarrow$ score 95/100)
2. **Canonical Food** (`foods` match $\rightarrow$ score 98/100)
3. **Dish Alias** (`dish_aliases` match $\rightarrow$ score 80/100)
4. **OCR Alias** (OCR variant match $\rightarrow$ score 90/100)
5. **AI Fallback** (LAST OPTION ONLY $\rightarrow$ score 70/100)

---

### 2. Canonical `food_id` Deduplication
- Resolved ingredients are grouped by canonical `foodId`.
- Duplicate representations of the same underlying food (e.g. `طماطم`, `Tomato`, `الطماطم`) resolve to `foodId: 52` and collapse into a **single** ingredient entry.

---

### 3. Recipe & AI Ingredient Merging
- Primary recipe ingredients loaded from `dish_ingredients` take precedence.
- AI-extracted or custom user ingredients append **only** if they do not duplicate existing recipe ingredients (`foodId` or `normalizedName`).

---

### 4. Provenance Tracking & Diagnostic Source Tagging
Every ingredient includes a non-null `provenance` field indicating its match origin:
- `dish_recipe`: Pre-mapped ingredient in database recipe.
- `exact_food`: Direct match to canonical food in `foods`.
- `food_alias`: Synonym or regional alias match in `food_aliases`.
- `ocr`: OCR spelling/dialect variant match.
- `ai_extracted`: Ingredient extracted dynamically from AI text or image.

---

### 5. Enriched Unknown Ingredients Format
Unmapped ingredients are preserved with diagnostic metadata:
```json
{
  "rawName": "مكون غير معروف 123",
  "normalizedName": "مكون غير معروف 123",
  "needsReview": true,
  "suggestedCanonical": null,
  "confidence": "LOW",
  "confidenceScore": 0,
  "language": "ar",
  "whyUnknown": "غير متوفر حالياً في قاعدة بيانات طيباتي",
  "status": "unknown",
  "provenance": "dish_recipe"
}
```

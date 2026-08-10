# Tayyibati Architecture Rules

This document defines the strict, non-negotiable architectural rules for the Tayyibati platform. All developers, subagents, and future implementation phases must adhere to these rules without exception.

---

## 📜 Mandatory Architectural Rules

### Rule 1: Foods Knowledge Base is the ONLY Source of Truth for Compatibility
**The `foods` table is the SINGLE, ABSOLUTE SOURCE OF TRUTH for compatibility decisions.**
- Supported Rulings: `allowed`, `forbidden`, `unknown`.
- **NO OTHER ENTITY IN THE SYSTEM** (Dishes, Recipes, Products, Brands, Restaurants, Menus, OCR Results, Camera Recognition, AI Recipes, Cached Search Results, Search Indexes) is permitted to store, calculate permanently, or override compatibility status.
- Compatibility MUST ALWAYS be calculated dynamically from canonical ingredients resolved to the `foods` table.
- See complete spec in [FOODS_SINGLE_SOURCE_OF_TRUTH.md](file:///c:/Users/r_elbes/Documents/New%20project/tayyibati/docs/FOODS_SINGLE_SOURCE_OF_TRUTH.md).

---

### Rule 2: Dynamic Decomposition of Composite Entities
**Composite entities MUST NEVER store compatibility rulings.**
- Composite entities include: dishes, sandwiches, burgers, pizzas, recipes, drinks, packaged products, and full meals.
- Every composite entity is dynamically decomposed into component ingredients at query time.

**Decomposition Pipeline:**
```
Composite Entity
       │
       ▼
Ingredient Extraction
       │
       ▼
Ingredient Resolution (to Canonical Foods)
       │
       ▼
Food Compatibility Lookup (from `foods`)
       │
       ▼
Final Dynamic Compatibility Calculation
```

---

### Rule 3: Unified Multimodal Resolution Pipeline
**Every input source must pass through the exact same resolution pipeline.**
- Input modalities: Text search, Camera recognition, Image OCR, Voice input (future), Barcode scanning (future).
- All modalities feed directly into the unified **Knowledge Resolver**.

---

### Rule 4: Strict Deterministic Resolution Hierarchy
**Ingredient & Entity Resolution MUST follow this exact priority order:**
```
1. Food Alias (Synonym, regional, dialect match)
       │
       ▼
2. Canonical Food (Exact canonical food entity match)
       │
       ▼
3. Dish Alias (Canonical dish alias match)
       │
       ▼
4. Dish (Canonical dish entity match)
       │
       ▼
5. Recipe (Component recipe ingredient match)
       │
       ▼
6. OCR Alias (OCR dialect & spelling error match)
       │
       ▼
7. AI Fallback (LAST OPTION ONLY)
```
- **Constraint:** AI MUST NEVER be called if an entity or ingredient resolves deterministically in local Knowledge Engine tables.

---

### Rule 5: Zero Hardcoded Business Logic
**No food names, dish names, aliases, rulings, or statuses may ever be hardcoded into source code.**
- Hardcoded strings such as `'دجاج'`, `'بطاطس'`, `'منسف'` are strictly prohibited in application logic.
- All entities, aliases, and rulings MUST be fetched dynamically from the database / Knowledge Engine cache.

---

### Rule 6: Preservation of Unknown Ingredients
**Unknown or unmapped ingredients MUST NEVER be discarded or silently ignored.**
- Every unresolved ingredient must be explicitly returned in the `unknownIngredients` payload.
- Required fields for unknown items:
  - `rawName`
  - `normalizedName`
  - `needsReview` (`true`)
  - `suggestedCanonical` (`string | null`)
  - `confidence` (`LOW`)
  - `language` (`ar | en`)
  - `whyUnknown` (`"غير متوفر حالياً في قاعدة بيانات طيباتي"`)

---

### Rule 7: Explainable Decision Generation
**Every compatibility decision MUST be human-readable and explainable.**
- The engine must NEVER return a bare ruling (`allowed`, `forbidden`, `conditional`) without an accompanying explanation.
- Explanations are generated directly from component ingredients (e.g., listing specific forbidden or conditional items).

---

### Rule 8: Mandatory Ingredient-Level Analysis
**Every composite entity is analyzed strictly ingredient-by-ingredient.**
- Never classify a dish directly based on pre-assumed categories.
- Never classify a sandwich or recipe as a whole entity.
- Ruling is strictly the derived outcome of evaluating every ingredient against `foods` rulings.

---

### Rule 9: Search Service Identity Isolation
**The Search Service MUST NEVER contain compatibility logic.**
- Its ONLY responsibility is to identify the canonical entity (`food`, `dish`, or `product`) with the highest confidence.
- All compatibility evaluation belongs EXCLUSIVELY to the Decision Engine.
- The Search Service returns identity metadata ONLY (`entity_type`, `canonical_id`, `canonical_name`, `confidence`, `matched_alias`, `search_method`). No compatibility payload is generated or stored during search.

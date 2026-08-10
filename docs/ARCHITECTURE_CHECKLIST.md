# Tayyibati Architecture Checklist

Every implementation phase, subagent task, and code modification MUST be audited against this checklist before sign-off.

---

## 📋 Mandatory Implementation Verification Checklist

| Status | Verification Item | Description & Constraint |
| :---: | :--- | :--- |
| [ ] | **Foods Remain Source of Truth** | Rulings exist ONLY in `foods` table. No other table or module stores compatibility status. |
| [ ] | **Composite Foods are Decomposed** | Dishes, sandwiches, burgers, pizzas, and recipes are decomposed into ingredients; never classified directly. |
| [ ] | **Compatibility Calculated from Ingredients** | Compatibility is computed dynamically from ingredient rulings at query time; never stored on dishes. |
| [ ] | **No Direct Dish Compatibility Lookup** | No database column or hardcoded logic maps a dish directly to an allowed/forbidden status. |
| [ ] | **No Hardcoded Compatibility** | No food names, dish names, aliases, or ruling strings exist as hardcoded values in source code. |
| [ ] | **Single Pipeline Used** | All modalities (Text, Camera, OCR, Barcode, Voice) execute through the 10-stage pipeline in `ANALYSIS_PIPELINE_SPEC.md`. |
| [ ] | **AI is Last Option** | AI fallback is invoked ONLY when local Knowledge Engine deterministic lookups yield no results. |
| [ ] | **Knowledge Cache Used** | In-memory cache (`knowledgeCache.ts` / `warmDishEngineCache`) is utilized for sub-millisecond lookups. |
| [ ] | **No Duplicated Ingredients** | Ingredients are deduplicated by canonical `food_id` prior to dynamic compatibility calculation. |
| [ ] | **Decision Explainable** | Human-readable Arabic and English explanations accompany every compatibility ruling. |
| [ ] | **Unknown Ingredients Preserved** | Unmapped ingredients are returned with `rawName`, `normalizedName`, `needsReview`, `confidenceScore`, `provenance`. |
| [ ] | **Existing APIs Fully Compatible** | Legacy API contracts and mobile context interfaces remain unbroken (`AnalysisReport`). |
| [ ] | **Zero DB Schema Violations** | No unauthorized schema mutations or data updates outside approved transaction scripts. |

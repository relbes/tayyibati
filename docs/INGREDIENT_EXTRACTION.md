# Ingredient Extraction Specification

**Document Version:** 1.0.0 (Phase 6.3B)  
**Status:** Permanent Architectural Governance Mandate  
**Target:** Tayyibati Intelligent Extraction Layer  

---

## Executive Summary

> [!IMPORTANT]
> **GOVERNANCE MANDATE**:  
> The **Ingredient Extraction Layer (`IngredientExtractor`)** is responsible ONLY for discovering raw ingredients from input sources.  
> It **MUST NOT** determine compatibility, query food status rulings, resolve aliases, or assign food IDs.

---

## 1. Supported Input Sources

The intelligent extractor collects raw ingredient candidates from 8 distinct input sources:
1. **Recipe Database** (Stored dish ingredient formulas)
2. **AI Dish Analysis** (LLM parsed ingredient lists)
3. **OCR Labels** (Scanned packaged product text)
4. **Camera Meal Recognition** (Vision extracted components)
5. **Manual Ingredient Lists** (User-provided ingredient arrays)
6. **Free Text Queries** (Natural language text queries)
7. **Future Barcode Ingredient Lists**
8. **Future Voice Input Transcripts**

---

## 2. Detection Confidence Matrix

Every extracted ingredient receives a deterministic `detectionConfidence` score (0–100) based on source reliability:

| Input Source | Context / Subtype | `detectionConfidence` | `wasInferred` |
| :--- | :--- | :---: | :---: |
| **Recipe Database** | Canonical stored recipe | **100** | `false` |
| **Manual Ingredient List** | Explicitly specified array | **100** | `false` |
| **Barcode Product** | Verified barcode payload | **98** | `false` |
| **OCR Label** | Direct `contains` list | **95** | `false` |
| **OCR Label** | `may_contain` / `traces` | **90 / 85** | `true` |
| **Vision Camera** | Visible primary component | **90** | `false` |
| **Vision Camera** | Hidden / uncertain component | **72** | `true` |
| **Voice Transcript** | Spoken audio transcript | **85** | `false` |
| **AI Inference** | Heuristic / LLM added ingredient | **65** | `true` |

---

## 3. Inference Flag (`wasInferred`)

- `wasInferred = false`: The ingredient was directly observed, explicitly listed, or stored in canonical recipe DB.
- `wasInferred = true`: The ingredient was added by AI, heuristic inference, or identified as a potential allergen warning (`may_contain`).

---

## 4. Context Tagging

The extractor attaches a `context` string to indicate extraction origin:
- `"contains"`: Explicit ingredients list
- `"may_contain"`: Cross-contamination allergen warning
- `"may_contain_traces"`: Trace allergen warning
- `"required"`: Mandatory recipe ingredient
- `"optional"`: Optional recipe ingredient / garnish
- `"visible"`: Vision-identified component
- `"uncertain_vision"`: Non-visible inferred vision component

---

## 5. OCR & Vision Intelligence Rules

- **OCR Noise Filtering**: Strips non-ingredient text blocks (manufacture dates, net weight, address, brand slogans, header tags).
- **Vision Confidence Split**: Assigns high confidence (`90`) and `wasInferred = false` for primary visible items; assigns lower confidence (`72`) and `wasInferred = true` for secondary implied components.

---

## 6. Extraction Lifecycle

```
    [ 1. Detected ]  ──► Captured from input modality
           │
           ▼
    [ 2. Cleaned ]   ──► Strips noise patterns, leading bullets, whitespace
           │
           ▼
    [ 3. Split ]     ──► Compound splitting ("ملح وفلفل" -> "ملح", "فلفل")
           │
           ▼
    [ 4. Normalized ]──► Basic Arabic/English string normalization
           │
           ▼
    [ 5. Ready ]     ──► Hand-off to Stage 3 Ingredient Resolver
```

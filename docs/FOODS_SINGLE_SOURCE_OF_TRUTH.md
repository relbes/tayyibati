# Foods Knowledge Base Single Source of Truth Mandate

**Document Version:** 1.0.0  
**Status:** Mandatory Permanent Project Rule  
**Target:** Entire Tayyibati Ecosystem  

---

## Executive Summary & Permanent Architectural Rule

> [!IMPORTANT]
> **PERMANENT ARCHITECTURAL RULE**:
> **The Foods Knowledge Base (`foods` table) is the ONLY source of truth for compatibility decisions.**  
> No other entity in the system is allowed to store, calculate permanently, or override compatibility status. This rule is mandatory and must NEVER be bypassed under any circumstances.

---

## 1. Single Source of Truth Definition

Only the `foods` table may store compatibility-related data, including:
- **Compatibility Status** (`allowed` | `forbidden` | `unknown`)
- **Reason** & **Evidence**
- **References** & **Scientific Notes**
- **Medical Notes**
- **Decision Metadata** & **Confidence**

No other database table or entity in the system may contain these compatibility fields.

---

## 2. Strictly Forbidden Entities

The following entities **MUST NOT** store compatibility results:
- Dishes
- Recipes
- Products
- Brands
- Restaurants & Menus
- OCR Results & Camera Recognition Results
- AI Generated Recipes
- Cached Search Results & Search Indexes

These entities may **ONLY** store descriptive and structural metadata (e.g. ingredient text, barcode, brand, image URLs).

---

## 3. Universal Decision Pipeline Flow

Every compatibility evaluation in Tayyibati MUST follow this exact pipeline:

```
                                User Input
                                    │
                                    ▼
                        Canonical Entity Resolution
                                    │
                                    ▼
                           Ingredient Resolution
                                    │
                                    ▼
                             Canonical Foods
                                    │
                                    ▼
                              Decision Engine
                                    │
                                    ▼
                            Explanation Engine
                                    │
                                    ▼
                             Final Result
```

---

## 4. Entity Conversion Rules

| Entity Input Type | Processing Flow Before Decision Engine |
| :--- | :--- |
| **Food** | Evaluate directly against canonical `foods` table. |
| **Dish** | Resolve to canonical dish $\rightarrow$ load recipe ingredients $\rightarrow$ resolve ingredients to canonical `foods` $\rightarrow$ Decision Engine. |
| **Product** | Extract ingredient text (barcode/OCR/manufacturer) $\rightarrow$ resolve ingredients to canonical `foods` $\rightarrow$ Decision Engine. |
| **Camera Meal Recognition** | Identify meal $\rightarrow$ load recipe or visible ingredients $\rightarrow$ resolve ingredients to canonical `foods` $\rightarrow$ Decision Engine. |
| **OCR Ingredient List** | Extract raw text $\rightarrow$ decompose & resolve ingredients to canonical `foods` $\rightarrow$ Decision Engine. |
| **AI Generated Recipe** | Extract ingredients $\rightarrow$ resolve ingredients to canonical `foods` $\rightarrow$ Decision Engine. |

---

## 5. Consistency Guarantee

If the compatibility status of a Food changes in the `foods` table:
- Every **Dish**, **Product**, **Recipe**, **OCR Scan**, **Camera Scan**, and **Search Query** **AUTOMATICALLY** reflects the updated decision without modifying any other table.
- **Zero duplicated compatibility data** is allowed anywhere in the project.

---

## 6. Search Service Identity Isolation Rule

> [!IMPORTANT]
> **PERMANENT SEARCH RULE**:
> **The Search Service MUST NEVER contain compatibility logic.**  
> Its ONLY responsibility is to identify the canonical entity (`food`, `dish`, or `product`) with the highest confidence. All compatibility evaluation belongs EXCLUSIVELY to the Decision Engine.  
> Search outputs identity metadata ONLY (`entity_type`, `canonical_id`, `canonical_name`, `confidence`, `matched_alias`, `search_method`). No compatibility calculation occurs inside the search pipeline.

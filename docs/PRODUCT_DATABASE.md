# Tayyibati Product Database Specification

**Document Version:** 1.0.0 (Phase 7.4)  
**Status:** Permanent Architectural Governance Mandate  
**Target:** Tayyibati Product Persistence Subsystem  

---

## Executive Summary & Non-Negotiable Rules

> [!IMPORTANT]
> **GOVERNANCE MANDATE**:  
> 1. **PRIMARY Source of Truth**: The `products` table and associated relational tables are the primary source of truth for all commercial packaged products.  
> 2. **LocalProductProvider Mandate**: `LocalProductProvider` MUST read exclusively from `ProductDatabase`. No hardcoded product arrays are permitted in code.  
> 3. **Zero Stored Rulings**: Products MUST NEVER store compatibility status or rulings. Compatibility is ALWAYS calculated dynamically from decomposed ingredient text blobs.

---

## 1. Schema & Relational Architecture

```
                    ┌─────────────────────────┐
                    │        products         │
                    ├─────────────────────────┤
                    │ id (PK)                 │
                    │ barcode (UNIQUE INDEX)  │
                    │ brand                   │
                    │ name_ar                 │
                    │ name_en                 │
                    │ ingredient_text         │
                    │ status                  │
                    │ knowledge_version       │
                    └────────────┬────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           │ 1:N                 │ 1:N                 │ 1:N
           ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ product_aliases  │  │  product_images  │  │ product_sources  │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ id (PK)          │  │ id (PK)          │  │ id (PK)          │
│ product_id (FK)  │  │ product_id (FK)  │  │ product_id (FK)  │
│ alias            │  │ front_image      │  │ provider         │
│ language         │  │ ingredients_img  │  │ confidence       │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## 2. Search Indexing Strategy

Fast lookup indexing is configured for:
- **Barcode Index:** B-Tree unique index on `barcode` for sub-millisecond lookup.
- **Brand + Name Index:** Compound normalized index on `(brand, name_ar)` for non-barcode queries.
- **Alias Index:** Hash index on `alias` in `product_aliases`.

---

## 3. Deduplication Rules

1. **Barcode Matching:** Unique matching by cleaned numeric barcode string.
2. **Brand + Name Matching:** If barcode is absent, deduplication matches `normalize(brand)` + `normalize(name_ar)`.

---

## 4. Import & Versioning Workflow

- **Supported Formats:** Batch imports from CSV, Excel, JSON, OpenFoodFacts JSON dumps, and Admin manual entries via `ProductDatabase.importBatch()`.
- **Versioning Attributes:** Every product tracks `knowledgeVersion` (`"2.1"`), `sourceProvider`, and `lastVerified`.

---

## 5. Verification Matrix

| Action | Query / Target | Index Hit | Returned Object | SLA Latency |
| :--- | :--- | :---: | :--- | :---: |
| **Barcode Search** | `629100123456` | **Barcode Index** | Nutella Hazelnut Spread | **< 0.5 ms** |
| **Brand Search** | `Ferrero` + `Nutella` | **Brand Index** | Nutella Hazelnut Spread | **< 0.5 ms** |
| **Alias Search** | `"نوتيلا"` | **Alias Index** | Nutella Hazelnut Spread | **< 0.5 ms** |
| **Product Insertion** | `New Product` | **N/A** | Inserted ID & Timestamp | **< 1.0 ms** |

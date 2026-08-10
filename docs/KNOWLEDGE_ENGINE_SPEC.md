# Knowledge Engine Specification

The Knowledge Engine is the primary, deterministic domain database of Tayyibati. It manages foods, food aliases, dishes, dish aliases, recipes, origins, and fast in-memory caching.

---

## 📊 Database Schema & Entities

### 1. `foods` (Canonical Foods)
- **Role:** The ONLY source of truth for dietary compatibility rulings.
- **Key Columns:**
  - `id`: Primary key integer.
  - `name_ar`: Canonical Arabic food name (e.g. `"الأرز"`, `"الطماطم"`).
  - `name_en`: Canonical English food name (e.g. `"rice"`, `"Tomatoes"`).
  - `category`: Food classification group.
  - `status`: Ruling status (`allowed` | `forbidden` | `conditional` | `unknown`).
  - `reason`: Primary explanation text for the ruling.
  - `is_exception`: Boolean indicator for special dietary exceptions.

---

### 2. `food_aliases` (Food Aliases & Synonyms)
- **Role:** Maps regional names, dialects, misspellings, English terms, and OCR variants to canonical foods.
- **Key Columns:**
  - `id`: Primary key integer.
  - `food_id`: Foreign key referencing `foods.id`.
  - `alias_ar`: Arabic alias string (e.g. `"بطاطا"` $\rightarrow$ ID 55 `"البطاطس"`).
  - `alias_en`: Optional English alias string.
  - `alias_type`: Categorization (`canonical` | `synonym` | `dialect` | `english` | `phonetic` | `ocr` | `misspelling` | `regional`).
  - `priority`: Rank integer (0–100, higher priority wins).

---

### 3. `dishes` (Canonical Dishes)
- **Role:** Represents structured culinary dishes across Arab and international cuisines.
- **Key Columns:**
  - `id`: Primary key integer.
  - `name_ar`: Canonical Arabic dish name (e.g. `"المنسف الأردني باللحم"`).
  - `name_en`: Canonical English dish name.
  - `category`: Dish category (`main_dish`, `appetizer`, `soup`, `dessert`, etc.).
  - **Constraint:** Contains **ZERO** compatibility status columns!

---

### 4. `dish_aliases` (Dish Aliases)
- **Role:** Maps short names, regional variations, and common terms to canonical dishes.
- **Key Columns:**
  - `id`: Primary key integer.
  - `dish_id`: Foreign key referencing `dishes.id`.
  - `alias_ar`: Arabic dish alias (e.g. `"منسف"` $\rightarrow$ ID 1 `"المنسف الأردني باللحم"`).
  - `alias_type`: (`canonical` | `synonym` | `short` | `regional`).
  - `region`: Regional provenance text.

---

### 5. `dish_ingredients` (Recipe Ingredients)
- **Role:** Connects dishes to component foods or raw ingredient text.
- **Key Columns:**
  - `id`: Primary key integer.
  - `dish_id`: Foreign key referencing `dishes.id`.
  - `food_id`: Optional foreign key referencing `foods.id` (Pre-mapped canonical food).
  - `raw_ingredient_name`: Original text string of ingredient (e.g. `"أرز مصري"`).
  - `requirement_type`: (`required` | `typical` | `optional` | `variation`).

---

### 6. `countries` & `dish_countries` (Geographic Origin)
- **Role:** Tracks countries and country-of-origin relationships for dishes.
- **Key Columns:**
  - `countries.code`: ISO country code (e.g. `"JO"`, `"SA"`, `"EG"`).
  - `countries.name_ar`: Arabic country name.
  - `dish_countries.dish_id` & `dish_countries.country_name`: Links dishes to country origins.

---

## ⚡ In-Memory Knowledge Cache (`knowledgeCache.ts`)

- **Warmup Performance:** Loads all 7 Knowledge Engine tables into fast `Map` data structures in **< 90 ms** consuming **~3.3 MB RAM**.
- **Lookup SLA:** Sub-millisecond string normalization and resolution (**< 0.05 ms** per query).
- **TTL:** 1-hour in-memory cache TTL with automatic background refresh.

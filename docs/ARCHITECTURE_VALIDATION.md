# Architecture Validation Test Specifications

This document defines the mandatory architecture validation test suite for verifying compliance of the Tayyibati analysis pipeline.

---

## 🧪 Architecture Test Cases

### TEST 1: Composite Entity Decomposition ("Pizza")
- **Input:** `"بيتزا"` / `"Pizza"`
- **Expected EntityType:** `COMPOSITE`
- **PASS Criteria:**
  - Input is identified as a composite food.
  - Component ingredients (dough, tomato sauce, cheese, toppings) are extracted.
  - Each ingredient is individually resolved to a canonical food.
- **FAIL Criteria:**
  - Pizza is classified directly with a hardcoded or stored whole-dish ruling.

---

### TEST 2: Multi-Ingredient Composite Meal ("Chicken Burger")
- **Input:** `"Chicken Burger"`
- **Expected Ingredients:** `Chicken`, `Bread`, `Tomato`, `Lettuce`, `Mayonnaise`
- **PASS Criteria:**
  - Every component ingredient is resolved independently.
  - Compatibility is computed dynamically from ingredient rulings (`Tomato` = forbidden $\rightarrow$ Burger becomes `forbidden`).
- **FAIL Criteria:**
  - Burger becomes forbidden directly without ingredient-level evaluation.

---

### TEST 3: Regional Dish ("Mansaf")
- **Input:** `"منسف"` / `"Mansaf"`
- **PASS Criteria:**
  - Dish $\rightarrow$ Recipe $\rightarrow$ Component Ingredients (`لحم`, `أرز`, `جميد`, `سمن`, `لوز`) $\rightarrow$ Compatibility Evaluation.
- **FAIL Criteria:**
  - Dish classified directly from a stored dish status field.

---

### TEST 4: Single Food Entity ("Tomato")
- **Input:** `"طماطم"` / `"Tomato"`
- **Expected EntityType:** `SINGLE_FOOD`
- **PASS Criteria:**
  - Resolved directly as single food entity (Canonical Food ID 52).
  - No ingredient extraction stage triggered.
- **FAIL Criteria:**
  - Classified as composite entity or passed to dish recipe extractor.

---

### TEST 5: Packaged Product Label Scan (OCR / Barcode)
- **Input:** Packaged Product Label / OCR Text String
- **PASS Criteria:**
  - OCR $\rightarrow$ Ingredient Extraction $\rightarrow$ Ingredient Resolution $\rightarrow$ Compatibility Engine $\rightarrow$ Decision.
- **FAIL Criteria:**
  - Whole label classified directly based on brand name or product title.

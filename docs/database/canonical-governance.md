# Tayyibati Canonical Database Governance Policy

## Architecture Freeze Notice

> [!IMPORTANT]
> **Canonical Search Database**: **FROZEN ❄️**
> **Canonical Entity Governance**: **FROZEN ❄️**
> **Search Resolution Rules**: **FROZEN ❄️**
>
> Future development should focus on:
> - User Interface & Experience (UI/UX)
> - Camera Analysis & Multimodal Features
> - AI Knowledge Extraction
> - Explanation Presentation
> - Performance & System Optimization
> - User Experience Enhancements
>
> **DO NOT** modify the Canonical Search Database schema, search resolution algorithms, or canonical entity mappings unless a verified production bug requires it.

---

## 1. Purpose of Canonical Governance

Tayyibati relies on a single-source-of-truth **Canonical Database Architecture** to evaluate food safety, ingredient compliance, and nutritional rules under the Tayyibati dietary framework.

### Key Principles
1. **Search Aliases vs. Canonical Entities**:
   - Aliases (`food_aliases`) exist **exclusively for search matching and text resolution**. They are not business objects.
   - Every user query, search term, or AI extracted ingredient must resolve to **exactly one Canonical Entity** (`foods`).
2. **Canonical Entity Primacy**:
   - A Canonical Entity is the **ONLY entity that represents a food concept** in the business domain.
   - All rules, restrictions, status decisions (`allowed`, `forbidden`, `conditional`), and explanation models operate **strictly on Canonical IDs**.
   - No engine, view model, or UI component may evaluate business rules directly on raw strings or alias records.

---

## 2. Canonical Entity Rules

1. **Uniqueness**: Each food concept is represented by a single Canonical Entity in the `foods` table.
2. **Single Resolution Target**: All variations, regional dialects, spelling typos, and brand synonyms must resolve to that entity's `id`.
3. **Domain Decoupling**: Business logic (Decision Engine, Meal Decision Engine, Explanation Framework) receives only Canonical IDs.
4. **Immutability of Rules**: Aliases may expand over time as users search differently, but Canonical Entity IDs remain stable.

---

## 3. Official Rice Governance Policy

### Official Canonical Rice Entity
- **Canonical ID**: `896`
- **Arabic Name (`nameAr`)**: `الأرز بجميع أشكاله (مصري، بسمتي، تايلندي، أبيض، بني)`
- **English Name (`nameEn`)**: `Rice (Egyptian/Basmati/Thai/White/Brown)`
- **Status**: `allowed`
- **Category**: `Grains & Starches`

### Scope & Inclusions
Food ID 896 represents **all forms of culinary rice**, including but not limited to:
- White Rice (`أرز أبيض` / `رز أبيض`)
- Brown Rice (`أرز بني` / `رز بني`)
- Egyptian Rice (`أرز مصري` / `رز مصري`)
- Basmati Rice (`أرز بسمتي` / `رز بسمتي` / `أرز البسمتي` / `الأرز البسمتي`)
- Thai Jasmine Rice (`أرز تايلندي` / `رز تايلندي`)
- Mixed rice dishes (e.g., Rice with vermicelli, Kabsa rice, Mandi rice)

---

## 4. Legacy & Deprecated Rice Entities

To preserve database foreign key integrity without breaking existing records, historical rice rows are governed as follows:

| Entity ID | Arabic Name | Governance Status | Governance Reason & Policy |
|---|---|---|---|
| **40** | `الأرز` | **`Legacy`** | Referenced by 17 historical `dish_ingredients` rows. **MUST NOT** be used as a search resolution target or canonical entity. |
| **609** | `الأرز البسمتي / الأبيض` | **`Deprecated`** | Superseded by Canonical Entity 896. **MUST NOT** receive new aliases or be treated as canonical. |

---

## 5. Permanent System Rules

### Rule 1: Single Target for New Rice Aliases
Any newly discovered rice variant, regional term, or user misspelling **must point exclusively to Food ID 896**.

### Rule 2: No Duplicate Rice Entities
No new canonical rice entity may be created in the `foods` table unless a major architectural redesign occurs.

### Rule 3: Alias Expansion Safety
Aliases may be added safely via official idempotent migrations in `@workspace/db`. Canonical IDs must remain static.

### Rule 4: Mandatory Search Pre-Resolution
The `SearchEngine` / `CanonicalSearchEngine` **must always** resolve user input to a canonical ID before any Business Logic or Decision Engine executes.

### Rule 5: Decision Engine Protection
The `DecisionEngine` and `MealDecisionEngine` **must never** evaluate raw aliases or user strings directly. They evaluate only Canonical Entities (`Food ID`).

### Rule 6: AI Output Normalization
All structured text output from the AI Extractor or Multimodal Provider **must pass through Canonical Resolution** before business rule evaluation.

---

## 6. Developer Guidelines for Future Maintenance

### Before Adding New Aliases
1. Perform a database lookup to find the active Canonical Entity ID.
2. Verify that the alias does not already exist in `food_aliases`.
3. Never create parallel canonical entities for existing concepts.

### Before Creating New Foods in the Database
1. Search existing canonical foods in `foods` and `food_aliases`.
2. Reuse existing canonical entities whenever the food concept overlaps.
3. Only add a new canonical row if the item is a genuinely distinct ingredient.

### Before Changing Canonical Mappings
1. Perform a full reference audit across `food_aliases`, `dish_ingredients`, and `products`.
2. Verify foreign key constraints before updating or re-linking IDs.
3. Execute the full search regression test suite.
4. Update this documentation file (`docs/database/canonical-governance.md`).

---

## 7. Architecture Flow Diagram

```
                 ┌──────────────────────────┐
                 │        User Input        │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │       Search Terms       │
                 │      & Food Aliases      │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │  CanonicalSearchEngine   │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │     Canonical Entity     │
                 │       (Food ID 896)      │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │     Decision Engine      │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │   Meal Decision Engine   │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │  Explanation Framework   │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │  Mobile Presentation UI  │
                 └──────────────────────────┘
```

---

## 8. Official Architecture Freeze Sign-Off

```
=========================================================================
OFFICIAL TAYYIBATI SEARCH ARCHITECTURE FREEZE SIGN-OFF
=========================================================================
Canonical Search Database:   FROZEN ❄️
Canonical Entity Governance: FROZEN ❄️
Search Resolution Rules:     FROZEN ❄️
=========================================================================
```

**Final Directive**:
Future engineering efforts must focus strictly on higher-level presentation, mobile UX refinements, multimodal AI analysis, and Phase 12 capabilities. The backend Canonical Search Database is locked as the Single Source of Truth for the application.

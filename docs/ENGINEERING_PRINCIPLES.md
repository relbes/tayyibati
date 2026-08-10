# Tayyibati Engineering Principles

This document defines the core engineering philosophy and architectural principles governing software development across all components of Tayyibati.

---

## 🏛️ Core Principles

### 1. Knowledge Before AI
- Deterministic data inside the Knowledge Engine always supersedes AI models.
- AI is an enhancement tool for unknown entities and unstructured inputs — NEVER a replacement for curated, structured domain knowledge.

---

### 2. Explainability & Transparency
- Every user-facing ruling must clearly communicate **WHY** a specific decision was reached.
- Explanations break down composite meals into allowed, forbidden, conditional, and unknown components.

---

### 3. Deterministic & Repeatable Results
- Identical queries under the same data state must produce 100% identical outputs.
- Stored Knowledge Engine lookups bypass non-deterministic LLM generations.

---

### 4. No Duplicated Logic (DRY Architecture)
- Common resolution, normalization, and evaluation logic must exist in single, shared modules (`knowledgeCache.ts`, `dishCompatibilityEngine.ts`).
- Router handlers and UI components must consume engine outputs rather than re-implementing matching logic.

---

### 5. No Hidden Business Rules
- All classification rules, compatibility logic, and entity priorities must be explicit, documented, and fully inspectable.
- Silent fallback fallacies, swallowed exceptions, or arbitrary hardcoded conditions are prohibited.

---

### 6. Single Source of Truth
- `foods` table is the sole authoritative store for dietary compatibility rulings.
- No parallel tables or frontend states may duplicate food rulings.

---

### 7. Cache First Architecture
- In-memory lookups (`getKnowledgeCache`, `warmDishEngineCache`) provide sub-millisecond query performance (< 1 ms).
- Database disk reads and network roundtrips are minimized through warm in-memory data structures.

---

### 8. AI Last (Final Fallback Only)
- AI calls are invoked ONLY when local deterministic lookups (canonical foods, food aliases, dish aliases, recipe ingredients) yield unresolvable results.
- Unnecessary LLM calls waste latency and compute; they must be prevented at the gateway layer.

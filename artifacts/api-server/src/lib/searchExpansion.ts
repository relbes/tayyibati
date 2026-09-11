/**
 * Tayyibati Search Expansion Layer & Synonym Cache Manager
 *
 * Expands input queries into canonical variants & synonyms before index lookups.
 * Pre-loads synonyms from DB/config and caches variant generation in memory.
 */

import { normalize, stripArticle } from "./arabicNormalization";

export interface SearchSynonymRecord {
  id: number;
  term: string;
  synonym: string;
  language?: string;
  priority?: number;
  active?: boolean;
}

// In-Memory Expansion Cache
const EXPANSION_CACHE = new Map<string, string[]>();

// In-Memory Synonym Dictionary Map (Normalized Term -> Normalized Synonym[])
const SYNONYM_DICTIONARY = new Map<string, string[]>();

// Static Baseline Food Synonyms Dictionary
const BASELINE_SYNONYMS: Record<string, string[]> = {
  مانجا: ["مانجو", "المانجو"],
  المانجا: ["مانجو", "المانجو"],
  مانجو: ["المانجو"],
  المانجو: ["مانجو"],
  بطاطا: ["بطاطس", "البطاطس"],
  روب: ["لبن", "اللبن", "زبادي"],
  جوانح: ["أجنحة دجاج", "اجنحة دجاج"],
  كاتشب: ["صلصة طماطم", "كاتشاب"],
  تمر: ["التمر"],
  التمر: ["تمر"],
  ضأن: ["ضان", "لحم ضأن", "لحم ضان"],
  ضان: ["ضأن", "لحم ضأن", "لحم ضان"],
  شاورمه: ["شاورما", "الشاورما"],
  كبسه: ["كبسة", "الكبسة"],
};

/**
 * Curated regional / dialectal food name synonyms.
 *
 * Rules:
 *  - Only include mappings that are genuine, unambiguous lexical equivalents
 *    in their respective dialect (i.e. same referent, different regional name).
 *  - Do NOT include speculative, context-dependent, or multi-meaning mappings.
 *  - Do NOT add: خروف→لحم الضاني, قرع→كوسة, جريش→قمح, برغل→قمح, عجل→كندوز, etc.
 *  - Each entry: key = normalized dialect term, value = normalized canonical equivalent.
 *
 * Match type produced in canonical search: treated as SYNONYM (confidence ~90%).
 * Ranking: above FUZZY/TYPO, below exact canonical/alias.
 */
export const DIALECT_REGIONAL_SYNONYMS: Record<string, string> = {
  // ─── Vegetables / Legumes ───────────────────────────────────────────────
  // Egyptian: بسلة = green peas (بازيلاء, Food 1604) — unambiguous, uncontested
  بسلة: "بازيلاء",
  // Common written form: بازلا (hamza dropped, ends in لا not لاء, so orthographic rule لاء↔يلاء doesn't fire)
  بازلا: "بازيلاء",
  // Levantine/Gulf: باميه = okra (بامية, Food 1392) — same word, different ه/ة spelling convention
  باميه: "بامية",
  // Gulf: حبحب = watermelon (بطيخ, Food 1497) — unambiguous Gulf dialect, single referent
  حبحب: "بطيخ",
  // Levantine: بندورة = tomato (طماطم, Food 1510) — unambiguous Levantine dialect, also in DB synonyms
  بندورة: "طماطم",
  // ─── Meat / Protein ─────────────────────────────────────────────────────
  // Egyptian: فراخ = chicken (دجاج, Food 1410) — unambiguous, فراخ even appears in Food 1410 name
  فراخ: "دجاج",
  // Egyptian: فرخة = chicken singular (دجاج) — same referent as فراخ, no DB conflict
  فرخة: "دجاج",

  // ─── REMOVED after audit ─────────────────────────────────────────────────
  // طرشي → مخلل  REMOVED: مخلل resolves to 2 foods (ID:1326, ID:1599); no single canonical target
  // كرنب → ملفوف REMOVED: كرنب appears in DB as "ورق الكرنب" (ID:1491, 1585); global mapping conflicts
  // عيش  → خبز   REMOVED: خبز resolves to 10 different bread foods; ambiguous resolution
  // رغيف → خبز   REMOVED: رغيف is a specific bread form (loaf), not a synonym for خبز in general
  // حمصية→ حمص   REMOVED: حمصية typically refers to a prepared dish (hummus stew), not the raw ingredient
  // حوت  → سمك   REMOVED: حوت = whale in MSA; its Gulf use as "fish" is ambiguous and regional
};

import { db, searchSynonyms } from "@workspace/db";

/**
 * Loads DB-driven synonyms directly from PostgreSQL `search_synonyms` table into memory.
 */
export async function loadDbSynonyms(): Promise<void> {
  try {
    const rows = await db.select().from(searchSynonyms);
    for (const r of rows) {
      const normTerm = normalize(r.term);
      const normTarget = normalize(r.targetTerm);
      if (!normTerm || !normTarget) continue;

      const existing = SYNONYM_DICTIONARY.get(normTerm) || [];
      if (!existing.includes(normTarget)) {
        existing.push(normTarget);
      }
      SYNONYM_DICTIONARY.set(normTerm, existing);
    }
  } catch (err) {
    console.error("[SYNONYMS] Failed to load search_synonyms from DB:", err);
  }
}

/**
 * Initialize / Precompute Synonym Dictionary in memory.
 * Loads BASELINE_SYNONYMS first, then DIALECT_REGIONAL_SYNONYMS, then custom synonyms.
 */
export function initializeSynonymDictionary(customSynonyms?: SearchSynonymRecord[]): void {
  SYNONYM_DICTIONARY.clear();
  EXPANSION_CACHE.clear();

  // Load baseline synonyms
  for (const [term, synonyms] of Object.entries(BASELINE_SYNONYMS)) {
    const normTerm = normalize(term);
    const normSyns = synonyms.map((s) => normalize(s));
    SYNONYM_DICTIONARY.set(normTerm, normSyns);
  }

  // Load dialect/regional synonyms — curated single-target mappings
  for (const [dialectTerm, canonicalTarget] of Object.entries(DIALECT_REGIONAL_SYNONYMS)) {
    const normTerm = normalize(dialectTerm);
    const normTarget = normalize(canonicalTarget);
    if (!normTerm || !normTarget) continue;
    const existing = SYNONYM_DICTIONARY.get(normTerm) || [];
    if (!existing.includes(normTarget)) {
      existing.push(normTarget);
    }
    SYNONYM_DICTIONARY.set(normTerm, existing);
  }

  // Load dynamic custom synonyms if provided
  if (customSynonyms && Array.isArray(customSynonyms)) {
    for (const record of customSynonyms) {
      if (record.active === false) continue;
      const normTerm = normalize(record.term);
      const normSyn = normalize(record.synonym);
      if (!normTerm || !normSyn) continue;

      const existing = SYNONYM_DICTIONARY.get(normTerm) || [];
      if (!existing.includes(normSyn)) {
        existing.push(normSyn);
      }
      SYNONYM_DICTIONARY.set(normTerm, existing);
    }
  }
}

/**
 * Generate all deterministic search variants for a query (cached O(1) lookup after first run).
 *
 * The returned array includes:
 *  1. The normalized query and article variants (ال/أ/ا prefix).
 *  2. Systematic Arabic orthographic variants (يلاء/لاء, ولياء/وليا, يا/ية).
 *  3. Synonym-expanded targets from SYNONYM_DICTIONARY (baseline + dialect).
 *     For multi-word queries, each token is checked individually against the dictionary.
 */
export function expandSearchQuery(query: string): string[] {
  const normQ = normalize(query);
  if (!normQ) return [];

  if (EXPANSION_CACHE.has(normQ)) {
    return EXPANSION_CACHE.get(normQ)!;
  }

  const variants = new Set<string>();
  const strippedQ = stripArticle(normQ);

  variants.add(normQ);
  if (strippedQ && strippedQ !== normQ) {
    variants.add(strippedQ);
    variants.add(`ال${strippedQ}`);
  }

  // Initial Alef variation expansion (e.g. "رز" <-> "ارز" <-> "أرز" <-> "الأرز")
  if (normQ.startsWith("ا") || normQ.startsWith("أ") || normQ.startsWith("إ") || normQ.startsWith("آ")) {
    const withoutAlef = normQ.replace(/^[اأإآ]/, "");
    if (withoutAlef.length >= 2) {
      variants.add(withoutAlef);
      variants.add(`ال${withoutAlef}`);
      variants.add(`الأ${withoutAlef}`);
    }
  } else if (!normQ.startsWith("ال") && normQ.length >= 2) {
    variants.add(`ا${normQ}`);
    variants.add(`أ${normQ}`);
    variants.add(`ال${normQ}`);
    variants.add(`الأ${normQ}`);
  }

  // Systematic Arabic Orthographic Variation (e.g. "بازلاء" <-> "بازيلاء", "فاصوليا" <-> "فاصولياء", "باميا" <-> "بامية")
  // Process current variants to produce orthographic equivalents
  const currentVariants = Array.from(variants);
  for (const v of currentVariants) {
    // 1. "يلاء" <-> "لاء" (e.g. بازيلاء <-> بازلاء)
    if (v.includes("يلاء")) {
      variants.add(v.replace(/يلاء/g, "لاء"));
    }
    if (v.includes("لاء")) {
      variants.add(v.replace(/لاء/g, "يلاء"));
    }
    // 2. "ولياء" <-> "وليا" (e.g. فاصولياء <-> فاصوليا)
    if (v.includes("ولياء")) {
      variants.add(v.replace(/ولياء/g, "وليا"));
    }
    if (v.includes("وليا")) {
      variants.add(v.replace(/وليا/g, "ولياء"));
    }
    // 3. Word-ending "يا" <-> "يه" / "ية" (e.g. باميا <-> بامية/باميه, كستنا <-> كستناء/كستنة)
    if (v.endsWith("يا") && v.length >= 4) {
      variants.add(v.slice(0, -2) + "يه");
      variants.add(v.slice(0, -2) + "ية");
    } else if ((v.endsWith("يه") || v.endsWith("ية")) && v.length >= 4) {
      variants.add(v.slice(0, -2) + "يا");
    }
  }

  // ── Synonym Dictionary Expansion ──────────────────────────────────────────
  // Check the full normalized query AND each whitespace token individually.
  // This ensures dialect multi-word queries like "بسلة مسلوقة" expand correctly.
  const queryTokens = [normQ, strippedQ, ...normQ.split(/\s+/)].filter(Boolean);
  for (const token of queryTokens) {
    const synonymTargets = SYNONYM_DICTIONARY.get(token);
    if (synonymTargets) {
      for (const target of synonymTargets) {
        if (target && !variants.has(target)) {
          // Add the synonym target and its orthographic variants
          variants.add(target);
          const strippedTarget = stripArticle(target);
          if (strippedTarget && strippedTarget !== target) {
            variants.add(strippedTarget);
            variants.add(`ال${strippedTarget}`);
          }
        }
      }
    }
  }

  const result = Array.from(variants);
  EXPANSION_CACHE.set(normQ, result);
  return result;
}

/**
 * Generate smart "Did You Mean" suggestions for unmapped queries using expansion variants.
 */
export function generateSmartSuggestions(query: string, candidatePool?: string[]): string[] {
  const expanded = expandSearchQuery(query);
  const suggestions = new Set<string>();

  for (const variant of expanded) {
    if (variant !== normalize(query)) {
      suggestions.add(variant);
    }
  }

  if (candidatePool && candidatePool.length > 0) {
    const qNorm = normalize(query);
    for (const cand of candidatePool) {
      const cNorm = normalize(cand);
      if (cNorm.startsWith(qNorm) || qNorm.startsWith(cNorm)) {
        suggestions.add(cand);
      }
    }
  }

  return Array.from(suggestions).slice(0, 5);
}

/**
 * Returns the set of normalized synonym-target variants for a query.
 *
 * Used by CanonicalSearchEngine to determine whether a Tier 2/3 match was made via
 * a synonym expansion (baseline or dialect), so it can assign matchType = "SYNONYM"
 * instead of "EXACT" or "ALIAS".
 *
 * Only covers synonym-derived targets — does NOT include pure orthographic variants
 * (alef normalization, يلاء/لاء, etc.), which remain EXACT.
 */
export function getQuerySynonymTargets(query: string): Set<string> {
  const normQ = normalize(query);
  const strippedQ = stripArticle(normQ);
  const targets = new Set<string>();

  const checkTokens = [normQ, strippedQ, ...normQ.split(/\s+/).filter(Boolean)];
  for (const token of checkTokens) {
    const synonymTargets = SYNONYM_DICTIONARY.get(token);
    if (synonymTargets) {
      for (const target of synonymTargets) {
        if (target) {
          targets.add(target);
          const strippedTarget = stripArticle(target);
          if (strippedTarget) targets.add(strippedTarget);
        }
      }
    }
  }
  return targets;
}

// Auto-initialize baseline synonyms on module load
initializeSynonymDictionary();

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

  // Check synonym dictionary
  const directSynonyms = SYNONYM_DICTIONARY.get(normQ) || SYNONYM_DICTIONARY.get(strippedQ) || [];
  for (const syn of directSynonyms) {
    variants.add(syn);
    const strippedSyn = stripArticle(syn);
    if (strippedSyn) {
      variants.add(strippedSyn);
      variants.add(`ال${strippedSyn}`);
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

// Auto-initialize baseline synonyms on module load
initializeSynonymDictionary();

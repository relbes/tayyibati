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
  تمر: ["التمر", "بلح", "رطب"],
  التمر: ["تمر", "بلح", "رطب"],
  بلح: ["تمر", "التمر", "رطب"],
  البلح: ["تمر", "التمر", "رطب"],
  معكرون: ["معكرونة", "المعكرونة", "مكرونة", "المكرونة", "باستا"],
  المعكرون: ["معكرونة", "المعكرونة", "مكرونة", "المكرونة", "باستا"],
  ضأن: ["ضان", "لحم ضأن", "لحم ضان"],
  ضان: ["ضأن", "لحم ضأن", "لحم ضان"],
  شاورمه: ["شاورما", "الشاورما"],
  كبسه: ["كبسة", "الكبسة"],
  رز: ["أرز", "الأرز", "ارز"],
  // Common Arabic orthographic variant of بيتزا (pizza): dropping the ي is a recognised alternate spelling
  بتزا: ["بيتزا", "البيتزا"],
  // Colloquial/childspeak alternate for طماطم (tomato) widely used across Arabic dialects
  طمطم: ["طماطم", "الطماطم"],
  // Biscuit, Cookie & Digestive synonyms (Food 1447 is "بسكوت", Food 1453 is "بسكوت شوفان", Food 1454 is "بسكوت دايجستف")
  بسكويت: ["بسكوت", "البسكوت", "البسكويت"],
  البسكويت: ["بسكوت", "البسكوت", "بسكويت"],
  بسكوت: ["بسكويت", "البسكوت", "البسكويت"],
  البسكوت: ["بسكوت", "بسكويت", "البسكويت"],
  بسكويتة: ["بسكوت", "بسكويت", "بسكوتة"],
  بسكوتة: ["بسكوت", "بسكويت", "بسكويتة"],
  دايجستيف: ["دايجستف", "الدايجستف"],
  الدايجستيف: ["دايجستف", "الدايجستف"],
  دايجستف: ["دايجستيف", "الدايجستيف"],
  "بسكوت دايجستيف": ["بسكوت دايجستف", "بسكويت دايجستف"],
  "بسكويت دايجستف": ["بسكوت دايجستف", "بسكوت دايجستيف"],
  "بسكويت دايجستيف": ["بسكوت دايجستف", "بسكوت دايجستيف"],
  "بسكويت شوفان": ["بسكوت شوفان"],
  "بسكويت الشوفان": ["بسكوت شوفان"],
  "بسكوت الشوفان": ["بسكوت شوفان"],
  // Black tea canonical synonyms (Food 1471 is "شاي أحمر (أسود)")
  "شاي اسود": ["شاي أحمر", "شاي أحمر (أسود)"],
  "شاي أسود": ["شاي أحمر", "شاي أحمر (أسود)"],
  "الشاي الاسود": ["شاي أحمر", "شاي أحمر (أسود)"],
  "الشاي الأسود": ["شاي أحمر", "شاي أحمر (أسود)"],
  // Orange & Citrus Juice synonyms (mapping to Food 1499 & Food 1677, decoupled from whole raw fruit)
  "عصير برتقال": ["عصير البرتقال", "orange juice"],
  "عصير البرتقال": ["عصير برتقال", "orange juice"],
  "orange juice": ["عصير برتقال", "عصير البرتقال"],
  "عصير ليمون": ["عصير الليمون", "lemon juice"],
  "عصير الليمون": ["عصير ليمون", "lemon juice"],
  "lemon juice": ["عصير ليمون", "عصير الليمون"],
  "عصير يوسفي": ["عصير مندلينا", "عصير كلمنتينا"],
  "عصير مندلينا": ["عصير يوسفي", "عصير كلمنتينا"],
  "عصير تفاح": ["عصير التفاح", "apple juice"],
  "عصير التفاح": ["عصير تفاح", "apple juice"],
  "apple juice": ["عصير تفاح", "عصير التفاح"],
  "خل تفاح": ["خل التفاح", "apple cider vinegar", "apple vinegar"],
  "خل التفاح": ["خل تفاح", "apple cider vinegar", "apple vinegar"],
  "apple vinegar": ["خل تفاح", "خل التفاح", "apple cider vinegar"],
  "apple cider vinegar": ["خل تفاح", "خل التفاح", "apple vinegar"],
  "عصير رمان": ["عصير رمان طبيعي", "عصير الرمان", "pomegranate juice"],
  "عصير الرمان": ["عصير رمان طبيعي", "عصير رمان", "pomegranate juice"],
  "عصير عنب": ["عصير عنب طبيعي", "عصير العنب", "grape juice"],
  "عصير العنب": ["عصير عنب طبيعي", "عصير عنب", "grape juice"],
  "عصير فراولة": ["عصير الفراولة", "strawberry juice"],
  "عصير الفراولة": ["عصير فراولة", "strawberry juice"],
  "عصير مانجو": ["عصير المانجو، المنجا", "عصير المانجو", "عصير مانجا"],
  "عصير مانجا": ["عصير المانجو، المنجا", "عصير المانجو", "عصير مانجو"],
  "عصير المنجا": ["عصير المانجو، المنجا", "عصير المانجو", "عصير مانجو"],
  "عصير قصب": ["عصير القصب", "قصب السكر"],
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
  // ─── Grains / Staples ───────────────────────────────────────────────────
  // Common colloquial / dialect form: رز = rice (أرز, Food 1364)
  رز: "أرز",

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
  // Gulf/Informal: طماط = tomato (طماطم, Food 1510) — common truncation / dialect form
  طماط: "طماطم",
  // ─── Meat / Protein ─────────────────────────────────────────────────────
  // Egyptian: فراخ = chicken (دجاج, Food 1410) — unambiguous, فراخ even appears in Food 1410 name
  فراخ: "دجاج",
  // Egyptian: فرخة = chicken singular (دجاج) — same referent as فراخ, no DB conflict
  فرخة: "دجاج",
  // Gulf: برقر = burger (برجر, Food 1404) — widely used phonetic spelling in Gulf & Saudi Arabia
  برقر: "برجر",
  // Citrus / Tangerine regional synonyms
  مندلينا: "يوسفي",
  كلمنتينا: "يوسفي",
  // Modern Standard Arabic <-> Popular dialect biscuit equivalence (Food 1447 is "بسكوت")
  بسكويت: "بسكوت",
  بسكويتة: "بسكوت",
  بسكوتة: "بسكوت",
  دايجستيف: "دايجستف",

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
    variants.add(`ال${normQ}`);
    if (normQ === "رز" || strippedQ === "رز") {
      variants.add("ارز");
      variants.add("أرز");
      variants.add("الأرز");
    }
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
    // 4. "كوت" <-> "كويت" (e.g. بسكوت <-> بسكويت, بسكوتة <-> بسكويتة)
    if (v.includes("كويت")) {
      variants.add(v.replace(/كويت/g, "كوت"));
    }
    if (v.includes("كوت")) {
      variants.add(v.replace(/كوت/g, "كويت"));
    }
    // 5. "ستيف" <-> "ستف" (e.g. دايجستيف <-> دايجستف)
    if (v.includes("ستيف")) {
      variants.add(v.replace(/ستيف/g, "ستف"));
    }
    if (v.includes("ستف")) {
      variants.add(v.replace(/ستف/g, "ستيف"));
    }
  }

  // ── Synonym Dictionary Expansion ──────────────────────────────────────────
  // Check the full normalized query (and stripped article).
  const checkFullTokens = [normQ, strippedQ].filter(Boolean);
  const words = normQ.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    checkFullTokens.push(...words);
  }

  for (const token of checkFullTokens) {
    const synonymTargets = SYNONYM_DICTIONARY.get(token);
    if (synonymTargets) {
      for (const target of synonymTargets) {
        if (target && !variants.has(target)) {
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

  // For multi-word queries, substitute tokens within the phrase (e.g. "طماطم شيري" -> "بندورة شيري")
  if (words.length > 1) {
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const wTargets = SYNONYM_DICTIONARY.get(w) || SYNONYM_DICTIONARY.get(stripArticle(w));
      if (wTargets) {
        for (const wt of wTargets) {
          const replacedWords = [...words];
          replacedWords[i] = wt;
          const phrase = replacedWords.join(" ");
          if (!variants.has(phrase)) {
            variants.add(phrase);
            const strippedPhrase = stripArticle(phrase);
            if (strippedPhrase && strippedPhrase !== phrase) {
              variants.add(strippedPhrase);
            }
          }
        }
      }
    }
  }

  // ── Arabic Typo-Tolerance: Repeated Character Deduplication ──────────────
  // Common Arabic typing error: doubling a letter (خييار → خيار, جززر → جزر, etc.).
  // Generate a "deduplicated" variant by collapsing all consecutive repeated characters.
  // This is strictly generic — no entity-specific hardcoding.
  const deduped = normQ.replace(/(.)\1+/gu, "$1");
  if (deduped && deduped !== normQ && deduped.length >= 2) {
    variants.add(deduped);
    const strippedDeduped = stripArticle(deduped);
    if (strippedDeduped && strippedDeduped !== deduped) {
      variants.add(strippedDeduped);
      variants.add(`ال${strippedDeduped}`);
    }
  }
  // Also try deduplication on the stripped form (in case article was already stripped)
  if (strippedQ) {
    const dedupedStripped = strippedQ.replace(/(.)\1+/gu, "$1");
    if (dedupedStripped && dedupedStripped !== strippedQ && dedupedStripped.length >= 2) {
      variants.add(dedupedStripped);
      variants.add(`ال${dedupedStripped}`);
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

  const checkTokens = [normQ, strippedQ].filter(Boolean);
  const words = normQ.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    checkTokens.push(...words);
  }

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

  if (words.length > 1) {
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const wTargets = SYNONYM_DICTIONARY.get(w) || SYNONYM_DICTIONARY.get(stripArticle(w));
      if (wTargets) {
        for (const wt of wTargets) {
          const replacedWords = [...words];
          replacedWords[i] = wt;
          const phrase = replacedWords.join(" ");
          targets.add(phrase);
          const strippedPhrase = stripArticle(phrase);
          if (strippedPhrase) targets.add(strippedPhrase);
        }
      }
    }
  }

  // Also include orthographic variations in synonym targets
  const currentTargets = Array.from(targets);
  for (const t of currentTargets) {
    if (t.includes("كويت")) targets.add(t.replace(/كويت/g, "كوت"));
    if (t.includes("كوت")) targets.add(t.replace(/كوت/g, "كويت"));
    if (t.includes("ستيف")) targets.add(t.replace(/ستيف/g, "ستف"));
    if (t.includes("ستف")) targets.add(t.replace(/ستف/g, "ستيف"));
  }
  if (normQ.includes("كويت")) targets.add(normQ.replace(/كويت/g, "كوت"));
  if (normQ.includes("كوت")) targets.add(normQ.replace(/كوت/g, "كويت"));
  if (normQ.includes("ستيف")) targets.add(normQ.replace(/ستيف/g, "ستف"));
  if (normQ.includes("ستف")) targets.add(normQ.replace(/ستف/g, "ستيف"));

  return targets;
}

// Auto-initialize baseline synonyms on module load
initializeSynonymDictionary();

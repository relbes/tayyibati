/**
 * Tayyibati Redesigned Production Canonical Search Engine (Phase 2)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/KNOWLEDGE_ENGINE_SPEC.md
 * - See docs/ARCHITECTURE_RULES.md (Rule 9: Search Service Identity Isolation)
 * - See docs/ENGINEERING_PRINCIPLES.md (Zero Compatibility In Search, Search Diagnostic Mode)
 *
 * MANDATE:
 * - Serves ALL search input modalities (TEXT, AUTOCOMPLETE, CAMERA, OCR, BARCODE) deterministically.
 * - Single Source of Truth Arabic Normalization via arabicNormalization.ts.
 * - Search Expansion Layer & Synonym Cache via searchExpansion.ts.
 * - O(1) Precomputed Memory Hash Map & Prefix Indexes.
 * - Candidate-Bounded Fuzzy Search (never full table scans).
 * - Zero AI code inside search engine.
 */

import { getKnowledgeCache } from "./knowledgeCache";
import { warmDishEngineCache } from "./dishCompatibilityEngine";
import { ProductDatabase } from "./productDatabase";
import {
  normalize,
  stripArticle,
  extractBaseEntity,
  isMeaningfulQuery,
  extractBaseEntityWithModifiers,
  ARABIC_STOP_WORDS,
  CULINARY_DESCRIPTORS,
  GENERIC_DESCRIPTORS,
  PREPARATION_DESCRIPTORS,
  PROTEIN_DESCRIPTORS,
  formatAmbiguityQuestion,
  hasRecognizedDescriptor,
} from "./arabicNormalization";
import { expandSearchQuery, generateSmartSuggestions, loadDbSynonyms, getQuerySynonymTargets } from "./searchExpansion";

export type EntityType = "food" | "dish" | "product";

export enum SearchMode {
  TEXT = "TEXT",
  AUTOCOMPLETE = "AUTOCOMPLETE",
  CAMERA = "CAMERA",
  OCR = "OCR",
  BARCODE = "BARCODE",
  PRODUCT = "PRODUCT",
  INGREDIENT = "INGREDIENT"
}

export enum SearchRankingProfile {
  TEXT = "TEXT",
  AUTOCOMPLETE = "AUTOCOMPLETE",
  CAMERA = "CAMERA",
  OCR = "OCR",
  BARCODE = "BARCODE",
  AI = "AI",
  INGREDIENT = "INGREDIENT"
}

export type SearchMethod =
  | "exact_alias"
  | "exact_canonical"
  | "base_entity_resolution"
  | "dish_alias"
  | "food_alias"
  | "protein_resolver"
  | "starts_with"
  | "contains"
  | "token_similarity"
  | "fuzzy"
  | "barcode_match"
  | "ocr_fallback"
  | "ai_fallback";

export interface SearchDiagnostics {
  originalQuery: string;
  normalizedQuery: string;
  expandedVariants: string[];
  searchedIndexes: string[];
  foodAliasMatches: number;
  foodAliasDetails: string[];
  foodMatches: number;
  foodDetails: string[];
  dishAliasMatches: number;
  dishAliasDetails: string[];
  dishMatches: number;
  dishDetails: string[];
  productMatches: number;
  productDetails: string[];
  selectedEntity: EntityType;
  canonicalId: number | string;
  canonicalName: string;
  confidence: number;
  searchMethod: SearchMethod;
  executionTimeMs: number;
  engineVersion: string;
}

export type MatchType = "EXACT" | "ALIAS" | "SYNONYM" | "PREFIX" | "BASE_ENTITY" | "PARENT_ENTITY" | "FUZZY" | "AI" | "RECIPE_INFERRED" | "VARIANT" | "UNKNOWN" | "NOT_FOUND" | "AMBIGUOUS";

export type SearchOutcome = "FOUND" | "AMBIGUOUS" | "NOT_FOUND";

export interface SearchResult {
  searchOutcome?: SearchOutcome;
  canonicalId?: number | string;
  canonicalEntityType?: EntityType;
  canonicalName?: string;
  searchConfidence?: number; // 0 to 100 percentage
  matchType?: MatchType;
  matchedReason?: string;
  matchedAlias?: string | null;
  modifiers?: string[]; // Preserved generic descriptors (e.g. ["بني"], ["أسمر"])
  didYouMean?: string[];
  isAmbiguous?: boolean;
  candidateDishes?: SearchResult[];
  candidateFoods?: SearchResult[];
  questionAr?: string;
  diagnostics?: SearchDiagnostics;

  // Backward compatibility fields
  entity_type?: EntityType;
  canonical_id?: number | string;
  canonical_name?: string;
  confidence?: number;
  matched_alias?: string | null;
  search_method?: SearchMethod;
  searchMethod?: SearchMethod;
}

export type CanonicalSearchResult = SearchResult;

export interface SearchResponse {
  status: "success" | "ambiguous" | "not_found" | "error";
  elapsedMs: number;
  result: SearchResult | null;
  sessionId?: string;
}

export interface AutocompleteResult {
  suggestions: Array<{
    labelAr: string;
    labelEn: string;
    query: string;
    entityType: EntityType;
    canonicalId: number | string;
  }>;
}

/**
 * Phase 7.2 Intelligent Weighted Ranking Engine
 */
export function computeRankingScore(
  candName: string,
  rawQuery: string,
  entityType: EntityType,
  matchedAlias?: string | null
): number {
  const qNorm = normalize(rawQuery.trim());
  const qStripped = stripArticle(qNorm);
  if (!qNorm) return 0;

  const cNorm = normalize(candName);
  const cStripped = stripArticle(cNorm);
  const aNorm = matchedAlias ? normalize(matchedAlias) : "";
  const aStripped = matchedAlias ? stripArticle(aNorm) : "";

  // 1. Exact Match (Score 1200)
  if (cNorm === qNorm || cStripped === qStripped || aNorm === qNorm || aStripped === qStripped) {
    return 1200;
  }

  // 1b. Exact Constituent Match (Score 1200-1250 for compound foods/synonyms separated by /, —, (), or 'و')
  const candParts = candName.split(/\/|\s+و\s+|[/—,()]+/);
  if (candParts.length > 1) {
    for (const cp of candParts) {
      const cpTrim = cp.trim();
      if (cpTrim.length >= 2) {
        const cpNorm = normalize(cpTrim);
        const cpStripped = stripArticle(cpNorm);
        if (cpNorm === qNorm || cpStripped === qStripped || cpNorm === qStripped || cpStripped === qNorm) {
          const isAtStart = cNorm.startsWith(cpNorm) || cStripped.startsWith(cpStripped);
          return isAtStart ? 1250 : 1200;
        }
      }
    }
  }

  // 2. Canonical Prefix Match (Score 1000)
  if (cNorm.startsWith(qNorm) || cStripped.startsWith(qStripped) || cNorm.startsWith("ال" + qStripped) || cNorm.startsWith("ال" + qNorm)) {
    const qHasDesc = hasRecognizedDescriptor(qNorm) || hasRecognizedDescriptor(qStripped);
    const cHasDesc = hasRecognizedDescriptor(cNorm) || hasRecognizedDescriptor(cStripped);
    if (!qHasDesc && cHasDesc) {
      return 950;
    }
    return 1000;
  }

  // 3. Alias Prefix Match (Score 800)
  if ((aNorm && aNorm.startsWith(qNorm)) || (aStripped && aStripped.startsWith(qStripped))) {
    return 800;
  }

  // 3b. Base Entity / Prefix of Query Match (Score 900)
  // When the query starts with the candidate entity or matched alias (e.g. "حمص بالطحينة" matching base food "حمص")
  if (
    qNorm.startsWith(cNorm + " ") ||
    qStripped.startsWith(cStripped + " ") ||
    (aNorm && qNorm.startsWith(aNorm + " ")) ||
    (aStripped && qStripped.startsWith(aStripped + " "))
  ) {
    return 900;
  }

  // 4. Substring / Contains Match (Score 600)
  if (cNorm.includes(qNorm) || cStripped.includes(qStripped) || (aNorm && aNorm.includes(qNorm))) {
    return 600;
  }

  // 5. Fuzzy Match (Score 400)
  return 400;
}

export function rankCandidates(
  candidates: SearchResult[],
  rawQuery: string,
  profile: SearchRankingProfile = SearchRankingProfile.AUTOCOMPLETE
): SearchResult[] {
  const typeWeight: Record<EntityType, number> = {
    dish: 30,
    food: 20,
    product: 10,
  };

  const scored = candidates.map((c) => {
    const score = computeRankingScore(c.canonicalName || "", rawQuery, c.canonicalEntityType || "food", c.matchedAlias || null);
    return { candidate: c, score };
  });

  // Pure Ranking - NO Grouping, NO Artificial Grouping
  scored.sort((a, b) => {
    // 1. Primary: Ranking score (Exact > Prefix > Alias Prefix > Contains > Fuzzy)
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // 2. Secondary: Entity Priority (Dish > Food > Product)
    const wA = typeWeight[a.candidate.canonicalEntityType || "food"] || 0;
    const wB = typeWeight[b.candidate.canonicalEntityType || "food"] || 0;
    if (wB !== wA) {
      return wB - wA;
    }
    // 3. Tertiary: Shorter canonical name length
    const lenA = (a.candidate.canonicalName || "").length;
    const lenB = (b.candidate.canonicalName || "").length;
    if (lenA !== lenB) {
      return lenA - lenB;
    }
    // 4. Quaternary: Arabic alphabetical order
    return (a.candidate.canonicalName || "").localeCompare(b.candidate.canonicalName || "", "ar");
  });

  const ranked = scored.map((s) => {
    s.candidate.searchConfidence = Math.min(100, Math.max(60, Math.round(s.score / 10)));
    return s.candidate;
  });

  if (profile === SearchRankingProfile.AUTOCOMPLETE) {
    return ranked.slice(0, 10);
  }
  if (profile === SearchRankingProfile.TEXT || profile === SearchRankingProfile.AI) {
    return ranked.slice(0, 1);
  }
  return ranked;
}

export interface SearchContext {
  query: string;
  mode?: SearchMode;
  language?: "ar" | "en";
  source?: string;
  allowAI?: boolean;
  allowFuzzy?: boolean;
  maxResults?: number;
  debug?: boolean;
}

export type QueryIntent = "FOOD" | "DISH" | "COMPOSITE" | "UNKNOWN";

export interface StructuredEntitiesSearchResult {
  queryIntent: QueryIntent;
  primaryResult: CanonicalSearchResult | null;
  foods: CanonicalSearchResult[];
  dishes: CanonicalSearchResult[];
  displayFoods: CanonicalSearchResult[];
  displayDishes: CanonicalSearchResult[];
}

export interface SearchOptions {
  mode?: SearchMode;
  debug?: boolean;
}

export interface EntityPriorityConfig {
  FoodAlias: number;
  Food: number;
  ProductAlias: number;
  Product: number;
  DishAlias: number;
  Dish: number;
}

export const DEFAULT_ENTITY_PRIORITY: EntityPriorityConfig = {
  FoodAlias: 120,
  Food: 110,
  ProductAlias: 100,
  Product: 90,
  DishAlias: 80,
  Dish: 70,
};

interface CacheIndexes {
  barcodeIndex: Map<string, any>;
  exactProductIndex: Map<string, any>;
  productAliasIndex: Map<string, any>;
  productPrefixIndex: Map<string, any[]>;
  exactFoodIndex: Map<string, any>;
  foodAliasIndex: Map<string, any>;
  foodPrefixIndex: Map<string, any[]>;
  baseFoodIndex: Map<string, any[]>;
  exactDishIndex: Map<string, any | any[]>;
  dishAliasIndex: Map<string, any | any[]>;
  dishPrefixIndex: Map<string, any[]>;
  entityHeadNouns: Set<string>;
  builtAt: number;
}

let cachedIndexes: CacheIndexes | null = null;

export function invalidateSearchIndexes(): void {
  cachedIndexes = null;
}

export function printStructuredSearchDebugLog(res: any): void {
  if (!res || !res.diagnostics) return;
  const d = res.diagnostics;
  console.log(`[SEARCH_DEBUG] Query: "${d.originalQuery}" | Method: ${d.searchMethod} | Entity: ${d.selectedEntity} | ID: ${d.canonicalId} | Time: ${d.executionTimeMs}ms`);
}

export interface OperationalMetrics {
  totalSearches: number;
  cacheHits: number;
  fuzzyFallbacks: number;
  aiFallbacks: number;
  successfulMatches: number;
  cacheHitRate: string;
  fuzzyFallbackRate: string;
  aiFallbackRate: string;
  searchAccuracy: string;
}

export class CanonicalSearchEngine {
  private static metricsCounters = {
    totalSearches: 0,
    cacheHits: 0,
    fuzzyFallbacks: 0,
    aiFallbacks: 0,
    successfulMatches: 0,
  };

  public static getOperationalMetrics(): OperationalMetrics {
    const m = this.metricsCounters;
    const total = m.totalSearches || 1;
    const cacheHitRate = `${((m.cacheHits / total) * 100).toFixed(1)}%`;
    const fuzzyFallbackRate = `${((m.fuzzyFallbacks / total) * 100).toFixed(1)}%`;
    const aiFallbackRate = `${((m.aiFallbacks / total) * 100).toFixed(1)}%`;
    const searchAccuracy = `${((m.successfulMatches / total) * 100).toFixed(1)}%`;

    return {
      totalSearches: m.totalSearches,
      cacheHits: m.cacheHits,
      fuzzyFallbacks: m.fuzzyFallbacks,
      aiFallbacks: m.aiFallbacks,
      successfulMatches: m.successfulMatches,
      cacheHitRate,
      fuzzyFallbackRate,
      aiFallbackRate,
      searchAccuracy,
    };
  }

  public static recordMetric(type: "cacheHit" | "fuzzy" | "ai" | "notFound") {
    this.metricsCounters.totalSearches++;
    if (type === "cacheHit") {
      this.metricsCounters.cacheHits++;
      this.metricsCounters.successfulMatches++;
    } else if (type === "fuzzy") {
      this.metricsCounters.fuzzyFallbacks++;
      this.metricsCounters.successfulMatches++;
    } else if (type === "ai" || type === "notFound") {
      this.metricsCounters.aiFallbacks++;
    }
  }
  public static normalize(input: string | null | undefined): string {
    return normalize(input);
  }

  public static stripArticle(str: string): string {
    return stripArticle(str);
  }

  /**
   * Precompute O(1) Hash Map and Prefix Indexes for Foods, Dishes, Products, and Aliases
   */
  public static async buildIndexes(): Promise<CacheIndexes> {
    const now = Date.now();
    if (cachedIndexes && now - cachedIndexes.builtAt < 3600000) {
      return cachedIndexes;
    }

    const knowledgeCache = await getKnowledgeCache();
    const dishCache = await warmDishEngineCache();
    await loadDbSynonyms();
    ProductDatabase.initialize();

    const barcodeIndex = new Map<string, any>();
    const exactProductIndex = new Map<string, any>();
    const productAliasIndex = new Map<string, any>();
    const productPrefixIndex = new Map<string, any[]>();

    const exactFoodIndex = new Map<string, any>();
    const foodAliasIndex = new Map<string, any>();
    const foodPrefixIndex = new Map<string, any[]>();
    const baseFoodIndex = new Map<string, any[]>();

    const exactDishIndex = new Map<string, any | any[]>();
    const dishAliasIndex = new Map<string, any | any[]>();
    const dishPrefixIndex = new Map<string, any[]>();
    const entityHeadNouns = new Set<string>();

    const addEntityHead = (text: string) => {
      if (!text) return;
      const stripped = stripArticle(normalize(text)).trim();
      const firstWord = stripped.split(/\s+/)[0];
      if (firstWord && firstWord.length > 1) {
        entityHeadNouns.add(firstWord);
      }
    };

    // Helper to index prefix keys (both 2-char and 3-char)
    const addPrefix = (map: Map<string, any[]>, keyStr: string, item: any) => {
      if (!keyStr) return;
      const k2 = keyStr.slice(0, 2);
      const k3 = keyStr.slice(0, 3);
      if (k2) {
        const l2 = map.get(k2) || [];
        if (!l2.includes(item)) l2.push(item);
        map.set(k2, l2);
      }
      if (k3 && k3 !== k2) {
        const l3 = map.get(k3) || [];
        if (!l3.includes(item)) l3.push(item);
        map.set(k3, l3);
      }
    };

    // 1. Index Foods & Food Aliases
    const addExactFood = (key: string, food: any) => {
      if (!key) return;
      const existing = exactFoodIndex.get(key);
      if (!existing) {
        exactFoodIndex.set(key, food);
      } else if (Array.isArray(existing)) {
        if (!existing.some((item: any) => item.id === food.id)) existing.push(food);
      } else if (existing.id !== food.id) {
        exactFoodIndex.set(key, [existing, food]);
      }
    };

    const addBaseFood = (key: string, food: any) => {
      if (!key || key.length < 2) return;
      const list = baseFoodIndex.get(key) || [];
      if (!list.some((item: any) => item.id === food.id)) {
        list.push(food);
      }
      baseFoodIndex.set(key, list);
    };

    for (const f of knowledgeCache.foods || []) {
      const normAr = normalize(f.nameAr);
      const stripAr = stripArticle(f.nameAr);
      const noAl = normAr.startsWith("ال") && normAr.length > 3 ? normAr.slice(2) : "";
      const normEn = normalize(f.nameEn);

      if (normAr) addExactFood(normAr, f);
      if (stripAr) addExactFood(stripAr, f);
      if (noAl) addExactFood(noAl, f);

      if (f.nameEn) {
        const cleanEn = f.nameEn.replace(/\s*\(.*?\)/g, "").trim();
        const normEn = normalize(f.nameEn);
        const cleanNormEn = normalize(cleanEn);

        if (normEn) {
          addExactFood(normEn, f);
          addPrefix(foodPrefixIndex, normEn, f);
        }
        if (cleanNormEn && cleanNormEn !== normEn) {
          addExactFood(cleanNormEn, f);
          addPrefix(foodPrefixIndex, cleanNormEn, f);
        }

        const enParts = cleanEn.split(/[/,]+/);
        for (const ep of enParts) {
          const epNorm = normalize(ep.trim());
          if (epNorm && epNorm.length >= 2) {
            addExactFood(epNorm, f);
            addPrefix(foodPrefixIndex, epNorm, f);
          }
        }
      }

      // Split compound food names & true constituent synonyms (e.g. "كمثرى / انجاص / اجاص", "بطاطس / بطاطا", "لبن / حليب", "سمك / أسماك", "الجوز (عين الجمل)", "دجاج و فراخ")
      addEntityHead(f.nameAr);
      const rawParts = f.nameAr.split(/\/|\s+و\s+|[/—,()]+/);
      for (const part of rawParts) {
        addEntityHead(part);
        const pTrimmed = part.trim();
        if (pTrimmed.length < 2) continue;

        const pNorm = normalize(pTrimmed);
        const pStrip = stripArticle(pNorm);
        const pNoAlef = pStrip.replace(/^[اأإآ]/, "");
        const pNoAl = pNorm.startsWith("ال") && pNorm.length > 3 ? pNorm.slice(2) : "";

        if (pNorm) {
          addExactFood(pNorm, f);
          addPrefix(foodPrefixIndex, pNorm, f);
        }
        if (pStrip) {
          addExactFood(pStrip, f);
          addPrefix(foodPrefixIndex, pStrip, f);
        }
        if (pNoAl) {
          addExactFood(pNoAl, f);
        }
        if (pNoAlef && pNoAlef.length >= 2) {
          addExactFood(pNoAlef, f);
        }

        // Handle quantifier phrases like "بكل أنواعها" or "بجميع أشكاله" (e.g. "سلطة بكل أنواعها", "الأرز بجميع أشكاله")
        const cleanHead = pStrip.replace(/\s+(?:بكل|بجميع|كافة|جميع)\s+.*$/, "").trim();
        if (cleanHead && cleanHead !== pStrip && cleanHead.length >= 2) {
          addExactFood(cleanHead, f);
          addExactFood("ال" + cleanHead, f);
          addBaseFood(cleanHead, f);
          addPrefix(foodPrefixIndex, cleanHead, f);
          addEntityHead(cleanHead);
        }

        // Feminine plural to singular (e.g. "سلطات" -> "سلطة")
        if (pStrip.endsWith("ات") && pStrip.length >= 5) {
          const singularH = pStrip.slice(0, -2) + "ه";
          const singularT = pStrip.slice(0, -2) + "ة";
          addBaseFood(singularH, f);
          addBaseFood(singularT, f);
          addPrefix(foodPrefixIndex, singularH, f);
          addEntityHead(singularH);
        }
      }

      // Base Entity and multi-word variants (Index into baseFoodIndex ONLY, NEVER exactFoodIndex!)
      // E.g. "طماطم شيري" -> base "طماطم"
      // E.g. "شاي أخضر" -> base "شاي"
      // E.g. "بطاطا حلوة" -> base "بطاطا"
      const baseEntity = extractBaseEntity(f.nameAr);
      if (baseEntity) {
        const baseNorm = normalize(baseEntity);
        const baseStrip = stripArticle(baseNorm);
        if (baseNorm) {
          addBaseFood(baseNorm, f);
          addPrefix(foodPrefixIndex, baseNorm, f);
        }
        if (baseStrip) {
          addBaseFood(baseStrip, f);
          addPrefix(foodPrefixIndex, baseStrip, f);
        }
      }

      // Multi-word variants (e.g. "طماطم شيري", "شاي أخضر", "بطاطا حلوة")
      const primaryParts = f.nameAr.split(/\/|\s+و\s+/).map((p: string) => p.trim()).filter(Boolean);
      for (const part of primaryParts) {
        const pWords = part.split(/\s+/).filter(Boolean);
        if (pWords.length > 1 && pWords.length <= 3) {
          const firstWord = normalize(pWords[0]);
          const firstStrip = stripArticle(firstWord);
          if (firstWord && firstWord.length >= 2) addBaseFood(firstWord, f);
          if (firstStrip && firstStrip.length >= 2) addBaseFood(firstStrip, f);
        }
      }

      addPrefix(foodPrefixIndex, normAr, f);
      addPrefix(foodPrefixIndex, stripAr, f);
    }

    for (const a of knowledgeCache.aliases || []) {
      const food = knowledgeCache.foodById.get(a.foodId);
      if (!food) continue;

      const normAr = normalize(a.aliasAr);
      const stripAr = stripArticle(a.aliasAr);
      const normEn = normalize(a.aliasEn);

      if (normAr) foodAliasIndex.set(normAr, food);
      if (stripAr) foodAliasIndex.set(stripAr, food);
      if (normEn) foodAliasIndex.set(normEn, food);

      addPrefix(foodPrefixIndex, normAr, food);
    }

    // Canonicalize standard tomato dialect forms directly to master Food 1510
    const food1510 = knowledgeCache.foodById.get(1510);
    if (food1510) {
      foodAliasIndex.set(normalize("طماط"), food1510);
      foodAliasIndex.set(stripArticle(normalize("طماط")), food1510);
      foodAliasIndex.set(normalize("بندورة"), food1510);
      foodAliasIndex.set(stripArticle(normalize("بندورة")), food1510);
    }

    // 2. Index Dishes & Dish Aliases
    const dishesList = dishCache.dishes || [];
    for (const d of dishesList) {
      addEntityHead(d.nameAr);
      const normAr = normalize(d.nameAr);
      const stripAr = stripArticle(d.nameAr);
      if (normAr) {
        const existing = exactDishIndex.get(normAr);
        if (existing) {
          const list = Array.isArray(existing) ? existing : [existing];
          list.push(d);
          exactDishIndex.set(normAr, list);
        } else {
          exactDishIndex.set(normAr, d);
        }
      }
      if (stripAr && stripAr !== normAr) {
        exactDishIndex.set(stripAr, d);
      }

      // Index distinct named constituents separated by / or — into dishAliasIndex
      const dishParts = d.nameAr.split(/\/|—|\(|\)/);
      for (const part of dishParts) {
        const pTrimmed = part.trim();
        if (pTrimmed.length < 3) continue;
        const pNorm = normalize(pTrimmed);
        const pStrip = stripArticle(pNorm);
        if (pNorm && pNorm !== normAr) {
          const existing = dishAliasIndex.get(pNorm);
          if (existing) {
            const list = Array.isArray(existing) ? existing : [existing];
            if (!list.some((item: any) => item.id === d.id)) list.push(d);
            dishAliasIndex.set(pNorm, list);
          } else {
            dishAliasIndex.set(pNorm, d);
          }
          addPrefix(dishPrefixIndex, pNorm, d);
        }
        if (pStrip && pStrip !== pNorm && pStrip !== stripAr) {
          const existing = dishAliasIndex.get(pStrip);
          if (existing) {
            const list = Array.isArray(existing) ? existing : [existing];
            if (!list.some((item: any) => item.id === d.id)) list.push(d);
            dishAliasIndex.set(pStrip, list);
          } else {
            dishAliasIndex.set(pStrip, d);
          }
          addPrefix(dishPrefixIndex, pStrip, d);
        }
        addEntityHead(part);
      }

      addPrefix(dishPrefixIndex, normAr, d);
      addPrefix(dishPrefixIndex, stripAr, d);
    }

    for (const [normAr, aliasList] of dishCache.dishAliasesByNormAr.entries()) {
      for (const da of aliasList) {
        const dish = dishCache.dishesById.get(da.dishId);
        if (!dish) continue;

        const existing = dishAliasIndex.get(normAr);
        if (existing) {
          const list = Array.isArray(existing) ? existing : [existing];
          list.push(dish);
          dishAliasIndex.set(normAr, list);
        } else {
          dishAliasIndex.set(normAr, dish);
        }

        addPrefix(dishPrefixIndex, normAr, dish);
      }
    }

    // 3. Index Products & Barcodes
    const productsList = ProductDatabase.getAllProducts();
    for (const p of productsList) {
      if (!p) continue;
      const rec = p as any;
      if (rec.barcode) barcodeIndex.set(rec.barcode.trim(), rec);
      const normBrand = normalize(rec.brand);
      const normAr = normalize(rec.nameAr || rec.productName);
      const normEn = normalize(rec.nameEn);

      if (normAr) exactProductIndex.set(normAr, rec);
      if (normEn) exactProductIndex.set(normEn, rec);
      if (normBrand) exactProductIndex.set(normBrand, rec);

      if (rec.aliases && Array.isArray(rec.aliases)) {
        for (const al of rec.aliases) {
          const normAl = normalize(al);
          if (normAl) productAliasIndex.set(normAl, rec);
        }
      }

      addPrefix(productPrefixIndex, normAr, rec);
    }

    cachedIndexes = {
      barcodeIndex,
      exactProductIndex,
      productAliasIndex,
      productPrefixIndex,
      exactFoodIndex,
      foodAliasIndex,
      foodPrefixIndex,
      baseFoodIndex,
      exactDishIndex,
      dishAliasIndex,
      dishPrefixIndex,
      entityHeadNouns,
      builtAt: now,
    };

    return cachedIndexes;
  }

  /**
   * Dual-Channel Structured Entity Search Gateway (Food vs Dish Channel Separation)
   */
  public static async searchEntities(
    input: string | SearchContext,
    options?: SearchOptions
  ): Promise<StructuredEntitiesSearchResult> {
    const context: SearchContext = typeof input === "string"
      ? { query: input, mode: options?.mode || SearchMode.TEXT, debug: options?.debug }
      : { mode: SearchMode.TEXT, ...input };

    const rawQuery = (context.query || "").trim();
    if (!rawQuery) {
      return {
        queryIntent: "UNKNOWN",
        primaryResult: null,
        foods: [],
        dishes: [],
        displayFoods: [],
        displayDishes: [],
      };
    }

    const mode = context.mode || SearchMode.TEXT;
    const valResult = isMeaningfulQuery(rawQuery);
    if (!valResult.isValid) {
      return {
        queryIntent: "UNKNOWN",
        primaryResult: null,
        foods: [],
        dishes: [],
        displayFoods: [],
        displayDishes: [],
      };
    }

    const queryNorm = normalize(rawQuery);
    if (!queryNorm) {
      return {
        queryIntent: "UNKNOWN",
        primaryResult: null,
        foods: [],
        dishes: [],
        displayFoods: [],
        displayDishes: [],
      };
    }

    const indexes = await this.buildIndexes();
    const dishCache = await warmDishEngineCache();
    const expandedVariants = expandSearchQuery(rawQuery);
    const synonymTargetVariants = getQuerySynonymTargets(rawQuery);
    const qStripped = stripArticle(queryNorm);

    let foods: CanonicalSearchResult[] = [];
    let dishes: CanonicalSearchResult[] = [];
    const seenFoodIds = new Set<number | string>();
    const seenDishIds = new Set<number | string>();

    // -------------------------------------------------------------------------
    // 1. FOOD CHANNEL RESOLUTION
    // -------------------------------------------------------------------------
    // A. Food Alias & Exact Matches across all expanded variants
    for (const variant of expandedVariants) {
      const foodAlias = indexes.foodAliasIndex.get(variant);
      if (foodAlias && !seenFoodIds.has(foodAlias.id)) {
        // CANONICAL ENTITY PRECEDENCE CHECK:
        // If this alias hit was reached via synonym expansion (e.g. بندورة→طماطم),
        // verify the original query is NOT itself a canonical food entity.
        // If it is (e.g. البندورة = Food 1586 exists as a canonical name), let exact match handle it.
        const isSynonymHit = synonymTargetVariants.has(variant) && stripArticle(variant) !== stripArticle(queryNorm);
        if (isSynonymHit) {
          const origExact = indexes.exactFoodIndex.get(queryNorm) || indexes.exactFoodIndex.get(qStripped);
          if (origExact) {
            continue;
          }
        }

        seenFoodIds.add(foodAlias.id);
        const aliasConf = isSynonymHit ? 90 : 100;
        foods.push({
          canonicalId: foodAlias.id,
          canonicalEntityType: "food",
          canonicalName: foodAlias.nameAr,
          searchConfidence: aliasConf,
          matchType: isSynonymHit ? "SYNONYM" : "ALIAS",
          matchedAlias: variant,
          matchedReason: isSynonymHit
            ? `Matched via Synonym Expansion '${variant}' (dialect/baseline)`
            : `Matched via Food Alias '${variant}'`,
          entity_type: "food",
          canonical_id: foodAlias.id,
          canonical_name: foodAlias.nameAr,
          confidence: aliasConf,
          matched_alias: variant,
          search_method: "exact_alias",
          searchOutcome: "FOUND",
        });
      }

      const foodExactHits = indexes.exactFoodIndex.get(variant);
      if (foodExactHits) {
        const hits = Array.isArray(foodExactHits) ? foodExactHits : [foodExactHits];
        for (const foodExact of hits) {
          if (!seenFoodIds.has(foodExact.id)) {
            seenFoodIds.add(foodExact.id);
            foods.push({
              canonicalId: foodExact.id,
              canonicalEntityType: "food",
              canonicalName: foodExact.nameAr,
              searchConfidence: 95,
              matchType: "EXACT",
              matchedAlias: variant !== foodExact.nameAr ? variant : null,
              matchedReason: "Matched via Food Canonical Name",
              entity_type: "food",
              canonical_id: foodExact.id,
              canonical_name: foodExact.nameAr,
              confidence: 95,
              matched_alias: variant !== foodExact.nameAr ? variant : null,
              search_method: "exact_canonical",
              searchOutcome: "FOUND",
            });
          }
        }
      }
    }

    // B. Food Prefix Index Scan (Guarded against meaningless short English/Punctuation queries)
    const allowBroadFuzzySubstring = qStripped.length >= 4 && !/^[a-z.]+$/i.test(rawQuery.trim());
    const prefixKeys = [queryNorm.slice(0, 2), queryNorm.slice(0, 3), qStripped.slice(0, 2), qStripped.slice(0, 3)].filter(Boolean);
    for (const pk of prefixKeys) {
      const pFoods = indexes.foodPrefixIndex.get(pk) || [];
      for (const f of pFoods) {
        if (!seenFoodIds.has(f.id)) {
          const fNorm = normalize(f.nameAr);
          const fStrip = stripArticle(fNorm);
          const fNormEn = normalize(f.nameEn);
          const isPrefixEn = !!(fNormEn && fNormEn.startsWith(queryNorm));
          const isPrefix = fNorm.startsWith(queryNorm) || fStrip.startsWith(qStripped) || isPrefixEn;
          const isSub = allowBroadFuzzySubstring && (fNorm.includes(queryNorm) || fStrip.includes(qStripped) || !!(fNormEn && fNormEn.includes(queryNorm)));

          if (isPrefix || isSub) {
            seenFoodIds.add(f.id);
            foods.push({
              canonicalId: f.id,
              canonicalEntityType: "food",
              canonicalName: f.nameAr,
              searchConfidence: isPrefix ? 90 : 80,
              matchType: isPrefix ? "PREFIX" : "FUZZY",
              matchedAlias: isPrefixEn ? f.nameEn : null,
              matchedReason: isPrefix ? "Matched via Food Prefix Index" : "Matched via Food Partial Match",
              entity_type: "food",
              canonical_id: f.id,
              canonical_name: f.nameAr,
              confidence: isPrefix ? 90 : 80,
              matched_alias: isPrefixEn ? f.nameEn : null,
              search_method: "starts_with",
              searchOutcome: "FOUND",
            });
          }
        }
      }
    }

    // C. Base Entity Resolution for Foods (e.g. "أرز مصري" -> base "أرز")
    const extractedBase = extractBaseEntity(rawQuery);
    if (extractedBase) {
      const baseVariants = expandSearchQuery(extractedBase);
      for (const bVar of baseVariants) {
        const baseFoodHit = indexes.exactFoodIndex.get(bVar) || indexes.foodAliasIndex.get(bVar);
        if (baseFoodHit) {
          const hits = Array.isArray(baseFoodHit) ? baseFoodHit : [baseFoodHit];
          for (const foodHit of hits) {
            if (!seenFoodIds.has(foodHit.id)) {
              seenFoodIds.add(foodHit.id);
              foods.push({
                canonicalId: foodHit.id,
                canonicalEntityType: "food",
                canonicalName: foodHit.nameAr,
                searchConfidence: 90,
                matchType: "BASE_ENTITY",
                matchedAlias: bVar,
                matchedReason: `Matched via Base Food Entity '${bVar}'`,
                entity_type: "food",
                canonical_id: foodHit.id,
                canonical_name: foodHit.nameAr,
                confidence: 90,
                matched_alias: bVar,
                search_method: "base_entity_resolution",
                searchOutcome: "FOUND",
              });
            }
          }
        }
      }
    }

    // D. Base Food Index Lookup for Generic Queries (e.g. "شاي" -> "شاي أخضر", "شاي أحمر (أسود)")
    const baseKeys: string[] = [queryNorm, qStripped, ...expandedVariants.map(v => stripArticle(normalize(v)))];
    if (extractedBase) {
      baseKeys.push(normalize(extractedBase), stripArticle(normalize(extractedBase)));
    }
    const seenBaseKey = new Set<string>();
    for (const bKey of baseKeys) {
      if (!bKey || seenBaseKey.has(bKey)) continue;
      seenBaseKey.add(bKey);
      const baseVariantsList = indexes.baseFoodIndex.get(bKey) || [];
      for (const bf of baseVariantsList) {
        if (!seenFoodIds.has(bf.id)) {
          seenFoodIds.add(bf.id);
          foods.push({
            canonicalId: bf.id,
            canonicalEntityType: "food",
            canonicalName: bf.nameAr,
            searchConfidence: 85,
            matchType: "VARIANT",
            matchedAlias: null,
            matchedReason: `Matched via Generic Food Family Variant`,
            entity_type: "food",
            canonical_id: bf.id,
            canonical_name: bf.nameAr,
            confidence: 85,
            matched_alias: null,
            search_method: "base_entity_resolution",
            searchOutcome: "FOUND",
          });
        }
      }
    }

    // Rank candidate foods using Intelligent Weighted Ranking Engine
    // (Ensures Exact canonical matches score 1200 and ALWAYS outrank variants scoring 1000/850/600)
    foods = rankCandidates(foods, rawQuery, SearchRankingProfile.AUTOCOMPLETE);

    // -------------------------------------------------------------------------
    // 2. DISH CHANNEL RESOLUTION
    // -------------------------------------------------------------------------

    // A. Dish Alias & Exact Matches across expanded variants (EQUIVALENCE GUARDED)
    for (const variant of expandedVariants) {
      const dishAliasHits = indexes.dishAliasIndex.get(variant);
      if (dishAliasHits) {
        const hits = Array.isArray(dishAliasHits) ? dishAliasHits : [dishAliasHits];
        for (const d of hits) {
          if (!seenDishIds.has(d.id) && this.verifyDishEquivalence(rawQuery, d, dishCache)) {
            seenDishIds.add(d.id);
            dishes.push({
              canonicalId: d.id,
              canonicalEntityType: "dish",
              canonicalName: d.nameAr,
              searchConfidence: variant === queryNorm ? 100 : 90,
              matchType: "ALIAS",
              matchedAlias: variant,
              matchedReason: `Matched via Dish Alias '${variant}'`,
              entity_type: "dish",
              canonical_id: d.id,
              canonical_name: d.nameAr,
              confidence: variant === queryNorm ? 100 : 90,
              matched_alias: variant,
              search_method: "exact_alias",
              searchOutcome: "FOUND",
            });
          }
        }
      }

      const dishExactHits = indexes.exactDishIndex.get(variant);
      if (dishExactHits) {
        const hits = Array.isArray(dishExactHits) ? dishExactHits : [dishExactHits];
        for (const d of hits) {
          if (!seenDishIds.has(d.id) && this.verifyDishEquivalence(rawQuery, d, dishCache)) {
            seenDishIds.add(d.id);
            dishes.push({
              canonicalId: d.id,
              canonicalEntityType: "dish",
              canonicalName: d.nameAr,
              searchConfidence: 95,
              matchType: "EXACT",
              matchedAlias: null,
              matchedReason: "Matched via Dish Canonical Name",
              entity_type: "dish",
              canonical_id: d.id,
              canonical_name: d.nameAr,
              confidence: 95,
              matched_alias: null,
              search_method: "exact_canonical",
              searchOutcome: "FOUND",
            });
          }
        }
      }
    }

    // B. Dish Prefix & Candidate-Bounded Token Similarity (EQUIVALENCE GUARDED)
    for (const variant of expandedVariants) {
      for (const d of dishCache.dishes || []) {
        if (!seenDishIds.has(d.id)) {
          const dNorm = normalize(d.nameAr);
          const match = this.calculateTokenMatch(variant, dNorm, false);
          if (match.matches && match.score >= 65 && this.verifyDishEquivalence(rawQuery, d, dishCache)) {
            seenDishIds.add(d.id);
            dishes.push({
              canonicalId: d.id,
              canonicalEntityType: "dish",
              canonicalName: d.nameAr,
              searchConfidence: match.score,
              matchType: match.method === "starts_with" ? "PREFIX" : "FUZZY",
              matchedAlias: variant !== queryNorm ? variant : null,
              matchedReason: `Matched via Dish Token Similarity (${match.method})`,
              entity_type: "dish",
              canonical_id: d.id,
              canonical_name: d.nameAr,
              confidence: match.score,
              matched_alias: variant !== queryNorm ? variant : null,
              search_method: match.method,
              searchOutcome: "FOUND",
            });
          }
        }
      }
    }

    dishes = rankCandidates(dishes, rawQuery, SearchRankingProfile.AUTOCOMPLETE);

    // -------------------------------------------------------------------------
    // 3. GENERIC QUERY INTENT DETERMINATION & AMBIGUITY EVALUATION
    // -------------------------------------------------------------------------
    let queryIntent: QueryIntent = "UNKNOWN";

    const hasExactFood = foods.some((f) => {
      const s = computeRankingScore(f.canonicalName || "", rawQuery, "food", f.matchedAlias);
      return s >= 1200;
    });
    const hasExactDish = dishes.some((d) => {
      const s = computeRankingScore(d.canonicalName || "", rawQuery, "dish", d.matchedAlias);
      return s >= 1200;
    });

    const hasStandaloneExactDish = dishes.some((d) => {
      const dNorm = normalize(d.canonicalName || "");
      const dStrip = stripArticle(dNorm);
      // For single-word queries, a compound slash-constituent dish (e.g. "العيش / العصيدة الموريتانية")
      // is NOT a standalone exact dish that can unilaterally seize DISH intent.
      return !dNorm.includes("/") && (dNorm === queryNorm || dStrip === qStripped);
    });

    const hasConjunction = (/\s+و[\u0600-\u06FF]+/.test(" " + rawQuery.trim()) && !["ورق", "وجبة", "وز"].some(w => rawQuery.trim().startsWith(w))) || queryNorm.includes(" و ");

    const hasBaseFoodVariants =
      (indexes.baseFoodIndex.get(queryNorm)?.length || 0) > 1 ||
      (indexes.baseFoodIndex.get(qStripped)?.length || 0) > 1 ||
      (extractedBase ? (indexes.baseFoodIndex.get(stripArticle(normalize(extractedBase)))?.length || 0) > 1 : false);

    const isSingleWord = queryNorm.split(/\s+/).filter(Boolean).length === 1;
    // For single-word queries with multiple base food variants, a compound slash/constituent dish match
    // must not unilaterally seize DISH intent and eliminate the food family!
    const effectiveExactDish = isSingleWord && hasBaseFoodVariants && !hasStandaloneExactDish ? false : hasExactDish;

    if (hasConjunction) {
      queryIntent = "COMPOSITE";
    } else if (effectiveExactDish && !hasExactFood) {
      queryIntent = "DISH";
    } else if (hasExactFood && !effectiveExactDish) {
      queryIntent = "FOOD";
    } else if (effectiveExactDish && hasExactFood) {
      const isSingleWordQuery = queryNorm.split(" ").length === 1;
      const topFoodConf = foods[0]?.searchConfidence || 0;
      const topDishConf = dishes[0]?.searchConfidence || 0;
      if (isSingleWordQuery && topFoodConf >= 85) {
        queryIntent = "FOOD";
      } else {
        queryIntent = topDishConf > topFoodConf ? "DISH" : "FOOD";
      }
    } else if (hasBaseFoodVariants && !effectiveExactDish) {
      queryIntent = dishes.length > 0 && !hasExactFood ? "UNKNOWN" : "FOOD";
    } else if (foods.length > 0 && dishes.length === 0) {
      queryIntent = "FOOD";
    } else if (dishes.length > 0 && foods.length === 0) {
      queryIntent = "DISH";
    } else if (foods.length > 0 && dishes.length > 0) {
      queryIntent = (foods[0].searchConfidence ?? 0) >= (dishes[0].searchConfidence ?? 0) ? "FOOD" : "DISH";
    } else {
      const isMultiWord = queryNorm.split(" ").length >= 3;
      queryIntent = isMultiWord ? "COMPOSITE" : "UNKNOWN";
    }

    // -------------------------------------------------------------------------
    // 4. DISPLAY POLICY / PRESENTATION FILTERING
    // -------------------------------------------------------------------------
    let displayFoods: CanonicalSearchResult[] = [];
    let displayDishes: CanonicalSearchResult[] = [];

    if (queryIntent === "FOOD") {
      displayFoods = foods;
      displayDishes = []; // HIDE DISHES FOR FOOD INTENT TO PREVENT DISH FLOODING
      dishes = [];
    } else if (queryIntent === "DISH") {
      displayDishes = dishes;
      displayFoods = [];
    } else {
      displayFoods = foods;
      displayDishes = dishes;
    }

    // Check if query is an ambiguous generic food family with multiple distinct variants
    const queryWords = queryNorm.split(/\s+/).filter(Boolean);
    const isMultiWordSpecificMatch =
      queryWords.length > 1 &&
      foods.some((f) => {
        const fNorm = normalize(f.canonicalName);
        const fStrip = stripArticle(fNorm);
        return (fNorm === queryNorm || fStrip === qStripped) && (f.searchConfidence ?? 0) >= 95;
      });

    const isEnglish = /[a-zA-Z]/.test(rawQuery);
    const baseKey = qStripped || queryNorm;
    const baseVariants = indexes.baseFoodIndex.get(baseKey) || indexes.baseFoodIndex.get(queryNorm) || [];
    const exactHits = indexes.exactFoodIndex.get(baseKey) || indexes.exactFoodIndex.get(queryNorm);
    const exactList = exactHits ? (Array.isArray(exactHits) ? exactHits : [exactHits]) : [];

    // Recognized descriptor variants (e.g. "طماطم شيري", "بطاطا حلوة", "شاي أخضر", "شاي أحمر")
    const hasCleanBaseFood = exactList.some((e: any) => !hasRecognizedDescriptor(e.nameAr));
    const hasMultipleVariants = !isEnglish && !hasCleanBaseFood && (
      baseVariants.length > 1 ||
      exactList.length > 1 ||
      (hasBaseFoodVariants && (foods.length > 1 || dishes.length > 0))
    );

    // A generic food query requires explicit choices if:
    // 1. queryIntent is FOOD or UNKNOWN with base food variants
    // 2. Query is NOT English
    // 3. Query is NOT a specific multi-word variant match (e.g. "شاي أخضر", "طماطم شيري", "بطاطا حلوة")
    // 4. The food family contains 2 or more distinct variants in the database
    const isAmbiguousGenericFood =
      !isEnglish &&
      (queryIntent === "FOOD" || (queryIntent === "UNKNOWN" && hasBaseFoodVariants)) &&
      !isMultiWordSpecificMatch &&
      hasMultipleVariants;

    let primaryResult: CanonicalSearchResult | null = null;
    if (isAmbiguousGenericFood) {
      const qAr = formatAmbiguityQuestion(rawQuery);
      const candidates: CanonicalSearchResult[] = [];
      const seenIds = new Set<number>();

      for (const e of exactList) {
        if (!seenIds.has(e.id)) {
          seenIds.add(e.id);
          candidates.push({
            canonicalId: e.id,
            canonicalEntityType: "food",
            canonicalName: e.nameAr,
            searchConfidence: 95,
            matchType: "EXACT",
            matchedAlias: null,
            matchedReason: "Matched via Food Canonical Name",
            entity_type: "food",
            canonical_id: e.id,
            canonical_name: e.nameAr,
            confidence: 95,
            matched_alias: null,
            search_method: "exact_canonical",
            searchOutcome: "FOUND",
          });
        }
      }

      for (const v of baseVariants) {
        if (!seenIds.has(v.id)) {
          seenIds.add(v.id);
          candidates.push({
            canonicalId: v.id,
            canonicalEntityType: "food",
            canonicalName: v.nameAr,
            searchConfidence: 90,
            matchType: "VARIANT",
            matchedAlias: null,
            matchedReason: "Matched via Generic Food Family Variant",
            entity_type: "food",
            canonical_id: v.id,
            canonical_name: v.nameAr,
            confidence: 90,
            matched_alias: null,
            search_method: "base_entity_resolution",
            searchOutcome: "FOUND",
          });
        }
      }

      // Also include any competing dish candidates for cross-category ambiguity (e.g. "عيش")
      for (const d of dishes) {
        const dId = typeof d.canonicalId === "number" ? d.canonicalId : Number(d.canonicalId) || 0;
        if (!seenIds.has(dId) && candidates.length < 10) {
          seenIds.add(dId);
          candidates.push(d);
        }
      }

      displayFoods = candidates;
      primaryResult = {
        canonicalId: 0,
        canonical_id: 0,
        canonicalName: rawQuery,
        canonical_name: rawQuery,
        canonicalEntityType: "food",
        entity_type: "food",
        searchConfidence: 85,
        confidence: 85,
        matchType: "AMBIGUOUS",
        searchOutcome: "AMBIGUOUS",
        isAmbiguous: true,
        candidateDishes: candidates,
        candidateFoods: candidates,
        questionAr: qAr,
        matchedReason: `Matched ${candidates.length} candidate variants for generic query '${rawQuery}'`,
      };
    } else {
      primaryResult = displayDishes[0] || displayFoods[0] || foods[0] || dishes[0] || null;
    }

    return {
      queryIntent,
      primaryResult,
      foods,
      dishes,
      displayFoods,
      displayDishes,
    };
  }

  /**
   * Unified Search Engine Gateway
   */
  public static async search(
    input: string | SearchContext,
    options?: SearchOptions
  ): Promise<CanonicalSearchResult | null> {
    const tStart = performance.now();

    // Parse input parameter
    const context: SearchContext = typeof input === "string"
      ? { query: input, mode: options?.mode || SearchMode.TEXT, debug: options?.debug }
      : { mode: SearchMode.TEXT, ...input };

    const rawQuery = (context.query || "").trim();
    if (!rawQuery) return null;

    const isDebug = context.debug ?? (process.env.SEARCH_DEBUG === "true" || process.env.NODE_ENV === "development");
    const mode = context.mode || SearchMode.TEXT;
    const queryNorm = normalize(rawQuery);
    if (!queryNorm) return null;

    const indexes = await this.buildIndexes();
    const searchedIndexes: string[] = [];

    // =========================================================================
    // SPECIAL SEARCH MODE 1: BARCODE SEARCH MODE
    // =========================================================================
    if (mode === SearchMode.BARCODE) {
      searchedIndexes.push("barcodeIndex");
      const p = indexes.barcodeIndex.get(rawQuery.trim());
      if (p) {
        return {
          entity_type: "product",
          canonical_id: p.productId || p.id,
          canonical_name: p.nameAr || p.productName,
          confidence: 100,
          matched_alias: null,
          search_method: "barcode_match",
          matchedReason: "Matched via Barcode Index",
        };
      }
      return null;
    }

    // =========================================================================
    // SPECIAL SEARCH MODE 2: INGREDIENT RESOLUTION SEARCH MODE (Food Priority)
    // =========================================================================
    if (mode === SearchMode.INGREDIENT) {
      const expandedVariants = expandSearchQuery(rawQuery);

      // 1. Exact Food & Food Alias Check
      for (const variant of expandedVariants) {
        const foodHit = indexes.foodAliasIndex.get(variant) || indexes.exactFoodIndex.get(variant);
        if (foodHit) {
          const primaryFood = Array.isArray(foodHit) ? foodHit[0] : foodHit;
          return this.formatResult({
            entity_type: "food",
            canonical_id: primaryFood.id,
            canonical_name: primaryFood.nameAr,
            confidence: 100,
            matched_alias: variant !== primaryFood.nameAr ? variant : null,
            search_method: "exact_alias",
            matchedReason: "Matched via Food Index (Ingredient Profile)",
          }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, 1, [], 1, [], 0, [], 0, [], 0, []);
        }
      }

      // 2. Base Entity Food Resolution (e.g. "صدر دجاج" -> "دجاج")
      const knowledgeCache = await getKnowledgeCache();
      const dishCache = await warmDishEngineCache();
      for (const variant of expandedVariants) {
        const baseKey = normalize(extractBaseEntity(variant) || stripArticle(variant).split(" ")[0] || "");
        if (baseKey) {
          const baseFood = indexes.exactFoodIndex.get(baseKey) || indexes.foodAliasIndex.get(baseKey);
          if (baseFood) {
            const primaryBaseFood = Array.isArray(baseFood) ? baseFood[0] : baseFood;
            return this.formatResult({
              entity_type: "food",
              canonical_id: primaryBaseFood.id,
              canonical_name: primaryBaseFood.nameAr,
              confidence: 90,
              matched_alias: variant,
              search_method: "base_entity_resolution",
              matchedReason: `Matched via Base Food Entity '${baseKey}' (Ingredient Profile)`,
            }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, 1, [], 1, [], 0, [], 0, [], 0, []);
          }
        }
      }

      // 3. Product Check
      for (const variant of expandedVariants) {
        const prodHit = indexes.exactProductIndex.get(variant) || indexes.productAliasIndex.get(variant);
        if (prodHit) {
          return this.formatResult({
            entity_type: "product",
            canonical_id: prodHit.productId || prodHit.id,
            canonical_name: prodHit.nameAr || prodHit.productName,
            confidence: 85,
            matched_alias: variant,
            search_method: "exact_canonical",
            matchedReason: "Matched via Product Index (Ingredient Profile)",
          }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, 0, [], 0, [], 0, [], 0, [], 1, []);
        }
      }

      // 4. Dish Check (Last Resort)
      for (const variant of expandedVariants) {
        const dishHit = indexes.exactDishIndex.get(variant) || indexes.dishAliasIndex.get(variant);
        if (dishHit) {
          const d = Array.isArray(dishHit) ? dishHit[0] : dishHit;
          return this.formatResult({
            entity_type: "dish",
            canonical_id: d.id,
            canonical_name: d.nameAr,
            confidence: 60,
            matched_alias: variant,
            search_method: "fuzzy",
            matchedReason: "Matched via Dish Index (Last Resort Ingredient Profile)",
          }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, 0, [], 0, [], 0, [], 1, [], 0, []);
        }
      }

      // NOT_FOUND
      return this.formatResult({
        canonicalId: 0,
        canonicalEntityType: "food",
        canonicalName: rawQuery,
        searchConfidence: 0,
        entity_type: "food",
        canonical_id: 0,
        canonical_name: rawQuery,
        confidence: 0,
        matched_alias: null,
        search_method: "ai_fallback",
        matchedReason: "No ingredient match found in DB",
        matchType: "NOT_FOUND",
        searchOutcome: "NOT_FOUND",
      }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, 0, [], 0, [], 0, [], 0, [], 0, []);
    }

    // =========================================================================
    // MULTI-RESULT HIGH PERFORMANCE AUTOCOMPLETE PIPELINE (Top 10)
    // =========================================================================
    if (mode === SearchMode.AUTOCOMPLETE) {
      const candidates: SearchResult[] = [];
      const seenEntities = new Set<string>();

      const addCandidate = (item: {
        canonicalId: number | string;
        canonicalEntityType: EntityType;
        canonicalName: string;
        searchConfidence: number;
        matchedAlias?: string | null;
        matchType: MatchType;
        matchedReason: string;
      }) => {
        const key = `${item.canonicalEntityType}:${item.canonicalId}`;
        if (seenEntities.has(key)) return;
        seenEntities.add(key);

        candidates.push({
          canonicalId: item.canonicalId,
          canonicalEntityType: item.canonicalEntityType,
          canonicalName: item.canonicalName,
          searchConfidence: item.searchConfidence,
          matchedAlias: item.matchedAlias || null,
          matchType: item.matchType,
          matchedReason: item.matchedReason,
          searchOutcome: "FOUND",
          entity_type: item.canonicalEntityType,
          canonical_id: item.canonicalId,
          canonical_name: item.canonicalName,
          confidence: item.searchConfidence,
          matched_alias: item.matchedAlias || null,
          search_method: "starts_with",
        });
      };

      const qNorm = queryNorm;
      const qStripped = stripArticle(qNorm);
      const prefixKey = qNorm.slice(0, Math.min(qNorm.length, 3));

      // 1. FOODS: Check foodPrefixIndex & foodAliasIndex
      const prefixFoods = indexes.foodPrefixIndex.get(prefixKey) || [];
      for (const f of prefixFoods) {
        const normAr = normalize(f.nameAr);
        const strippedAr = stripArticle(normAr);
        if (normAr.startsWith(qNorm) || strippedAr.startsWith(qStripped) || normAr.includes(qNorm)) {
          const isPrefix = normAr.startsWith(qNorm) || strippedAr.startsWith(qStripped);
          addCandidate({
            canonicalId: f.id,
            canonicalEntityType: "food",
            canonicalName: f.nameAr,
            searchConfidence: isPrefix ? 98 : 82,
            matchType: isPrefix ? "PREFIX" : "FUZZY",
            matchedReason: isPrefix ? "Matched via Food Prefix Index" : "Matched via Food Partial Match",
          });
        }
      }

      for (const [alias, foodRef] of indexes.foodAliasIndex.entries()) {
        const normAlias = normalize(alias);
        const strippedAlias = stripArticle(normAlias);
        if (normAlias.startsWith(qNorm) || strippedAlias.startsWith(qStripped) || normAlias.includes(qNorm)) {
          const isPrefix = normAlias.startsWith(qNorm) || strippedAlias.startsWith(qStripped);
          addCandidate({
            canonicalId: foodRef.id,
            canonicalEntityType: "food",
            canonicalName: foodRef.nameAr,
            searchConfidence: isPrefix ? 98 : 85,
            matchedAlias: alias,
            matchType: isPrefix ? "ALIAS" : "FUZZY",
            matchedReason: `Matched via Food Alias '${alias}'`,
          });
        }
      }

      // 2. DISHES: Check dishPrefixIndex & dishAliasIndex
      const prefixDishes = indexes.dishPrefixIndex.get(prefixKey) || [];
      for (const d of prefixDishes) {
        const normAr = normalize(d.nameAr);
        const strippedAr = stripArticle(normAr);
        if (normAr.startsWith(qNorm) || strippedAr.startsWith(qStripped) || normAr.includes(qNorm)) {
          const isPrefix = normAr.startsWith(qNorm) || strippedAr.startsWith(qStripped);
          addCandidate({
            canonicalId: d.id,
            canonicalEntityType: "dish",
            canonicalName: d.nameAr,
            searchConfidence: isPrefix ? 95 : 75,
            matchType: isPrefix ? "PREFIX" : "FUZZY",
            matchedReason: isPrefix ? "Matched via Dish Prefix Index" : "Matched via Dish Partial Match",
          });
        }
      }

      for (const [alias, dishRef] of indexes.dishAliasIndex.entries()) {
        const normAlias = normalize(alias);
        const strippedAlias = stripArticle(normAlias);
        if (normAlias.startsWith(qNorm) || strippedAlias.startsWith(qStripped) || normAlias.includes(qNorm)) {
          const dishArr = Array.isArray(dishRef) ? dishRef : [dishRef];
          for (const d of dishArr) {
            const isPrefix = normAlias.startsWith(qNorm) || strippedAlias.startsWith(qStripped);
            addCandidate({
              canonicalId: d.id,
              canonicalEntityType: "dish",
              canonicalName: d.nameAr,
              searchConfidence: isPrefix ? 92 : 72,
              matchedAlias: alias,
              matchType: isPrefix ? "ALIAS" : "FUZZY",
              matchedReason: `Matched via Dish Alias '${alias}'`,
            });
          }
        }
      }

      // 3. PRODUCTS: Check productPrefixIndex & ProductDatabase
      const prefixProducts = indexes.productPrefixIndex?.get(prefixKey) || [];
      for (const p of prefixProducts) {
        const normAr = normalize(p.productName || p.nameAr || "");
        const normEn = normalize(p.nameEn || "");
        if (normAr.startsWith(qNorm) || normEn.startsWith(qNorm) || normAr.includes(qNorm)) {
          const isPrefix = normAr.startsWith(qNorm) || normEn.startsWith(qNorm);
          addCandidate({
            canonicalId: p.productId || p.id,
            canonicalEntityType: "product",
            canonicalName: p.productName || p.nameAr,
            searchConfidence: isPrefix ? 85 : 70,
            matchType: isPrefix ? "PREFIX" : "FUZZY",
            matchedReason: "Matched via Product Index",
          });
        }
      }

      const prodMatches = ProductDatabase.searchProduct({ alias: rawQuery, brand: rawQuery, nameAr: rawQuery, nameEn: rawQuery });
      if (prodMatches) {
        addCandidate({
          canonicalId: prodMatches.productId || prodMatches.id,
          canonicalEntityType: "product",
          canonicalName: prodMatches.productName || prodMatches.nameAr || rawQuery,
          searchConfidence: 90,
          matchType: "EXACT",
          matchedReason: "Matched via Commercial Product Database",
        });
      }

      // Rank candidates using Phase 7.2 Intelligent Weighted Ranking Engine
      const rankedCandidates = rankCandidates(candidates, rawQuery, SearchRankingProfile.AUTOCOMPLETE);

      if (rankedCandidates.length === 0) {
        return this.formatResult({
          canonicalId: 0,
          canonicalEntityType: "food",
          canonicalName: rawQuery,
          searchConfidence: 0,
          entity_type: "food",
          canonical_id: 0,
          canonical_name: rawQuery,
          confidence: 0,
          matched_alias: null,
          search_method: "ai_fallback",
          matchedReason: "No autocomplete candidates found",
          matchType: "NOT_FOUND",
          searchOutcome: "NOT_FOUND",
        }, tStart, isDebug, rawQuery, queryNorm, [], [], 0, [], 0, [], 0, [], 0, [], 0, []);
      }

      if (rankedCandidates.length === 1) {
        const single = rankedCandidates[0];
        single.searchOutcome = "FOUND";
        return this.formatResult(single, tStart, isDebug, rawQuery, queryNorm, [], [], 0, [], 0, [], 0, [], 0, [], 0, []);
      }

      const primary: SearchResult = {
        ...rankedCandidates[0],
        matchType: "AMBIGUOUS",
        searchOutcome: "AMBIGUOUS",
        isAmbiguous: true,
        candidateDishes: rankedCandidates,
        matchedReason: `Matched ${rankedCandidates.length} autocomplete candidate items`,
      };

      return this.formatResult(primary, tStart, isDebug, rawQuery, queryNorm, [], [], 0, [], 0, [], 0, [], 0, [], 0, []);
    }

    // =========================================================================
    // MODULAR PIPELINE: TEXT / CAMERA / OCR SEARCH
    // =========================================================================
    
    // Stage 1 & 2: Expansion Layer
    const expandedVariants = expandSearchQuery(rawQuery);
    // Compute which expanded variants came from synonym dictionary (baseline + dialect).
    // Used by Tier 2/3 to assign matchType = "SYNONYM" instead of "EXACT"/"ALIAS".
    const synonymTargetVariants = getQuerySynonymTargets(rawQuery);

    let foodAliasCount = 0; const foodAliasDetails: string[] = [];
    let foodCount = 0; const foodDetails: string[] = [];
    let dishAliasCount = 0; const dishAliasDetails: string[] = [];
    let dishCount = 0; const dishDetails: string[] = [];
    let productCount = 0; const productDetails: string[] = [];

    // Stage 3 & 4: Natural Entity Discovery (Sequential Tier Short-Circuiting)
    const dishCache = await warmDishEngineCache();

    // TIER 1: Barcode / Direct Commercial Product Check
    searchedIndexes.push("barcodeIndex", "exactProductIndex");
    const barcodeHit = indexes.barcodeIndex.get(rawQuery.trim());
    if (barcodeHit) {
      productCount++;
      productDetails.push(`${barcodeHit.productName} (100%)`);
      return this.formatResult({
        entity_type: "product",
        canonical_id: barcodeHit.productId || barcodeHit.id,
        canonical_name: barcodeHit.nameAr || barcodeHit.productName,
        confidence: 100,
        matched_alias: null,
        search_method: "barcode_match",
        matchedReason: "Matched via Barcode Index",
      }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
    }

    // Check Commercial Product Brand Precedence (Nutella, Pepsi, Coca Cola, etc.)
    for (const variant of expandedVariants) {
      const prodHit = indexes.exactProductIndex.get(variant) || ProductDatabase.searchProduct({ alias: variant, brand: variant, nameAr: variant, nameEn: variant });
      if (prodHit) {
        productCount++;
        productDetails.push(`${prodHit.productName} (100%)`);
        return this.formatResult({
          entity_type: "product",
          canonical_id: prodHit.productId || prodHit.id,
          canonical_name: prodHit.nameAr || prodHit.productName,
          confidence: 100,
          matched_alias: variant !== queryNorm ? variant : null,
          search_method: "exact_canonical",
          matchedReason: "Matched via Commercial Product Index",
        }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
      }
    }

    // STRICT DOMAIN ISOLATION GATEWAY:
    // If the request explicitly specifies SearchMode.BARCODE or SearchMode.PRODUCT,
    // and no product match was found in Tier 1, terminate immediately with NOT_FOUND.
    // NEVER allow product/barcode queries to leak into Food or Dish domains!
    if ((mode as any) === SearchMode.BARCODE || mode === SearchMode.PRODUCT) {
      const unmappedProductResult: CanonicalSearchResult = {
        canonicalId: 0,
        canonicalEntityType: "product",
        canonicalName: rawQuery,
        searchConfidence: 0,
        entity_type: "product",
        canonical_id: 0,
        canonical_name: rawQuery,
        confidence: 0,
        matched_alias: null,
        search_method: "ai_fallback",
        matchedReason: "No matching product found in Product DB",
        matchType: "NOT_FOUND",
      };
      return this.formatResult(unmappedProductResult, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
    }

    // TIER 2: Food Alias Match (Evaluates all expanded variants)
    searchedIndexes.push("foodAliasIndex");
    for (const variant of expandedVariants) {
      const foodHit = indexes.foodAliasIndex.get(variant);
      if (foodHit) {
        // CANONICAL ENTITY PRECEDENCE CHECK:
        // If this alias hit was reached via synonym expansion (e.g. بندورة→طماطم),
        // verify the original query is NOT itself a canonical food entity.
        // If it is (e.g. البندورة = Food 1586 exists as a canonical name), let Tier 3 handle it.
        const isSynonymHit = synonymTargetVariants.has(variant) && stripArticle(variant) !== stripArticle(queryNorm);
        if (isSynonymHit) {
          // Check if original query maps directly to a canonical food
          const origExact = indexes.exactFoodIndex.get(queryNorm) || indexes.exactFoodIndex.get(stripArticle(queryNorm));
          if (origExact) {
            // Original query IS a canonical food — skip alias and let Tier 3 resolve it correctly
            continue;
          }
        }

        foodAliasCount++;
        // Determine if this hit was reached via synonym expansion (baseline or dialect).
        // Synonym-derived matches are labeled SYNONYM at 90% confidence, not EXACT at 100%.
        const aliasConf = isSynonymHit ? 90 : 100;
        const aliasMethod: SearchMethod = "exact_alias";
        const aliasMatchReason = isSynonymHit
          ? `Matched via Synonym Expansion '${variant}' (dialect/baseline)`
          : `Matched via Food Alias '${variant}'`;
        foodAliasDetails.push(`${foodHit.nameAr} via alias '${variant}' (${aliasConf}%)`);
        return this.formatResult({
          entity_type: "food",
          canonical_id: foodHit.id,
          canonical_name: foodHit.nameAr,
          confidence: aliasConf,
          matched_alias: variant,
          search_method: aliasMethod,
          matchType: isSynonymHit ? "SYNONYM" : "ALIAS",
          matchedReason: aliasMatchReason,
        }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
      }
    }


    // TIER 3: Foods Exact Match (Evaluates all expanded variants)
    searchedIndexes.push("exactFoodIndex");
    for (const variant of expandedVariants) {
      const foodHit = indexes.exactFoodIndex.get(variant);
      if (foodHit) {
        let primaryFood = foodHit;
        if (Array.isArray(foodHit)) {
          // Sort candidates:
          // 1. Exact full name match to variant
          // 2. Root category / no parent
          // 3. Shorter name length
          // 4. Lower ID
          const sorted = [...foodHit].sort((a: any, b: any) => {
            const aNorm = normalize(a.nameAr);
            const bNorm = normalize(b.nameAr);
            const aStrip = stripArticle(aNorm);
            const bStrip = stripArticle(bNorm);

            const aExact = (aNorm === variant || aStrip === variant) ? 1 : 0;
            const bExact = (bNorm === variant || bStrip === variant) ? 1 : 0;
            if (bExact !== aExact) return bExact - aExact;

            const aRoot = (a.foodType === "general_category" || a.parentFoodId === null) ? 1 : 0;
            const bRoot = (b.foodType === "general_category" || b.parentFoodId === null) ? 1 : 0;
            if (bRoot !== aRoot) return bRoot - aRoot;

            if (a.nameAr.length !== b.nameAr.length) return a.nameAr.length - b.nameAr.length;
            return a.id - b.id;
          });
          primaryFood = sorted[0];
        }

        const isSynonymHit = synonymTargetVariants.has(variant) && stripArticle(variant) !== stripArticle(queryNorm);
        const foodConf = isSynonymHit ? 90 : 95;
        const foodMatchType: MatchType = isSynonymHit ? "SYNONYM" : "EXACT";
        const foodMatchReason = isSynonymHit
          ? `Matched via Synonym Expansion '${variant}' (dialect/baseline)`
          : "Matched via Food Canonical Name";

        // If this query is a bare base term (e.g. "طماطم", "شاي", "بطاطا") whose family has multiple distinct variants:
        const isEnglish = /[a-zA-Z]/.test(rawQuery);
        const queryWords = queryNorm.split(/\s+/).filter(Boolean);
        const baseKey = stripArticle(queryNorm) || queryNorm;
        const baseVariants = indexes.baseFoodIndex.get(baseKey) || indexes.baseFoodIndex.get(queryNorm) || [];
        const exactHits = indexes.exactFoodIndex.get(baseKey) || indexes.exactFoodIndex.get(queryNorm);
        const exactList = exactHits ? (Array.isArray(exactHits) ? exactHits : [exactHits]) : [];

        const hasCleanBaseFood = exactList.some((e: any) => !hasRecognizedDescriptor(e.nameAr));
        const hasFamilyAmbiguity = !isEnglish && !hasCleanBaseFood && (
          baseVariants.length > 1 ||
          exactList.length > 1
        );

        if (queryWords.length === 1 && hasFamilyAmbiguity) {
          const candidates: SearchResult[] = [];
          const seenIds = new Set<number>();
          for (const e of exactList) {
            if (!seenIds.has(e.id)) {
              seenIds.add(e.id);
              candidates.push({
                canonicalId: e.id,
                canonicalEntityType: "food" as EntityType,
                canonicalName: e.nameAr,
                searchConfidence: 95,
                matchedAlias: null,
                matchType: "EXACT",
                matchedReason: "Matched via Food Canonical Name",
                entity_type: "food",
                canonical_id: e.id,
                canonical_name: e.nameAr,
                confidence: 95,
                matched_alias: null,
                search_method: "exact_canonical",
              });
            }
          }
          for (const v of baseVariants) {
            if (!seenIds.has(v.id)) {
              seenIds.add(v.id);
              candidates.push({
                canonicalId: v.id,
                canonicalEntityType: "food" as EntityType,
                canonicalName: v.nameAr,
                searchConfidence: 85,
                matchedAlias: null,
                matchType: "VARIANT",
                matchedReason: "Matched via Generic Food Family Variant",
                entity_type: "food",
                canonical_id: v.id,
                canonical_name: v.nameAr,
                confidence: 85,
                matched_alias: null,
                search_method: "base_entity_resolution",
              });
            }
          }

          const qAr = formatAmbiguityQuestion(rawQuery);
          return this.formatResult({
            canonicalId: 0,
            canonicalEntityType: "food",
            canonicalName: rawQuery,
            searchConfidence: 85,
            entity_type: "food",
            canonical_id: 0,
            canonical_name: rawQuery,
            confidence: 85,
            matched_alias: null,
            search_method: "base_entity_resolution",
            matchedReason: `Matched ${candidates.length} variants for generic query '${rawQuery}'`,
            matchType: "AMBIGUOUS",
            searchOutcome: "AMBIGUOUS",
            isAmbiguous: true,
            candidateDishes: candidates,
            candidateFoods: candidates,
            questionAr: qAr,
          }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
        }

        foodCount++;
        foodDetails.push(`${primaryFood.nameAr} (${foodConf}%)`);
        return this.formatResult({
          entity_type: "food",
          canonical_id: primaryFood.id,
          canonical_name: primaryFood.nameAr,
          confidence: foodConf,
          matched_alias: isSynonymHit ? variant : null,
          search_method: "exact_canonical",
          matchType: foodMatchType,
          matchedReason: foodMatchReason,
        }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
      }
    }

    // TIER 4: Dish Alias Match (Evaluates all expanded variants with Equivalence Guard)
    searchedIndexes.push("dishAliasIndex");
    for (const variant of expandedVariants) {
      const dishHit = indexes.dishAliasIndex.get(variant);
      if (dishHit) {
        const isExactQueryVariant = variant === queryNorm;
        const aliasConf = isExactQueryVariant ? 100 : 90;
        const aliasMatchType: MatchType = "ALIAS";

        if (Array.isArray(dishHit)) {
          const validCandidates = dishHit.filter((d: any) => this.verifyDishEquivalence(rawQuery, d, dishCache));
          if (validCandidates.length > 0) {
            dishAliasCount += validCandidates.length;
            const candidates: SearchResult[] = validCandidates.map((d: any) => ({
              canonicalId: d.id,
              canonicalEntityType: "dish" as EntityType,
              canonicalName: d.nameAr,
              searchConfidence: aliasConf,
              matchedAlias: variant,
              matchType: aliasMatchType,
              matchedReason: `Matched via Dish Alias '${variant}'`,
              entity_type: "dish",
              canonical_id: d.id,
              canonical_name: d.nameAr,
              confidence: aliasConf,
              matched_alias: variant,
              search_method: "exact_alias",
            }));
            const primary: any = { ...candidates[0] };
            if (candidates.length > 1) {
              primary.isAmbiguous = true;
              primary.canonicalId = 0;
              primary.canonical_id = 0;
              primary.canonicalName = null;
              primary.canonical_name = null;
              primary.matchType = "AMBIGUOUS";
              primary.matchedReason = `Matched ${candidates.length} candidate dishes via Dish Alias '${variant}'`;
              primary.candidateDishes = candidates;
            }
            return this.formatResult(primary, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
          }
        } else {
          if (this.verifyDishEquivalence(rawQuery, dishHit, dishCache)) {
            dishAliasCount++;
            dishAliasDetails.push(`${dishHit.nameAr} via alias '${variant}' (${aliasConf}%)`);
            return this.formatResult({
              canonicalId: dishHit.id,
              canonicalEntityType: "dish",
              canonicalName: dishHit.nameAr,
              searchConfidence: aliasConf,
              matchedAlias: variant,
              matchType: aliasMatchType,
              matchedReason: `Matched via Dish Alias '${variant}'`,
              entity_type: "dish",
              canonical_id: dishHit.id,
              canonical_name: dishHit.nameAr,
              confidence: aliasConf,
              matched_alias: variant,
              search_method: "exact_alias",
            }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
          }
        }
      }
    }

    // TIER 5: Dishes Exact Match (Evaluates all expanded variants with Equivalence Guard)
    searchedIndexes.push("exactDishIndex");
    for (const variant of expandedVariants) {
      const dishHit = indexes.exactDishIndex.get(variant);
      if (dishHit) {
        const isExactQueryVariant = variant === queryNorm;
        const conf = isExactQueryVariant ? 100 : 85;
        const mType: MatchType = isExactQueryVariant ? "EXACT" : "FUZZY";
        const sMethod: SearchMethod = isExactQueryVariant ? "exact_canonical" : "fuzzy";
        const mReason = isExactQueryVariant ? "Matched via Dish Canonical Name" : `Matched via Dish Variant '${variant}'`;

        if (Array.isArray(dishHit)) {
          const validCandidates = dishHit.filter((d: any) => this.verifyDishEquivalence(rawQuery, d, dishCache));
          if (validCandidates.length > 0) {
            dishCount += validCandidates.length;
            const candidates: SearchResult[] = validCandidates.map((d: any) => ({
              canonicalId: d.id,
              canonicalEntityType: "dish" as EntityType,
              canonicalName: d.nameAr,
              searchConfidence: conf,
              matchedAlias: isExactQueryVariant ? null : variant,
              matchType: mType,
              matchedReason: mReason,
              entity_type: "dish",
              canonical_id: d.id,
              canonical_name: d.nameAr,
              confidence: conf,
              matched_alias: isExactQueryVariant ? null : variant,
              search_method: sMethod,
            }));
            const primary: any = { ...candidates[0] };
            if (candidates.length > 1) {
              primary.isAmbiguous = true;
              primary.canonicalId = 0;
              primary.canonical_id = 0;
              primary.canonicalName = null;
              primary.canonical_name = null;
              primary.matchType = "AMBIGUOUS";
              primary.matchedReason = `Matched ${candidates.length} candidate dishes for '${rawQuery}'`;
              primary.candidateDishes = candidates;
            }
            return this.formatResult(primary, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
          }
        } else {
          if (this.verifyDishEquivalence(rawQuery, dishHit, dishCache)) {
            dishCount++;
            dishDetails.push(`${dishHit.nameAr} (${conf}%)`);
            return this.formatResult({
              entity_type: "dish",
              canonical_id: dishHit.id,
              canonical_name: dishHit.nameAr,
              confidence: conf,
              matched_alias: isExactQueryVariant ? null : variant,
              search_method: sMethod,
              matchedReason: mReason,
              matchType: mType,
            }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
          }
        }
      }
    }

    // TIER 6: Product Alias Match
    searchedIndexes.push("productAliasIndex");
    for (const variant of expandedVariants) {
      const prodHit = indexes.productAliasIndex.get(variant);
      if (prodHit) {
        productCount++;
        productDetails.push(`${prodHit.productName} via alias '${variant}' (80%)`);
        return this.formatResult({
          entity_type: "product",
          canonical_id: prodHit.productId || prodHit.id,
          canonical_name: prodHit.nameAr || prodHit.productName,
          confidence: 80,
          matched_alias: variant,
          search_method: "exact_alias",
          matchedReason: `Matched via Product Alias '${variant}'`,
        }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
      }
    }

    // =========================================================================
    // STAGE 5.5: CANONICAL ENTITY RESOLUTION STAGE
    // Extract base entity by stripping generic descriptors (regions, colors, forms, size, dish associations)
    // Example: "أرز مصري" -> "أرز", "جميد كركي" -> "جميد", "خبز شراك" -> "خبز", "بهارات منسف" -> "بهارات"
    // =========================================================================
    // =========================================================================
    // STAGE 5.5: CANONICAL ENTITY RESOLUTION STAGE
    // Extract base entity by stripping generic descriptors (regions, colors, forms, size, dish associations)
    // PRESERVES modifiers (e.g. ["بني"], ["اسمر"]) for downstream compatibility evaluation!
    // Example: "أرز مصري" -> Base Entity "أرز", Modifiers ["مصري"]
    // Example: "رز بني" -> Base Entity "رز", Modifiers ["بني"]
    // =========================================================================
    const extractionRes = extractBaseEntityWithModifiers(rawQuery);
    const baseEntity = extractionRes?.baseEntity;
    if (extractionRes && normalize(extractionRes.baseEntity) !== queryNorm) {
      const modifiers = extractionRes.modifiers;
      const baseVariants = expandSearchQuery(extractionRes.baseEntity);
      const baseConfidence = 100;
      const dishCache = await warmDishEngineCache();

      // Rule 1 Prepared Dish Guard:
      // If the query contains explicit culinary/preparation indicators (e.g. "مشوي", "بالفرن", "مقلي", "طاجن", "محشي"),
      // do NOT prematurely collapse the query to a raw food entity if an eligible prepared dish exists in dishCache.
      const hasPreparationIndicator = modifiers.some(m => PREPARATION_DESCRIPTORS.has(m) || PREPARATION_DESCRIPTORS.has(stripArticle(m)));

      if (hasPreparationIndicator) {
        // Evaluate candidate dishes in dishCache first
        for (const d of dishCache.dishes || []) {
          const dNorm = normalize(d.nameAr);
          const match = this.calculateTokenMatch(queryNorm, dNorm, false);
          if (match.matches && match.score >= 70 && this.verifyDishEquivalence(rawQuery, d, dishCache)) {
            dishCount++;
            dishDetails.push(`${d.nameAr} (${match.score}%)`);
            return this.formatResult({
              entity_type: "dish",
              canonical_id: d.id,
              canonical_name: d.nameAr,
              confidence: match.score,
              matched_alias: null,
              search_method: match.method,
              matchedReason: `Matched via Prepared Dish Guard (${match.method})`,
              modifiers,
              matchType: "PREFIX",
            }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
          }
        }
      }

      for (const bVar of baseVariants) {
        // Check Food Alias on Base Entity
        const foodAliasHit = indexes.foodAliasIndex.get(bVar);
        if (foodAliasHit) {
          foodAliasCount++;
          foodAliasDetails.push(`${foodAliasHit.nameAr} via base entity '${baseEntity}' (${baseConfidence}%)`);
          return this.formatResult({
            entity_type: "food",
            canonical_id: foodAliasHit.id,
            canonical_name: foodAliasHit.nameAr,
            confidence: baseConfidence,
            matched_alias: bVar,
            search_method: "base_entity_resolution",
            matchedReason: `Matched via Base Entity Resolution ('${baseEntity}' extracted from '${rawQuery}')`,
            modifiers,
            matchType: "BASE_ENTITY",
          }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
        }

        // Check Exact Food on Base Entity
        const exactFoodHit = indexes.exactFoodIndex.get(bVar);
        if (exactFoodHit) {
          const primaryFood = Array.isArray(exactFoodHit) ? exactFoodHit[0] : exactFoodHit;
          foodCount++;
          foodDetails.push(`${primaryFood.nameAr} via base entity '${baseEntity}' (${baseConfidence}%)`);
          return this.formatResult({
            entity_type: "food",
            canonical_id: primaryFood.id,
            canonical_name: primaryFood.nameAr,
            confidence: baseConfidence,
            matched_alias: null,
            search_method: "base_entity_resolution",
            matchedReason: `Matched via Base Entity Resolution ('${baseEntity}' extracted from '${rawQuery}')`,
            modifiers,
            matchType: "BASE_ENTITY",
          }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
        }

        // Check Dish Alias on Base Entity with Generic Equivalence Guard
        const dishAliasHit = indexes.dishAliasIndex.get(bVar);
        if (dishAliasHit) {
          const dishObj = Array.isArray(dishAliasHit) ? dishAliasHit[0] : dishAliasHit;
          if (this.verifyDishEquivalence(rawQuery, dishObj, dishCache)) {
            dishAliasCount++;
            dishAliasDetails.push(`${dishObj.nameAr} via base entity '${baseEntity}' (85%)`);
            return this.formatResult({
              entity_type: "dish",
              canonical_id: dishObj.id,
              canonical_name: dishObj.nameAr,
              confidence: 85,
              matched_alias: bVar,
              search_method: "base_entity_resolution",
              matchedReason: `Matched via Base Entity Resolution ('${baseEntity}' extracted from '${rawQuery}')`,
              modifiers,
              matchType: "BASE_ENTITY",
            }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
          }
        }

        // Check Exact Dish on Base Entity with Generic Equivalence Guard
        const exactDishHit = indexes.exactDishIndex.get(bVar);
        if (exactDishHit) {
          const dishObj = Array.isArray(exactDishHit) ? exactDishHit[0] : exactDishHit;
          if (this.verifyDishEquivalence(rawQuery, dishObj, dishCache)) {
            dishCount++;
            dishDetails.push(`${dishObj.nameAr} via base entity '${baseEntity}' (85%)`);
            return this.formatResult({
              entity_type: "dish",
              canonical_id: dishObj.id,
              canonical_name: dishObj.nameAr,
              confidence: 85,
              matched_alias: null,
              search_method: "base_entity_resolution",
              matchedReason: `Matched via Base Entity Resolution ('${baseEntity}' extracted from '${rawQuery}')`,
              modifiers,
              matchType: "BASE_ENTITY",
            }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
          }
        }
      }
    }

    // Generic Food Family Ambiguity Check before falling to fuzzy matching
    // (e.g. "شاي" or "شاي أسود" -> returns AMBIGUOUS with "شاي أخضر" and "شاي أحمر (أسود)" choices)
    const baseKeys: string[] = [queryNorm, stripArticle(queryNorm)];
    if (baseEntity) {
      baseKeys.push(normalize(baseEntity), stripArticle(normalize(baseEntity)));
    }
    let baseVariantsList: any[] = [];
    const seenBk = new Set<string>();
    for (const bk of baseKeys) {
      if (!bk || seenBk.has(bk)) continue;
      seenBk.add(bk);
      const list = indexes.baseFoodIndex.get(bk);
      if (list && list.length > 1) {
        baseVariantsList = list;
        break;
      }
    }
    if (baseVariantsList.length > 1) {
      const candidates: SearchResult[] = baseVariantsList.map((f: any) => ({
        canonicalId: f.id,
        canonicalEntityType: "food" as EntityType,
        canonicalName: f.nameAr,
        searchConfidence: 85,
        matchedAlias: null,
        matchType: "VARIANT",
        matchedReason: `Matched via Generic Food Family Variant`,
        entity_type: "food",
        canonical_id: f.id,
        canonical_name: f.nameAr,
        confidence: 85,
        matched_alias: null,
        search_method: "base_entity_resolution",
      }));

      return this.formatResult({
        canonicalId: 0,
        canonicalEntityType: "food",
        canonicalName: rawQuery,
        searchConfidence: 85,
        entity_type: "food",
        canonical_id: 0,
        canonical_name: rawQuery,
        confidence: 85,
        matched_alias: null,
        search_method: "base_entity_resolution",
        matchedReason: `Matched ${candidates.length} variants for generic query '${rawQuery}'`,
        matchType: "AMBIGUOUS",
        searchOutcome: "AMBIGUOUS",
        isAmbiguous: true,
        candidateDishes: candidates,
        candidateFoods: candidates,
        questionAr: formatAmbiguityQuestion(rawQuery),
      }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
    }

    // TIER 7: Candidate-Bounded Fuzzy / Similarity Match (Evaluates all expanded variants)
    const knowledgeCache = await getKnowledgeCache();

    // Check fuzzy on dishes first across all expanded variants with canonical prioritization ranking and Equivalence Guard
    const dishCandidates: Array<{ dish: any; score: number; method: SearchMethod; variant: string }> = [];
    for (const variant of expandedVariants) {
      for (const d of dishCache.dishes || []) {
        const dNorm = normalize(d.nameAr);
        const match = this.calculateTokenMatch(variant, dNorm, false);
        if (match.matches && match.score >= 65) {
          let score = match.score;
          const stripVariant = stripArticle(variant);
          const stripDish = stripArticle(dNorm);

          if (stripDish.startsWith(stripVariant)) {
            score += 15; // Starts with query term bonus
          }
          if (stripDish === stripVariant) {
            score += 25; // Exact match bonus
          }
          const extraTokens = Math.max(0, stripDish.split(" ").length - stripVariant.split(" ").length);
          if (extraTokens > 1) {
            score -= extraTokens * 5; // Penalty for compound dish names
          }

          // GENERIC EQUIVALENCE GUARD: Fuzzy match MUST pass concept preservation check
          if (this.verifyDishEquivalence(rawQuery, d, dishCache)) {
            dishCandidates.push({ dish: d, score, method: match.method, variant });
          }
        }
      }
    }

    // Check fuzzy on foods across all expanded variants
    const foodCandidates: Array<{ food: any; score: number; method: SearchMethod; variant: string }> = [];
    for (const variant of expandedVariants) {
      for (const f of knowledgeCache.foods || []) {
        const fNorm = normalize(f.nameAr);
        const match = this.calculateTokenMatch(variant, fNorm, false);
        if (match.matches && match.score >= 60) {
          let score = match.score;
          const stripVariant = stripArticle(variant);
          const stripFood = stripArticle(fNorm);

          if (stripFood.startsWith(stripVariant)) {
            score += 15;
          }
          if (stripFood === stripVariant) {
            score += 25;
          }
          // If query has preparation descriptors (e.g. "مشوي", "بالفرن"), penalize raw food candidates that lack them
          const queryTokens = stripVariant.split(" ");
          const foodTokens = stripFood.split(" ");
          const hasPrepWord = queryTokens.some(qt => PREPARATION_DESCRIPTORS.has(qt) || PREPARATION_DESCRIPTORS.has(stripArticle(qt)));
          const foodHasPrepWord = foodTokens.some(ft => PREPARATION_DESCRIPTORS.has(ft) || PREPARATION_DESCRIPTORS.has(stripArticle(ft)));

          if (hasPrepWord && !foodHasPrepWord) {
            score -= 30; // Significant penalty: query requests a prepared dish, not raw ingredient
          }

          // If query does not have descriptors, penalize candidate foods that have recognized descriptors (unless exact match)
          const queryHasDesc = queryTokens.some(qt => hasRecognizedDescriptor(qt));
          const foodHasDesc = hasRecognizedDescriptor(fNorm);
          if (!queryHasDesc && foodHasDesc && stripFood !== stripVariant) {
            score -= 10;
          }

          foodCandidates.push({ food: f, score, method: match.method, variant });
        }
      }
    }

    if (foodCandidates.length > 0) {
      foodCandidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const qTokens = stripArticle(rawQuery).split(" ");
        const qHasDesc = qTokens.some(qt => hasRecognizedDescriptor(qt));
        if (!qHasDesc) {
          const descA = hasRecognizedDescriptor(a.food.nameAr) ? 1 : 0;
          const descB = hasRecognizedDescriptor(b.food.nameAr) ? 1 : 0;
          if (descA !== descB) return descA - descB;
        }
        return stripArticle(a.food.nameAr).length - stripArticle(b.food.nameAr).length;
      });
    }

    // Compare top food vs top dish: if top food score >= top dish score, prioritize food
    const topFood = foodCandidates[0] || null;
    const topDish = dishCandidates[0] || null;

    if (topFood && (!topDish || topFood.score >= topDish.score)) {
      // Confidence floor: if topFood score is below 60, reject as insufficient match
      if (topFood.score >= 60) {
        foodCount += foodCandidates.length;
        foodDetails.push(`${topFood.food.nameAr} (${topFood.score}%)`);
        return this.formatResult({
          entity_type: "food",
          canonical_id: topFood.food.id,
          canonical_name: topFood.food.nameAr,
          confidence: Math.min(topFood.score, 100),
          matched_alias: topFood.variant !== queryNorm ? topFood.variant : null,
          search_method: topFood.method,
          matchedReason: `Matched via Food Similarity (${topFood.method})`,
        }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
      }
    }

    if (topDish) {
      dishCount += dishCandidates.length;
      dishDetails.push(`${topDish.dish.nameAr} (${topDish.score}%)`);

      return this.formatResult({
        canonicalId: topDish.dish.id,
        canonicalEntityType: "dish",
        canonicalName: topDish.dish.nameAr,
        searchConfidence: Math.min(topDish.score, 100),
        matchType: topDish.method === "exact_canonical" || topDish.method === "exact_alias" ? "EXACT" : (topDish.method === "starts_with" ? "PREFIX" : "FUZZY"),
        matchedReason: `Matched via Dish Canonical Prioritization (${topDish.method})`,
        matchedAlias: topDish.variant !== queryNorm ? topDish.variant : null,
      }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
    }

    // TIER 8: Smart "Did You Mean" Unmapped Response (Zero AI Invocation)
    const suggestions = generateSmartSuggestions(rawQuery);
    const unmappedResult: CanonicalSearchResult = {
      entity_type: "food",
      canonical_id: 0,
      canonical_name: rawQuery,
      confidence: 0,
      matched_alias: null,
      search_method: "ai_fallback",
      matchedReason: "No match found in Tayyibati DB",
      matchType: "NOT_FOUND",
      didYouMean: suggestions.length > 0 ? suggestions : undefined,
    };

    return this.formatResult(unmappedResult, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
  }

  private static verifyDishEquivalence(rawQuery: string, candidateDish: any, dishCache: any): boolean {
    if (!candidateDish) return false;

    const queryNorm = normalize(rawQuery);
    const dishNorm = normalize(candidateDish.nameAr || "");

    const stripVariant = stripArticle(queryNorm);
    const stripDish = stripArticle(dishNorm);

    // Exact normalized or stripped match is always equivalent
    if (stripVariant === stripDish || queryNorm === dishNorm) {
      return true;
    }

    // Check expanded variants for exact synonym/orthographic match
    const variants = expandSearchQuery(rawQuery);
    if (variants.some((v) => stripArticle(normalize(v)) === stripDish || normalize(v) === dishNorm)) {
      return true;
    }

    // Generic category words that do NOT define dish identity alone
    const GENERIC_CATEGORY_WORDS = new Set([
      "سلطة", "سلطه", "شوربة", "شوربه", "عصير", "مرق", "مرقة", "مرقه",
      "طاجن", "صينية", "صينيه", "طبق", "أرز", "ارز", "رز", "ادام", "إدام", "مشروب"
    ]);

    // Extract meaningful non-category tokens from query
    const queryTokens = stripVariant
      .split(/\s+/)
      .map((t) => stripArticle(t))
      .filter((t) => t.length > 1 && !GENERIC_CATEGORY_WORDS.has(t) && !CULINARY_DESCRIPTORS.has(t) && !["بال", "مع", "و", "من", "في", "على", "طريقة", "عمل"].includes(t));

    // If query consists only of generic category words, allow matching
    if (queryTokens.length === 0) {
      return true;
    }

    // Specificity Guard: A candidate dish must NOT introduce an unrequested major protein,
    // coordinated dish component, or distinct food entity that the query did not specify.
    // e.g. "حمص بالطحينة" must NOT match "حمص بالطحينة والشاورما"
    const ALL_PROTEINS = new Set([
      ...Array.from(PROTEIN_DESCRIPTORS),
      "شاورما", "كفتة", "كباب", "سجق", "تيركي", "تونة", "جمبري", "روبيان", "لحمة", "دجاجة", "فراخ", "قوزي"
    ]);

    const cleanDishToken = (t: string): string => {
      let s = t;
      if (s.startsWith("وال") && s.length > 4) s = s.slice(1);
      else if (s.startsWith("بال") && s.length > 4) s = s.slice(1);
      else if (s.startsWith("و") && s.length >= 4 && !["ورق", "وجبة", "وز"].some(w => s.startsWith(w))) s = s.slice(1);
      return stripArticle(s);
    };

    const candidateNameTokens = stripDish.split(/\s+/).map(cleanDishToken).filter((t) => t.length > 1);
    const queryTokenSet = new Set(queryTokens);
    stripVariant.split(/\s+/).forEach((t) => {
      queryTokenSet.add(cleanDishToken(t));
      queryTokenSet.add(stripArticle(t));
      queryTokenSet.add(normalize(t));
    });

    for (const cToken of candidateNameTokens) {
      if (ALL_PROTEINS.has(cToken) && !queryTokenSet.has(cToken)) {
        return false; // Rejected: Candidate introduces unqueried protein/major component!
      }
    }

    // Gather candidate footprint (nameAr, nameEn, aliases, ingredient raw names)
    const candidateFootprintParts: string[] = [candidateDish.nameAr || "", candidateDish.nameEn || ""];

    if (dishCache && dishCache.aliasesByDishId) {
      const aliases = dishCache.aliasesByDishId.get(candidateDish.id) || [];
      aliases.forEach((a: any) => {
        if (a.aliasAr) candidateFootprintParts.push(a.aliasAr);
        if (a.aliasEn) candidateFootprintParts.push(a.aliasEn);
      });
    }

    if (dishCache && dishCache.ingredientsByDishId) {
      const ingredients = dishCache.ingredientsByDishId.get(candidateDish.id) || [];
      ingredients.forEach((ing: any) => {
        if (ing.rawIngredientName) candidateFootprintParts.push(ing.rawIngredientName);
      });
    }

    const footprintText = normalize(candidateFootprintParts.join(" "));
    const footprintTokens = footprintText
      .split(/\s+/)
      .map((t) => stripArticle(t))
      .filter((t) => t.length > 1);

    // Every specific query concept token MUST be present in candidate footprint
    for (const qToken of queryTokens) {
      const matchedInFootprint = footprintTokens.some((fToken) =>
        fToken.includes(qToken) || qToken.includes(fToken)
      );

      if (!matchedInFootprint) {
        return false; // Rejected: Key query concept is missing from candidate dish!
      }
    }

    // Dish Head Noun Compatibility Check:
    // The candidate dish's primary culinary head noun (e.g. "فتة", "تسقية", "كبة", "طاجن")
    // must be matched by the query, unless the query consists entirely of generic category words.
    // e.g. "حمص بالطحينة" cannot match "تسقية بالسمنة (فتة حمص)" or "فتة حمص باللبن والثوم" because
    // the head noun of the dish ("تسقية" or "فتة") was never queried!
    if (queryTokens.length > 0) {
      const qHead = queryTokens[0];
      const rawDishParts = (candidateDish.nameAr || stripDish).split(/\/|[/—,()]+/);
      let matchedDishHead = false;

      for (const part of rawDishParts) {
        const pNorm = normalize(part.trim());
        const pStrip = stripArticle(pNorm);
        const pTokens = pStrip.split(/\s+/).filter((t) => t.length > 1 && !GENERIC_CATEGORY_WORDS.has(t));
        if (pTokens.length === 0) {
          matchedDishHead = true;
          break;
        }

        const pHead = pTokens[0];
        if (
          pHead === qHead ||
          pHead.startsWith(qHead) ||
          qHead.startsWith(pHead) ||
          queryTokens.some((qt) => pHead === qt || pHead.startsWith(qt) || qt.startsWith(pHead))
        ) {
          matchedDishHead = true;
          break;
        }
      }

      if (!matchedDishHead) {
        return false; // Rejected: Candidate dish head noun does not match query head noun!
      }
    }

    return true;
  }

  private static calculateTokenMatch(
    queryNorm: string,
    candidateNorm: string,
    isAlias: boolean = false
  ): { matches: boolean; score: number; method: SearchMethod } {
    const qClean = stripArticle(queryNorm);
    const cClean = stripArticle(candidateNorm);

    if (!qClean || !cClean) return { matches: false, score: 0, method: "fuzzy" };

    const isEnglishOrNoise = /^[a-z.]+$/i.test(qClean);
    const qTokens = qClean.split(" ").filter((t) => t.length > 0);
    const cTokens = cClean.split(" ").filter((t) => t.length > 0);

    if (qClean === cClean || queryNorm === candidateNorm) {
      return { matches: true, score: isAlias ? 100 : 95, method: isAlias ? "exact_alias" : "exact_canonical" };
    }

    // Short or non-Arabic query guard: prevent broad substring matches ("of" matching dish names)
    if (qClean.length < 3 || isEnglishOrNoise) {
      const isExactToken = qTokens.some((qt) => cTokens.some((ct) => ct === qt));
      if (!isExactToken) {
        return { matches: false, score: 0, method: "fuzzy" };
      }
    }

    // Helper for descriptor check: identifies generic, culinary, preparation descriptors, and stop words
    // GENERAL & SAFE RULE: If a token is recognized as a canonical food/dish/category head noun
    // in the database indexes, it must be allowed to act as the semantic head of the query!
    const isDescriptorToken = (token: string): boolean => {
      const stripped = stripArticle(token);
      const headNouns = cachedIndexes?.entityHeadNouns;
      if (headNouns && (headNouns.has(token) || headNouns.has(stripped))) {
        return false;
      }
      return (
        ARABIC_STOP_WORDS.has(token) ||
        ARABIC_STOP_WORDS.has(stripped) ||
        CULINARY_DESCRIPTORS.has(token) ||
        CULINARY_DESCRIPTORS.has(stripped) ||
        GENERIC_DESCRIPTORS.has(token) ||
        GENERIC_DESCRIPTORS.has(stripped) ||
        PREPARATION_DESCRIPTORS.has(token) ||
        PREPARATION_DESCRIPTORS.has(stripped)
      );
    };

    // Helper for whole word/token boundary matching: checks if a token exists as a complete word in target token list
    const hasWordTokenMatch = (queryToken: string, targetTokens: string[]): boolean => {
      return targetTokens.some((tt) => tt === queryToken);
    };

    const isWordStart =
      qClean.startsWith(cClean + " ") ||
      cClean.startsWith(qClean + " ") ||
      (qClean.length >= 4 && cClean.startsWith(qClean + " ")) ||
      (cClean.length >= 4 && qClean.startsWith(cClean + " "));

    // Single-word or all-descriptor queries must NOT match multi-token candidates via starts_with
    if (isWordStart && !(qTokens.every((t) => isDescriptorToken(t)) && cTokens.length > qTokens.length)) {
      return { matches: true, score: 85, method: "starts_with" };
    }

    const mainQTokens = qTokens.filter((t) => t.length >= 3 && !isDescriptorToken(t));

    // Multi-token similarity: require actual shared words/tokens, not mid-word substring slices
    if (mainQTokens.length > 1 && mainQTokens.every((t) => hasWordTokenMatch(t, cTokens) || cTokens.some(ct => ct.startsWith(t)))) {
      return { matches: true, score: 85, method: "token_similarity" };
    }

    // Single-word query containment: require whole word token match in candidate (e.g. "بني" must be a standalone word, not inside "سبنيورية")
    // ARCHITECTURAL GUARD: A single generic descriptor token (e.g. "بني", "ابيض", "مصري", "مشوي") MUST NEVER match a composite candidate (e.g. "الأرز بجميع أشكاله ... بني")
    if (qTokens.length === 1) {
      const singleQ = qTokens[0];
      if (!isDescriptorToken(singleQ) && (hasWordTokenMatch(singleQ, cTokens) || cTokens.some((ct) => ct.length >= 4 && ct.startsWith(singleQ)))) {
        return { matches: true, score: 75, method: "contains" };
      }
    } else if (qClean.includes(cClean) || cClean.includes(qClean)) {
      // Multi-word exact phrase containment: disallow if all query tokens are generic descriptors
      if (!qTokens.every((t) => isDescriptorToken(t))) {
        return { matches: true, score: 75, method: "contains" };
      }
    }

    // Non-descriptor, meaningful content tokens (must exclude preparation & generic descriptors so descriptors alone don't trigger a match)
    const qContentTokens = qTokens.filter((t) => t.length >= 3 && !isDescriptorToken(t));
    const cContentTokens = cTokens.filter((t) => t.length >= 3 && !isDescriptorToken(t));

    if (qContentTokens.length > 0 && cContentTokens.length > 0) {
      const sharedContent = qContentTokens.filter((t) =>
        cContentTokens.some((ct) => ct === t || (t.length >= 4 && ct.length >= 4 && (ct.startsWith(t) || t.startsWith(ct))))
      );
      if (sharedContent.length > 0) {
        // Also check if any additional tokens match
        const score = sharedContent.length > 1 ? 75 : 70;
        return { matches: true, score, method: "token_similarity" };
      }
    }

    return { matches: false, score: 0, method: "fuzzy" };
  }

  private static formatResult(
    res: Partial<SearchResult>,
    tStart: number,
    isDebug: boolean,
    rawQuery: string,
    queryNorm: string,
    expandedVariants: string[],
    searchedIndexes: string[],
    foodAliasCount: number, foodAliasDetails: string[],
    foodCount: number, foodDetails: string[],
    dishAliasCount: number, dishAliasDetails: string[],
    dishCount: number, dishDetails: string[],
    productCount: number, productDetails: string[]
  ): SearchResult {
    const executionTimeMs = Math.round((performance.now() - tStart) * 100) / 100;

    // Populate clean Phase 4 fields if missing
    if (res.canonicalId === undefined) res.canonicalId = res.canonical_id ?? 0;
    if (!res.canonicalEntityType) res.canonicalEntityType = res.entity_type || "food";
    if (!res.canonicalName) res.canonicalName = res.canonical_name || "";
    if (res.searchConfidence === undefined) res.searchConfidence = res.confidence ?? 0;
    if (res.matchedAlias === undefined) res.matchedAlias = res.matched_alias ?? null;
    if (!res.matchType) {
      if (res.search_method === "exact_alias") res.matchType = "ALIAS";
      else if (res.search_method === "exact_canonical") res.matchType = "EXACT";
      else if (res.search_method === "starts_with") res.matchType = "PREFIX";
      else if (res.search_method === "barcode_match") res.matchType = "EXACT";
      else if (res.search_method === "ai_fallback") res.matchType = res.confidence === 0 ? "NOT_FOUND" : "AI";
      else res.matchType = "FUZZY";
    }
    if (!res.matchedReason) {
      res.matchedReason = `Matched via ${res.matchType} (${res.search_method || 'direct'})`;
    }

    // Populate explicit SearchOutcome enum
    if (res.isAmbiguous || res.matchType === "AMBIGUOUS" || (res.candidateDishes && res.candidateDishes.length > 1)) {
      res.searchOutcome = "AMBIGUOUS";
    } else if (res.searchConfidence === 0 || res.matchType === "NOT_FOUND" || res.search_method === "ai_fallback") {
      res.searchOutcome = "NOT_FOUND";
    } else {
      res.searchOutcome = "FOUND";
    }

    // Record dynamic operational metric
    if (res.matchType === "NOT_FOUND" || res.searchConfidence === 0) {
      CanonicalSearchEngine.recordMetric("notFound");
    } else if (res.matchType === "FUZZY") {
      CanonicalSearchEngine.recordMetric("fuzzy");
    } else {
      CanonicalSearchEngine.recordMetric("cacheHit");
    }

    // Populate backward compatibility fields
    res.entity_type = res.canonicalEntityType;
    res.canonical_id = res.canonicalId;
    res.canonical_name = res.canonicalName;
    res.confidence = res.searchConfidence;
    res.matched_alias = res.matchedAlias;
    res.search_method = res.search_method || "exact_canonical";

    if (isDebug) {
      res.diagnostics = {
        originalQuery: rawQuery,
        normalizedQuery: queryNorm,
        expandedVariants,
        searchedIndexes,
        foodAliasMatches: foodAliasCount, foodAliasDetails,
        foodMatches: foodCount, foodDetails,
        dishAliasMatches: dishAliasCount, dishAliasDetails,
        dishMatches: dishCount, dishDetails,
        productMatches: productCount, productDetails,
        selectedEntity: res.canonicalEntityType,
        canonicalId: res.canonicalId,
        canonicalName: res.canonicalName,
        confidence: res.searchConfidence,
        searchMethod: res.search_method,
        executionTimeMs,
        engineVersion: "v2.5",
      };
    }
    return res;
  }
}

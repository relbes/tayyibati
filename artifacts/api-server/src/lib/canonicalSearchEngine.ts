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
} from "./arabicNormalization";
import { expandSearchQuery, generateSmartSuggestions, loadDbSynonyms } from "./searchExpansion";

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

  // 2. Canonical Prefix Match (Score 1000)
  if (cNorm.startsWith(qNorm) || cStripped.startsWith(qStripped) || cNorm.startsWith("ال" + qStripped) || cNorm.startsWith("ال" + qNorm)) {
    return 1000;
  }

  // 3. Alias Prefix Match (Score 800)
  if ((aNorm && aNorm.startsWith(qNorm)) || (aStripped && aStripped.startsWith(qStripped))) {
    return 800;
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
  exactDishIndex: Map<string, any | any[]>;
  dishAliasIndex: Map<string, any | any[]>;
  dishPrefixIndex: Map<string, any[]>;
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

    const exactDishIndex = new Map<string, any | any[]>();
    const dishAliasIndex = new Map<string, any | any[]>();
    const dishPrefixIndex = new Map<string, any[]>();

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

    for (const f of knowledgeCache.foods || []) {
      const normAr = normalize(f.nameAr);
      const stripAr = stripArticle(f.nameAr);
      const normEn = normalize(f.nameEn);

      if (normAr) addExactFood(normAr, f);
      if (stripAr) addExactFood(stripAr, f);
      if (normEn) addExactFood(normEn, f);

      // Index base entity & root noun tokens (e.g. "الأرز", "ارز", "رز" for "الأرز بجميع أشكاله...")
      const baseEntity = extractBaseEntity(f.nameAr);
      if (baseEntity) {
        const baseNorm = normalize(baseEntity);
        const baseStrip = stripArticle(baseNorm);
        const baseNoAlef = baseStrip.replace(/^[اأإآ]/, "");

        if (baseNorm) addExactFood(baseNorm, f);
        if (baseStrip) addExactFood(baseStrip, f);
        if (baseNoAlef && baseNoAlef.length >= 2) addExactFood(baseNoAlef, f);

        if (baseNorm) addPrefix(foodPrefixIndex, baseNorm, f);
        if (baseStrip) addPrefix(foodPrefixIndex, baseStrip, f);
        if (baseNoAlef && baseNoAlef.length >= 2) addPrefix(foodPrefixIndex, baseNoAlef, f);
      }

      // Root primary food noun indexing (e.g. "رز", "ارز", "أرز" for "الأرز بجميع أشكاله...")
      const firstWordNorm = normalize(f.nameAr.split(/[/—,\s()]+/)[0] || "");
      const firstWordStrip = stripArticle(firstWordNorm);
      const firstWordNoAlef = firstWordStrip.replace(/^[اأإآ]/, "");

      if (firstWordNorm) addExactFood(firstWordNorm, f);
      if (firstWordStrip) addExactFood(firstWordStrip, f);
      if (firstWordNoAlef && firstWordNoAlef.length >= 2) addExactFood(firstWordNoAlef, f);

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

    // 2. Index Dishes & Dish Aliases
    const dishesList = dishCache.dishes || [];
    for (const d of dishesList) {
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
      exactDishIndex,
      dishAliasIndex,
      dishPrefixIndex,
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
    const qStripped = stripArticle(queryNorm);

    const foods: CanonicalSearchResult[] = [];
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
        seenFoodIds.add(foodAlias.id);
        foods.push({
          canonicalId: foodAlias.id,
          canonicalEntityType: "food",
          canonicalName: foodAlias.nameAr,
          searchConfidence: 100,
          matchType: "ALIAS",
          matchedAlias: variant,
          matchedReason: `Matched via Food Alias '${variant}'`,
          entity_type: "food",
          canonical_id: foodAlias.id,
          canonical_name: foodAlias.nameAr,
          confidence: 100,
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
              matchedAlias: null,
              matchedReason: "Matched via Food Canonical Name",
              entity_type: "food",
              canonical_id: foodExact.id,
              canonical_name: foodExact.nameAr,
              confidence: 95,
              matched_alias: null,
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
          const isPrefix = fNorm.startsWith(queryNorm) || fStrip.startsWith(qStripped);
          const isSub = allowBroadFuzzySubstring && (fNorm.includes(queryNorm) || fStrip.includes(qStripped));

          if (isPrefix || isSub) {
            seenFoodIds.add(f.id);
            foods.push({
              canonicalId: f.id,
              canonicalEntityType: "food",
              canonicalName: f.nameAr,
              searchConfidence: isPrefix ? 90 : 80,
              matchType: isPrefix ? "PREFIX" : "FUZZY",
              matchedAlias: null,
              matchedReason: isPrefix ? "Matched via Food Prefix Index" : "Matched via Food Partial Match",
              entity_type: "food",
              canonical_id: f.id,
              canonical_name: f.nameAr,
              confidence: isPrefix ? 90 : 80,
              matched_alias: null,
              search_method: "starts_with",
              searchOutcome: "FOUND",
            });
          }
        }
      }
    }

    // C. Base Entity Resolution for Foods (e.g. "أرز مصري" -> base "أرز")
    const baseKey = normalize(extractBaseEntity(rawQuery) || qStripped.split(" ")[0] || "");
    if (baseKey) {
      const baseFoodHits = [
        indexes.exactFoodIndex.get(baseKey),
        indexes.foodAliasIndex.get(baseKey),
        ...(indexes.foodPrefixIndex.get(baseKey.slice(0, 2)) || []),
        ...(indexes.foodPrefixIndex.get(baseKey.slice(0, 3)) || []),
      ].filter(Boolean);

      for (const bf of baseFoodHits) {
        if (bf && !seenFoodIds.has(bf.id)) {
          seenFoodIds.add(bf.id);
          foods.push({
            canonicalId: bf.id,
            canonicalEntityType: "food",
            canonicalName: bf.nameAr,
            searchConfidence: 90,
            matchType: "BASE_ENTITY",
            matchedAlias: baseKey,
            matchedReason: `Matched via Base Food Entity '${baseKey}'`,
            entity_type: "food",
            canonical_id: bf.id,
            canonical_name: bf.nameAr,
            confidence: 90,
            matched_alias: baseKey,
            search_method: "base_entity_resolution",
            searchOutcome: "FOUND",
          });
        }
      }
    }

    foods.sort((a, b) => (b.searchConfidence ?? 0) - (a.searchConfidence ?? 0));

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

    dishes.sort((a, b) => (b.searchConfidence ?? 0) - (a.searchConfidence ?? 0));

    // -------------------------------------------------------------------------
    // 3. GENERIC QUERY INTENT DETERMINATION
    // -------------------------------------------------------------------------
    let queryIntent: QueryIntent = "UNKNOWN";
    const hasExactFood = foods.some((f) => f.matchType === "EXACT" || f.matchType === "ALIAS" || f.matchType === "BASE_ENTITY" || (f.searchConfidence ?? 0) >= 85);
    const hasExactDish = dishes.some((d) => d.matchType === "EXACT" || d.matchType === "ALIAS" || (d.searchConfidence ?? 0) >= 85);
    const hasConjunction = (/\s+و[\u0600-\u06FF]+/.test(" " + rawQuery.trim()) && !["ورق", "وجبة", "وز"].some(w => rawQuery.trim().startsWith(w))) || queryNorm.includes(" و ");

    if (hasConjunction) {
      queryIntent = "COMPOSITE";
    } else if (hasExactDish && !hasExactFood) {
      queryIntent = "DISH";
    } else if (hasExactFood && !hasExactDish) {
      queryIntent = "FOOD";
    } else if (hasExactDish && hasExactFood) {
      const isSingleWordQuery = queryNorm.split(" ").length === 1;
      const topFoodConf = foods[0]?.searchConfidence || 0;
      const topDishConf = dishes[0]?.searchConfidence || 0;
      if (isSingleWordQuery && topFoodConf >= 85) {
        queryIntent = "FOOD";
      } else {
        queryIntent = topDishConf > topFoodConf ? "DISH" : "FOOD";
      }
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

    const primaryResult = displayDishes[0] || displayFoods[0] || foods[0] || dishes[0] || null;

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
          return this.formatResult({
            entity_type: "food",
            canonical_id: foodHit.id,
            canonical_name: foodHit.nameAr,
            confidence: 100,
            matched_alias: variant !== foodHit.nameAr ? variant : null,
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
            return this.formatResult({
              entity_type: "food",
              canonical_id: baseFood.id,
              canonical_name: baseFood.nameAr,
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
        foodAliasCount++;
        foodAliasDetails.push(`${foodHit.nameAr} via alias '${variant}' (100%)`);
        return this.formatResult({
          entity_type: "food",
          canonical_id: foodHit.id,
          canonical_name: foodHit.nameAr,
          confidence: 100,
          matched_alias: variant,
          search_method: "exact_alias",
          matchedReason: `Matched via Food Alias '${variant}'`,
        }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
      }
    }

    // TIER 3: Foods Exact Match (Evaluates all expanded variants)
    searchedIndexes.push("exactFoodIndex");
    for (const variant of expandedVariants) {
      const foodHit = indexes.exactFoodIndex.get(variant);
      if (foodHit) {
        foodCount++;
        foodDetails.push(`${foodHit.nameAr} (95%)`);
        return this.formatResult({
          entity_type: "food",
          canonical_id: foodHit.id,
          canonical_name: foodHit.nameAr,
          confidence: 95,
          matched_alias: null,
          search_method: "exact_canonical",
          matchedReason: "Matched via Food Canonical Name",
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
    if (extractionRes && normalize(extractionRes.baseEntity) !== queryNorm) {
      const baseEntity = extractionRes.baseEntity;
      const modifiers = extractionRes.modifiers;
      const baseVariants = expandSearchQuery(baseEntity);
      const baseConfidence = 100;
      const dishCache = await warmDishEngineCache();

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
          foodCount++;
          foodDetails.push(`${exactFoodHit.nameAr} via base entity '${baseEntity}' (${baseConfidence}%)`);
          return this.formatResult({
            entity_type: "food",
            canonical_id: exactFoodHit.id,
            canonical_name: exactFoodHit.nameAr,
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

    if (dishCandidates.length > 0) {
      dishCandidates.sort((a, b) => b.score - a.score);
      const winner = dishCandidates[0];
      dishCount += dishCandidates.length;
      dishDetails.push(`${winner.dish.nameAr} (${winner.score}%)`);

      return this.formatResult({
        canonicalId: winner.dish.id,
        canonicalEntityType: "dish",
        canonicalName: winner.dish.nameAr,
        searchConfidence: Math.min(winner.score, 100),
        matchType: winner.method === "exact_canonical" || winner.method === "exact_alias" ? "EXACT" : (winner.method === "starts_with" ? "PREFIX" : "FUZZY"),
        matchedReason: `Matched via Dish Canonical Prioritization (${winner.method})`,
        matchedAlias: winner.variant !== queryNorm ? winner.variant : null,
      }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
    }

    // Check fuzzy on foods across all expanded variants
    for (const variant of expandedVariants) {
      for (const f of knowledgeCache.foods || []) {
        const fNorm = normalize(f.nameAr);
        const match = this.calculateTokenMatch(variant, fNorm, false);
        if (match.matches && match.score >= 60) {
          foodCount++;
          foodDetails.push(`${f.nameAr} (${match.score}%)`);
          return this.formatResult({
            entity_type: "food",
            canonical_id: f.id,
            canonical_name: f.nameAr,
            confidence: match.score,
            matched_alias: variant !== queryNorm ? variant : null,
            search_method: match.method,
            matchedReason: `Matched via Food Similarity (${match.method})`,
          }, tStart, isDebug, rawQuery, queryNorm, expandedVariants, searchedIndexes, foodAliasCount, foodAliasDetails, foodCount, foodDetails, dishAliasCount, dishAliasDetails, dishCount, dishDetails, productCount, productDetails);
        }
      }
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

    // Generic category words that do NOT define dish identity alone
    const GENERIC_CATEGORY_WORDS = new Set([
      "سلطة", "سلطه", "شوربة", "شوربه", "عصير", "مرق", "مرقة", "مرقه",
      "طاجن", "صينية", "صينيه", "طبق", "أرز", "ارز", "ادام", "إدام", "مشروب"
    ]);

    // Extract meaningful non-category tokens from query
    const queryTokens = stripVariant
      .split(/\s+/)
      .map((t) => stripArticle(t))
      .filter((t) => t.length > 1 && !GENERIC_CATEGORY_WORDS.has(t) && !["بال", "مع", "و", "من", "في", "على", "طريقة", "عمل"].includes(t));

    // If query consists only of generic category words, allow matching
    if (queryTokens.length === 0) {
      return true;
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

    const isWordStart =
      qClean.startsWith(cClean + " ") ||
      cClean.startsWith(qClean + " ") ||
      (cClean.length >= 3 && qClean.startsWith(cClean + " ")) ||
      (qClean.length >= 3 && cClean.startsWith(qClean + " ")) ||
      (cClean.length >= 4 && qClean.startsWith(cClean)) ||
      (qClean.length >= 4 && cClean.startsWith(qClean));

    if (isWordStart) {
      return { matches: true, score: 85, method: "starts_with" };
    }

    const mainQTokens = qTokens.filter((t) => t.length >= 3 && !CULINARY_DESCRIPTORS.has(t) && !ARABIC_STOP_WORDS.has(t));
    if (mainQTokens.length > 1 && mainQTokens.every((t) => cClean.includes(t))) {
      return { matches: true, score: 85, method: "token_similarity" };
    }
    if (
      qClean.includes(cClean) ||
      cClean.includes(qClean) ||
      (mainQTokens.length > 0 && mainQTokens.some((t) => t.length >= 3 && cClean.includes(t)))
    ) {
      return { matches: true, score: 75, method: "contains" };
    }

    const qMainTokens = qTokens.filter((t) => t.length >= 3 && !ARABIC_STOP_WORDS.has(t) && !CULINARY_DESCRIPTORS.has(t));
    const cMainTokens = cTokens.filter((t) => t.length >= 3 && !ARABIC_STOP_WORDS.has(t));

    if (qMainTokens.length > 0 && cMainTokens.length > 0) {
      const sharedTokens = qMainTokens.filter((t) =>
        cMainTokens.some((ct) => ct === t || (t.length >= 4 && ct.length >= 4 && (ct.includes(t) || t.includes(ct))))
      );
      if (sharedTokens.length > 0) {
        const score = sharedTokens.length > 1 ? 75 : 70;
        return { matches: true, score, method: "token_similarity" };
      }
    }

    if (qClean.length >= 4 && cClean.length >= 4 && (qClean.slice(0, 4) === cClean.slice(0, 4) || qClean.slice(-4) === cClean.slice(-4))) {
      return { matches: true, score: 60, method: "fuzzy" };
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

/**
 * Tayyibati Knowledge Engine Cache & Resolver Gateway
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/ANALYSIS_PIPELINE_SPEC.md for complete 10-stage pipeline
 * - See docs/ARCHITECTURE_RULES.md (Rules 1, 3, 4, 5)
 * - See docs/KNOWLEDGE_ENGINE_SPEC.md for schema details
 * - See docs/ENGINEERING_PRINCIPLES.md (Knowledge Before AI, Cache First)
 */
import { db, foodsTable, foodAliases } from "@workspace/db";
import { normalizeName, normalize, stripArticle, norm, stripAlefLam, extractBaseEntity } from "./arabicNormalization";
import { expandSearchQuery } from "./searchExpansion";

export { normalizeName, normalize, stripArticle, norm, stripAlefLam };

export enum UserIntent {
  SPECIFIC_INGREDIENT = "SPECIFIC_INGREDIENT",
  BROAD_FOOD_CATEGORY = "BROAD_FOOD_CATEGORY",
  SPECIFIC_DISH = "SPECIFIC_DISH",
  AMBIGUOUS_DISH_FOOD = "AMBIGUOUS_DISH_FOOD",
  PRODUCT_BRAND = "PRODUCT_BRAND",
  INGREDIENT_LIST = "INGREDIENT_LIST",
  FREE_FORM_MEAL = "FREE_FORM_MEAL",
  UNKNOWN = "UNKNOWN"
}

export enum Provenance {
  IMAGE_OBSERVED = "IMAGE_OBSERVED",
  TEXT_EXTRACTED = "TEXT_EXTRACTED",
  TEXT_RESOLVED = "TEXT_RESOLVED",
  DB_REQUIRED = "DB_REQUIRED",
  DB_TYPICAL = "DB_TYPICAL",
  DB_VARIANT_REQUIRED = "DB_VARIANT_REQUIRED",
  CONTEXT_INFERRED = "CONTEXT_INFERRED",
  AI_INFERRED = "AI_INFERRED"
}

export enum EvidenceClass {
  STRONGLY_SUPPORTED = "STRONGLY_SUPPORTED",
  SUPPORTED = "SUPPORTED",
  PLAUSIBLE = "PLAUSIBLE",
  WEAK = "WEAK",
  CONTEXTUALLY_UNLIKELY = "CONTEXTUALLY_UNLIKELY",
  CONTRADICTORY = "CONTRADICTORY",
}

export interface ResolvedEntity {
  id: number;
  nameAr: string;
  nameEn: string;
  type: "ingredient" | "dish" | "sauce" | "beverage" | "bread" | "dessert";
  attributes: {
    sweet?: boolean;
    savory?: boolean;
    [key: string]: boolean | undefined;
  };
  foodId: number | null;
  parentEntityId?: number | null;
  matchScore: number;
}

export interface DishCandidate {
  entity: ResolvedEntity;
  variant: {
    id: number;
    dishId: number;
    variantKey: string;
    nameAr: string;
    nameEn: string;
    region: string | null;
  } | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface RefinementSuggestion {
  labelAr: string;
  labelEn: string;
  query: string;
  source: "DB_VARIANT" | "AI_CULINARY" | "DB_CANDIDATE";
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface IngredientHypothesis {
  rawNameAr: string;
  rawNameEn: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  observedEntity: ResolvedEntity | null;
  observationProvenance: Provenance | null;
  inferredEntity: ResolvedEntity | null;
  inferenceProvenance: Provenance | null;
  contextSupport: "REQUIRED" | "TYPICAL" | "OPTIONAL" | "VARIANT_DEPENDENT" | null;
  recipeProvenance: Provenance | null;
  evidenceClass: EvidenceClass;
  compatibilityStatus: "allowed" | "forbidden" | "conditional" | "unknown";
  visualConfidence?: "HIGH" | "MEDIUM" | "LOW";
}

export interface EffectiveRecipe {
  dishId: number;
  variantId: number | null;
  ingredients: {
    entityId: number;
    ingredientType: "REQUIRED" | "TYPICAL" | "OPTIONAL" | "VARIANT_DEPENDENT";
    provenance: Provenance;
  }[];
}

interface CacheStore {
  entities: any[];
  aliases: any[];
  dishVariants: any[];
  dishIngredients: any[];
  foodRelationships: any[];
  foods: any[];
  lastLoaded: number;
  /** Precomputed normalized name map, keyed by food ID — built once at cache load time */
  foodNormMap: Map<number, { nAr: string; sAr: string; nEn: string }>;
  /** Precomputed O(1) food lookup by ID — built once at cache load time */
  foodById: Map<number, any>;
}

let cache: CacheStore | null = null;
const CACHE_TTL = 3600000; // 1 hour in ms

export async function getKnowledgeCache(): Promise<CacheStore> {
  const now = Date.now();
  if (cache && now - cache.lastLoaded < CACHE_TTL) {
    return cache;
  }

  const tStart = performance.now();
  try {
    const [foods, aliases] = await Promise.all([
      db.select().from(foodsTable),
      db.select().from(foodAliases),
    ]);

    // Precompute normalized food name map and ID lookup map once at cache load time
    const foodNormMap = new Map<number, { nAr: string; sAr: string; nEn: string }>();
    const foodById = new Map<number, any>();
    for (const f of foods) {
      const nAr = normalizeName(f.nameAr);
      foodNormMap.set(f.id, { nAr, sAr: stripArticle(nAr), nEn: normalizeName(f.nameEn) });
      foodById.set(f.id, f);
    }

    // Alias Integrity Validation: verify referenced food exists in foodById
    const validAliases: typeof aliases = [];
    let orphanedAliasCount = 0;
    for (const a of aliases) {
      if (a.foodId && foodById.has(a.foodId)) {
        validAliases.push(a);
      } else {
        orphanedAliasCount++;
      }
    }

    const buildTimeMs = Math.round((performance.now() - tStart) * 100) / 100;
    if (orphanedAliasCount > 0) {
      console.warn(`[KNOWLEDGE_CACHE] Alias Integrity Warning: Skipped ${orphanedAliasCount} orphaned aliases.`);
    }
    console.log(`[KNOWLEDGE_CACHE] Memory Indexes Loaded | Foods: ${foods.length} | Aliases: ${validAliases.length} | Build: ${buildTimeMs}ms`);

    cache = {
      entities: [],
      aliases: validAliases,
      dishVariants: [],
      dishIngredients: [],
      foodRelationships: [],
      foods,
      lastLoaded: now,
      foodNormMap,
      foodById,
    };
  } catch (err) {
    console.error("[KNOWLEDGE] Failed to load database cache:", err);
    if (cache) {
      return cache;
    }
    return {
      entities: [],
      aliases: [],
      dishVariants: [],
      dishIngredients: [],
      foodRelationships: [],
      foods: [],
      lastLoaded: 0,
      foodNormMap: new Map(),
      foodById: new Map(),
    };
  }

  return cache;
}

export function clearKnowledgeCache(): void {
  cache = null;
}



function findExactMatch(input: string, entities: any[], aliases: any[]): ResolvedEntity | null {
  const norm = normalizeName(input);
  
  const entityMatch = entities.find(
    (e) => normalizeName(e.nameAr) === norm || normalizeName(e.nameEn) === norm
  );
  if (entityMatch) {
    return {
      id: entityMatch.id,
      nameAr: entityMatch.nameAr,
      nameEn: entityMatch.nameEn,
      type: entityMatch.type,
      attributes: (entityMatch.attributes as ResolvedEntity["attributes"]) || {},
      foodId: entityMatch.foodId,
      parentEntityId: entityMatch.parentEntityId,
      matchScore: 100,
    };
  }

  const aliasMatch = aliases.find(
    (a) => normalizeName(a.aliasAr || a.alias_ar) === norm || (a.aliasEn && normalizeName(a.aliasEn) === norm)
  );
  if (aliasMatch) {
    const fId = aliasMatch.foodId || aliasMatch.food_id;
    if (fId) {
      return {
        id: fId,
        nameAr: aliasMatch.aliasAr || aliasMatch.alias_ar,
        nameEn: aliasMatch.aliasEn || aliasMatch.alias_en || "",
        type: "ingredient",
        attributes: {},
        foodId: fId,
        parentEntityId: null,
        matchScore: 90,
      };
    }
  }

  return null;
}

export function resolveEntity(input: string, entities: any[], aliases: any[]): ResolvedEntity | null {
  const normInput = input.trim();
  if (!normInput) return null;

  // Layer 1: Exact original string match
  let match = findExactMatch(normInput, entities, aliases);
  if (match) {
    return match;
  }

  // Layer 2: Light Arabic normalization
  const lightNorm = normalizeName(normInput);
  match = findExactMatch(lightNorm, entities, aliases);
  if (match) {
    return match;
  }

  // Layer 3: Definite article removal
  const stripped = stripArticle(lightNorm);
  match = findExactMatch(stripped, entities, aliases);
  if (match) {
    return match;
  }

  // Layer 4: Aggressive normalization (ة -> ه, ى -> ي)
  const aggressiveNorm = lightNorm
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/^ال/, "")
    .trim();
  match = findExactMatch(aggressiveNorm, entities, aliases);
  if (match) {
    return match;
  }

  // Layer 5: Parent-entity fuzzy matching (Direction A only)
  //
  // Rule: the user's query must CONTAIN the known entity name.
  // This means the user typed something MORE SPECIFIC than an entity we know
  // (e.g. "خبز أسمر" contains "خبز" → Bread is a reasonable parent candidate).
  //
  // Direction B (entityName.includes(normInput)) is intentionally NOT used:
  // it would allow a SPECIFIC entity to match a GENERIC input
  // (e.g. "توست" matching "توست ريتش بيك بالردة"), which silently promotes
  // a generic query to a specific product's ruling — a safety violation.
  for (const e of entities) {
    const nAr = normalizeName(e.nameAr);
    const nEn = normalizeName(e.nameEn);
    if (
      (nAr.length >= 3 && normInput.includes(nAr)) ||
      (nEn.length >= 3 && normInput.includes(nEn))
    ) {
      return {
        id: e.id,
        nameAr: e.nameAr,
        nameEn: e.nameEn,
        type: e.type,
        attributes: (e.attributes as ResolvedEntity["attributes"]) || {},
        foodId: e.foodId,
        parentEntityId: e.parentEntityId,
        matchScore: 60,
      };
    }
  }

  return null;
}

export function buildEffectiveRecipe(dishId: number, variantId: number | null, allIngredients: any[]): EffectiveRecipe {
  const recipe: EffectiveRecipe = {
    dishId,
    variantId,
    ingredients: [],
  };

  const genericRows = allIngredients.filter((row) => row.dishId === dishId && row.dishVariantId === null);
  for (const row of genericRows) {
    recipe.ingredients.push({
      entityId: row.entityId,
      ingredientType: row.ingredientType,
      provenance: row.ingredientType === "REQUIRED" ? Provenance.DB_REQUIRED : Provenance.DB_TYPICAL,
    });
  }

  if (variantId !== null) {
    const variantRows = allIngredients.filter((row) => row.dishVariantId === variantId);
    for (const row of variantRows) {
      const existing = recipe.ingredients.find((ing) => ing.entityId === row.entityId);
      if (existing) {
        existing.ingredientType = row.ingredientType;
        existing.provenance = Provenance.DB_VARIANT_REQUIRED;
      } else {
        recipe.ingredients.push({
          entityId: row.entityId,
          ingredientType: row.ingredientType,
          provenance: Provenance.DB_VARIANT_REQUIRED,
        });
      }
    }
  }

  return recipe;
}

function checkAttributeConflict(dish: ResolvedEntity, ing: ResolvedEntity): boolean {
  if (dish.attributes?.savory && ing.attributes?.sweet && !ing.attributes?.savory) {
    return true;
  }
  if (dish.attributes?.sweet && ing.attributes?.savory && !ing.attributes?.sweet) {
    return true;
  }
  return false;
}

function getRelationship(sourceId: number, targetId: number, relationships: any[]): string | null {
  const rel = relationships.find(
    (r) => r.sourceEntityId === sourceId && r.targetEntityId === targetId
  );
  return rel ? rel.relationshipType : null;
}

function compareEvidence(a: EvidenceClass, b: EvidenceClass): number {
  const order = [
    EvidenceClass.STRONGLY_SUPPORTED,
    EvidenceClass.SUPPORTED,
    EvidenceClass.PLAUSIBLE,
    EvidenceClass.WEAK,
    EvidenceClass.CONTEXTUALLY_UNLIKELY,
    EvidenceClass.CONTRADICTORY,
  ];
  return order.indexOf(a) - order.indexOf(b);
}

export interface IngredientHypothesis {
  rawNameAr: string;
  rawNameEn: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  observedEntity: ResolvedEntity | null;
  observationProvenance: Provenance | null;
  inferredEntity: ResolvedEntity | null;
  inferenceProvenance: Provenance | null;
  contextSupport: "REQUIRED" | "TYPICAL" | "OPTIONAL" | "VARIANT_DEPENDENT" | null;
  recipeProvenance: Provenance | null;
  evidenceClass: EvidenceClass;
  compatibilityStatus: "allowed" | "forbidden" | "conditional" | "unknown";
  resolvedFood?: any;
  visualConfidence?: "HIGH" | "MEDIUM" | "LOW";
}

export function rerankImageCandidates(
  dishCandidate: DishCandidate | null,
  rawObservations: { nameAr: string; nameEn: string; confidence: "HIGH" | "MEDIUM" | "LOW" }[],
  knowledgeCache: CacheStore,
  mode: "text" | "image",
  aiResolvedMap?: Map<string, ResolvedFoodIdentity>
): IngredientHypothesis[] {
  const hypotheses: IngredientHypothesis[] = [];
  const recipe = dishCandidate
    ? buildEffectiveRecipe(dishCandidate.entity.id, dishCandidate.variant?.id ?? null, knowledgeCache.dishIngredients)
    : null;

  for (const obs of rawObservations) {
    const rawTerm = obs.nameAr || obs.nameEn;

    // Primary Identity Resolution via shared resolveFoodIdentity
    let identity = resolveFoodIdentity(obs.nameAr, knowledgeCache) || 
                   resolveFoodIdentity(obs.nameEn, knowledgeCache);

    let isAiFallback = false;
    if (!identity && aiResolvedMap) {
      const aiMatch = aiResolvedMap.get(obs.nameAr) || aiResolvedMap.get(obs.nameEn);
      if (aiMatch) {
        identity = aiMatch;
        isAiFallback = true;
      }
    }

    let obsEntity = resolveEntity(rawTerm, knowledgeCache.entities, knowledgeCache.aliases);
    
    // Requirement 6 Guard: Strip low-confidence Layer 5 fuzzy entity matches (matchScore === 60)
    // so they do not impose DB rulings or trigger recipe-based classification to generic bread.
    if (!identity && obsEntity && obsEntity.matchScore === 60) {
      obsEntity = null;
    }

    let bestInferredEntity = obsEntity;
    let bestEvidence = EvidenceClass.PLAUSIBLE;
    let inferenceProvenance: Provenance | null = obsEntity 
      ? (mode === "text" ? Provenance.TEXT_RESOLVED : Provenance.IMAGE_OBSERVED) 
      : null;
    let contextSupport: IngredientHypothesis["contextSupport"] = null;
    let recipeProvenance: Provenance | null = null;

    if (recipe) {
      if (obsEntity) {
        const recipeMatch = recipe.ingredients.find((ing) => ing.entityId === obsEntity.id);
        
        if (recipeMatch) {
          bestEvidence =
            recipeMatch.ingredientType === "REQUIRED" || recipeMatch.ingredientType === "VARIANT_DEPENDENT"
              ? EvidenceClass.STRONGLY_SUPPORTED
              : EvidenceClass.SUPPORTED;
          contextSupport = recipeMatch.ingredientType;
          recipeProvenance = recipeMatch.provenance;
        } else {
          const unlikely = getRelationship(obsEntity.id, dishCandidate!.entity.id, knowledgeCache.foodRelationships);
          if (unlikely === "UNLIKELY_WITH") {
            bestEvidence = EvidenceClass.CONTRADICTORY;
          } else {
            const flavorConflict = checkAttributeConflict(dishCandidate!.entity, obsEntity);
            if (flavorConflict) {
              bestEvidence = EvidenceClass.CONTEXTUALLY_UNLIKELY;
              
              const confusionMatch = findConfusedRecipeIngredient(obsEntity.id, recipe, knowledgeCache);
              if (confusionMatch) {
                bestInferredEntity = confusionMatch.entity;
                bestEvidence = EvidenceClass.STRONGLY_SUPPORTED;
                inferenceProvenance = Provenance.CONTEXT_INFERRED;
                contextSupport = confusionMatch.ingredientType;
                recipeProvenance = confusionMatch.provenance;
              }
            } else {
              const relation = getRelationship(obsEntity.id, dishCandidate!.entity.id, knowledgeCache.foodRelationships);
              if (relation === "SAUCE_FOR" || relation === "TOPPED_WITH") {
                bestEvidence = EvidenceClass.SUPPORTED;
              }
            }
          }
        }
      } else {
        if (obs.confidence === "LOW") {
          const missingIng = findUnmatchedRequiredIngredient(recipe, rawObservations, knowledgeCache);
          if (missingIng) {
            bestInferredEntity = missingIng.entity;
            bestEvidence = EvidenceClass.WEAK;
            inferenceProvenance = Provenance.CONTEXT_INFERRED;
            contextSupport = missingIng.ingredientType;
            recipeProvenance = missingIng.provenance;
          }
        }
      }
    }

    // Authoritative Food Identity Determination
    let status: string = "unknown";
    let foodId: number | null = null;
    let resolvedFood: any = undefined;

    if (identity) {
      status = identity.food.status;
      foodId = identity.food.id;
      resolvedFood = identity.food;

      // Ensure bestInferredEntity points to resolved food so hypothesis matchType and entity metadata match
      if (!obsEntity || obsEntity.matchScore === 60) {
        bestInferredEntity = {
          id: identity.food.id,
          nameAr: identity.food.nameAr,
          nameEn: identity.food.nameEn || rawTerm,
          type: "ingredient",
          attributes: {},
          foodId: identity.food.id,
          matchScore: 100
        };
      }
    } else {
      bestInferredEntity = null;
      // Fallback to obsEntity ONLY IF it is NOT a low-confidence Layer 5 fuzzy match (matchScore === 60)
      if (obsEntity && obsEntity.matchScore !== 60 && obsEntity.foodId) {
        foodId = obsEntity.foodId;
        status = getCompatibilityStatusFromFoodsTable(foodId, knowledgeCache.foods);
        const fRow = knowledgeCache.foods.find(f => f.id === foodId);
        resolvedFood = fRow;
        bestInferredEntity = obsEntity;
      }
    }

    hypotheses.push({
      rawNameAr: obs.nameAr,
      rawNameEn: obs.nameEn,
      confidence: obs.confidence,
      observedEntity: obsEntity,
      observationProvenance: obsEntity ? (mode === "text" ? Provenance.TEXT_EXTRACTED : Provenance.IMAGE_OBSERVED) : null,
      inferredEntity: bestInferredEntity,
      inferenceProvenance,
      contextSupport,
      recipeProvenance,
      evidenceClass: bestEvidence,
      compatibilityStatus: status as IngredientHypothesis["compatibilityStatus"],
      resolvedFood,
      visualConfidence: mode === "image" ? obs.confidence : undefined
    });
  }

  const sorted = hypotheses.sort((a, b) => compareEvidence(a.evidenceClass, b.evidenceClass));
  return sorted;
}

function findConfusedRecipeIngredient(
  obsEntityId: number,
  recipe: EffectiveRecipe,
  knowledgeCache: CacheStore
): { entity: ResolvedEntity; ingredientType: EffectiveRecipe["ingredients"][0]["ingredientType"]; provenance: Provenance } | null {
  for (const ing of recipe.ingredients) {
    const relation = knowledgeCache.foodRelationships.find(
      (r) =>
        r.relationshipType === "VISUALLY_SIMILAR_TO" &&
        r.sourceEntityId === obsEntityId &&
        r.targetEntityId === ing.entityId
    );
    if (relation) {
      const parent = knowledgeCache.entities.find((e) => e.id === ing.entityId);
      if (parent) {
        return {
          entity: {
            id: parent.id,
            nameAr: parent.nameAr,
            nameEn: parent.nameEn,
            type: parent.type,
            attributes: parent.attributes || {},
            foodId: parent.foodId,
            matchScore: 80,
          },
          ingredientType: ing.ingredientType,
          provenance: ing.provenance,
        };
      }
    }
  }
  return null;
}

function findUnmatchedRequiredIngredient(
  recipe: EffectiveRecipe,
  rawObservations: any[],
  knowledgeCache: CacheStore
): { entity: ResolvedEntity; ingredientType: EffectiveRecipe["ingredients"][0]["ingredientType"]; provenance: Provenance } | null {
  const requiredIngs = recipe.ingredients.filter((ing) => ing.ingredientType === "REQUIRED");
  
  for (const ing of requiredIngs) {
    const isMatched = rawObservations.some((obs) => {
      const resolved = resolveEntity(obs.nameAr || obs.nameEn, knowledgeCache.entities, knowledgeCache.aliases);
      return resolved?.id === ing.entityId;
    });

    if (!isMatched) {
      const parent = knowledgeCache.entities.find((e) => e.id === ing.entityId);
      if (parent) {
        return {
          entity: {
            id: parent.id,
            nameAr: parent.nameAr,
            nameEn: parent.nameEn,
            type: parent.type,
            attributes: parent.attributes || {},
            foodId: parent.foodId,
            matchScore: 80,
          },
          ingredientType: ing.ingredientType,
          provenance: ing.provenance,
        };
      }
    }
  }
  return null;
}

function getCompatibilityStatusFromFoodsTable(foodId: number, foods: any[]): string {
  const row = foods.find((f) => f.id === foodId);
  return row ? row.status : "unknown";
}

export function buildVariantSuggestions(dishEntity: ResolvedEntity, knowledgeCache: CacheStore): { nameAr: string; query: string }[] {
  const suggestions: { nameAr: string; query: string }[] = [];
  const variants = knowledgeCache.dishVariants.filter((v) => v.dishId === dishEntity.id);
  for (const v of variants) {
    suggestions.push({
      nameAr: v.nameAr,
      query: v.nameAr,
    });
  }
  return suggestions;
}

export function isWordMatch(query: string, candidate: string): boolean {
  const normQ = normalizeName(query).replace(/^ال/, "").trim();
  const normC = normalizeName(candidate).replace(/^ال/, "").trim();

  if (!normQ || !normC) return false;
  if (normQ === normC) return true;

  const qTokens = normQ.split(/\s+/);
  const cTokens = normC.split(/\s+/);

  return qTokens.every((qTok) => cTokens.some((cTok) => cTok === qTok));
}

export function buildUnifiedSuggestions(
  resolvedEntity: ResolvedEntity | null,
  aiSuggestions: { labelAr: string; labelEn: string; query?: string }[],
  knowledgeCache: CacheStore
): RefinementSuggestion[] {
  const suggestions: RefinementSuggestion[] = [];
  const seenQueries = new Set<string>();

  const addSuggestion = (s: RefinementSuggestion) => {
    const norm = normalizeName(s.query);
    if (!seenQueries.has(norm)) {
      seenQueries.add(norm);
      suggestions.push(s);
    }
  };

  // 1. Gather DB-curated variants (Strongest source)
  if (resolvedEntity) {
    const variants = knowledgeCache.dishVariants.filter((v) => v.dishId === resolvedEntity.id);
    for (const v of variants) {
      addSuggestion({
        labelAr: v.nameAr,
        labelEn: v.nameEn,
        query: v.nameAr,
        source: "DB_VARIANT",
        confidence: "HIGH",
      });
    }
  }

  // 2. Gather AI culinary refinements (ONLY IF THEY RESOLVE TO REAL DB RECORDS)
  for (const ai of aiSuggestions) {
    if (ai && ai.labelAr) {
      const dbMatch = resolveWithInheritance(ai.query || ai.labelAr, knowledgeCache);
      if (dbMatch) {
        addSuggestion({
          labelAr: dbMatch.food.nameAr,
          labelEn: dbMatch.food.nameEn || ai.labelEn || dbMatch.food.nameAr,
          query: dbMatch.food.nameAr,
          source: "DB_CANDIDATE",
          confidence: "MEDIUM",
        });
      }
    }
  }

  // Cap final suggestions at 6
  return suggestions.slice(0, 6);
}

export interface ResolvedFoodIdentity {
  food: any;
  matchType: "EXACT" | "NORMALIZED" | "ALIAS" | "WORD_BOUNDARY" | "AI_INTERPRETED" | "BASE_ENTITY";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  originalInput: string;
  matchedTerm?: string;
}

const STOP_WORDS = new Set(["غير", "بدون", "مع", "من", "عن", "علي", "على", "في", "او", "أم", "معا", "جدا", "حتى", "طازج", "نيء", "مطبوخ"]);

/**
 * Shared generic food identity resolver.
 * Used by text search and image/camera extracted ingredients.
 */
export function resolveFoodIdentity(
  input: string,
  knowledgeCache: CacheStore
): ResolvedFoodIdentity | null {
  if (!input || typeof input !== "string") return null;
  const rawInput = input.trim();
  if (!rawInput) return null;

  const normQ = normalizeName(rawInput);
  if (!normQ) return null;
  const strippedQ = stripArticle(normQ);

  const { foods, entities, aliases, foodNormMap } = knowledgeCache;

  // Stage 1: Exact match on food name (Arabic or English)
  for (const f of foods) {
    if (f.nameAr === rawInput || (f.nameEn && f.nameEn.toLowerCase() === rawInput.toLowerCase())) {
      return { food: f, matchType: "EXACT", confidence: "HIGH", originalInput: rawInput, matchedTerm: f.nameAr };
    }
  }

  // Stage 2: Normalized match on food name
  for (const f of foods) {
    const { nAr, nEn } = foodNormMap.get(f.id)!;
    if (nAr === normQ || (nEn && nEn === normQ)) {
      return { food: f, matchType: "NORMALIZED", confidence: "HIGH", originalInput: rawInput, matchedTerm: f.nameAr };
    }
  }

  // Stage 2b: Base Entity match (e.g. "لحم" -> matches "لحم بقري", "خبز" -> matches bread family, "رز" / "ارز" / "أرز" / "أَرُز" -> matches rice family)
  const noAlefQ = strippedQ.replace(/^[اأإآ]/, "");
  const baseMatches: any[] = [];
  for (const f of foods) {
    const baseAr = extractBaseEntity(f.nameAr);
    if (baseAr) {
      const normBase = stripArticle(normalizeName(baseAr));
      const noAlefBase = normBase.replace(/^[اأإآ]/, "");
      if (
        normBase === strippedQ ||
        normBase === normQ ||
        noAlefBase === strippedQ ||
        (noAlefQ.length >= 2 && noAlefBase === noAlefQ)
      ) {
        baseMatches.push(f);
      }
    }
  }

  if (baseMatches.length > 0) {
    // Sort baseMatches: prefer Root Family Food (general_category || parentFoodId === null) over specific variants
    baseMatches.sort((a, b) => {
      const aIsRoot = a.foodType === "general_category" || a.parentFoodId === null ? 1 : 0;
      const bIsRoot = b.foodType === "general_category" || b.parentFoodId === null ? 1 : 0;
      if (bIsRoot !== aIsRoot) return bIsRoot - aIsRoot;
      return a.id - b.id;
    });

    const chosenFood = baseMatches[0];
    return { food: chosenFood, matchType: "BASE_ENTITY", confidence: "HIGH", originalInput: rawInput, matchedTerm: chosenFood.nameAr };
  }

  // Stage 3: Article-stripped exact match on food name (evaluating all expanded variants)
  const expandedVariants = expandSearchQuery(rawInput);
  for (const variant of expandedVariants) {
    const vNorm = normalizeName(variant);
    const vStrip = stripArticle(vNorm);
    for (const f of foods) {
      const { sAr, nAr } = foodNormMap.get(f.id)!;
      if (sAr && (sAr === vStrip || sAr === vNorm || nAr === vNorm)) {
        return { food: f, matchType: "NORMALIZED", confidence: "HIGH", originalInput: rawInput, matchedTerm: f.nameAr };
      }
    }
  }

  // Stage 4: DB Alias / Entity resolution (food_aliases & food_entities)
  const resolvedEntity = resolveEntity(rawInput, entities, aliases);
  if (resolvedEntity?.foodId) {
    const food = foods.find((f) => f.id === resolvedEntity.foodId);
    if (food) {
      return { food, matchType: "ALIAS", confidence: "HIGH", originalInput: rawInput, matchedTerm: resolvedEntity.nameAr };
    }
  }

  // Stage 5: Multi-name Concept / Constituent Word Match (evaluating expanded variants)
  // E.g. "الدجاج والفراخ" contains constituent concept words ["دجاج", "فراخ"]
  // E.g. "الشمام / الكنتالوب" contains constituent concept words ["شمام", "كنتالوب"]
  for (const f of foods) {
    const { nAr } = foodNormMap.get(f.id)!;
    const concepts = nAr.split(/[/—,\s]+و?\s*/).map((c) => stripArticle(normalizeName(c))).filter((c) => c.length >= 2);
    for (const concept of concepts) {
      for (const variant of expandedVariants) {
        const vNorm = normalizeName(variant);
        const vStrip = stripArticle(vNorm);
        if (concept === vStrip || concept === vNorm) {
          return { food: f, matchType: "WORD_BOUNDARY", confidence: "HIGH", originalInput: rawInput, matchedTerm: concept };
        }
      }
    }
  }

  // Stage 5b: Token match for multi-word phrases (e.g. "صدور دجاج" -> matches "الدجاج والفراخ")
  if (strippedQ.length >= 3) {
    for (const f of foods) {
      const { sAr } = foodNormMap.get(f.id)!;
      const foodTokens = sAr.split(/[/—,\s]+/).map((t) => stripArticle(t)).filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
      const queryTokens = strippedQ.split(/\s+/).map((t) => stripArticle(t)).filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

      if (queryTokens.length === 0 || foodTokens.length === 0) continue;

      const hasExactTokenMatch = queryTokens.some((qTok) =>
        foodTokens.some((fTok) => fTok === qTok)
      );
      if (hasExactTokenMatch) {
        return { food: f, matchType: "WORD_BOUNDARY", confidence: "MEDIUM", originalInput: rawInput, matchedTerm: f.nameAr };
      }
    }
  }

  return null;
}

/**
 * Controlled AI Identity Interpretation Fallback.
 * Asks AI only for candidate canonical food names/synonyms (NO rulings).
 * Backend then searches DB again for each candidate.
 */
export async function resolveUnresolvedTermsWithAI(
  unresolvedInputs: string[],
  knowledgeCache: CacheStore,
  getOpenAIClient: () => Promise<any>
): Promise<Map<string, ResolvedFoodIdentity>> {
  const results = new Map<string, ResolvedFoodIdentity>();
  if (!unresolvedInputs || unresolvedInputs.length === 0) return results;

  const uniqueInputs = Array.from(new Set(unresolvedInputs.filter((s) => s && s.trim())));
  if (uniqueInputs.length === 0) return results;

  try {
    const openai = await getOpenAIClient();
    const prompt = `أنت مترجم ومحلل لأسماء الأطعمة والمكونات.
المطلوب: لكل مصطلح طعام في القائمة المرفقة، قدم الأسماء والمرادفات العربية الشائعة القياسية لهذا الطعام (مثل: فراخ -> دجاج، بندورة -> طماطم، حبحب -> بطيخ).

قواعد صارمة:
- لا تُقدم أي أحكام (مسموح/ممنوع/مشروط) ولا تقييمات ولا درجات ملاءمة.
- قدم فقط قائمة بالأسماء والمرادفات المرشحة لكل مصطلح.

أعد JSON فقط بهذا الشكل:
{
  "resolutions": [
    {
      "input": "المصطلح الأصلي",
      "candidateNames": ["اسم مرشح 1", "اسم مرشح 2"]
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify({ terms: uniqueInputs }) },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0,
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    const resolutions = parsed.resolutions || [];

    for (const item of resolutions) {
      const origInput = item.input || "";
      const candidates = item.candidateNames || [];

      for (const cand of candidates) {
        if (!cand || typeof cand !== "string") continue;
        const dbMatch = resolveFoodIdentity(cand, knowledgeCache);
        if (dbMatch) {
          results.set(origInput, {
            ...dbMatch,
            matchType: "AI_INTERPRETED",
            confidence: "MEDIUM",
            originalInput: origInput,
          });
          break;
        }
      }
    }
  } catch (err) {
    console.error("[KNOWLEDGE] AI identity interpretation failed:", err);
  }

  return results;
}

export function resolveWithInheritance(
  query: string,
  knowledgeCache: CacheStore
): {
  food: any;
  matchType: string;
  inherited: boolean;
  inheritsFrom?: any;
  resultMode: string;
  exceptions?: { allowed: any[]; forbidden: any[]; conditional: any[] };
  candidates?: any[];
} | null {
  const { foods } = knowledgeCache;
  const identity = resolveFoodIdentity(query, knowledgeCache);

  const normQ = normalizeName(query);
  const strippedQ = stripArticle(normQ);

  const findCandidatesForQuery = (primaryFoodId: number): any[] => {
    const primaryFood = foods.find((f) => f.id === primaryFoodId);
    if (!primaryFood) return [];

    const candidates: any[] = [primaryFood];
    const seenIds = new Set<number>([primaryFood.id]);

    for (const f of foods) {
      if (seenIds.has(f.id)) continue;

      const normF = normalizeName(f.nameAr);
      const strippedF = stripArticle(normF);

      if (
        (strippedQ.length >= 3 && (strippedF.includes(strippedQ) || strippedQ.includes(strippedF))) ||
        (normQ.length >= 3 && (normF.includes(normQ) || normQ.includes(normF)))
      ) {
        seenIds.add(f.id);
        candidates.push(f);
      }
    }

    return candidates.length > 1 ? candidates : [];
  };

  const buildResult = (food: any, matchType: string, inherited: boolean, inheritsFrom?: any) => {
    let resultMode = "EXACT_FOOD";
    let exceptions = undefined;

    if (food.foodType === "general_category") {
      resultMode = "GENERAL_RULE";

      const relatedExceptions = foods.filter((f) => f.parentFoodId === food.id && f.isException);
      if (relatedExceptions.length > 0) {
        resultMode = "GENERAL_RULE_EXCEPTIONS";
        exceptions = {
          allowed: relatedExceptions.filter((f) => f.status === "allowed"),
          forbidden: relatedExceptions.filter((f) => f.status === "forbidden"),
          conditional: relatedExceptions.filter((f) => f.status === "conditional"),
        };
      }
    } else if (inherited) {
      resultMode = "SPECIFIC_INHERITED";
    }

    const candidates = findCandidatesForQuery(food.id);
    return { food, matchType, inherited, inheritsFrom, resultMode, exceptions, candidates };
  };

  if (identity) {
    const matchTypeLabel =
      identity.matchType === "EXACT" || identity.matchType === "NORMALIZED"
        ? "EXACT_FOODS_TABLE"
        : identity.matchType === "ALIAS"
        ? "EXACT"
        : identity.matchType;
    return buildResult(identity.food, matchTypeLabel, false);
  }

  return null;
}

export function aggregateFoodFamilySafety(
  food: any,
  knowledgeCache: CacheStore,
  candidates?: any[]
) {
  const { foods } = knowledgeCache;

  const childExceptions = foods.filter(
    (item) => item.parentFoodId === food.id || (item.foodType === "specific_food" && item.parentFoodId === food.id)
  );

  const allMembers: any[] = [food];
  const memberIds = new Set<number>([food.id]);

  for (const child of childExceptions) {
    if (!memberIds.has(child.id)) {
      memberIds.add(child.id);
      allMembers.push(child);
    }
  }

  const familyBaseName = extractBaseEntity(food.nameAr) || food.nameAr;
  const familyNormBase = stripArticle(normalizeName(familyBaseName));

  if (candidates && candidates.length > 0) {
    for (const cand of candidates) {
      if (!memberIds.has(cand.id)) {
        const candBaseName = extractBaseEntity(cand.nameAr) || cand.nameAr;
        const candNormBase = stripArticle(normalizeName(candBaseName));
        const isSameFamily =
          cand.parentFoodId === food.id ||
          food.parentFoodId === cand.id ||
          (cand.parentFoodId !== null && cand.parentFoodId === food.parentFoodId) ||
          candNormBase === familyNormBase ||
          candNormBase.startsWith(familyNormBase + " ") ||
          familyNormBase.startsWith(candNormBase + " ");

        if (isSameFamily) {
          memberIds.add(cand.id);
          allMembers.push(cand);
        }
      }
    }
  }

  if (process.env.DEBUG || process.env.NODE_ENV !== "production") {
    console.log(`[FOOD_FAMILY_AGGREGATION] Family ID: ${food.id} | Name: "${food.nameAr}" | Members Count: ${allMembers.length}`);
    for (const m of allMembers) {
      const src = m.id === food.id ? "canonical_root" : (m.parentFoodId === food.id ? "parent_child_db" : "base_entity_alignment");
      console.log(`  - Member ID: ${m.id} | Name: "${m.nameAr}" | Status: ${m.status} | Source: ${src}`);
    }
  }

  let familyStatus: "allowed" | "forbidden" | "conditional" | "mixed" = food.status as any;
  let familySummaryAr = "";

  const baseName = extractBaseEntity(food.nameAr) || food.nameAr;

  if (allMembers.length === 1) {
    if (food.status === "allowed") {
      familyStatus = "allowed";
      familySummaryAr = `جميع أنواع ${baseName} مسموحة`;
    } else if (food.status === "forbidden") {
      familyStatus = "forbidden";
      familySummaryAr = `${baseName}: ممنوع`;
    } else if (food.status === "conditional") {
      familyStatus = "conditional";
      familySummaryAr = `${baseName}: مشروط`;
    } else {
      familyStatus = "mixed";
      familySummaryAr = `${baseName}: يتطلب مراجعة`;
    }
  } else {
    const otherMembers = allMembers.filter((m) => m.id !== food.id);
    const hasAllowedOther = otherMembers.some((m) => m.status === "allowed");
    const hasForbiddenOther = otherMembers.some((m) => m.status === "forbidden");

    if (food.status === "forbidden" && hasAllowedOther) {
      familyStatus = "mixed";
      familySummaryAr = `${baseName}: ممنوع (يحتوي استثناءات مسموحة)`;
    } else if (food.status === "allowed" && hasForbiddenOther) {
      familyStatus = "mixed";
      familySummaryAr = `${baseName}: مسموح (يحتوي استثناءات ممنوعة)`;
    } else if (allMembers.every((m) => m.status === "allowed")) {
      familyStatus = "allowed";
      familySummaryAr = `جميع أنواع ${baseName} مسموحة`;
    } else if (allMembers.every((m) => m.status === "forbidden")) {
      familyStatus = "forbidden";
      familySummaryAr = `${baseName}: ممنوع`;
    } else {
      familyStatus = "mixed";
      familySummaryAr = `${baseName}: محدد بحسب النوع`;
    }
  }

  const allowedExceptions = allMembers
    .filter((m) => m.id !== food.id && m.status === "allowed")
    .map((m) => ({ id: m.id, nameAr: m.nameAr, nameEn: m.nameEn, status: "allowed", reason: m.reason }));

  const forbiddenExceptions = allMembers
    .filter((m) => m.id !== food.id && m.status === "forbidden")
    .map((m) => ({ id: m.id, nameAr: m.nameAr, nameEn: m.nameEn, status: "forbidden", reason: m.reason }));

  const conditionalExceptions = allMembers
    .filter((m) => m.id !== food.id && m.status === "conditional")
    .map((m) => ({ id: m.id, nameAr: m.nameAr, nameEn: m.nameEn, status: "conditional", reason: m.reason }));

  return {
    food,
    familyStatus,
    familySummaryAr,
    allowedExceptions,
    forbiddenExceptions,
    conditionalExceptions,
    allMembers,
  };
}

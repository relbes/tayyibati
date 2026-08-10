/**
 * Tayyibati AI Cache Module (Phase 6 - Step 4.5 & Final Production Validation)
 *
 * Provides dual-layer caching:
 * 1. Fast in-memory L1 cache (24-hour TTL).
 * 2. Persistent database L2 cache (ai_food_knowledge_cache table, AI_CACHE_TTL_DAYS configurable TTL).
 * 3. Versioned cache key format: `${INPUT_TYPE}:${NORM_QUERY}:${AI_CACHE_VERSION}`
 * 4. In-flight request coalescing (prevents duplicate provider calls under concurrent requests).
 */

import { db, aiFoodKnowledgeCacheTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { FoodKnowledgeResponse, SearchModality } from "./aiProvider";
import { norm } from "../arabicNormalization";
import { AI_CONFIG } from "../config";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours in-memory

interface CacheEntry {
  response: FoodKnowledgeResponse;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<FoodKnowledgeResponse>>();

export function getAICacheKey(query: string, inputType: SearchModality = "text"): string {
  const normQuery = norm(query || "").trim();
  const modality = (inputType || "text").toUpperCase();
  const version = AI_CONFIG.cacheVersion || "v1";
  return `${modality}:${normQuery}:${version}`;
}

export function aiCacheGetMemory(key: string): FoodKnowledgeResponse | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.response;
}

export function aiCacheSetMemory(key: string, response: FoodKnowledgeResponse): void {
  memoryCache.set(key, {
    response,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Synchronous memory cache check for fast lookup
 */
export function aiCacheGetSync(query: string, inputType: SearchModality = "text"): FoodKnowledgeResponse | null {
  const key = getAICacheKey(query, inputType);
  return aiCacheGetMemory(key);
}

/**
 * Async dual-layer cache check (Memory L1 + DB L2)
 */
export async function aiCacheGet(query: string, inputType: SearchModality = "text"): Promise<FoodKnowledgeResponse | null> {
  const key = getAICacheKey(query, inputType);

  // 1. Check Memory L1 Cache
  const memoryHit = aiCacheGetMemory(key);
  if (memoryHit) {
    return {
      ...memoryHit,
      debugMetadata: {
        ...(memoryHit.debugMetadata || { provider: "cache", model: "memory", durationMs: 0, success: true }),
        cacheHit: true,
      },
    };
  }

  // 2. Check Database L2 Cache
  try {
    const records = await db
      .select()
      .from(aiFoodKnowledgeCacheTable)
      .where(
        and(
          eq(aiFoodKnowledgeCacheTable.cacheKey, key),
          eq(aiFoodKnowledgeCacheTable.cacheVersion, AI_CONFIG.cacheVersion),
          eq(aiFoodKnowledgeCacheTable.isDeleted, false),
          gt(aiFoodKnowledgeCacheTable.expiresAt, new Date())
        )
      )
      .limit(1);

    if (records && records.length > 0) {
      const rec = records[0];
      const parsedResponse = rec.responseJson as FoodKnowledgeResponse;

      // Populate Memory L1 Cache
      aiCacheSetMemory(key, parsedResponse);

      // Async update hit count and last used timestamp
      db.update(aiFoodKnowledgeCacheTable)
        .set({
          hitCount: rec.hitCount + 1,
          lastUsedAt: new Date(),
        })
        .where(eq(aiFoodKnowledgeCacheTable.id, rec.id))
        .catch(() => {});

      return {
        ...parsedResponse,
        debugMetadata: {
          ...(parsedResponse.debugMetadata || { provider: rec.provider, model: rec.model, durationMs: 1, success: true }),
          cacheHit: true,
        },
      };
    }
  } catch (err: any) {
    // Graceful fallback on cache check error
  }

  return null;
}

/**
 * Dual-layer cache set (Memory L1 + DB L2 persistent configurable TTL storage)
 */
export async function aiCacheSet(query: string, inputType: SearchModality = "text", response: FoodKnowledgeResponse): Promise<void> {
  const key = getAICacheKey(query, inputType);
  const normQuery = norm(query || "").trim();

  // 1. Set Memory L1 Cache
  aiCacheSetMemory(key, response);

  // 2. Set Database L2 Persistent Cache
  try {
    const dbTtlMs = Math.max(1, AI_CONFIG.cacheTtlDays) * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + dbTtlMs);

    const existing = await db
      .select()
      .from(aiFoodKnowledgeCacheTable)
      .where(eq(aiFoodKnowledgeCacheTable.cacheKey, key))
      .limit(1);

    const providerToSave = response.debugMetadata?.provider || AI_CONFIG.provider;
    const modelToSave = response.debugMetadata?.model || AI_CONFIG.model;
    const versionToSave = AI_CONFIG.cacheVersion;

    if (existing && existing.length > 0) {
      await db
        .update(aiFoodKnowledgeCacheTable)
        .set({
          responseJson: response as any,
          confidence: response.confidence,
          provider: providerToSave,
          model: modelToSave,
          cacheVersion: versionToSave,
          updatedAt: new Date(),
          expiresAt,
          isDeleted: false,
        })
        .where(eq(aiFoodKnowledgeCacheTable.id, existing[0].id));
    } else {
      await db.insert(aiFoodKnowledgeCacheTable).values({
        cacheKey: key,
        normalizedQuery: normQuery,
        originalQuery: query || "",
        inputType: inputType || "text",
        entityType: response.entityType || "dish",
        canonicalNameAr: response.canonicalNameAr || query || "",
        canonicalNameEn: response.canonicalNameEn || query || "",
        responseJson: response as any,
        confidence: response.confidence,
        provider: providerToSave,
        model: modelToSave,
        cacheVersion: versionToSave,
        expiresAt,
        hitCount: 0,
      });
    }
  } catch (err: any) {
    console.error("[AI_PERSISTENT_CACHE] Error setting DB cache:", err?.message || err);
  }
}

/**
 * Executes fetcher with in-flight request deduplication and dual-layer caching.
 * Prevents race conditions when concurrent requests hit the same uncached query.
 */
export async function aiCacheGetOrFetch(
  query: string,
  inputType: SearchModality = "text",
  fetcher: () => Promise<FoodKnowledgeResponse>
): Promise<FoodKnowledgeResponse> {
  const key = getAICacheKey(query, inputType);

  // 1. Dual-layer cache check
  const cached = await aiCacheGet(query, inputType);
  if (cached) return cached;

  // 2. In-flight request deduplication
  const existingPromise = inFlightRequests.get(key);
  if (existingPromise) {
    return existingPromise;
  }

  // 3. Execute single provider request and coalesce concurrent callers
  const promise = (async () => {
    try {
      const response = await fetcher();
      await aiCacheSet(query, inputType, response);
      return response;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return promise;
}

export function aiCacheClearMemory(): void {
  memoryCache.clear();
  inFlightRequests.clear();
}

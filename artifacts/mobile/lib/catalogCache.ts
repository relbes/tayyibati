import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CatalogFoodItem {
  id: number;
  nameAr: string;
  category: string;
  categoryAr?: string;
  status: "allowed" | "forbidden" | "conditional";
}

export interface CachedCatalog {
  version: string;
  isPremium: boolean;
  foods: CatalogFoodItem[];
  timestamp: number;
}

const CATALOG_CACHE_KEY_PREFIX = "tayyibati_food_catalog_v1_";

/**
 * Client-side TTL for the catalog AsyncStorage cache.
 * After 2 hours the cache is treated as expired: getCachedCatalog returns null,
 * which causes syncCatalog to omit the If-None-Match header and force a full
 * fresh response from the server — guaranteeing the latest DB data is shown
 * (including any newly added "conditional" foods) within 2 hours of a DB change.
 */
const CATALOG_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function getCachedCatalog(userId: string): Promise<CachedCatalog | null> {
  try {
    const key = `${CATALOG_CACHE_KEY_PREFIX}${userId || "guest"}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalog;
    // Treat expired cache as a cache miss so the next fetch omits the ETag
    // and retrieves fresh data from the server unconditionally.
    if (Date.now() - (parsed.timestamp ?? 0) > CATALOG_CACHE_TTL_MS) {
      return null;
    }
    return parsed;
  } catch (err) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[CatalogCache] Failed to load cache:", err);
    }
    return null;
  }
}

export async function setCachedCatalog(
  userId: string,
  version: string,
  isPremium: boolean,
  foods: CatalogFoodItem[]
): Promise<void> {
  try {
    const key = `${CATALOG_CACHE_KEY_PREFIX}${userId || "guest"}`;
    const payload: CachedCatalog = {
      version,
      isPremium,
      foods,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[CatalogCache] Failed to save cache:", err);
    }
  }
}

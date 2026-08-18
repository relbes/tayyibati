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

export async function getCachedCatalog(userId: string): Promise<CachedCatalog | null> {
  try {
    const key = `${CATALOG_CACHE_KEY_PREFIX}${userId || "guest"}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedCatalog;
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

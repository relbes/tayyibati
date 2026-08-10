/**
 * Tayyibati Knowledge Resolver Layer (Phase 3)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/KNOWLEDGE_ENGINE_SPEC.md
 * - Loads complete canonical objects (Food, Dish Recipe, Product) given canonical identity.
 * - Keeps search entity resolution decoupled from business rules and DecisionEngine.
 */

import { getKnowledgeCache } from "./knowledgeCache";
import { warmDishEngineCache } from "./dishCompatibilityEngine";
import { ProductDatabase, ProductDbRecord } from "./productDatabase";
import { EntityType } from "./canonicalSearchEngine";

export interface ResolvedCanonicalObject {
  canonicalEntityId: number | string;
  canonicalEntityType: EntityType;
  canonicalName: string;
  canonicalSource: "foods_table" | "dishes_table" | "products_table";
  entityRecord: any;
  dishRecipe?: {
    dishId: number;
    nameAr: string;
    nameEn: string | null;
    category: string | null;
    ingredients: any[];
    countries: string[];
  };
  productRecord?: ProductDbRecord;
}

export class KnowledgeResolver {
  /**
   * Resolves complete canonical entity object and metadata by ID and type.
   */
  public static async resolveCanonicalObject(
    canonicalId: number | string,
    entityType: EntityType
  ): Promise<ResolvedCanonicalObject | null> {
    if (!canonicalId) return null;

    if (entityType === "food") {
      const cache = await getKnowledgeCache();
      const foodId = typeof canonicalId === "string" ? parseInt(canonicalId, 10) : canonicalId;
      const food = cache.foodById.get(foodId);
      if (!food) return null;

      return {
        canonicalEntityId: food.id,
        canonicalEntityType: "food",
        canonicalName: food.nameAr,
        canonicalSource: "foods_table",
        entityRecord: food,
      };
    }

    if (entityType === "dish") {
      const dishCache = await warmDishEngineCache();
      const dishId = typeof canonicalId === "string" ? parseInt(canonicalId, 10) : canonicalId;
      const dish = dishCache.dishesById.get(dishId);
      if (!dish) return null;

      const ingredients = dishCache.ingredientsByDishId.get(dishId) || [];
      const countries = dishCache.countriesByDishId.get(dishId) || [];

      return {
        canonicalEntityId: dish.id,
        canonicalEntityType: "dish",
        canonicalName: dish.nameAr,
        canonicalSource: "dishes_table",
        entityRecord: dish,
        dishRecipe: {
          dishId: dish.id,
          nameAr: dish.nameAr,
          nameEn: dish.nameEn || null,
          category: dish.category || null,
          ingredients,
          countries,
        },
      };
    }

    if (entityType === "product") {
      const p = ProductDatabase.getProductById(canonicalId);
      if (!p) return null;

      return {
        canonicalEntityId: p.productId || p.id,
        canonicalEntityType: "product",
        canonicalName: p.nameAr || p.productName,
        canonicalSource: "products_table",
        entityRecord: p,
        productRecord: p,
      };
    }

    return null;
  }
}

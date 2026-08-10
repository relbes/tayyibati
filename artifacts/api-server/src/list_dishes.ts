import { warmDishEngineCache } from "./lib/dishCompatibilityEngine";

async function listDishes() {
  const dCache = await warmDishEngineCache();
  console.log("=== First 30 Dishes ===");
  dCache.dishes.slice(0, 30).forEach(d => console.log(`ID: ${d.id} | name: "${d.nameAr}"`));
}

listDishes();

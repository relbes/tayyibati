import { getKnowledgeCache } from "./lib/knowledgeCache";
import { warmDishEngineCache } from "./lib/dishCompatibilityEngine";

async function checkAll() {
  const kCache = await getKnowledgeCache();
  const dCache = await warmDishEngineCache();

  console.log("=== FOODS containing shawarma ===");
  kCache.foods.filter(f => f.nameAr.includes("شاورما") || f.nameAr.includes("شاورمه")).forEach(f => {
    console.log(`Food ID: ${f.id} | nameAr: "${f.nameAr}"`);
  });

  console.log("=== FOOD ALIASES containing shawarma ===");
  kCache.aliases.filter(a => a.aliasAr.includes("شاورما") || a.aliasAr.includes("شاورمه")).forEach(a => {
    const target = kCache.foodById.get(a.foodId);
    console.log(`Alias: "${a.aliasAr}" -> Food ID ${a.foodId} (${target?.nameAr})`);
  });

  console.log("=== DISHES containing shawarma ===");
  dCache.dishes.filter(d => d.nameAr.includes("شاورما") || d.nameAr.includes("شاورمه")).forEach(d => {
    console.log(`Dish ID: ${d.id} | nameAr: "${d.nameAr}"`);
  });

  console.log("=== DISH ALIASES containing shawarma ===");
  for (const [norm, list] of dCache.dishAliasesByNormAr.entries()) {
    if (norm.includes("شاورما") || norm.includes("شاورمه")) {
      console.log(`Dish Alias Norm: "${norm}" ->`, list.map(x => `Dish ID ${x.canonicalDish?.id} (${x.canonicalDish?.nameAr})`));
    }
  }
}

checkAll();

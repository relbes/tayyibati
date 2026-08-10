import { warmDishEngineCache } from "./lib/dishCompatibilityEngine";
import { normalize, stripArticle } from "./lib/arabicNormalization";

async function checkDishes() {
  const cache = await warmDishEngineCache();
  console.log("Total dishes in dishCache:", cache.dishes.length);
  const shawarmaDishes = cache.dishes.filter(d => normalize(d.nameAr).includes("شاورما") || normalize(d.nameAr).includes("شاورمه"));
  console.log("Dishes containing shawarma:");
  shawarmaDishes.forEach(d => {
    console.log(`ID: ${d.id} | nameAr: "${d.nameAr}" | norm: "${normalize(d.nameAr)}"`);
  });

  const shawarmaAliases = Array.from(cache.dishAliasesByNormAr.entries()).filter(([norm, list]) => norm.includes("شاورما") || norm.includes("شاورمه"));
  console.log("Dish Aliases containing shawarma:");
  shawarmaAliases.forEach(([norm, list]) => {
    console.log(`Alias norm: "${norm}" | Targets:`, list.map(a => a.canonicalDish?.nameAr || a.dishId));
  });
}

checkDishes();

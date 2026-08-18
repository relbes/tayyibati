import { getKnowledgeCache } from "./lib/knowledgeCache";

async function inspectDBCategories() {
  const cache = await getKnowledgeCache();
  const allFoods = cache.foods || [];

  const categoriesCount = new Map<string, number>();
  for (const f of allFoods) {
    const cat = f.category || "NULL/EMPTY";
    categoriesCount.set(cat, (categoriesCount.get(cat) || 0) + 1);
  }

  console.log("=== DISTINCT CATEGORY VALUES IN FOODS DATABASE ===");
  for (const [cat, count] of categoriesCount.entries()) {
    console.log(`- "${cat}": ${count} foods`);
  }
}

inspectDBCategories();

import { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";
import { getKnowledgeCache, resolveFoodIdentity } from "./lib/knowledgeCache";

async function inspectBread() {
  const cache = await getKnowledgeCache();

  console.log("=== ALL BREAD FOODS IN DB ===");
  const breads = cache.foods.filter(f => f.nameAr.includes("خبز") || f.nameAr.includes("الخبز"));
  for (const b of breads) {
    console.log(`ID: ${b.id} | Name: "${b.nameAr}" | Type: ${b.foodType} | Parent: ${b.parentFoodId} | Status: ${b.status}`);
  }

  console.log("\n=== resolveFoodIdentity('خبز') ===");
  const identity = resolveFoodIdentity("خبز", cache);
  console.log(identity);

  console.log("\n=== searchEntities('خبز') ===");
  const sRes = await CanonicalSearchEngine.searchEntities("خبز");
  console.log("queryIntent:", sRes.queryIntent);
  console.log("primaryResult:", sRes.primaryResult ? { id: sRes.primaryResult.canonicalId, name: sRes.primaryResult.canonicalName, conf: sRes.primaryResult.searchConfidence, matchType: sRes.primaryResult.matchType } : null);
  console.log("displayFoods:", sRes.displayFoods.map(f => ({ id: f.canonicalId, name: f.canonicalName, conf: f.searchConfidence, matchType: f.matchType })));
}

inspectBread().catch(console.error);

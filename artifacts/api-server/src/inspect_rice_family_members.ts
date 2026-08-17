import { db, foodsTable } from "@workspace/db";
import { getKnowledgeCache, aggregateFoodFamilySafety } from "./lib/knowledgeCache";
import { extractBaseEntity, normalize, stripArticle } from "./lib/arabicNormalization";

async function inspectRice() {
  const cache = await getKnowledgeCache();
  const riceFood = cache.foods.find(f => f.id === 1364) || cache.foods.find(f => f.nameAr.includes("بجميع أشكاله"));
  
  console.log("=== CANONICAL RICE FOOD RECORD ===");
  console.log(riceFood);

  console.log("\n=== ALL DB FOOD RECORDS CONTAINING RICE / ARZ / ROZZ ===");
  const riceDbRecords = cache.foods.filter(f => {
    const normName = normalize(f.nameAr);
    const stripName = stripArticle(normName);
    return normName.includes("ارز") || normName.includes("رز") || stripName.includes("ارز") || stripName.includes("رز");
  });

  for (const r of riceDbRecords) {
    console.log(`ID: ${r.id} | Name: ${r.nameAr} | Status: ${r.status} | Parent: ${r.parentFoodId} | Type: ${r.foodType}`);
  }

  if (riceFood) {
    console.log("\n=== AGGREGATE FOOD FAMILY SAFETY FOR RICE (ID 1364) ===");
    const res = aggregateFoodFamilySafety(riceFood, cache);
    console.log("Family Status:", res.familyStatus);
    console.log("Family Summary:", res.familySummaryAr);
    console.log("All Members Count:", res.allMembers.length);
    console.log("All Members Breakdown:");
    for (const m of res.allMembers) {
      console.log(`  - Member ID: ${m.id} | Name: "${m.nameAr}" | Status: ${m.status} | Parent: ${m.parentFoodId} | Reason: ${m.reason}`);
    }
  }
}

inspectRice().catch(console.error);

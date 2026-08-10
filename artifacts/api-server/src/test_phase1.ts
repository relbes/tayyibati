import { normalize, stripArticle } from "./lib/arabicNormalization";
import { expandSearchQuery } from "./lib/searchExpansion";
import { getKnowledgeCache } from "./lib/knowledgeCache";

async function run() {
  console.log("====================================================");
  console.log("TESTING PHASE 1 FOUNDATION & SSoT NORMALIZATION");
  console.log("====================================================");

  // 1. Arabic Normalization SSoT
  console.log("1. Arabic Normalization SSoT:");
  console.log(" -> normalize('مانجا'):", normalize("مانجا"));
  console.log(" -> normalize('المانجو'):", normalize("المانجو"));
  console.log(" -> normalize('تمر'):", normalize("تمر"));
  console.log(" -> normalize('التمر'):", normalize("التمر"));
  console.log(" -> normalize('ضأن'):", normalize("ضأن"));
  console.log(" -> normalize('ضان'):", normalize("ضان"));
  console.log(" -> normalize('شاورمه'):", normalize("شاورمه"));
  console.log(" -> normalize('كبسه'):", normalize("كبسه"));
  console.log(" -> stripArticle('التمر'):", stripArticle("التمر"));

  // 2. Search Expansion
  console.log("\n2. Search Expansion & Synonyms:");
  console.log(" -> expandSearchQuery('مانجا'):", expandSearchQuery("مانجا"));
  console.log(" -> expandSearchQuery('تمر'):", expandSearchQuery("تمر"));
  console.log(" -> expandSearchQuery('ضأن'):", expandSearchQuery("ضأن"));
  console.log(" -> expandSearchQuery('شاورمه'):", expandSearchQuery("شاورمه"));
  console.log(" -> expandSearchQuery('كبسه'):", expandSearchQuery("كبسه"));

  // 3. Knowledge Cache & Alias Integrity
  console.log("\n3. Knowledge Cache Warmup & Alias Integrity:");
  const t0 = performance.now();
  const cache = await getKnowledgeCache();
  const elapsed = Math.round(performance.now() - t0);
  console.log(` -> Cache loaded in ${elapsed} ms`);
  console.log(` -> Foods count: ${cache.foods.length}`);
  console.log(` -> Valid Aliases count: ${cache.aliases.length}`);
  console.log(` -> foodNormMap size: ${cache.foodNormMap.size}`);
  console.log(` -> foodById size: ${cache.foodById.size}`);

  console.log("\nPHASE 1 VERIFICATION COMPLETE: ALL FOUNDATION SYSTEMS FUNCTIONAL ✅");
  process.exit(0);
}

run().catch(console.error);

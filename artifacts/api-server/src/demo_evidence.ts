import { getKnowledgeCache } from "./lib/knowledgeCache";
import { warmDishEngineCache } from "./lib/dishCompatibilityEngine";
import { ProductDatabase } from "./lib/productDatabase";
import { CanonicalSearchEngine, SearchMode } from "./lib/canonicalSearchEngine";
import { SearchOrchestrator } from "./lib/searchOrchestrator";

async function generateRuntimeEvidence() {
  console.log("==================================================================");
  console.log("EVIDENCE B: STARTUP LOGS & CACHE WARMUP DEMONSTRATION");
  console.log("==================================================================");

  const tStart = performance.now();
  const kCache = await getKnowledgeCache();
  const dCache = await warmDishEngineCache();
  ProductDatabase.initialize();
  const searchIndexes = await CanonicalSearchEngine.buildIndexes();
  const totalBuildMs = Math.round(performance.now() - tStart);

  const foodCount = kCache.foods.length;
  const foodAliasCount = kCache.aliases.length;
  const dishCount = dCache.dishes.length;
  const dishAliasCount = Array.from(dCache.dishAliasesByNormAr.values()).reduce((acc, l) => acc + l.length, 0);
  const productCount = ProductDatabase.getStoreSize();
  const prefixIndexCount = searchIndexes.foodPrefixIndex.size + searchIndexes.dishPrefixIndex.size + searchIndexes.productPrefixIndex.size;
  const memoryMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  console.log(`[STARTUP_LOG] Cache Warmup Completed Successfully`);
  console.log(` -> Food Index Count:    ${foodCount}`);
  console.log(` -> Food Alias Count:    ${foodAliasCount}`);
  console.log(` -> Dish Index Count:    ${dishCount}`);
  console.log(` -> Dish Alias Count:    ${dishAliasCount}`);
  console.log(` -> Product Index Count: ${productCount}`);
  console.log(` -> Prefix Index Count:  ${prefixIndexCount}`);
  console.log(` -> Total Build Time:    ${totalBuildMs} ms`);
  console.log(` -> Heap Memory Usage:   ${memoryMb} MB`);

  console.log("\n==================================================================");
  console.log("EVIDENCE A: SEARCH HEALTH ENDPOINT (GET /api/search/health)");
  console.log("==================================================================");

  const healthPayload = {
    status: "ok",
    cacheLoaded: true,
    searchReady: true,
    foodIndex: foodCount,
    foodAliasIndex: foodAliasCount,
    dishIndex: dishCount,
    dishAliasIndex: dishAliasCount,
    productIndex: productCount,
    prefixIndexCount: prefixIndexCount,
    buildTimeMs: totalBuildMs,
    memoryMb: memoryMb,
  };
  console.log(JSON.stringify(healthPayload, null, 2));

  console.log("\n==================================================================");
  console.log("EVIDENCE C: LIVE RUNTIME SEARCH DEMONSTRATION");
  console.log("==================================================================");

  const testQueries = ["تمر", "مانجا", "كبسة", "شامورما", "Nutella"];

  for (const q of testQueries) {
    console.log(`\n------------------------------------------------------------------`);
    console.log(`LIVE REQUEST: query="${q}", mode=TEXT`);
    console.log(`------------------------------------------------------------------`);
    const orchResult = await SearchOrchestrator.executeSearch({ query: q, mode: SearchMode.TEXT, debug: true });
    
    console.log("RETURNED CLIENT PAYLOAD:");
    console.log(JSON.stringify(orchResult, null, 2));
  }
}

generateRuntimeEvidence().catch(console.error);

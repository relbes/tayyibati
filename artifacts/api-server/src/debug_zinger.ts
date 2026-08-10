import { CanonicalSearchEngine, SearchMode } from "./lib/canonicalSearchEngine";
import { SearchOrchestrator } from "./lib/searchOrchestrator";
import { KnowledgeResolver } from "./lib/knowledgeResolver";
import { getKnowledgeCache } from "./lib/knowledgeCache";
import { warmDishEngineCache } from "./lib/dishCompatibilityEngine";

async function traceZinger() {
  console.log("==================================================");
  console.log("TRACING QUERY: 'زنجر'");
  console.log("==================================================");

  // 1. Check Search Engine Direct Lookup
  const searchResult = await CanonicalSearchEngine.search({ query: "زنجر", mode: SearchMode.TEXT, debug: true });
  console.log("\n1. CANONICAL SEARCH ENGINE RESULT:");
  console.log(JSON.stringify(searchResult, null, 2));

  // 2. Check Search Orchestrator Gateway
  const orchResult = await SearchOrchestrator.executeSearch({ query: "زنجر", mode: SearchMode.TEXT, debug: true });
  console.log("\n2. SEARCH ORCHESTRATOR RESULT:");
  console.log(JSON.stringify(orchResult, null, 2));

  // 3. Check DB records for 'زنجر'
  const kCache = await getKnowledgeCache();
  const dCache = await warmDishEngineCache();

  const foodMatch = kCache.foods.filter(f => f.nameAr.includes("زنجر") || (f.nameEn && f.nameEn.toLowerCase().includes("zinger")));
  console.log("\n3. FOOD DB MATCHES FOR 'زنجر':", foodMatch);

  const aliasMatch = kCache.aliases.filter(a => a.aliasAr.includes("زنجر") || (a.aliasEn && a.aliasEn.toLowerCase().includes("zinger")));
  console.log("4. FOOD ALIAS DB MATCHES FOR 'زنجر':", aliasMatch);

  const dishMatch = dCache.dishes.filter(d => d.nameAr.includes("زنجر") || (d.nameEn && d.nameEn.toLowerCase().includes("zinger")));
  console.log("5. DISH DB MATCHES FOR 'زنجر':", dishMatch);

  const dishAliasMatch = Array.from(dCache.dishAliasesByNormAr.entries()).filter(([norm]) => norm.includes("زنجر"));
  console.log("6. DISH ALIAS DB MATCHES FOR 'زنجر':", dishAliasMatch);
}

traceZinger().catch(console.error);

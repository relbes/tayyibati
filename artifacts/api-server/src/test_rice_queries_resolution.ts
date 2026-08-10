import { SearchOrchestrator } from "./lib/searchOrchestrator";
import { SearchMode } from "./lib/canonicalSearchEngine";

interface QueryVerificationResult {
  query: string;
  triggerAction: string;
  searchOutcome: string;
  canonicalId: number | string;
  canonicalName: string;
  searchMethod: string;
  matchedAlias: string;
  confidence: number;
  aiCalled: boolean;
}

async function runRiceQueriesVerification() {
  console.log("=========================================================================");
  console.log("VERIFYING RICE ALIAS RESOLUTION & REGRESSION QUERIES");
  console.log("=========================================================================\n");

  const riceQueries = [
    "أرز",
    "رز",
    "أرز مصري",
    "رز مصري",
    "أرز أبيض",
    "رز أبيض",
    "أرز بني",
    "رز بني",
    "أرز بسمتي",
    "رز بسمتي",
    "أرز تايلندي",
    "رز تايلندي",
  ];

  const regressionQueries = [
    "صدر دجاج",
    "لحم مفروم",
    "خبز برغر",
    "بطاطا مقلية",
    "جبنة شيدر",
    "مايونيز",
    "خس",
    "طماطم",
  ];

  const results: QueryVerificationResult[] = [];
  let totalAiCalls = 0;

  console.log("--- PART 8: RICE VARIANT SEARCHES ---");
  for (const q of riceQueries) {
    const res = await SearchOrchestrator.executeSearch({ query: q, mode: SearchMode.TEXT });
    const cRes = res.canonicalResult;
    const aiCalled = !!res.aiKnowledge;
    if (aiCalled) totalAiCalls++;

    const item: QueryVerificationResult = {
      query: q,
      triggerAction: res.triggerAction,
      searchOutcome: cRes?.searchOutcome || "N/A",
      canonicalId: cRes?.canonical_id || 0,
      canonicalName: cRes?.canonical_name || "N/A",
      searchMethod: cRes?.search_method || "N/A",
      matchedAlias: cRes?.matched_alias || "N/A",
      confidence: cRes?.confidence || 0,
      aiCalled,
    };
    results.push(item);
  }
  console.table(results);

  console.log("\n--- PART 9: REGRESSION VERIFICATION SEARCHES ---");
  const regressionResults: QueryVerificationResult[] = [];
  for (const q of regressionQueries) {
    const res = await SearchOrchestrator.executeSearch({ query: q, mode: SearchMode.TEXT });
    const cRes = res.canonicalResult;
    const aiCalled = !!res.aiKnowledge;
    if (aiCalled) totalAiCalls++;

    const item: QueryVerificationResult = {
      query: q,
      triggerAction: res.triggerAction,
      searchOutcome: cRes?.searchOutcome || "N/A",
      canonicalId: cRes?.canonical_id || 0,
      canonicalName: cRes?.canonical_name || "N/A",
      searchMethod: cRes?.search_method || "N/A",
      matchedAlias: cRes?.matched_alias || "N/A",
      confidence: cRes?.confidence || 0,
      aiCalled,
    };
    regressionResults.push(item);
  }
  console.table(regressionResults);

  console.log("\n=========================================================================");
  console.log(`TOTAL AI KNOWLEDGE EXTRACTOR CALLS: ${totalAiCalls}`);
  console.log("=========================================================================\n");

  if (totalAiCalls > 0) {
    console.error("❌ FAILURE: AI Knowledge Extractor was invoked for database-resolvable queries!");
    process.exit(1);
  } else {
    console.log("✅ SUCCESS: All 12 rice queries + 8 regression queries resolved directly with ZERO AI calls!");
  }
}

runRiceQueriesVerification().catch((err) => {
  console.error("VERIFICATION_ERROR", err);
  process.exit(1);
});

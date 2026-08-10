import { SearchOrchestrator } from "./lib/searchOrchestrator";
import { CanonicalSearchEngine, SearchMode } from "./lib/canonicalSearchEngine";

async function runPhase4Tests() {
  console.log("====================================================");
  console.log("RUNNING PHASE 4 API MODEL REFINEMENT TEST SUITE");
  console.log("====================================================");

  let passed = 0;
  let total = 0;

  // Test 1: Verify clean SearchResult schema on Food search ('تمر')
  total++;
  console.log("----------------------------------------------------");
  console.log("Test 1: Clean SearchResult Schema on Food Search ('تمر')");
  const res1 = await CanonicalSearchEngine.search({ query: "تمر", mode: SearchMode.TEXT });
  console.log(" -> canonicalId:        ", res1?.canonicalId);
  console.log(" -> canonicalEntityType:", res1?.canonicalEntityType);
  console.log(" -> canonicalName:      ", res1?.canonicalName);
  console.log(" -> searchConfidence:   ", res1?.searchConfidence);
  console.log(" -> matchType:          ", res1?.matchType);
  console.log(" -> matchedReason:      ", res1?.matchedReason);
  console.log(" -> matchedAlias:       ", res1?.matchedAlias);

  const cleanOk =
    res1?.canonicalId === 611 &&
    res1?.canonicalEntityType === "food" &&
    res1?.canonicalName === "التمر والرطب" &&
    res1?.searchConfidence === 100 &&
    res1?.matchType === "ALIAS" &&
    res1?.matchedAlias === "تمر";

  if (cleanOk) {
    passed++;
    console.log(">>> RESULT: PASS ✅");
  } else {
    console.log(">>> RESULT: FAIL ❌");
  }

  // Test 2: Verify Backward Compatibility Fields Match Clean Fields 1:1
  total++;
  console.log("----------------------------------------------------");
  console.log("Test 2: Verify Backward Compatibility Fields Match Clean Fields");
  const compatOk =
    res1?.canonical_id === res1?.canonicalId &&
    res1?.entity_type === res1?.canonicalEntityType &&
    res1?.canonical_name === res1?.canonicalName &&
    res1?.confidence === res1?.searchConfidence &&
    res1?.matched_alias === res1?.matchedAlias;

  console.log(" -> canonical_id === canonicalId:  ", res1?.canonical_id === res1?.canonicalId);
  console.log(" -> entity_type === canonicalType: ", res1?.entity_type === res1?.canonicalEntityType);
  console.log(" -> confidence === searchConfidence:", res1?.confidence === res1?.searchConfidence);

  if (compatOk) {
    passed++;
    console.log(">>> RESULT: PASS ✅");
  } else {
    console.log(">>> RESULT: FAIL ❌");
  }

  // Test 3: SearchOrchestration Result Schema
  total++;
  console.log("----------------------------------------------------");
  console.log("Test 3: SearchOrchestrator Result Schema ('Nutella')");
  const orchRes = await SearchOrchestrator.executeSearch({ query: "Nutella", mode: SearchMode.TEXT });
  console.log(" -> Trigger Action:", orchRes.triggerAction);
  console.log(" -> canonicalId:   ", orchRes.canonicalResult?.canonicalId);
  console.log(" -> matchType:     ", orchRes.canonicalResult?.matchType);
  if (orchRes.triggerAction === "ANALYZE_IMMEDIATE" && orchRes.canonicalResult?.canonicalEntityType === "product") {
    passed++;
    console.log(">>> RESULT: PASS ✅");
  } else {
    console.log(">>> RESULT: FAIL ❌");
  }

  console.log("\n====================================================");
  console.log(`PHASE 4 VERIFICATION SUMMARY: ${passed} / ${total} Passed`);
  console.log("====================================================");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase4Tests().catch(console.error);

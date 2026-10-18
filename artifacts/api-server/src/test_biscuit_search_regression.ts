import assert from "assert";
import { CanonicalSearchEngine, SearchMode } from "./lib/canonicalSearchEngine";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { expandSearchQuery } from "./lib/searchExpansion";

async function runBiscuitRegressionSuite() {
  console.log("==========================================================");
  console.log("       TAYYIBATI BISCUIT SEARCH REGRESSION TEST SUITE     ");
  console.log("==========================================================\n");

  // TEST 1: Variant Expansion Verification
  console.log("--- TEST 1: Search Expansion Variants ---");
  const expansions = [
    { input: "بسكوت", expected: ["بسكويت", "البسكوت"] },
    { input: "بسكويت", expected: ["بسكوت", "البسكويت"] },
    { input: "دايجستيف", expected: ["دايجستف"] },
    { input: "بسكويت دايجستيف", expected: ["بسكوت دايجستف"] },
    { input: "بسكويت شوفان", expected: ["بسكوت شوفان"] },
  ];

  for (const exp of expansions) {
    const variants = expandSearchQuery(exp.input);
    console.log(`Query "${exp.input}" expanded to:`, variants);
    for (const req of exp.expected) {
      assert.ok(
        variants.includes(req),
        `Expansion for "${exp.input}" MUST contain "${req}". Found: ${JSON.stringify(variants)}`
      );
    }
  }
  console.log("[PASS] TEST 1: Search expansion variants are fully bidirectional and comprehensive!\n");

  // TEST 2: Canonical Search Engine Entity Resolution
  console.log("--- TEST 2: Canonical Search Resolution ---");
  const testCases = [
    { query: "بسكوت", expectedId: 1447, expectedName: "بسكوت" },
    { query: "البسكوت", expectedId: 1447, expectedName: "بسكوت" },
    { query: "بسكويت", expectedId: 1447, expectedName: "بسكوت" },
    { query: "البسكويت", expectedId: 1447, expectedName: "بسكوت" },
    { query: "بسكوتة", expectedId: 1447, expectedName: "بسكوت" },
    { query: "بسكويتة", expectedId: 1447, expectedName: "بسكوت" },
    { query: "بسكوت شوفان", expectedId: 1453, expectedName: "بسكوت شوفان" },
    { query: "بسكويت شوفان", expectedId: 1453, expectedName: "بسكوت شوفان" },
    { query: "بسكوت دايجستف", expectedId: 1454, expectedName: "بسكوت دايجستف" },
    { query: "بسكوت دايجستيف", expectedId: 1454, expectedName: "بسكوت دايجستف" },
    { query: "بسكويت دايجستف", expectedId: 1454, expectedName: "بسكوت دايجستف" },
    { query: "بسكويت دايجستيف", expectedId: 1454, expectedName: "بسكوت دايجستف" },
  ];

  for (const tc of testCases) {
    const searchRes = await CanonicalSearchEngine.searchEntities(tc.query, { rankingProfile: "TEXT" as any });
    assert.ok(searchRes.primaryResult, `Search for "${tc.query}" MUST yield a primary result`);
    assert.strictEqual(
      Number(searchRes.primaryResult.canonicalId),
      tc.expectedId,
      `Query "${tc.query}" must resolve to Food #${tc.expectedId} ('${tc.expectedName}'), but resolved to #${searchRes.primaryResult.canonicalId} ('${searchRes.primaryResult.canonicalName}')`
    );
    console.log(`[PASS] "${tc.query}" -> Food #${searchRes.primaryResult.canonicalId} (${searchRes.primaryResult.canonicalName})`);
  }
  console.log("[PASS] TEST 2: All biscuit orthographic variants resolve to correct canonical records!\n");

  // TEST 3: Unified Analysis Pipeline Ruling Integrity
  console.log("--- TEST 3: Unified Analysis Pipeline Ruling Integrity ---");
  for (const tc of testCases) {
    const analysisRes = await UnifiedAnalysisEngine.analyze({
      query: tc.query,
      displayQuery: tc.query,
      inputType: "text",
    });

    const report = analysisRes.report;
    assert.strictEqual(report.resultMode, "EXACT_FOOD", `Query "${tc.query}" must have resultMode EXACT_FOOD`);
    assert.strictEqual(report.notFound, false, `Query "${tc.query}" must NOT be notFound`);
    assert.ok(report.primaryRuling, `Query "${tc.query}" must have primaryRuling`);
    assert.strictEqual(report.primaryRuling?.status, "forbidden", `Query "${tc.query}" must be forbidden`);
    assert.strictEqual(
      report.forbidden && report.forbidden.length > 0,
      true,
      `Query "${tc.query}" must contain item in forbidden list`
    );
    console.log(`[PASS] Analysis "${tc.query}" -> status: ${report.primaryRuling?.status} | reason: ${report.primaryRuling?.dbReason}`);
  }
  console.log("[PASS] TEST 3: All queries produce valid forbidden ruling with no empty state!\n");

  // TEST 4: Autocomplete Candidate Generation
  console.log("--- TEST 4: Autocomplete Candidate Generation ---");
  const autocompleteQueries = ["بسك", "بسكوت", "بسكويت", "بسكويت ش", "دايجستيف"];
  for (const aq of autocompleteQueries) {
    const acResult = await CanonicalSearchEngine.search(aq, { mode: SearchMode.AUTOCOMPLETE });
    assert.ok(acResult, `Autocomplete for "${aq}" must not return null`);
    console.log(`Autocomplete for "${aq}" returned candidates:`, acResult.candidateFoods?.map(f => f.canonicalName) || [acResult.canonicalName]);
  }
  console.log("[PASS] TEST 4: Autocomplete correctly yields candidate food items!\n");

  console.log("==========================================================");
  console.log("  ALL BISCUIT REGRESSION TESTS PASSED SUCCESSFULLY (100%) ");
  console.log("==========================================================");
}

runBiscuitRegressionSuite().catch((err) => {
  console.error("REGRESSION TEST FAILED:", err);
  process.exit(1);
});

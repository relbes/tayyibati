import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";
import { createAnalysisResultViewModel } from "../../mobile/lib/models/AnalysisResultViewModel";
import assert from "assert";

async function runDisplayTitleTests() {
  console.log("==================================================");
  console.log("  TESTING ANALYSIS RESULT TITLE & DISPLAY QUERY   ");
  console.log("==================================================\n");

  // TEST 1: Input "خبز"
  console.log("--- TEST 1: Search 'خبز' ---");
  const uRes1 = await UnifiedAnalysisEngine.analyze({ query: "خبز", displayQuery: "خبز" });
  const vm1 = createAnalysisResultViewModel(uRes1.report);
  console.log(`Input: "خبز" | ViewModel recognizedName: "${vm1.recognizedName}" | Internal canonical: "${uRes1.report.primaryRuling?.nameAr}"`);
  assert.strictEqual(vm1.recognizedName, "خبز", `Result title must be 'خبز' (got '${vm1.recognizedName}')`);
  assert.notStrictEqual(vm1.recognizedName, "خبز فرنسي", `Generic 'خبز' title MUST NOT be 'خبز فرنسي'`);
  assert.notStrictEqual(vm1.recognizedName, "خبز التوست الحبة الكاملة", `Generic 'خبز' title MUST NOT be 'خبز التوست...'`);
  console.log("[PASS] TEST 1: Generic query 'خبز' display title preserved as 'خبز'!\n");

  // TEST 2: Input "رز"
  console.log("--- TEST 2: Search 'رز' ---");
  const uRes2 = await UnifiedAnalysisEngine.analyze({ query: "رز", displayQuery: "رز" });
  const vm2 = createAnalysisResultViewModel(uRes2.report);
  console.log(`Input: "رز" | ViewModel recognizedName: "${vm2.recognizedName}" | Internal canonical: "${uRes2.report.primaryRuling?.nameAr}"`);
  assert.strictEqual(vm2.recognizedName, "رز", `Result title must be 'رز' (got '${vm2.recognizedName}')`);
  console.log("[PASS] TEST 2: Generic query 'رز' display title preserved as 'رز'!\n");

  // TEST 3: Input "أرز"
  console.log("--- TEST 3: Search 'أرز' ---");
  const uRes3 = await UnifiedAnalysisEngine.analyze({ query: "أرز", displayQuery: "أرز" });
  const vm3 = createAnalysisResultViewModel(uRes3.report);
  console.log(`Input: "أرز" | ViewModel recognizedName: "${vm3.recognizedName}" | Internal canonical: "${uRes3.report.primaryRuling?.nameAr}"`);
  assert.strictEqual(vm3.recognizedName, "أرز", `Result title must be 'أرز' (got '${vm3.recognizedName}')`);
  console.log("[PASS] TEST 3: Generic query 'أرز' display title preserved as 'أرز'!\n");

  // TEST 4: Input "أرز مصري"
  console.log("--- TEST 4: Search 'أرز مصري' ---");
  const uRes4 = await UnifiedAnalysisEngine.analyze({ query: "أرز مصري", displayQuery: "أرز مصري" });
  const vm4 = createAnalysisResultViewModel(uRes4.report);
  console.log(`Input: "أرز مصري" | ViewModel recognizedName: "${vm4.recognizedName}"`);
  assert.strictEqual(vm4.recognizedName, "أرز مصري", `Result title must be 'أرز مصري' (got '${vm4.recognizedName}')`);
  console.log("[PASS] TEST 4: Specific query 'أرز مصري' display title preserved!\n");

  // TEST 5: Explicit Selected Suggestion "خبز فرنسي"
  console.log("--- TEST 5: Autocomplete Suggestion Selection 'خبز فرنسي' ---");
  const uRes5 = await UnifiedAnalysisEngine.analyze({
    query: "خبز فرنسي",
    displayQuery: "خبز فرنسي",
    entityType: "food",
    canonicalId: 1345,
  });
  const vm5 = createAnalysisResultViewModel(uRes5.report);
  console.log(`Selected Suggestion: "خبز فرنسي" | ViewModel recognizedName: "${vm5.recognizedName}"`);
  assert.strictEqual(vm5.recognizedName, "خبز فرنسي", `Result title must be 'خبز فرنسي' (got '${vm5.recognizedName}')`);
  console.log("[PASS] TEST 5: Selected suggestion 'خبز فرنسي' display title preserved!\n");

  // TEST 6: Generic "خبز" must NOT produce "خبز فرنسي" or "خبز التوست الحبة الكاملة"
  console.log("--- TEST 6: Negative Assertion Guard ---");
  assert.notStrictEqual(vm1.recognizedName, "خبز فرنسي");
  assert.notStrictEqual(vm1.recognizedName, "خبز التوست الحبة الكاملة");
  console.log("[PASS] TEST 6: Negative assertion verified!\n");

  console.log("==================================================");
  console.log("  ALL DISPLAY TITLE PRESERVATION TESTS PASSED (100%)");
  console.log("==================================================");
}

runDisplayTitleTests().catch((err) => {
  console.error("DISPLAY TITLE TEST FAILED:", err);
  process.exit(1);
});

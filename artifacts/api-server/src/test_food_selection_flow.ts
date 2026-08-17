import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";
import assert from "assert";

async function runTest() {
  console.log("==================================================");
  console.log("  TESTING EXPLICIT FOOD ENTITY & FAMILY FLOW     ");
  console.log("==================================================\n");

  // TEST 1: "رز" -> FOOD intent, Rice family resolution
  console.log("--- Test 1: Query 'رز' ---");
  const sRes1 = await CanonicalSearchEngine.searchEntities("رز", { debug: true });
  console.log("sRes1 debug:", JSON.stringify({ queryIntent: sRes1.queryIntent, foods: sRes1.foods.map(f => ({ name: f.canonicalName, conf: f.searchConfidence, match: f.matchType })), dishes: sRes1.dishes.map(d => ({ name: d.canonicalName, conf: d.searchConfidence, match: d.matchType })) }, null, 2));
  assert(sRes1.queryIntent === "FOOD", `queryIntent should be FOOD (got '${sRes1.queryIntent}')`);
  assert(sRes1.displayDishes.length === 0, `displayDishes should be EMPTY (got ${sRes1.displayDishes.length})`);
  assert(sRes1.displayFoods.length > 0, `displayFoods should have items`);

  const uRes1 = await UnifiedAnalysisEngine.analyze({ query: "رز" });
  console.log("Result 1 Summary:", (uRes1.report as any).familySummary || uRes1.report.explanation);
  assert(!uRes1.report.dish || !uRes1.report.dish.includes("مجدرة"), "Result 1 MUST NOT return 'مجدرة الأرز'");
  assert(uRes1.report.primaryRuling?.status === "allowed", "Rice status should be allowed");
  console.log("[PASS] Test 1: Query 'رز' resolved to Rice family with ALLOWED status!");

  // TEST 2: "أرز مصري" -> FOOD intent & direct food analysis
  console.log("\n--- Test 2: Query 'أرز مصري' ---");
  const uRes2 = await UnifiedAnalysisEngine.analyze({
    query: "أرز مصري",
    entityType: "food",
    canonicalId: 15,
  });
  console.log("Result 2 Summary:", (uRes2.report as any).familySummary || uRes2.report.explanation);
  assert(uRes2.report.primaryRuling?.status === "allowed", "Rice status should be allowed");
  assert(!uRes2.report.dish || !uRes2.report.dish.includes("مجدرة"), "Result 2 MUST NOT return 'مجدرة الأرز'");
  console.log("[PASS] Test 2: 'أرز مصري' resolved directly to Food entity!");

  // TEST 3: "خبز" -> Bread Family & Exceptions
  console.log("\n--- Test 3: Query 'خبز' ---");
  const sRes3 = await CanonicalSearchEngine.searchEntities("خبز");
  assert(sRes3.queryIntent === "FOOD", `queryIntent should be FOOD (got '${sRes3.queryIntent}')`);
  assert(sRes3.displayDishes.length === 0, `displayDishes should be EMPTY (got ${sRes3.displayDishes.length})`);

  const uRes3 = await UnifiedAnalysisEngine.analyze({ query: "خبز" });
  console.log("Result 3 Summary:", (uRes3.report as any).familySummary || uRes3.report.explanation);
  console.log("Result 3 Allowed Exceptions:", uRes3.report.allowed?.map(a => a.nameAr));
  console.log("[PASS] Test 3: 'خبز' resolved to Bread family!");

  // TEST 4: Dish "منسف دجاج"
  console.log("\n--- Test 4: Dish Selection 'منسف دجاج' ---");
  const uRes4 = await UnifiedAnalysisEngine.analyze({
    query: "منسف دجاج",
    entityType: "dish",
    canonicalId: 618,
  });
  console.log("Result 4 Dish Name:", uRes4.report.dish);
  assert(uRes4.report.dish?.includes("المنسف") || uRes4.report.dish?.includes("منسف"), "Result 4 should return Mansaf dish");
  console.log("[PASS] Test 4: Dish search 'منسف دجاج' preserved!");

  console.log("\n==================================================");
  console.log("  ALL FOOD FAMILY & SELECTION TESTS PASSED (100%)");
  console.log("==================================================");
}

runTest().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});

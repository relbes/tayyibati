import { CanonicalSearchEngine, SearchMode } from "./lib/canonicalSearchEngine";

async function runTests() {
  console.log("==================================================");
  console.log("  DUAL-CHANNEL SEARCH & INTENT SEPARATION SUITE   ");
  console.log("==================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
    }
  }

  // TEST 1: "أرز مصري" -> FOOD intent, displayFoods non-empty, displayDishes EMPTY (No dish flooding!)
  console.log("--- Test 1: Query 'أرز مصري' ---");
  const res1 = await CanonicalSearchEngine.searchEntities("أرز مصري", { mode: SearchMode.AUTOCOMPLETE });
  assert(res1.queryIntent === "FOOD", `queryIntent is FOOD (got '${res1.queryIntent}')`);
  assert(res1.displayFoods.length > 0, `displayFoods has items (${res1.displayFoods.length})`);
  assert(res1.displayFoods.some(f => f.canonicalName.includes("أرز")), `displayFoods contains rice entity ('${res1.displayFoods[0]?.canonicalName}')`);
  assert(res1.displayDishes.length === 0, `displayDishes is EMPTY to prevent dish flooding (got ${res1.displayDishes.length})`);
  assert(!res1.displayDishes.some(d => d.canonicalName.includes("مجدرة")), `displayDishes does not promote 'مجدرة الأرز' for 'أرز مصري'`);

  // TEST 2: "أرز بسمتي" -> FOOD intent
  console.log("\n--- Test 2: Query 'أرز بسمتي' ---");
  const res2 = await CanonicalSearchEngine.searchEntities("أرز بسمتي", { mode: SearchMode.AUTOCOMPLETE });
  assert(res2.queryIntent === "FOOD", `queryIntent is FOOD (got '${res2.queryIntent}')`);
  assert(res2.displayFoods.length > 0, `displayFoods has items (${res2.displayFoods.length})`);
  assert(res2.displayDishes.length === 0, `displayDishes is EMPTY (got ${res2.displayDishes.length})`);

  // TEST 3: "جبن" -> FOOD intent
  console.log("\n--- Test 3: Query 'جبن' ---");
  const res3 = await CanonicalSearchEngine.searchEntities("جبن", { mode: SearchMode.AUTOCOMPLETE });
  assert(res3.queryIntent === "FOOD", `queryIntent is FOOD (got '${res3.queryIntent}')`);
  assert(res3.displayFoods.length > 0, `displayFoods has cheese items (${res3.displayFoods.length})`);
  assert(res3.displayDishes.length === 0, `displayDishes is EMPTY (got ${res3.displayDishes.length})`);

  // TEST 4: "زيت" -> FOOD intent
  console.log("\n--- Test 4: Query 'زيت' ---");
  const res4 = await CanonicalSearchEngine.searchEntities("زيت", { mode: SearchMode.AUTOCOMPLETE });
  assert(res4.queryIntent === "FOOD", `queryIntent is FOOD (got '${res4.queryIntent}')`);
  assert(res4.displayFoods.length > 0, `displayFoods has oil items (${res4.displayFoods.length})`);
  assert(res4.displayDishes.length === 0, `displayDishes is EMPTY (got ${res4.displayDishes.length})`);

  // TEST 5: "خبز" -> FOOD intent
  console.log("\n--- Test 5: Query 'خبز' ---");
  const res5 = await CanonicalSearchEngine.searchEntities("خبز", { mode: SearchMode.AUTOCOMPLETE });
  assert(res5.queryIntent === "FOOD", `queryIntent is FOOD (got '${res5.queryIntent}')`);
  assert(res5.displayFoods.length > 0, `displayFoods has bread items (${res5.displayFoods.length})`);
  assert(res5.displayDishes.length === 0, `displayDishes is EMPTY (got ${res5.displayDishes.length})`);

  // TEST 6: "منسف دجاج" -> DISH intent
  console.log("\n--- Test 6: Query 'منسف دجاج' ---");
  const res6 = await CanonicalSearchEngine.searchEntities("منسف دجاج", { mode: SearchMode.TEXT });
  assert(res6.queryIntent === "DISH", `queryIntent is DISH (got '${res6.queryIntent}')`);
  assert(res6.displayDishes.length > 0, `displayDishes has items (${res6.displayDishes.length})`);
  assert(res6.displayDishes[0]?.canonicalName.includes("منسف"), `displayDishes primary is 'منسف دجاج' ('${res6.displayDishes[0]?.canonicalName}')`);

  // TEST 7: "سلطة زبادي بالخيار" -> UNKNOWN/COMPOSITE intent, no false dish substitution
  console.log("\n--- Test 7: Query 'سلطة زبادي بالخيار' ---");
  const res7 = await CanonicalSearchEngine.searchEntities("سلطة زبادي بالخيار", { mode: SearchMode.TEXT });
  assert(res7.displayDishes.length === 0, `displayDishes is EMPTY (no false 'سلطة الدكوة البيضاء' substitution)`);

  // TEST 8: "أرز ودجاج" -> COMPOSITE intent
  console.log("\n--- Test 8: Query 'أرز ودجاج' ---");
  const res8 = await CanonicalSearchEngine.searchEntities("أرز ودجاج", { mode: SearchMode.TEXT });
  assert(res8.queryIntent === "COMPOSITE", `queryIntent is COMPOSITE (got '${res8.queryIntent}')`);

  // TEST 9: Backward compatibility contract of CanonicalSearchEngine.search()
  console.log("\n--- Test 9: Backward compatibility of CanonicalSearchEngine.search() ---");
  const legacyRes = await CanonicalSearchEngine.search("منسف دجاج");
  assert(legacyRes !== null, `Legacy search returned non-null result`);
  assert(legacyRes?.canonicalId === 618 || legacyRes?.canonicalId === 2, `Legacy search returned valid mansaf canonicalId (got ${legacyRes?.canonicalId})`);
  assert(legacyRes?.canonicalEntityType === "dish", `Legacy search returned entityType 'dish'`);

  console.log("\n==================================================");
  console.log(`  RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log("==================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

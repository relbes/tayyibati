import assert from "assert";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { createAnalysisResultViewModel } from "../../mobile/lib/models/AnalysisResultViewModel";

async function runPotatoFamilyFixTests() {
  console.log("==================================================");
  console.log("  TESTING POTATO FAMILY FIX & ALL REGRESSIONS     ");
  console.log("==================================================\n");

  // TEST 1: "بطاطا" must resolve to GENERIC_FOOD_FAMILY and strictly EXCLUDE "بط" (duck)
  console.log("--- TEST 1: Generic Food Family 'بطاطا' ---");
  const potatoRes = await UnifiedAnalysisEngine.analyze({ query: "بطاطا", displayQuery: "بطاطا", inputType: "text" });
  const potatoVm = createAnalysisResultViewModel(potatoRes.report);

  console.log(`Query: "بطاطا" -> resultMode: ${potatoRes.report.resultMode} | vm.presentationMode: ${potatoVm.presentationMode}`);
  assert.strictEqual(potatoVm.presentationMode, "GENERIC_FOOD_FAMILY", "Query 'بطاطا' must resolve to GENERIC_FOOD_FAMILY UI mode");

  if (potatoVm.familyData) {
    const allVariantNames = [
      ...potatoVm.familyData.allowedVariants.map(v => v.nameAr),
      ...potatoVm.familyData.forbiddenVariants.map(v => v.nameAr),
      ...potatoVm.familyData.conditionalVariants.map(v => v.nameAr),
    ];
    console.log("Potato Family Variants found:", allVariantNames);

    const hasDuck = allVariantNames.some(name => name.trim() === "بط");
    assert.strictEqual(hasDuck, false, "Generic family 'بطاطا' must NEVER contain duck 'بط'!");

    const hasSweetPotato = allVariantNames.some(name => name.includes("بطاطا حلوة"));
    assert.ok(hasSweetPotato, "Generic family 'بطاطا' should include actual potato member 'بطاطا حلوة'");
  }
  console.log("[PASS] TEST 1: 'بطاطا' family correctly includes 'بطاطا حلوة' and excludes 'بط'!\n");

  // TEST 2: Family members belong to same canonical family
  console.log("--- TEST 2: Canonical Family Membership Integrity ---");
  const familyQueries = [
    { query: "تمر", forbiddenCheck: "تفاح" },
    { query: "أرز", forbiddenCheck: "أناناس" },
    { query: "خبز", forbiddenCheck: "خيار" },
    { query: "جبن", forbiddenCheck: "جزر" },
  ];

  for (const item of familyQueries) {
    const res = await UnifiedAnalysisEngine.analyze({ query: item.query, displayQuery: item.query, inputType: "text" });
    const vm = createAnalysisResultViewModel(res.report);
    console.log(`Query: "${item.query}" -> presentationMode: ${vm.presentationMode}`);
    assert.strictEqual(vm.presentationMode, "GENERIC_FOOD_FAMILY", `Query '${item.query}' must be GENERIC_FOOD_FAMILY`);

    if (vm.familyData) {
      const names = [
        ...vm.familyData.allowedVariants.map(v => v.nameAr),
        ...vm.familyData.forbiddenVariants.map(v => v.nameAr),
        ...vm.familyData.conditionalVariants.map(v => v.nameAr),
      ];
      assert.strictEqual(names.some(n => n === item.forbiddenCheck), false, `Family '${item.query}' must not contain '${item.forbiddenCheck}'`);
    }
  }
  console.log("[PASS] TEST 2: All generic food family boundaries are verified clean!\n");

  // TEST 3: Specific Food Searches
  console.log("--- TEST 3: Specific Food Searches ---");
  const specificQueries = ["خبز فرنسي", "أرز مصري"];
  for (const q of specificQueries) {
    const res = await UnifiedAnalysisEngine.analyze({ query: q, displayQuery: q, inputType: "text" });
    const vm = createAnalysisResultViewModel(res.report);
    console.log(`Specific Query: "${q}" -> presentationMode: ${vm.presentationMode}`);
    assert.strictEqual(vm.presentationMode, "SPECIFIC_FOOD", `Query '${q}' must be SPECIFIC_FOOD`);
  }
  console.log("[PASS] TEST 3: Specific food searches preserved!\n");

  // TEST 4: Dish Searches
  console.log("--- TEST 4: Dish Searches ---");
  const dishQueries = ["منسف دجاج", "مقلوبة"];
  for (const q of dishQueries) {
    const res = await UnifiedAnalysisEngine.analyze({ query: q, displayQuery: q, inputType: "text" });
    const vm = createAnalysisResultViewModel(res.report);
    console.log(`Dish Query: "${q}" -> presentationMode: ${vm.presentationMode}`);
    assert.strictEqual(vm.presentationMode, "DISH", `Query '${q}' must be DISH`);
  }
  console.log("[PASS] TEST 4: Dish searches preserved!\n");

  // TEST 5: Invalid Noise Queries
  console.log("--- TEST 5: Invalid Noise Queries ---");
  const noiseQueries = ["زز", "ققق", "سسس", "xyz", "of.", "###", "!!!"];
  for (const q of noiseQueries) {
    const res = await UnifiedAnalysisEngine.analyze({ query: q, displayQuery: q, inputType: "text" });
    const vm = createAnalysisResultViewModel(res.report);
    console.log(`Noise Query: "${q}" -> resultMode: ${res.report.resultMode} | vm.presentationMode: ${vm.presentationMode}`);
    assert.strictEqual(res.report.resultMode, "NOT_FOUND");
    assert.strictEqual(vm.presentationMode, "NOT_FOUND");
  }
  console.log("[PASS] TEST 5: Invalid noise queries preserved!\n");

  console.log("==================================================");
  console.log("  ALL POTATO FAMILY FIX TESTS PASSED (100%)      ");
  console.log("==================================================");
}

runPotatoFamilyFixTests().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});

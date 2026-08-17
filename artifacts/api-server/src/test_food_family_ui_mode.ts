import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { createAnalysisResultViewModel } from "../../mobile/lib/models/AnalysisResultViewModel";
import assert from "assert";

async function runFoodFamilyUIModeTests() {
  console.log("==================================================");
  console.log("  TESTING FOOD FAMILY MOBILE UI PRESENTATION MODE ");
  console.log("==================================================\n");

  // TEST 1: Generic Food Category "تمر"
  console.log("--- TEST 1: Query 'تمر' ---");
  const res1 = await UnifiedAnalysisEngine.analyze({ query: "تمر", displayQuery: "تمر", inputType: "text" });
  const vm1 = createAnalysisResultViewModel(res1.report);
  console.log(`Input: "تمر" | presentationMode: ${vm1.presentationMode} | familyStatus: ${vm1.familyViewModel?.familyStatus}`);
  console.log(`  Allowed Variants: ${vm1.familyViewModel?.allowedVariants.map(v => v.nameAr).join(", ")}`);
  console.log(`  Forbidden Variants: ${vm1.familyViewModel?.forbiddenVariants.length || 0}`);
  
  assert.strictEqual(vm1.presentationMode, "GENERIC_FOOD_FAMILY", "Query 'تمر' must resolve to GENERIC_FOOD_FAMILY presentation mode");
  assert.ok(vm1.familyViewModel !== null, "Query 'تمر' familyViewModel must not be null");
  assert.strictEqual(vm1.familyViewModel?.familyName, "تمر", "Query 'تمر' familyName must be 'تمر'");
  assert.strictEqual(vm1.familyViewModel?.familyStatus, "allowed", "Query 'تمر' familyStatus must be 'allowed'");
  assert.ok((vm1.familyViewModel?.allowedVariants.length || 0) > 0, "Query 'تمر' must contain allowed variants");
  assert.strictEqual(vm1.familyViewModel?.forbiddenVariants.length || 0, 0, "Query 'تمر' forbidden list must be empty");
  console.log("[PASS] TEST 1: Generic food category 'تمر' correctly rendered as Food Family UI!\n");

  // TEST 2: Generic Food Category "خبز"
  console.log("--- TEST 2: Query 'خبز' ---");
  const res2 = await UnifiedAnalysisEngine.analyze({ query: "خبز", displayQuery: "خبز", inputType: "text" });
  const vm2 = createAnalysisResultViewModel(res2.report);
  console.log(`Input: "خبز" | presentationMode: ${vm2.presentationMode} | familyStatus: ${vm2.familyViewModel?.familyStatus}`);
  console.log(`  Allowed Variants: ${vm2.familyViewModel?.allowedVariants.map(v => v.nameAr).join(", ")}`);
  console.log(`  Forbidden Variants: ${vm2.familyViewModel?.forbiddenVariants.map(v => v.nameAr).join(", ")}`);

  assert.strictEqual(vm2.presentationMode, "GENERIC_FOOD_FAMILY", "Query 'خبز' must resolve to GENERIC_FOOD_FAMILY presentation mode");
  assert.strictEqual(vm2.familyViewModel?.familyName, "خبز", "Query 'خبز' familyName must be 'خبز'");
  assert.ok(vm2.familyViewModel?.familyStatus === "mixed" || vm2.familyViewModel?.familyStatus === "forbidden", "Query 'خبز' familyStatus must be mixed or forbidden");
  assert.ok((vm2.familyViewModel?.allowedVariants.length || 0) > 0, "Query 'خبز' must list allowed bread variants");
  console.log("[PASS] TEST 2: Generic food category 'خبز' correctly rendered as Food Family UI!\n");

  // TEST 3: Generic Food Category "أرز"
  console.log("--- TEST 3: Query 'أرز' ---");
  const res3 = await UnifiedAnalysisEngine.analyze({ query: "أرز", displayQuery: "أرز", inputType: "text" });
  const vm3 = createAnalysisResultViewModel(res3.report);
  console.log(`Input: "أرز" | presentationMode: ${vm3.presentationMode} | familyStatus: ${vm3.familyViewModel?.familyStatus}`);

  assert.strictEqual(vm3.presentationMode, "GENERIC_FOOD_FAMILY", "Query 'أرز' must resolve to GENERIC_FOOD_FAMILY presentation mode");
  assert.strictEqual(vm3.familyViewModel?.familyName, "أرز", "Query 'أرز' familyName must be 'أرز'");
  assert.strictEqual(vm3.familyViewModel?.familyStatus, "allowed", "Query 'أرز' familyStatus must be 'allowed'");
  console.log("[PASS] TEST 3: Generic food category 'أرز' correctly rendered as Food Family UI!\n");

  // TEST 4: Specific Food Variant "خبز فرنسي"
  console.log("--- TEST 4: Query 'خبز فرنسي' ---");
  const res4 = await UnifiedAnalysisEngine.analyze({ query: "خبز فرنسي", displayQuery: "خبز فرنسي", entityType: "food", canonicalId: 1345, inputType: "text" });
  const vm4 = createAnalysisResultViewModel(res4.report);
  console.log(`Input: "خبز فرنسي" | presentationMode: ${vm4.presentationMode}`);

  assert.strictEqual(vm4.presentationMode, "SPECIFIC_FOOD", "Specific query 'خبز فرنسي' must resolve to SPECIFIC_FOOD presentation mode");
  console.log("[PASS] TEST 4: Specific food variant 'خبز فرنسي' correctly rendered as SPECIFIC_FOOD UI!\n");

  // TEST 5: Specific Food Variant "أرز مصري"
  console.log("--- TEST 5: Query 'أرز مصري' ---");
  const res5 = await UnifiedAnalysisEngine.analyze({ query: "أرز مصري", displayQuery: "أرز مصري", inputType: "text" });
  const vm5 = createAnalysisResultViewModel(res5.report);
  console.log(`Input: "أرز مصري" | presentationMode: ${vm5.presentationMode}`);

  assert.strictEqual(vm5.presentationMode, "SPECIFIC_FOOD", "Specific query 'أرز مصري' must resolve to SPECIFIC_FOOD presentation mode");
  console.log("[PASS] TEST 5: Specific food variant 'أرز مصري' correctly rendered as SPECIFIC_FOOD UI!\n");

  // TEST 6: Dish Search "منسف دجاج"
  console.log("--- TEST 6: Query 'منسف دجاج' ---");
  const res6 = await UnifiedAnalysisEngine.analyze({ query: "منسف دجاج", displayQuery: "منسف دجاج", inputType: "text" });
  const vm6 = createAnalysisResultViewModel(res6.report);
  console.log(`Input: "منسف دجاج" | presentationMode: ${vm6.presentationMode}`);

  assert.strictEqual(vm6.presentationMode, "DISH", "Dish query 'منسف دجاج' must resolve to DISH presentation mode");
  console.log("[PASS] TEST 6: Dish query 'منسف دجاج' correctly rendered as DISH UI!\n");

  // TEST 7: Invalid Query "of."
  console.log("--- TEST 7: Query 'of.' ---");
  const res7 = await UnifiedAnalysisEngine.analyze({ query: "of.", displayQuery: "of.", inputType: "text" });
  const vm7 = createAnalysisResultViewModel(res7.report);
  console.log(`Input: "of." | presentationMode: ${vm7.presentationMode}`);

  assert.strictEqual(vm7.presentationMode, "NOT_FOUND", "Invalid query 'of.' must resolve to NOT_FOUND presentation mode");
  console.log("[PASS] TEST 7: Invalid query 'of.' correctly rendered as NOT_FOUND UI!\n");

  // TEST 8: Invalid Query "xyz"
  console.log("--- TEST 8: Query 'xyz' ---");
  const res8 = await UnifiedAnalysisEngine.analyze({ query: "xyz", displayQuery: "xyz", inputType: "text" });
  const vm8 = createAnalysisResultViewModel(res8.report);
  console.log(`Input: "xyz" | presentationMode: ${vm8.presentationMode}`);

  assert.strictEqual(vm8.presentationMode, "NOT_FOUND", "Invalid query 'xyz' must resolve to NOT_FOUND presentation mode");
  console.log("[PASS] TEST 8: Invalid query 'xyz' correctly rendered as NOT_FOUND UI!\n");

  console.log("==================================================");
  console.log("  ALL FOOD FAMILY UI MODE TESTS PASSED (100%)    ");
  console.log("==================================================");
}

runFoodFamilyUIModeTests().catch((err) => {
  console.error("FOOD FAMILY UI MODE TEST FAILED:", err);
  process.exit(1);
});

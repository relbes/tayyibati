import assert from "assert";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { createAnalysisResultViewModel } from "../../mobile/lib/models/AnalysisResultViewModel";
import { getKnowledgeCache } from "./lib/knowledgeCache";
import { getArabicCategoryName } from "./routes/foods";

async function runNoiseAndArabicCategoriesTests() {
  console.log("==================================================");
  console.log("  TESTING INVALID NOISE GATE & ARABIC CATEGORIES ");
  console.log("==================================================\n");

  // PART 1: Invalid Noise Queries Rejection Gate
  console.log("--- PART 1: Arbitrary Invalid Noise Queries Rejection ---");
  const invalidQueries = ["زز", "ققق", "سسس", "xyz", "of.", "###", "!!!", "   "];

  for (const q of invalidQueries) {
    const res = await UnifiedAnalysisEngine.analyze({ query: q, displayQuery: q, inputType: "text" });
    const vm = createAnalysisResultViewModel(res.report);

    console.log(`Query: "${q}" -> resultMode: ${res.report.resultMode} | notFound: ${res.report.notFound} | vm.presentationMode: ${vm.presentationMode}`);

    assert.strictEqual(res.report.resultMode, "NOT_FOUND", `Query '${q}' must produce resultMode 'NOT_FOUND'`);
    assert.strictEqual(res.report.notFound, true, `Query '${q}' must produce notFound: true`);
    assert.strictEqual((res.report.allowed || []).length, 0, `Query '${q}' must have empty allowed foods`);
    assert.strictEqual((res.report.forbidden || []).length, 0, `Query '${q}' must have empty forbidden foods`);
    assert.strictEqual((res.report.conditional || []).length, 0, `Query '${q}' must have empty conditional foods`);
    assert.strictEqual((res.report.unknown || []).length, 0, `Query '${q}' must have empty unknown foods`);
    assert.strictEqual(res.report.explanation, "لم نفهم ما تبحث عنه. يرجى كتابة اسم طعام أو طبق للحصول على النتيجة.");
    assert.strictEqual(vm.presentationMode, "NOT_FOUND", `Query '${q}' ViewModel must be NOT_FOUND presentationMode`);
  }
  console.log("[PASS] Part 1: All arbitrary noise queries correctly rejected before AI/Analysis!\n");

  // PART 2: Valid Food & Dish Searches Regression Protection
  console.log("--- PART 2: Valid Food & Dish Search Regressions ---");
  
  // Generic Food Families
  const genericQueries = ["تمر", "خبز", "أرز", "رز"];
  for (const q of genericQueries) {
    const res = await UnifiedAnalysisEngine.analyze({ query: q, displayQuery: q, inputType: "text" });
    const vm = createAnalysisResultViewModel(res.report);
    console.log(`Generic Query: "${q}" -> resultMode: ${res.report.resultMode} | vm.presentationMode: ${vm.presentationMode}`);
    assert.strictEqual(vm.presentationMode, "GENERIC_FOOD_FAMILY", `Query '${q}' must resolve to GENERIC_FOOD_FAMILY presentationMode`);
    assert.ok(!res.report.notFound, `Valid query '${q}' must NOT be marked as notFound`);
  }

  // Specific Food Variants
  const specificQueries = ["خبز فرنسي", "أرز مصري"];
  for (const q of specificQueries) {
    const res = await UnifiedAnalysisEngine.analyze({ query: q, displayQuery: q, inputType: "text" });
    const vm = createAnalysisResultViewModel(res.report);
    console.log(`Specific Query: "${q}" -> resultMode: ${res.report.resultMode} | vm.presentationMode: ${vm.presentationMode}`);
    assert.strictEqual(vm.presentationMode, "SPECIFIC_FOOD", `Specific query '${q}' must resolve to SPECIFIC_FOOD presentationMode`);
    assert.ok(!res.report.notFound, `Specific query '${q}' must NOT be marked as notFound`);
  }

  // Dishes
  const dishQueries = ["منسف دجاج", "مقلوبة"];
  for (const q of dishQueries) {
    const res = await UnifiedAnalysisEngine.analyze({ query: q, displayQuery: q, inputType: "text" });
    const vm = createAnalysisResultViewModel(res.report);
    console.log(`Dish Query: "${q}" -> resultMode: ${res.report.resultMode} | vm.presentationMode: ${vm.presentationMode}`);
    assert.strictEqual(vm.presentationMode, "DISH", `Dish query '${q}' must resolve to DISH presentationMode`);
  }
  console.log("[PASS] Part 2: All valid food & dish searches preserved 100%!\n");

  // PART 3: Arabic Catalog Categories Validation
  console.log("--- PART 3: Arabic Catalog Categories Validation ---");
  const cache = await getKnowledgeCache();
  const allFoods = cache.foods || [];

  for (const f of allFoods) {
    const categoryAr = getArabicCategoryName(f.category);
    assert.ok(typeof categoryAr === "string" && categoryAr.length > 0, `Food #${f.id} must have non-empty categoryAr`);
    assert.ok(/[\u0600-\u06FF]/.test(categoryAr), `Category '${categoryAr}' for food #${f.id} must contain Arabic characters`);
  }

  const sampleCategoriesAr = Array.from(new Set(allFoods.map(f => getArabicCategoryName(f.category))));
  console.log(`Derived Arabic Categories Count: ${sampleCategoriesAr.length}`);
  console.log("Sample Arabic Categories:", sampleCategoriesAr.slice(0, 10).join(", "));
  
  console.log("[PASS] Part 3: All catalog categories properly translated/formatted in Arabic!\n");

  console.log("==================================================");
  console.log("  ALL NOISE GATE & ARABIC CATEGORY TESTS PASSED  ");
  console.log("==================================================");
}

runNoiseAndArabicCategoriesTests().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});

import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { warmDishEngineCache, analyzeDishCompatibility } from "./lib/dishCompatibilityEngine";
import { getKnowledgeCache } from "./lib/knowledgeCache";
import { MultiItemEngine } from "./lib/multiItemEngine";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${msg}`);
    failCount++;
  }
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("  TAYYIBATI BIRYANI VARIANT & MULTI-ITEM REGRESSION SUITE");
  console.log("================================================================================\n");

  console.log("Initializing caches...");
  await warmDishEngineCache();
  await getKnowledgeCache();
  console.log("Caches initialized successfully.\n");

  // ============================================================================
  // SECTION 1: Biryani بالخضار Variant Resolution & Ingredient Isolation
  // ============================================================================
  console.log("--- SECTION 1: Biryani Variant Resolution & Ingredient Isolation ---");

  // 1.1 Generic "برياني بالخضار" triggers DISH_VARIANT clarification with exact options
  const r1 = await UnifiedAnalysisEngine.analyze({
    query: "برياني بالخضار",
    inputType: "text",
    userId: "test_user",
  });
  assert(
    Boolean(r1.report.needsClarification),
    "1.1 'برياني بالخضار' triggers needsClarification=true"
  );
  assert(
    r1.report.clarificationType === "DISH_VARIANT",
    `1.1 'برياني بالخضار' clarificationType is DISH_VARIANT (got: ${r1.report.clarificationType})`
  );
  const sug1 = r1.report.suggestions || [];
  assert(
    sug1.length === 2 &&
      sug1[0] === "برياني بالخضار واللحم" &&
      sug1[1] === "برياني بالخضار والدجاج",
    `1.1 Clarification suggestions are Meat first, Poultry second, NO vegetarian variant: ${JSON.stringify(sug1)}`
  );

  // 1.2 Generic with Al- "البرياني بالخضار"
  const r1_2 = await UnifiedAnalysisEngine.analyze({
    query: "البرياني بالخضار",
    inputType: "text",
    userId: "test_user",
  });
  assert(
    Boolean(r1_2.report.needsClarification) &&
      r1_2.report.suggestions?.[0] === "برياني بالخضار واللحم" &&
      r1_2.report.suggestions?.[1] === "برياني بالخضار والدجاج",
    "1.2 'البرياني بالخضار' (with Al-) also triggers exact variant clarification"
  );

  // 1.3 Generic "برياني"
  const r1_3 = await UnifiedAnalysisEngine.analyze({
    query: "برياني",
    inputType: "text",
    userId: "test_user",
  });
  assert(
    Boolean(r1_3.report.needsClarification) &&
      !r1_3.report.suggestions?.some((s: string) => s.includes("نباتي")),
    "1.3 Generic 'برياني' has no unverified vegetarian option fabricated"
  );

  // 1.4 Meat Variant "برياني بالخضار واللحم"
  const rMeat = await UnifiedAnalysisEngine.analyze({
    query: "برياني بالخضار واللحم",
    inputType: "text",
    userId: "test_user",
  });
  const meatReport = rMeat.report;
  assert(
    !meatReport.needsClarification,
    "1.4 'برياني بالخضار واللحم' resolves directly without clarification"
  );
  const meatAllowed = meatReport.allowed?.map((i) => i.nameAr) || [];
  const meatForbidden = meatReport.forbidden?.map((i) => i.nameAr) || [];
  const meatConditional = meatReport.conditional?.map((i) => i.nameAr) || [];
  const allMeatIngredients = [...meatAllowed, ...meatForbidden, ...meatConditional];

  const hasMeatInAllowed = meatAllowed.some((n) => n.includes("لحم"));
  const hasChickenInMeat = allMeatIngredients.some((n) => n.includes("دجاج"));
  assert(
    hasMeatInAllowed,
    `1.4 Meat variant includes meat in allowed ingredients: ${meatAllowed.join(", ")}`
  );
  assert(
    !hasChickenInMeat,
    `1.4 Meat variant completely excludes chicken: ${allMeatIngredients.join(", ")}`
  );

  // 1.5 Chicken Variant "برياني بالخضار والدجاج"
  const rChicken = await UnifiedAnalysisEngine.analyze({
    query: "برياني بالخضار والدجاج",
    inputType: "text",
    userId: "test_user",
  });
  const chickenReport = rChicken.report;
  assert(
    !chickenReport.needsClarification,
    "1.5 'برياني بالخضار والدجاج' resolves directly without clarification"
  );
  const chickenAllowed = chickenReport.allowed?.map((i) => i.nameAr) || [];
  const chickenForbidden = chickenReport.forbidden?.map((i) => i.nameAr) || [];
  const chickenConditional = chickenReport.conditional?.map((i) => i.nameAr) || [];
  const allChickenIngredients = [...chickenAllowed, ...chickenForbidden, ...chickenConditional];

  const hasChickenInForbidden = chickenForbidden.some((n) => n.includes("دجاج"));
  const hasMeatInChicken = allChickenIngredients.some((n) => n.includes("لحم"));
  assert(
    hasChickenInForbidden,
    `1.5 Chicken variant includes chicken in forbidden ingredients: ${chickenForbidden.join(", ")}`
  );
  assert(
    !hasMeatInChicken,
    `1.5 Chicken variant completely excludes meat: ${allChickenIngredients.join(", ")}`
  );

  // 1.6 Recipe verification flag on Dish 1009
  const dish1009 = await analyzeDishCompatibility(1009, undefined, "برياني بالخضار");
  assert(
    dish1009.dish?.id === 1009,
    "1.6 Dish 1009 exists in database"
  );
  const eggIng = dish1009.ingredientAnalysis.find(
    (i) => (i.rawIngredientName && i.rawIngredientName.includes("بيض")) || (i.canonicalFoodAr && i.canonicalFoodAr.includes("بيض"))
  );
  assert(
    eggIng?.requirementType === "optional",
    `1.6 Optional boiled egg has requirementType='optional' (got: ${eggIng?.requirementType})`
  );

  // ============================================================================
  // SECTION 2: Multi-Item Decomposition & Independent Food Evaluation
  // ============================================================================
  console.log("\n--- SECTION 2: Multi-Item Decomposition & Independent Food Evaluation ---");

  // 2.1 Multi-item fruit list: "بطيخ وشمام وتفاح وبرتقال"
  const rMultiFruits = await UnifiedAnalysisEngine.analyze({
    query: "بطيخ وشمام وتفاح وبرتقال",
    inputType: "text",
    userId: "test_user",
  });
  assert(
    rMultiFruits.report.resultMode === "MULTI_ITEM",
    `2.1 'بطيخ وشمام وتفاح وبرتقال' has resultMode=MULTI_ITEM (got: ${rMultiFruits.report.resultMode})`
  );
  const fruitItems = rMultiFruits.report.multiItemResults || [];
  assert(
    fruitItems.length === 4,
    `2.1 Decomposed into 4 items (got: ${fruitItems.length})`
  );
  const apple = fruitItems.find((f) => f.nameAr.includes("تفاح"));
  const watermelon = fruitItems.find((f) => f.nameAr.includes("بطيخ"));
  const melon = fruitItems.find((f) => f.nameAr.includes("شمام"));
  const orange = fruitItems.find((f) => f.nameAr.includes("برتقال"));

  assert(
    apple?.status === "allowed" &&
      watermelon?.status === "forbidden" &&
      melon?.status === "forbidden" &&
      orange?.status === "forbidden",
    `2.1 All 4 fruits independently evaluated to authentic Tayyibati DB rulings: ${fruitItems.map((f) => `${f.nameAr}: ${f.status}`).join(", ")}`
  );

  // 2.2 Multi-item mixed foods and categories: "الدجاج والبيض والورقيات والبقوليات"
  const rMultiMixed = await UnifiedAnalysisEngine.analyze({
    query: "الدجاج والبيض والورقيات والبقوليات",
    inputType: "text",
    userId: "test_user",
    isPremium: true,
  });
  assert(
    rMultiMixed.report.resultMode === "MULTI_ITEM",
    `2.2 'الدجاج والبيض والورقيات والبقوليات' has resultMode=MULTI_ITEM (got: ${rMultiMixed.report.resultMode})`
  );
  const mixedItems = rMultiMixed.report.multiItemResults || [];
  assert(
    mixedItems.length === 4,
    `2.2 Decomposed into 4 items (got: ${mixedItems.length})`
  );

  const chickenItem = mixedItems.find((m) => m.nameAr.includes("دجاج"));
  assert(
    chickenItem?.status === "forbidden" && chickenItem?.sourceType === "حيواني",
    `2.2 Chicken item is forbidden animal food (got: status=${chickenItem?.status}, source=${chickenItem?.sourceType})`
  );

  const eggItem = mixedItems.find((m) => m.nameAr.includes("بيض"));
  assert(
    eggItem?.status === "forbidden" && eggItem?.sourceType === "حيواني",
    `2.2 Egg item is forbidden animal food (got: status=${eggItem?.status}, source=${eggItem?.sourceType})`
  );

  const vegCategoryItem = mixedItems.find((m) => m.nameAr.includes("خضروات"));
  assert(
    vegCategoryItem?.itemType === "category" &&
      (vegCategoryItem?.categoryStats?.total || 0) > 0,
    `2.2 'الورقيات' recognized as category 'خضروات' with stats (total: ${vegCategoryItem?.categoryStats?.total})`
  );

  const legCategoryItem = mixedItems.find((m) => m.nameAr.includes("بقوليات"));
  assert(
    legCategoryItem?.itemType === "category" &&
      legCategoryItem?.categoryStats?.exceptions?.some((e) => e.includes("العدس الأصفر")),
    `2.2 'البقوليات' recognized as category with Yellow Lentil Soup conditional exception noted: ${legCategoryItem?.categoryStats?.exceptions?.join(", ")}`
  );

  // 2.3 Free User vs Premium User limits in multi-item categories
  const rFreeMulti = await UnifiedAnalysisEngine.analyze({
    query: "التفاح والورقيات",
    inputType: "text",
    userId: "free_user",
    isPremium: false,
  });
  const freeVeg = rFreeMulti.report.multiItemResults?.find((m) => m.nameAr.includes("خضروات"));
  assert(
    freeVeg?.categoryStats?.hasMore === true &&
      (freeVeg?.sampleItems?.forbidden?.length || 0) <= 10,
    `2.3 Free user category in multi-item query is capped at 10 items (got sample count: ${freeVeg?.sampleItems?.forbidden?.length}, hasMore: ${freeVeg?.categoryStats?.hasMore})`
  );

  // 2.4 Protection: Composite dish "برياني بالخضار" must NOT be split
  const multiBiryani = await MultiItemEngine.decomposeAndEvaluate("برياني بالخضار", false);
  assert(
    !multiBiryani.isMultiItem,
    "2.4 Composite dish 'برياني بالخضار' is protected and NOT split into multi-item list"
  );

  // 2.5 Protection: Policy queries must NOT be decomposed
  const rListAllowed = await UnifiedAnalysisEngine.analyze({
    query: "طعام مسموح",
    inputType: "text",
    userId: "test_user",
  });
  assert(
    rListAllowed.report.resultMode === "LIST_ALLOWED",
    `2.5 'طعام مسموح' retains LIST_ALLOWED without being split (got: ${rListAllowed.report.resultMode})`
  );

  const rListRestricted = await UnifiedAnalysisEngine.analyze({
    query: "ما هي الأطعمة الممنوعة؟",
    inputType: "text",
    userId: "test_user",
  });
  assert(
    rListRestricted.report.resultMode === "LIST_RESTRICTED",
    `2.5 'ما هي الأطعمة الممنوعة؟' retains LIST_RESTRICTED without being split (got: ${rListRestricted.report.resultMode})`
  );

  console.log("\n================================================================================");
  console.log(`  RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("================================================================================");

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});

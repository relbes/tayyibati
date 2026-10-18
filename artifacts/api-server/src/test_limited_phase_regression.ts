import assert from "assert";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { IntentClassificationEngine } from "./lib/intentClassificationEngine";
import { warmDishEngineCache, getDishEngineCache } from "./lib/dishCompatibilityEngine";
import { getKnowledgeCache } from "./lib/knowledgeCache";

async function runLimitedPhaseRegressionSuite() {
  console.log("================================================================================");
  console.log("  TAYYIBATI LIMITED PHASE REGRESSION TEST SUITE                                 ");
  console.log("================================================================================\n");

  console.log("Initializing caches...");
  await warmDishEngineCache();
  await getKnowledgeCache();
  console.log("Caches initialized successfully.\n");

  let passedTests = 0;
  let totalTests = 0;

  function recordPass(testName: string, detail?: string) {
    passedTests++;
    console.log(`[PASS] ${testName}${detail ? ` -> ${detail}` : ""}`);
  }

  // ============================================================================
  // GROUP 1: UNSUPPORTED CALORIE & DIET QUESTIONS GATE
  // ============================================================================
  console.log("\n--- GROUP 1: Unsupported Calorie & Diet Calculation Queries ---");

  const unsupportedQueries = [
    "عملت كاسة جوز الهند وكاسة لبن مع بيضة وملعقة فانيلا وملعقة بيكنج باودر كم سعراتها",
    "كم سعرة حرارية في التفاح؟",
    "احسب السعرات",
    "سعرات الشاورما",
    "جدول دايت",
    "نظام غذائي للتخسيس",
    "كم كالوري في البيض",
    "احسب الكالوري في الوجبة",
    "خطة وجبات للتنحيف",
    "كيف اخس بسرعة",
  ];

  for (const q of unsupportedQueries) {
    totalTests++;
    const intentRes = IntentClassificationEngine.detectQueryIntent(q);
    assert.strictEqual(intentRes.intent, "UNSUPPORTED_QUESTION", `Query '${q}' must be classified as UNSUPPORTED_QUESTION`);

    const res = await UnifiedAnalysisEngine.analyze({ query: q, inputType: "text" });
    const r = res.report;

    assert.strictEqual(r.resultMode, "UNSUPPORTED_QUESTION", `Query '${q}' resultMode must be UNSUPPORTED_QUESTION`);
    assert.strictEqual(r.queryIntent, "UNSUPPORTED_QUESTION", `Query '${q}' queryIntent must be UNSUPPORTED_QUESTION`);
    assert.strictEqual(r.notFound, true, `Query '${q}' notFound must be true`);
    assert.strictEqual(r.allowed.length, 0, `Query '${q}' must not return allowed rulings`);
    assert.strictEqual(r.forbidden.length, 0, `Query '${q}' must not return forbidden rulings`);
    assert.strictEqual(r.compatibilityScore, null, `Query '${q}' compatibilityScore must be null`);
    assert.ok(r.explanation && r.explanation.includes("السعرات الحرارية"), `Query '${q}' must explain that calories are unsupported`);
    assert.ok(r.suggestions && r.suggestions.length > 0, `Query '${q}' must provide supported suggestions`);

    recordPass(`GROUP 1: Unsupported Query '${q.slice(0, 30)}...'`, `resultMode=UNSUPPORTED_QUESTION, no rulings leaked`);
  }

  // ============================================================================
  // GROUP 2: LEGITIMATE ALLOWANCE QUERIES CONTAINING FOOD/DIET KEYWORDS
  // ============================================================================
  console.log("\n--- GROUP 2: Legitimate Food Allowance Queries (Must NOT be blocked) ---");

  {
    totalTests++;
    const q = "هل البيض مسموح في الدايت؟";
    const intentRes = IntentClassificationEngine.detectQueryIntent(q);
    assert.strictEqual(intentRes.intent, "IS_FOOD_ALLOWED", `Query '${q}' must be IS_FOOD_ALLOWED, NOT UNSUPPORTED_QUESTION`);
    assert.ok(intentRes.targetFoodQuery?.includes("البيض") || intentRes.targetFoodQuery?.includes("بيض"), "targetFoodQuery should extract egg");

    const res = await UnifiedAnalysisEngine.analyze({ query: q, inputType: "text" });
    const r = res.report;
    assert.strictEqual(r.primaryRuling?.status, "forbidden", `Egg must be evaluated to its Tayyibati DB status (forbidden)`);
    assert.ok(r.forbidden.some((f) => f.nameAr === "البيض بجميع أنواعه" || f.nameAr.includes("بيض")), "Egg must be in forbidden list");
    recordPass(`GROUP 2: '${q}'`, `Correctly evaluated as IS_FOOD_ALLOWED -> Egg FORBIDDEN per Tayyibati policy`);
  }

  {
    totalTests++;
    const q = "هل التمر مسموح؟";
    const res = await UnifiedAnalysisEngine.analyze({ query: q, inputType: "text" });
    const r = res.report;
    assert.strictEqual(r.primaryRuling?.status, "allowed", `Date fruit query must be evaluated to allowed`);
    recordPass(`GROUP 2: '${q}'`, `Correctly evaluated as IS_FOOD_ALLOWED -> Date ALLOWED`);
  }

  {
    totalTests++;
    const q = "بيض";
    const res = await UnifiedAnalysisEngine.analyze({ query: q, inputType: "text" });
    const r = res.report;
    assert.strictEqual(r.resultMode, "EXACT_FOOD");
    assert.strictEqual(r.primaryRuling?.status, "forbidden");
    recordPass(`GROUP 2: '${q}'`, `Exact food lookup preserved directly (forbidden)`);
  }

  {
    totalTests++;
    const q = "تمر";
    const res = await UnifiedAnalysisEngine.analyze({ query: q, inputType: "text" });
    const r = res.report;
    assert.strictEqual(r.resultMode, "EXACT_FOOD");
    assert.strictEqual(r.primaryRuling?.status, "allowed");
    recordPass(`GROUP 2: '${q}'`, `Exact food lookup preserved directly (allowed)`);
  }

  {
    totalTests++;
    const q = "لبن";
    const res = await UnifiedAnalysisEngine.analyze({ query: q, inputType: "text" });
    const r = res.report;
    assert.strictEqual(r.resultMode, "EXACT_FOOD");
    assert.strictEqual(r.primaryRuling?.status, "forbidden");
    recordPass(`GROUP 2: '${q}'`, `Exact food lookup preserved directly (forbidden)`);
  }

  // ============================================================================
  // GROUP 3: CATEGORY SEARCH & BLANKET PROHIBITION RULES
  // ============================================================================
  console.log("\n--- GROUP 3: Category Searches & Blanket Prohibition Rules ---");

  const categoryTests = [
    { query: "خضروات", key: "خضروات" },
    { query: "فواكه", key: "فواكه" },
    { query: "حبوب", key: "حبوب" },
    { query: "بقوليات", key: "بقوليات" },
    { query: "لحوم", key: "لحوم" },
  ];

  for (const t of categoryTests) {
    totalTests++;
    const intentRes = IntentClassificationEngine.detectQueryIntent(t.query);
    assert.strictEqual(intentRes.intent, "CATEGORY_SEARCH", `Query '${t.query}' must be CATEGORY_SEARCH`);
    assert.strictEqual(intentRes.targetCategory, t.key, `Query '${t.query}' targetCategory must match '${t.key}'`);

    const res = await UnifiedAnalysisEngine.analyze({ query: t.query, inputType: "text", isPremium: true });
    const r = res.report;

    assert.strictEqual(r.resultMode, "CATEGORY_REPORT", `Query '${t.query}' resultMode must be CATEGORY_REPORT`);
    assert.strictEqual(r.queryIntent, "CATEGORY_SEARCH", `Query '${t.query}' queryIntent must be CATEGORY_SEARCH`);
    assert.ok(r.categoryStats, `categoryStats must be defined`);
    assert.ok(r.categoryStats.total > 0, `Total items in category '${t.key}' must be > 0`);

    if (t.key === "بقوليات") {
      // CRITICAL RULE: Blanket prohibition must NOT be declared unconditionally for legumes!
      assert.strictEqual(r.categoryStats.isFullyForbidden, false, "Legumes category must NOT be declared fully forbidden without exception");
      assert.ok(r.categoryStats.exceptions.some((e) => e.includes("شوربة العدس الأصفر") || e.includes("العدس الأصفر")), "Legumes must note yellow lentil soup exception");
      assert.ok(r.explanation.includes("شوربة العدس الأصفر"), "Explanation must explicitly mention yellow lentil soup exception");
    }

    recordPass(`GROUP 3: Category '${t.query}'`, `Total: ${r.categoryStats.total}, Allowed: ${r.categoryStats.allowedCount}, Forbidden: ${r.categoryStats.forbiddenCount}, Conditional: ${r.categoryStats.conditionalCount}`);
  }

  // ============================================================================
  // GROUP 4: FREE VS PREMIUM ACCESS LIMITS IN CATEGORY SEARCH
  // ============================================================================
  console.log("\n--- GROUP 4: Free vs Premium Access Limits in Category Search ---");

  {
    totalTests++;
    // Free user querying vegetables
    const resFree = await UnifiedAnalysisEngine.analyze({
      query: "خضروات",
      inputType: "text",
      isPremium: false,
    });
    const rFree = resFree.report;

    assert.strictEqual(rFree.categoryStats?.isPremium, false, "isPremium must be false");
    assert.ok(rFree.allowed.length <= 10, "Free user must be capped at 10 allowed items");
    assert.strictEqual(rFree.forbidden.length, 10, "Free user forbidden items must be capped at 10");
    assert.strictEqual(rFree.categoryStats?.hasMore, true, "hasMore must be true when forbidden exceeds 10");
    assert.strictEqual(rFree.categoryStats?.total, 47, "Total database count must reflect all 47 items");

    recordPass("GROUP 4: Free User Category Search", `Capped to max 10 per status (forbidden capped from 37 to ${rFree.forbidden.length}), hasMore=true, totalDB=${rFree.categoryStats?.total}`);
  }

  {
    totalTests++;
    // Premium user querying vegetables
    const resPrem = await UnifiedAnalysisEngine.analyze({
      query: "خضروات",
      inputType: "text",
      isPremium: true,
    });
    const rPrem = resPrem.report;

    assert.strictEqual(rPrem.categoryStats?.isPremium, true, "isPremium must be true");
    assert.strictEqual(rPrem.forbidden.length, 37, "Premium user must receive all 37 forbidden vegetables");
    assert.strictEqual(rPrem.allowed.length, 8, "Premium user receives all 8 allowed vegetables");
    assert.strictEqual(rPrem.conditional.length, 2, "Premium user receives all 2 conditional vegetables");
    assert.strictEqual(rPrem.categoryStats?.hasMore, false, "hasMore must be false for premium user");
    assert.strictEqual(rPrem.allowed.length + rPrem.forbidden.length + rPrem.conditional.length, rPrem.categoryStats?.total, "All 47 items returned for premium user");

    recordPass("GROUP 4: Premium User Category Search", `Full catalog returned (total=${rPrem.categoryStats?.total}, forbidden=${rPrem.forbidden.length}), hasMore=false`);
  }

  // ============================================================================
  // GROUP 5: COMPOSITE DISH VARIANT CLARIFICATION & UNVERIFIED RECIPE CHECK
  // ============================================================================
  console.log("\n--- GROUP 5: Composite Dish Variants & Recipe Verification ---");

  {
    totalTests++;
    // Generic "برياني"
    const res = await UnifiedAnalysisEngine.analyze({ query: "برياني", inputType: "text" });
    const r = res.report;

    assert.strictEqual(r.needsClarification, true, "'برياني' must require clarification");
    assert.strictEqual(r.clarificationType, "DISH_VARIANT", "'برياني' clarificationType must be DISH_VARIANT");
    assert.ok(r.questionAr?.includes("برياني"), "questionAr must ask for biryani type");

    const labels = (r.suggestions || []).map((s: any) => typeof s === "string" ? s : s.label || s.query || "");
    const meatIndex = labels.findIndex((l) => l.includes("لحم"));
    const chickenIndex = labels.findIndex((l) => l.includes("دجاج"));

    assert.ok(meatIndex >= 0, "Biryani meat variant must be suggested");
    assert.ok(chickenIndex >= 0, "Biryani chicken variant must be suggested");
    assert.ok(meatIndex < chickenIndex, "Biryani meat variant must appear BEFORE chicken");

    recordPass("GROUP 5: 'برياني' Dish Variant Clarification", `needsClarification=true, order=[${labels.slice(0, 3).join(", ")}]`);
  }

  {
    totalTests++;
    // Generic "شاورما"
    const res = await UnifiedAnalysisEngine.analyze({ query: "شاورما", inputType: "text" });
    const r = res.report;

    assert.strictEqual(r.needsClarification, true, "'شاورما' must require clarification");
    assert.strictEqual(r.clarificationType, "DISH_VARIANT", "'شاورما' clarificationType must be DISH_VARIANT");

    const labels = (r.suggestions || []).map((s: any) => typeof s === "string" ? s : s.label || s.query || "");
    const beefIndex = labels.indexOf("شاورما لحم بقر");
    const lambIndex = labels.indexOf("شاورما لحم غنم");
    const chickenIndex = labels.indexOf("شاورما دجاج");

    assert.ok(beefIndex >= 0 && lambIndex >= 0 && chickenIndex >= 0);
    assert.ok(beefIndex < chickenIndex && lambIndex < chickenIndex, "Meat variants must appear before chicken");

    recordPass("GROUP 5: 'شاورما' Dish Variant Clarification", `needsClarification=true, order=[${labels.slice(0, 3).join(", ")}]`);
  }

  {
    totalTests++;
    // Dish 1009: "البرياني بالخضار" (conflicting recipe containing chicken/meat)
    const res = await UnifiedAnalysisEngine.analyze({ dishId: 1009, inputType: "text" });
    const r = res.report;

    assert.strictEqual(r.needsRecipeVerification, true, "Dish 1009 must flag needsRecipeVerification=true");
    assert.strictEqual(r.recipeVerificationStatus, "NEEDS_RECIPE_VERIFICATION", "Dish 1009 must have NEEDS_RECIPE_VERIFICATION status");
    assert.ok(r.recipeWarning && r.recipeWarning.includes("متضاربة"), "recipeWarning must explain conflicting ingredients");
    assert.ok(r.explanation.includes("متضاربة") || r.explanation.includes("NEEDS_RECIPE_VERIFICATION"), "explanation must include recipe verification notice");
    // Ensure existing database recipe ingredients were NOT wiped or fabricated!
    assert.ok(r.allowed.length > 0 || r.forbidden.length > 0, "Database ingredients must be preserved as-is");

    recordPass("GROUP 5: Dish 1009 'البرياني بالخضار' Recipe Verification", `needsRecipeVerification=true, recipe preserved without fabrication`);
  }

  // ============================================================================
  // GROUP 6: REGRESSION PROTECTION (Existing Core Behaviors Unbroken)
  // ============================================================================
  console.log("\n--- GROUP 6: Regression Protection for Existing Query Types ---");

  {
    totalTests++;
    const res = await UnifiedAnalysisEngine.analyze({ query: "لحم", inputType: "text" });
    const r = res.report;
    assert.strictEqual(r.primaryRuling?.status, "allowed");
    assert.strictEqual(r.primaryRuling?.sourceType, "حيواني");
    recordPass("GROUP 6: 'لحم' Generic Meat", "Preserved as allowed animal source without clarification");
  }

  {
    totalTests++;
    const res = await UnifiedAnalysisEngine.analyze({ query: "شاورما لحم", inputType: "text" });
    const r = res.report;
    assert.strictEqual(r.needsClarification, undefined);
    assert.ok(r.allowed.some((a) => a.nameAr === "لحم"), "Ingredient 'لحم' remains allowed");
    recordPass("GROUP 6: 'شاورما لحم'", "Ingredient 'لحم' correctly preserved as allowed");
  }

  {
    totalTests++;
    const res = await UnifiedAnalysisEngine.analyze({ query: "شاورما دجاج", inputType: "text" });
    const r = res.report;
    assert.strictEqual(r.needsClarification, undefined);
    assert.strictEqual(r.resultMode, "COMPOSITE_FOOD");
    recordPass("GROUP 6: 'شاورما دجاج'", "Composite food resolution preserved directly");
  }

  {
    totalTests++;
    const res = await UnifiedAnalysisEngine.analyze({ query: "دجاج", inputType: "text" });
    const r = res.report;
    assert.strictEqual(r.primaryRuling?.status, "forbidden");
    recordPass("GROUP 6: 'دجاج'", "Pure protein resolution preserved directly");
  }

  {
    totalTests++;
    const res = await UnifiedAnalysisEngine.analyze({ query: "بلح", inputType: "text" });
    const r = res.report;
    assert.strictEqual(r.notFound, false);
    assert.strictEqual(r.primaryRuling?.status, "allowed");
    recordPass("GROUP 6: 'بلح'", "Exact food resolution preserved cleanly as Date fruit");
  }

  {
    totalTests++;
    const res = await UnifiedAnalysisEngine.analyze({ query: "اكلات مسموح بيها", inputType: "text" });
    const r = res.report;
    assert.strictEqual(r.resultMode, "LIST_ALLOWED");
    assert.strictEqual(r.action?.type, "NAVIGATE_BROWSE");
    recordPass("GROUP 6: 'اكلات مسموح بيها'", "Catalog intent preserved with NAVIGATE_BROWSE");
  }

  console.log("\n================================================================================");
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY (100%)!`);
  console.log("================================================================================\n");
}

runLimitedPhaseRegressionSuite().catch((err) => {
  console.error("Test Suite Failed with error:", err);
  process.exit(1);
});

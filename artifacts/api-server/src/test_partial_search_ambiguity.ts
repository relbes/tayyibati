import { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { warmDishEngineCache } from "./lib/dishCompatibilityEngine";
import { getKnowledgeCache } from "./lib/knowledgeCache";

function assert(condition: boolean, testName: string, details?: string) {
  if (!condition) {
    console.error(`[FAIL] ${testName}${details ? ` -> ${details}` : ""}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
  console.log(`[PASS] ${testName}${details ? ` (${details})` : ""}`);
}

async function runTestSuite() {
  console.log("===============================================================");
  console.log("  Tayyibati: Partial Search and Ambiguity Handling Test Suite  ");
  console.log("===============================================================\n");

  await warmDishEngineCache();
  await getKnowledgeCache();

  // -------------------------------------------------------------------------
  // 1. Partial Arabic Food Query: معكر
  // -------------------------------------------------------------------------
  console.log("--- 1. Testing Incomplete Food Query: 'معكر' ---");
  const sResMaakar = await CanonicalSearchEngine.searchEntities("معكر");
  assert(
    sResMaakar.primaryResult?.searchOutcome === "AMBIGUOUS",
    "searchEntities('معكر') returns searchOutcome = AMBIGUOUS",
    `searchOutcome: ${sResMaakar.primaryResult?.searchOutcome}`
  );
  assert(
    sResMaakar.primaryResult?.isAmbiguous === true,
    "searchEntities('معكر') flags isAmbiguous = true"
  );
  assert(
    sResMaakar.primaryResult?.canonicalId !== 1467,
    "searchEntities('معكر') does NOT arbitrarily select lentil pasta #1467",
    `canonicalId: ${sResMaakar.primaryResult?.canonicalId}`
  );
  assert(
    (sResMaakar.displayFoods?.length || 0) >= 3,
    "searchEntities('معكر') retains multiple pasta candidates in displayFoods",
    `count: ${sResMaakar.displayFoods?.length}`
  );

  const aResMaakar = await UnifiedAnalysisEngine.analyze({ query: "معكر", inputType: "text" });
  assert(
    aResMaakar.report.resultMode === "MULTIPLE_DISHES",
    "analyze('معكر') returns resultMode = MULTIPLE_DISHES",
    `resultMode: ${aResMaakar.report.resultMode}`
  );
  assert(
    (aResMaakar.report as any).isAmbiguous === true,
    "analyze('معكر') returns isAmbiguous = true"
  );
  assert(
    (aResMaakar.report as any).requiresSelection === true,
    "analyze('معكر') returns requiresSelection = true"
  );
  assert(
    Boolean(aResMaakar.report.questionAr),
    "analyze('معكر') includes Arabic clarification question",
    `questionAr: ${aResMaakar.report.questionAr}`
  );
  assert(
    aResMaakar.report.allowed.length === 0 && aResMaakar.report.forbidden.length === 0,
    "analyze('معكر') does NOT issue any food ruling",
    `allowed: ${aResMaakar.report.allowed.length}, forbidden: ${aResMaakar.report.forbidden.length}`
  );

  // -------------------------------------------------------------------------
  // 2. Specific Complete Query: معكرونة العدس
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Testing Specific Food Query: 'معكرونة العدس' ---");
  const sResLentil = await CanonicalSearchEngine.searchEntities("معكرونة العدس");
  assert(
    sResLentil.primaryResult?.searchOutcome === "FOUND",
    "searchEntities('معكرونة العدس') returns searchOutcome = FOUND",
    `searchOutcome: ${sResLentil.primaryResult?.searchOutcome}`
  );
  assert(
    sResLentil.primaryResult?.matchType === "EXACT",
    "searchEntities('معكرونة العدس') matches with EXACT matchType"
  );
  assert(
    sResLentil.primaryResult?.canonicalId === 1467,
    "searchEntities('معكرونة العدس') correctly resolves to Food #1467",
    `canonicalId: ${sResLentil.primaryResult?.canonicalId}`
  );

  const aResLentil = await UnifiedAnalysisEngine.analyze({ query: "معكرونة العدس", inputType: "text" });
  assert(
    aResLentil.report.resultMode === "EXACT_FOOD",
    "analyze('معكرونة العدس') returns resultMode = EXACT_FOOD",
    `resultMode: ${aResLentil.report.resultMode}`
  );
  assert(
    aResLentil.report.forbidden.length > 0 && aResLentil.report.forbidden[0].nameAr === "معكرونة العدس",
    "analyze('معكرونة العدس') produces confident ruling for lentil pasta",
    `status: ${aResLentil.report.forbidden[0]?.status}`
  );

  // -------------------------------------------------------------------------
  // 3. Umbrella Generic Dish: شاورما
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Testing Generic Umbrella Dish Query: 'شاورما' ---");
  const sResShawarma = await CanonicalSearchEngine.searchEntities("شاورما");
  assert(
    sResShawarma.primaryResult?.searchOutcome === "AMBIGUOUS",
    "searchEntities('شاورما') returns searchOutcome = AMBIGUOUS",
    `searchOutcome: ${sResShawarma.primaryResult?.searchOutcome}`
  );
  assert(
    sResShawarma.primaryResult?.isAmbiguous === true,
    "searchEntities('شاورما') flags isAmbiguous = true"
  );
  const dishVariants = sResShawarma.displayDishes || [];
  const hasChicken = dishVariants.some(d => (d.canonicalName || "").includes("دجاج"));
  const hasMeat = dishVariants.some(d => (d.canonicalName || "").includes("لحم") || (d.canonicalName || "").includes("بقر"));
  assert(
    hasChicken && hasMeat,
    "searchEntities('شاورما') offers distinct relevant variants (both chicken and beef/meat)",
    `variants: ${dishVariants.map(d => d.canonicalName).join(", ")}`
  );

  const aResShawarma = await UnifiedAnalysisEngine.analyze({ query: "شاورما", inputType: "text" });
  assert(
    aResShawarma.report.resultMode === "MULTIPLE_DISHES",
    "analyze('شاورما') returns resultMode = MULTIPLE_DISHES"
  );
  assert(
    (aResShawarma.report as any).isAmbiguous === true,
    "analyze('شاورما') returns isAmbiguous = true"
  );
  assert(
    (aResShawarma.report as any).requiresSelection === true,
    "analyze('شاورما') returns requiresSelection = true"
  );
  assert(
    aResShawarma.report.allowed.length === 0 && aResShawarma.report.forbidden.length === 0,
    "analyze('شاورما') does NOT issue a premature dish ruling",
    `allowed: ${aResShawarma.report.allowed.length}, forbidden: ${aResShawarma.report.forbidden.length}`
  );
  const suggestions = aResShawarma.report.suggestions || [];
  const suggChicken = suggestions.some(s => s.includes("دجاج"));
  const suggMeat = suggestions.some(s => s.includes("لحم") || s.includes("بقر"));
  assert(
    suggChicken && suggMeat,
    "analyze('شاورما') suggestions include both chicken and beef/meat",
    `suggestions: ${suggestions.join(", ")}`
  );

  // -------------------------------------------------------------------------
  // 4. Kiri Cheese and Alias Safety Invariance
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Testing Kiri Cheese and Cheese Safety Regression Invariance ---");
  const sResKiri = await CanonicalSearchEngine.searchEntities("كيري");
  assert(
    sResKiri.primaryResult?.canonicalId === 1720,
    "Query 'كيري' resolves to allowed Kiri food #1720",
    `canonicalId: ${sResKiri.primaryResult?.canonicalId}`
  );
  const sResAlKiri = await CanonicalSearchEngine.searchEntities("الكيري");
  assert(
    sResAlKiri.primaryResult?.canonicalId === 1720,
    "Query 'الكيري' resolves to allowed Kiri food #1720",
    `canonicalId: ${sResAlKiri.primaryResult?.canonicalId}`
  );
  const sResTaama = await CanonicalSearchEngine.searchEntities("طعمة");
  assert(
    sResTaama.primaryResult?.canonicalId === 1578,
    "Query 'طعمة' continues to resolve to forbidden food #1578",
    `canonicalId: ${sResTaama.primaryResult?.canonicalId}`
  );
  const sResLabnita = await CanonicalSearchEngine.searchEntities("لبنيتا");
  assert(
    sResLabnita.primaryResult?.canonicalId === 1578,
    "Query 'لبنيتا' continues to resolve to forbidden food #1578",
    `canonicalId: ${sResLabnita.primaryResult?.canonicalId}`
  );

  // -------------------------------------------------------------------------
  // 5. Toast Safety Invariance
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Testing Toast Safety Regression Invariance ---");
  const sResToastWhite = await CanonicalSearchEngine.searchEntities("توست أبيض");
  assert(
    sResToastWhite.primaryResult?.canonicalId === 1694,
    "Query 'توست أبيض' resolves to exact food #1694",
    `canonicalId: ${sResToastWhite.primaryResult?.canonicalId}`
  );
  const sResToastBare = await CanonicalSearchEngine.searchEntities("توست");
  assert(
    sResToastBare.primaryResult?.canonicalId !== 1551,
    "Bare query 'توست' never resolves to allowed bran toast #1551",
    `canonicalId: ${sResToastBare.primaryResult?.canonicalId}`
  );

  // -------------------------------------------------------------------------
  // 6. Non-existent Query Handling
  // -------------------------------------------------------------------------
  console.log("\n--- 6. Testing Non-existent Query Handling ---");
  const sResNonsense = await CanonicalSearchEngine.searchEntities("xyz123nonsense");
  assert(
    sResNonsense.primaryResult === null || sResNonsense.primaryResult?.searchOutcome === "NOT_FOUND",
    "Query 'xyz123nonsense' produces NOT_FOUND without inventing rulings"
  );

  console.log("\n===============================================================");
  console.log("  ALL TESTS PASSED SUCCESSFULLY!                             ");
  console.log("===============================================================\n");
  process.exit(0);
}

runTestSuite().catch(e => {
  console.error("Test Suite Failed:", e);
  process.exit(1);
});

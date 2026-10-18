import assert from "assert";
import { resolveSingleIngredient, warmDishEngineCache, getDishEngineCache } from "./lib/dishCompatibilityEngine";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { getKnowledgeCache } from "./lib/knowledgeCache";

async function runRegression() {
  console.log("================================================================================");
  console.log("  TAYYIBATI P0 #2: INGREDIENT DISH ALIAS LEAKAGE REGRESSION TEST SUITE        ");
  console.log("================================================================================\n");

  console.log("Initializing caches...");
  await warmDishEngineCache();
  await getKnowledgeCache();
  const cache = getDishEngineCache();
  console.log("Caches initialized successfully.\n");

  let passed = 0;
  let total = 0;

  // ---------------------------------------------------------------------------
  // CASE A: 'شاورما' and dish aliases must NOT resolve as allowed ingredients
  // ---------------------------------------------------------------------------
  total++;
  console.log("--- TEST A1: resolveSingleIngredient('شاورما') ---");
  const resShawarma = resolveSingleIngredient("شاورما", cache);
  console.log("Status:", resShawarma.status);
  console.log("Reason:", resShawarma.reason);
  console.log("CanonicalFoodAr:", resShawarma.canonicalFoodAr);
  assert.notStrictEqual(resShawarma.status, "allowed", "TEST A1 FAILED: 'شاورما' must NOT be resolved as an allowed ingredient");
  assert.strictEqual(resShawarma.status, "unknown", "TEST A1 FAILED: 'شاورما' should be unknown as a single ingredient");
  console.log("[PASS] TEST A1: 'شاورما' is NOT an allowed ingredient\n");
  passed++;

  total++;
  console.log("--- TEST A2: resolveSingleIngredient('شاورما عربي') (Dish Alias) ---");
  const resShawarmaArabi = resolveSingleIngredient("شاورما عربي", cache);
  console.log("Status:", resShawarmaArabi.status);
  console.log("Reason:", resShawarmaArabi.reason);
  console.log("CanonicalFoodAr:", resShawarmaArabi.canonicalFoodAr);
  assert.notStrictEqual(resShawarmaArabi.status, "allowed", "TEST A2 FAILED: Dish alias 'شاورما عربي' must NOT be resolved as an allowed ingredient");
  assert.strictEqual(resShawarmaArabi.status, "unknown", "TEST A2 FAILED: Dish alias must be unknown as a single ingredient");
  console.log("[PASS] TEST A2: Dish alias 'شاورما عربي' is NOT an allowed ingredient\n");
  passed++;

  total++;
  console.log("--- TEST A3: UnifiedAnalysisEngine.analyze('شاورما') Query Resolution ---");
  const outShawarma = await UnifiedAnalysisEngine.analyze({ query: "شاورما" });
  console.log("needsClarification:", outShawarma.report.needsClarification);
  console.log("clarificationType:", outShawarma.report.clarificationType);
  console.log("suggestions:", outShawarma.report.suggestions);
  assert.strictEqual(outShawarma.report.needsClarification, true, "TEST A3 FAILED: 'شاورما' must trigger clarification");
  assert.strictEqual(outShawarma.report.clarificationType, "DISH_VARIANT", "TEST A3 FAILED: clarificationType must be DISH_VARIANT");
  assert.deepStrictEqual(outShawarma.report.suggestions, ["شاورما لحم بقر", "شاورما لحم غنم", "شاورما دجاج"], "TEST A3 FAILED: suggestions mismatch");
  console.log("[PASS] TEST A3: 'شاورما' handled as dish ambiguity with DISH_VARIANT clarification\n");
  passed++;

  // ---------------------------------------------------------------------------
  // CASE B: 'شاورما دجاج' must continue to resolve as composite/dish result
  // ---------------------------------------------------------------------------
  total++;
  console.log("--- TEST B: UnifiedAnalysisEngine.analyze('شاورما دجاج') ---");
  const outShawarmaChicken = await UnifiedAnalysisEngine.analyze({ query: "شاورما دجاج" });
  console.log("resultMode:", outShawarmaChicken.report.resultMode);
  console.log("primaryRuling:", outShawarmaChicken.report.primaryRuling?.nameAr);
  console.log("needsClarification:", outShawarmaChicken.report.needsClarification);
  assert.strictEqual(outShawarmaChicken.report.resultMode, "COMPOSITE_FOOD", "TEST B FAILED: resultMode must be COMPOSITE_FOOD");
  assert.strictEqual(outShawarmaChicken.report.notFound, false, "TEST B FAILED: notFound must be false");
  assert.strictEqual(outShawarmaChicken.report.needsClarification, undefined, "TEST B FAILED: needsClarification must not be true");
  console.log("[PASS] TEST B: 'شاورما دجاج' resolves authoritatively as COMPOSITE_FOOD\n");
  passed++;

  // ---------------------------------------------------------------------------
  // CASE C: 'لحم' must continue to resolve as normal allowed animal ingredient
  // ---------------------------------------------------------------------------
  total++;
  console.log("--- TEST C1: resolveSingleIngredient('لحم') ---");
  const resMeat = resolveSingleIngredient("لحم", cache);
  console.log("Status:", resMeat.status);
  console.log("ProteinCategory:", resMeat.proteinCategory);
  assert.strictEqual(resMeat.status, "allowed", "TEST C1 FAILED: 'لحم' ingredient must be allowed");
  assert.strictEqual(resMeat.proteinCategory, "MEAT", "TEST C1 FAILED: 'لحم' proteinCategory must be MEAT");
  console.log("[PASS] TEST C1: 'لحم' ingredient is allowed with proteinCategory MEAT\n");
  passed++;

  total++;
  console.log("--- TEST C2: UnifiedAnalysisEngine.analyze('لحم') ---");
  const outMeat = await UnifiedAnalysisEngine.analyze({ query: "لحم" });
  console.log("resultMode:", outMeat.report.resultMode);
  console.log("status:", outMeat.report.primaryRuling?.status);
  console.log("sourceType:", outMeat.report.primaryRuling?.sourceType);
  assert.strictEqual(outMeat.report.resultMode, "EXACT_FOOD", "TEST C2 FAILED: resultMode must be EXACT_FOOD");
  assert.strictEqual(outMeat.report.primaryRuling?.status, "allowed", "TEST C2 FAILED: status must be allowed");
  assert.strictEqual(outMeat.report.primaryRuling?.sourceType, "حيواني", "TEST C2 FAILED: sourceType must be حيواني");
  console.log("[PASS] TEST C2: 'لحم' query resolves as EXACT_FOOD allowed animal ingredient\n");
  passed++;

  // ---------------------------------------------------------------------------
  // CASE D: 'دجاج' must continue to resolve as normal animal ingredient
  // ---------------------------------------------------------------------------
  total++;
  console.log("--- TEST D: UnifiedAnalysisEngine.analyze('دجاج') ---");
  const outChicken = await UnifiedAnalysisEngine.analyze({ query: "دجاج" });
  console.log("resultMode:", outChicken.report.resultMode);
  console.log("status:", outChicken.report.primaryRuling?.status);
  console.log("sourceType:", outChicken.report.primaryRuling?.sourceType);
  assert.strictEqual(outChicken.report.resultMode, "EXACT_FOOD", "TEST D FAILED: resultMode must be EXACT_FOOD");
  assert.strictEqual(outChicken.report.primaryRuling?.sourceType, "حيواني", "TEST D FAILED: sourceType must be حيواني");
  console.log("[PASS] TEST D: 'دجاج' query resolves as EXACT_FOOD animal ingredient\n");
  passed++;

  // ---------------------------------------------------------------------------
  // CASE E: 'بلح' must continue to resolve as Date fruit without leaking recipe ingredients
  // ---------------------------------------------------------------------------
  total++;
  console.log("--- TEST E: UnifiedAnalysisEngine.analyze('بلح') ---");
  const outDates = await UnifiedAnalysisEngine.analyze({ query: "بلح" });
  console.log("resultMode:", outDates.report.resultMode);
  console.log("primaryRuling:", outDates.report.primaryRuling?.nameAr);
  assert.strictEqual(outDates.report.resultMode, "EXACT_FOOD", "TEST E FAILED: resultMode must be EXACT_FOOD");
  assert.strictEqual(outDates.report.primaryRuling?.nameAr, "التمر", "TEST E FAILED: primaryRuling must be التمر");
  assert.strictEqual(outDates.report.notFound, false, "TEST E FAILED: notFound must be false");
  console.log("[PASS] TEST E: 'بلح' resolves cleanly as Date fruit without leaking recipe ingredients\n");
  passed++;

  // ---------------------------------------------------------------------------
  // CASE F: 'معكرون' must continue to resolve to canonical food 'المكرونة بكل أنواعها وأشكالها'
  // ---------------------------------------------------------------------------
  total++;
  console.log("--- TEST F: UnifiedAnalysisEngine.analyze('معكرون') ---");
  const outPasta = await UnifiedAnalysisEngine.analyze({ query: "معكرون" });
  console.log("resultMode:", outPasta.report.resultMode);
  console.log("canonicalName:", outPasta.report.canonicalResult?.canonicalName);
  assert.strictEqual(outPasta.report.canonicalResult?.canonicalName, "المكرونة بكل أنواعها وأشكالها", "TEST F FAILED: canonicalName mismatch");
  console.log("[PASS] TEST F: 'معكرون' resolves to canonical food 'المكرونة بكل أنواعها وأشكالها'\n");
  passed++;

  console.log("================================================================================");
  console.log(`  ALL ${passed}/${total} TESTS PASSED SUCCESSFULLY!                             `);
  console.log("================================================================================\n");
}

runRegression().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});

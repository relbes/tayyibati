import assert from "assert";
import { FoodResolutionEngine } from "./lib/foodResolutionEngine";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { getKnowledgeCache, resolveWithInheritance } from "./lib/knowledgeCache";
import { warmDishEngineCache } from "./lib/dishCompatibilityEngine";

async function runCameraDishRegression() {
  console.log("================================================================================");
  console.log("  TAYYIBATI CAMERA DISH AMBIGUITY REGRESSION TEST SUITE                        ");
  console.log("================================================================================\n");

  console.log("Initializing caches...");
  await warmDishEngineCache();
  const knowledgeCache = await getKnowledgeCache();
  console.log("Caches initialized.\n");

  let passed = 0;
  let total = 0;

  // TEST 1: Generic Camera Dish "شاورما" -> DISH_VARIANT ambiguity
  total++;
  console.log("--- TEST 1: Generic Camera Dish 'شاورما' ---");
  const resShawarma = await FoodResolutionEngine.resolve("شاورما", "camera", 1.0, []);
  console.log("Resolution state:", resShawarma.state);
  console.log("needsClarification:", resShawarma.needsClarification);
  console.log("clarificationType:", resShawarma.clarificationType);
  console.log("questionAr:", resShawarma.questionAr);
  const suggestionLabels = (resShawarma.suggestions || []).map((s: any) => typeof s === "string" ? s : s.label || s.query);
  console.log("suggestions:", suggestionLabels);

  assert.strictEqual(resShawarma.needsClarification, true, "TEST 1 Failed: needsClarification must be true");
  assert.strictEqual(resShawarma.clarificationType, "DISH_VARIANT", "TEST 1 Failed: clarificationType must be DISH_VARIANT");
  assert.strictEqual(resShawarma.questionAr, "ما نوع شاورما الذي تقصده؟", "TEST 1 Failed: questionAr must match");
  assert.deepStrictEqual(suggestionLabels, ["شاورما لحم بقر", "شاورما لحم غنم", "شاورما دجاج"], "TEST 1 Failed: suggestions order mismatch");
  console.log("[PASS] TEST 1: 'شاورما' correctly produces DISH_VARIANT clarification with ordered meat & poultry variants\n");
  passed++;

  // TEST 2: Specific Camera Dish "شاورما دجاج" -> Resolves dish authoritatively without ambiguity
  total++;
  console.log("--- TEST 2: Specific Camera Dish 'شاورما دجاج' ---");
  const dishReport = await UnifiedAnalysisEngine.analyze({
    query: "شاورما دجاج",
    inputType: "camera"
  });
  console.log("Dish report resultMode:", dishReport.report.resultMode);
  console.log("Dish report primary ruling:", dishReport.report.primaryRuling?.nameAr);
  console.log("Dish report needsClarification:", dishReport.report.needsClarification);
  assert.strictEqual(dishReport.report.resultMode, "COMPOSITE_FOOD", "TEST 2 Failed: resultMode must be COMPOSITE_FOOD");
  assert.strictEqual(dishReport.report.notFound, false, "TEST 2 Failed: notFound must be false");
  assert.strictEqual(dishReport.report.needsClarification, undefined, "TEST 2 Failed: needsClarification must not be true");
  console.log("[PASS] TEST 2: 'شاورما دجاج' resolves authoritatively as COMPOSITE_FOOD without clarification\n");
  passed++;

  // TEST 3: Single Food Camera "تفاح" -> Resolves as EXACT_FOOD
  total++;
  console.log("--- TEST 3: Single Food Camera 'تفاح' ---");
  const resApple = await FoodResolutionEngine.resolve("تفاح", "camera", 1.0, []);
  assert.strictEqual(resApple.needsClarification, false, "TEST 3 Failed: apple should not need clarification");
  const singleApple = resolveWithInheritance("تفاح", knowledgeCache);
  assert.ok(singleApple && singleApple.food, "TEST 3 Failed: apple must resolve in knowledgeCache");
  assert.strictEqual(singleApple.food.status, "allowed", "TEST 3 Failed: apple must be allowed");
  console.log("[PASS] TEST 3: 'تفاح' resolves cleanly as single allowed food\n");
  passed++;

  // TEST 4: Single Food Camera "لحم" -> Resolves as ALLOWED with sourceType حيواني
  total++;
  console.log("--- TEST 4: Single Food Camera 'لحم' ---");
  const resMeat = await FoodResolutionEngine.resolve("لحم", "camera", 1.0, []);
  assert.strictEqual(resMeat.needsClarification, false, "TEST 4 Failed: meat should not need clarification");
  const singleMeat = resolveWithInheritance("لحم", knowledgeCache);
  assert.ok(singleMeat && singleMeat.food, "TEST 4 Failed: meat must resolve in knowledgeCache");
  assert.strictEqual(singleMeat.food.status, "allowed", "TEST 4 Failed: meat must be allowed");
  console.log("[PASS] TEST 4: 'لحم' resolves cleanly as single allowed meat\n");
  passed++;

  console.log("================================================================================");
  console.log(`  ALL ${passed}/${total} CAMERA REGRESSION TESTS PASSED!`);
  console.log("================================================================================\n");
}

runCameraDishRegression().catch(err => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});

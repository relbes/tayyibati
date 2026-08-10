/**
 * Tayyibati Phase 10.3 - Explanation Framework Unit Test Suite (INVARIANT CONSISTENCY VALIDATION)
 */

import { ExplanationFramework } from "./lib/explanationFramework";
import { IngredientDecisionItem } from "./lib/decisionEngine";
import { MealDecisionEngine } from "./lib/mealDecisionEngine";

function runPhase10ExplanationFrameworkTests() {
  console.log("=========================================================================");
  console.log("PHASE 10.3 EXPLANATION FRAMEWORK UNIT TEST SUITE (INVARIANT VALIDATION)");
  console.log("=========================================================================\n");

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(` -> PASS ✅: ${testName}`);
      if (details) console.log(`     ${details}`);
      passCount++;
    } else {
      console.error(` -> FAIL ❌: ${testName}`);
      if (details) console.error(`     ${details}`);
      failCount++;
    }
  }

  // SCENARIO 1: All ingredients allowed
  console.log("[TEST 1]: All ingredients allowed");
  const items1: IngredientDecisionItem[] = [
    { input: "ماء", canonicalId: 10, canonicalName: "الماء", status: "allowed", reason: "مسموح", source: "foods" },
    { input: "زيت زيتون", canonicalId: 20, canonicalName: "زيت الزيتون", status: "allowed", reason: "مسموح", source: "foods" },
  ];
  const meal1 = MealDecisionEngine.evaluateMeal(items1);
  const exp1 = ExplanationFramework.generateExplanation(meal1, items1);

  assert(
    exp1.status === "allowed" &&
      exp1.reasonCode === "ONLY_ALLOWED_INGREDIENTS" &&
      exp1.statistics.allowedCount === 2 &&
      exp1.allowedIngredientIds.length === 2 &&
      exp1.forbiddenIngredientIds.length === 0,
    "Scenario 1 - All ingredients allowed produces ONLY_ALLOWED_INGREDIENTS reasonCode with CanonicalId[]",
    `Status: ${exp1.status}, ReasonCode: ${exp1.reasonCode}, AllowedIDs: [${exp1.allowedIngredientIds.join(", ")}]`
  );

  // SCENARIO 2: Contains forbidden ingredients
  console.log("\n[TEST 2]: Contains forbidden ingredients");
  const items2: IngredientDecisionItem[] = [
    { input: "صدر دجاج", canonicalId: 663, canonicalName: "الدجاج والفراخ", status: "forbidden", reason: "الدواجن ممنوعة", source: "foods" },
    { input: "مايونيز", canonicalId: 101, canonicalName: "المايونيز", status: "allowed", reason: "مسموح", source: "foods" },
  ];
  const meal2 = MealDecisionEngine.evaluateMeal(items2);
  const exp2 = ExplanationFramework.generateExplanation(meal2, items2);

  assert(
    exp2.status === "forbidden" &&
      exp2.reasonCode === "FORBIDDEN_INGREDIENTS" &&
      exp2.forbiddenIngredientIds.length === 1 &&
      exp2.forbiddenIngredientIds[0] === 663,
    "Scenario 2 - Contains forbidden ingredients produces FORBIDDEN_INGREDIENTS reasonCode with forbidden CanonicalId[]",
    `Status: ${exp2.status}, ReasonCode: ${exp2.reasonCode}, ForbiddenIDs: [${exp2.forbiddenIngredientIds.join(", ")}]`
  );

  // SCENARIO 3: Contains conditional ingredients
  console.log("\n[TEST 3]: Contains conditional ingredients");
  const items3: IngredientDecisionItem[] = [
    { input: "جيلاتين", canonicalId: 300, canonicalName: "الجيلاتين", status: "conditional", reason: "مشروط بمصدر الحلال", source: "foods" },
    { input: "سكر", canonicalId: 50, canonicalName: "السكر", status: "allowed", reason: "مسموح", source: "foods" },
  ];
  const meal3 = MealDecisionEngine.evaluateMeal(items3);
  const exp3 = ExplanationFramework.generateExplanation(meal3, items3);

  assert(
    exp3.status === "conditional" &&
      exp3.reasonCode === "CONDITIONAL_INGREDIENTS_PRESENT" &&
      exp3.conditionalIngredientIds.length === 1 &&
      exp3.conditionalIngredientIds[0] === 300,
    "Scenario 3 - Contains conditional ingredients produces CONDITIONAL_INGREDIENTS_PRESENT reasonCode with conditional CanonicalId[]",
    `Status: ${exp3.status}, ReasonCode: ${exp3.reasonCode}, ConditionalIDs: [${exp3.conditionalIngredientIds.join(", ")}]`
  );

  // SCENARIO 4: Contains unresolved ingredients
  console.log("\n[TEST 4]: Contains unresolved ingredients");
  const items4: IngredientDecisionItem[] = [
    { input: "صلصة خاصة", canonicalId: 0, canonicalName: "صلصة خاصة", status: "unknown", reason: "غير معروف", source: "unknown" },
  ];
  const meal4 = MealDecisionEngine.evaluateMeal(items4);
  const exp4 = ExplanationFramework.generateExplanation(meal4, items4);

  assert(
    exp4.status === "unknown" &&
      exp4.reasonCode === "UNKNOWN_INGREDIENTS_PRESENT" &&
      exp4.unresolvedIngredientInputs.length === 1 &&
      exp4.unresolvedIngredientInputs[0] === "صلصة خاصة" &&
      exp4.statistics.unresolvedCount === 1,
    "Scenario 4 - Contains unresolved ingredients produces UNKNOWN_INGREDIENTS_PRESENT reasonCode with unresolvedIngredientInputs[]",
    `Status: ${exp4.status}, ReasonCode: ${exp4.reasonCode}, UnresolvedInputs: [${exp4.unresolvedIngredientInputs.join(", ")}]`
  );

  // SCENARIO 5: Mixed meal
  console.log("\n[TEST 5]: Mixed meal");
  const items5: IngredientDecisionItem[] = [
    { input: "لحم خنزير", canonicalId: 1, canonicalName: "لحم الخنزير", status: "forbidden", reason: "ممنوع", source: "foods" },
    { input: "جيلاتين", canonicalId: 300, canonicalName: "الجيلاتين", status: "conditional", reason: "مشروط", source: "foods" },
    { input: "ملح", canonicalId: 12, canonicalName: "الملح", status: "allowed", reason: "مسموح", source: "foods" },
    { input: "بهار سري", canonicalId: 0, canonicalName: "بهار سري", status: "unknown", reason: "مجهول", source: "unknown" },
  ];
  const meal5 = MealDecisionEngine.evaluateMeal(items5);
  const exp5 = ExplanationFramework.generateExplanation(meal5, items5);

  assert(
    exp5.status === "forbidden" &&
      exp5.reasonCode === "FORBIDDEN_INGREDIENTS" &&
      exp5.statistics.totalIngredients === 4 &&
      exp5.forbiddenIngredientIds[0] === 1 &&
      exp5.conditionalIngredientIds[0] === 300 &&
      exp5.allowedIngredientIds[0] === 12 &&
      exp5.unresolvedIngredientInputs[0] === "بهار سري" &&
      exp5.statistics.unresolvedCount === 1,
    "Scenario 5 - Mixed meal correctly isolates CanonicalId[] and unresolvedIngredientInputs[]",
    `ForbiddenIDs: [${exp5.forbiddenIngredientIds}], ConditionalIDs: [${exp5.conditionalIngredientIds}], AllowedIDs: [${exp5.allowedIngredientIds}], UnresolvedInputs: [${exp5.unresolvedIngredientInputs}]`
  );

  // SCENARIO 6: Empty ingredient list
  console.log("\n[TEST 6]: Empty ingredient list");
  const items6: IngredientDecisionItem[] = [];
  const meal6 = MealDecisionEngine.evaluateMeal(items6);
  const exp6 = ExplanationFramework.generateExplanation(meal6, items6);

  assert(
    exp6.status === "unknown" &&
      exp6.reasonCode === "NO_INGREDIENTS_FOUND" &&
      exp6.statistics.totalIngredients === 0,
    "Scenario 6 - Empty ingredient list produces NO_INGREDIENTS_FOUND reasonCode",
    `Status: ${exp6.status}, ReasonCode: ${exp6.reasonCode}, TotalIngredients: 0`
  );

  // SCENARIO 7: MealDecision UNKNOWN (Explicit MealDecision.status = "unknown")
  console.log("\n[TEST 7]: MealDecision UNKNOWN");
  const items7: IngredientDecisionItem[] = [
    { input: "تفاح", canonicalId: 88, canonicalName: "التفاح", status: "allowed", reason: "مسموح", source: "foods" }
  ];
  const customUnknownMeal = {
    status: "unknown" as const,
    forbiddenCount: 0,
    conditionalCount: 0,
    allowedCount: 1,
    unknownCount: 0,
    totalIngredients: 1,
    breakdown: { forbidden: [], conditional: [], allowed: [], unknown: [] }
  };
  const exp7 = ExplanationFramework.generateExplanation(customUnknownMeal, items7);

  assert(
    exp7.status === "unknown" &&
      exp7.reasonCode === "UNKNOWN_MEAL_STATUS" &&
      exp7.statistics.totalIngredients === 1,
    "Scenario 7 - Explicit MealDecision UNKNOWN mapping produces UNKNOWN_MEAL_STATUS (Zero contradiction)",
    `Status: ${exp7.status}, ReasonCode: ${exp7.reasonCode}`
  );

  console.log("\n=========================================================================");
  console.log(`PHASE 10.3 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("=========================================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase10ExplanationFrameworkTests();

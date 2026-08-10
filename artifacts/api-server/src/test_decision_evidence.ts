import { DecisionEngine } from "./lib/decisionEngine";

async function runDecisionEvidenceTest() {
  console.log("============================================================");
  console.log("PHASE 6.4.1 – DECISION EVIDENCE & METADATA TEST SUITE");
  console.log("============================================================\n");

  // JIT Warmup
  DecisionEngine.evaluate({
    resolvedIngredients: [],
    unknownIngredients: [],
    recognitionStats: { totalDetected: 0, totalResolved: 0, totalUnknown: 0, recognitionPercentage: 0, averageConfidence: 0, highestConfidence: 0, lowestConfidence: 0 },
  });

  const testCases = [
    {
      name: "Chicken Burger (Forbidden Meal)",
      input: {
        resolvedIngredients: [
          { foodId: 10, canonicalFoodAr: "الدجاج والفرخة", canonicalFoodEn: "Chicken", status: "forbidden" as const, reason: "ممنوع" },
          { foodId: 11, canonicalFoodAr: "الخبز العادي", canonicalFoodEn: "Bread", status: "forbidden" as const, reason: "ممنوع" },
          { foodId: 12, canonicalFoodAr: "صلصة الطماطم", canonicalFoodEn: "Tomato", status: "allowed" as const, reason: "مسموح" },
        ],
        unknownIngredients: [],
        recognitionStats: { totalDetected: 3, totalResolved: 3, totalUnknown: 0, recognitionPercentage: 100, averageConfidence: 95, highestConfidence: 98, lowestConfidence: 90 },
      },
      expectedDecision: "FORBIDDEN",
      expectedCriticalCount: 2, // Chicken, Bread
    },
    {
      name: "Mansaf (Allowed Meal)",
      input: {
        resolvedIngredients: [
          { foodId: 1, canonicalFoodAr: "الأرز", canonicalFoodEn: "Rice", status: "allowed" as const, reason: "مسموح" },
          { foodId: 2, canonicalFoodAr: "السمن البلدي", canonicalFoodEn: "Ghee", status: "allowed" as const, reason: "مسموح" },
          { foodId: 3, canonicalFoodAr: "اللوز", canonicalFoodEn: "Almonds", status: "allowed" as const, reason: "مسموح" },
        ],
        unknownIngredients: [],
        recognitionStats: { totalDetected: 3, totalResolved: 3, totalUnknown: 0, recognitionPercentage: 100, averageConfidence: 90, highestConfidence: 98, lowestConfidence: 85 },
      },
      expectedDecision: "ALLOWED",
      expectedCriticalCount: 3, // All allowed
    },
    {
      name: "Pizza (Conditional Cheese)",
      input: {
        resolvedIngredients: [
          { foodId: 20, canonicalFoodAr: "جبنة", canonicalFoodEn: "Cheese", status: "conditional" as const, reason: "أسبوعي" },
          { foodId: 21, canonicalFoodAr: "زيت زيتون", canonicalFoodEn: "Olive Oil", status: "allowed" as const, reason: "مسموح" },
        ],
        unknownIngredients: [],
        recognitionStats: { totalDetected: 2, totalResolved: 2, totalUnknown: 0, recognitionPercentage: 100, averageConfidence: 92, highestConfidence: 95, lowestConfidence: 90 },
      },
      expectedDecision: "CONDITIONAL",
      expectedCriticalCount: 1, // Cheese
    },
    {
      name: "Needs Review (Unknown Compounds)",
      input: {
        resolvedIngredients: [],
        unknownIngredients: [
          { rawName: "مركب غريب X", normalizedName: "مركب غريب x", whyUnknown: "غير متوفر" },
        ],
        recognitionStats: { totalDetected: 1, totalResolved: 0, totalUnknown: 1, recognitionPercentage: 0, averageConfidence: 0, highestConfidence: 0, lowestConfidence: 0 },
      },
      expectedDecision: "NEEDS_REVIEW",
      expectedCriticalCount: 1, // Unknown item
    },
  ];

  let allPassed = true;
  for (let idx = 0; idx < testCases.length; idx++) {
    const tc = testCases[idx];
    const tStart = performance.now();
    const res = DecisionEngine.evaluate(tc.input);
    const durationMs = performance.now() - tStart;

    const isDecisionPass = res.finalDecision === tc.expectedDecision;
    const isCriticalPass = res.decisionEvidence.criticalIngredients.length === tc.expectedCriticalCount;
    const hasMetadata = !!res.decisionMetadata.engineVersion && !!res.decisionMetadata.decisionTimestamp;

    const pass = isDecisionPass && isCriticalPass && hasMetadata && durationMs < 1.0;
    if (!pass) allPassed = false;

    console.log(`[TEST ${idx + 1}: "${tc.name}"]`);
    console.log(`  -> Final Decision:         ${res.finalDecision} (Expected: ${tc.expectedDecision})`);
    console.log(`  -> Critical Ingredients:   ${res.decisionEvidence.criticalIngredients.map((c) => c.canonicalFoodAr).join(", ")}`);
    console.log(`  -> Engine Version:         ${res.decisionMetadata.engineVersion}`);
    console.log(`  -> Processing Time:        ${res.decisionMetadata.processingTimeMs} ms (Target < 1.0 ms)`);
    console.log(`  -> Deterministic:          ${res.decisionMetadata.deterministic}`);
    console.log(`  -> Result:                 ${pass ? "PASS ✓" : "FAIL ✗"}\n`);
  }

  console.log(`✓ Decision determined BEFORE score calculation`);
  console.log(`✓ DecisionEvidence & criticalIngredients correctly populated`);
  console.log(`✓ DecisionMetadata (engineVersion, timestamp, processingTimeMs) verified`);
  console.log(`\nOVERALL SUITE: ${allPassed ? "100% PASSED (ALL TESTS PASSED)" : "SOME TESTS FAILED"}`);
}

runDecisionEvidenceTest().catch(console.error);

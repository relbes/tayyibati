/**
 * Tayyibati Phase 6 - Step 3 Integration Test Suite
 *
 * Verifies end-to-end AI Knowledge Fallback integration across the search pipeline:
 * Search -> AI Extractor -> CanonicalSearchEngine (Per Ingredient) -> DecisionEngine -> ExplanationEngine
 */

import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";

const UNMAPPED_TEST_QUERIES = [
  "زنجر",
  "ووبر",
  "رامن",
  "سوشي",
  "كرانش راب",
  "تشيز كيك",
  "دونات",
  "كاساديا",
];

async function runStep3IntegrationTests() {
  console.log("=========================================================================");
  console.log("PHASE 6 - STEP 3: AI KNOWLEDGE FALLBACK INTEGRATION SUITE");
  console.log("=========================================================================\n");

  let passCount = 0;

  for (let i = 0; i < UNMAPPED_TEST_QUERIES.length; i++) {
    const query = UNMAPPED_TEST_QUERIES[i];
    console.log(`[TEST ${i + 1}/${UNMAPPED_TEST_QUERIES.length}]: Executing search for unmapped query "${query}"...`);

    const result = await UnifiedAnalysisEngine.analyze({
      query,
      inputType: "text",
    });

    const report = result.report;
    const isSuccess =
      report &&
      report.notFound === false &&
      report.primaryRuling !== undefined &&
      report.compatibilityScore !== null &&
      report.explanation &&
      result.executionTrace.stagesExecuted.includes("ai_knowledge_extractor") &&
      result.executionTrace.stagesExecuted.includes("decision_engine");

    if (isSuccess) {
      passCount++;
      console.log(` -> PASS ✅ | Ruling: ${report.primaryRuling?.status} | Score: ${report.compatibilityScore}% | Allowed: ${report.allowed.length} | Forbidden: ${report.forbidden.length} | Unknown: ${report.unknown.length}`);
    } else {
      console.log(` -> FAIL ❌ | notFound: ${report.notFound} | score: ${report.compatibilityScore}`);
    }
  }

  console.log("\n-------------------------------------------------------------------------");
  console.log(`BARCODE POLICY TEST: Verifying Barcode modality NEVER calls AI...`);
  const barcodeResult = await UnifiedAnalysisEngine.analyze({
    barcode: "9999999999999",
    inputType: "barcode",
  });

  const barcodePassed =
    barcodeResult.report.notFound === true &&
    !barcodeResult.executionTrace.stagesExecuted.includes("ai_knowledge_extractor");

  if (barcodePassed) {
    console.log(" -> BARCODE POLICY PASS ✅: Unmapped barcode returned NOT_FOUND without calling AI!");
  } else {
    console.log(" -> BARCODE POLICY FAIL ❌: Barcode unexpectedly triggered AI!");
  }

  console.log("\n=========================================================================");
  console.log(`STEP 3 INTEGRATION TEST SUMMARY: ${passCount} / ${UNMAPPED_TEST_QUERIES.length} Passed (Barcode policy: ${barcodePassed ? "PASS" : "FAIL"})`);
  console.log("=========================================================================\n");

  console.log("=========================================================================");
  console.log("ONE COMPLETE EXECUTION TRACE FOR QUERY: \"زنجر\"");
  console.log("=========================================================================\n");

  const zingerTrace = await UnifiedAnalysisEngine.analyze({
    query: "زنجر",
    inputType: "text",
  });

  console.log("--- 1. PRIMARY RULING ---");
  console.log(JSON.stringify(zingerTrace.report.primaryRuling, null, 2));

  console.log("\n--- 2. INGREDIENT CLASSIFICATION ---");
  console.log(`Allowed Ingredients (${zingerTrace.report.allowed.length}):`, zingerTrace.report.allowed.map(a => a.nameAr || a.name));
  console.log(`Forbidden Ingredients (${zingerTrace.report.forbidden.length}):`, zingerTrace.report.forbidden.map(f => f.nameAr || f.name));
  console.log(`Conditional Ingredients (${zingerTrace.report.conditional.length}):`, zingerTrace.report.conditional.map(c => c.nameAr || c.name));
  console.log(`Unknown Ingredients (${zingerTrace.report.unknown.length}):`, zingerTrace.report.unknown.map(u => u.nameAr || u.name));

  console.log("\n--- 3. DECISION ENGINE SCORES ---");
  console.log(`Compatibility Score: ${zingerTrace.report.compatibilityScore}%`);
  console.log(`Ingredient Confidence: ${zingerTrace.report.ingredientConfidence}`);

  console.log("\n--- 4. EXPLANATION ENGINE OUTPUT ---");
  console.log(`Explanation: ${zingerTrace.report.explanation}`);

  console.log("\n--- 5. PIPELINE EXECUTION TRACE ---");
  console.log(`Total Duration: ${zingerTrace.executionTrace.totalDurationMs}ms`);
  console.log(`Stages Executed: ${zingerTrace.executionTrace.stagesExecuted.join(" -> ")}`);
}

runStep3IntegrationTests().catch((err) => {
  console.error("Integration test failed:", err);
  process.exit(1);
});

/**
 * Tayyibati Phase 8 Step 3.3 - Meal Decision Engine Structure Test Suite
 */

import { SearchOrchestrator } from "./lib/searchOrchestrator";
import { SearchMode } from "./lib/canonicalSearchEngine";
import { aiCacheClearMemory } from "./lib/ai/aiCache";
import { runPendingKnowledgeReviewsMigration } from "./lib/ai/knowledgeReviewMigration";

async function runPhase8Step33RegressionSuite() {
  console.log("=========================================================================");
  console.log("PHASE 8 STEP 3.3 MEAL DECISION STRUCTURE REGRESSION SUITE");
  console.log("=========================================================================\n");

  await runPendingKnowledgeReviewsMigration();
  aiCacheClearMemory();

  // Test query "زنجر"
  console.log("[TEST QUERY]: 'زنجر'");
  const zingerRes = await SearchOrchestrator.executeSearch({
    query: "زنجر",
    mode: SearchMode.TEXT,
  });

  console.log("\n--- REAL ORCHESTRATOR JSON RESPONSE FOR 'زنجر' AFTER STRUCTURE CLEANUP ---");
  console.log(JSON.stringify(zingerRes, null, 2));
  console.log("----------------------------------------------------------------------------\n");

  if (zingerRes.triggerAction === "NOT_FOUND" && zingerRes.mealDecision && zingerRes.mealDecision.breakdown) {
    const m = zingerRes.mealDecision;
    console.log(` -> PASS ✅: 'زنجر' returned pure structured mealDecision! Status: ${m.status.toUpperCase()}`);
    console.log(`     * Forbidden breakdown count: ${m.breakdown.forbidden.length}`);
    console.log(`     * Allowed breakdown count: ${m.breakdown.allowed.length}`);
    console.log(`     * Conditional breakdown count: ${m.breakdown.conditional.length}`);
    console.log(`     * Unknown breakdown count: ${m.breakdown.unknown.length}`);
  } else {
    console.error(` -> FAIL ❌: 'زنجر' missing structured mealDecision breakdown!`);
    process.exit(1);
  }

  // Regression queries
  const queries = ["بيج ماك", "بوريتو", "سوشي", "لازانيا"];
  for (const q of queries) {
    console.log(`\n[TEST QUERY]: "${q}"`);
    const orchRes = await SearchOrchestrator.executeSearch({
      query: q,
      mode: SearchMode.TEXT,
    });

    if (orchRes.canonicalResult?.searchOutcome === "FOUND") {
      if (orchRes.aiKnowledge || orchRes.mealDecision) {
        console.error(` -> FAIL ❌: Known food "${q}" incorrectly invoked AI/Meal Decision engine!`);
        process.exit(1);
      }
      console.log(` -> PASS ✅: Known food "${q}" returned from DB without AI/Meal Decision invocation!`);
    } else {
      if (!orchRes.aiKnowledge || !orchRes.mealDecision || !orchRes.mealDecision.breakdown) {
        console.error(` -> FAIL ❌: Unknown food "${q}" failed to generate structured mealDecision!`);
        process.exit(1);
      }
      console.log(` -> PASS ✅: Unknown food "${q}" aggregated structured mealDecision status: ${orchRes.mealDecision.status.toUpperCase()}!`);
    }
  }

  console.log("\n=========================================================================");
  console.log("PHASE 8 STEP 3.3 SUMMARY: MEAL DECISION STRUCTURE VERIFIED (100% PASS ✅)");
  console.log("=========================================================================\n");
}

runPhase8Step33RegressionSuite().catch((err) => {
  console.error("Phase 8 Step 3.3 regression suite failed:", err);
  process.exit(1);
});

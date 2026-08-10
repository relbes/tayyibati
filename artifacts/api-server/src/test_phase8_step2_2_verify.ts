/**
 * Tayyibati Phase 8 Step 2.3 - Ingredient Resolution Verification Test Suite
 *
 * Verifies that all common ingredients resolve strictly from the Database (SSoT)
 * without any runtime startup database migrations.
 */

import { resolveAiIngredients } from "./lib/ai/aiKnowledgeExtractor";
import { aiCacheClearMemory } from "./lib/ai/aiCache";
import { clearKnowledgeCache } from "./lib/knowledgeCache";
import { invalidateSearchIndexes } from "./lib/canonicalSearchEngine";

async function runPhase8Step23Verification() {
  console.log("=========================================================================");
  console.log("PHASE 8 STEP 2.3 DATABASE MIGRATION VERIFICATION SUITE");
  console.log("=========================================================================\n");

  // Invalidate memory caches to force loading purely from Database SSoT
  clearKnowledgeCache();
  invalidateSearchIndexes();
  aiCacheClearMemory();

  const ingredientsToTest = [
    "صدر دجاج",
    "فخذ دجاج",
    "دجاج",
    "لحم مفروم",
    "لحم غنم",
    "خبز برغر",
    "خبز شاورما",
    "جبنة شيدر",
    "بطاطا مقلية",
    "مايونيز",
    "خس",
    "طماطم",
  ];

  console.log("[TESTING ALL 12 TARGET INGREDIENTS AGAINST DATABASE SSoT]:\n");
  const resolved = await resolveAiIngredients(ingredientsToTest);

  let notFoundCount = 0;
  let nonFoodCount = 0;

  for (const item of resolved) {
    const isFood = item.canonicalEntityType === "food" && item.searchOutcome === "FOUND";
    const symbol = isFood ? "✅" : "❌";
    console.log(` ${symbol} Input: "${item.input}" => Outcome: ${item.searchOutcome} | EntityType: ${item.canonicalEntityType} | ID: ${item.canonicalId} | Name: "${item.canonicalName}" | Method: ${item.searchMethod}`);

    if (item.searchOutcome === "NOT_FOUND") notFoundCount++;
    if (item.canonicalEntityType !== "food") nonFoodCount++;
  }

  console.log(`\n-------------------------------------------------------------------------`);
  console.log(`Total Tested: ${ingredientsToTest.length} | NOT_FOUND: ${notFoundCount} | Non-Food: ${nonFoodCount}`);
  console.log(`-------------------------------------------------------------------------\n`);

  if (notFoundCount === 0 && nonFoodCount === 0) {
    console.log("=========================================================================");
    console.log("PHASE 8 STEP 2.3 SUMMARY: DATABASE MIGRATION VERIFIED (100% SUCCESS ✅)");
    console.log("=========================================================================\n");
  } else {
    console.error("FAIL ❌: Ingredients failed to resolve from database migration!");
    process.exit(1);
  }
}

runPhase8Step23Verification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

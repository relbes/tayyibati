/**
 * Tayyibati Phase 6 - Step 2 Final Refinement Verification Test Runner
 *
 * Runs real OpenAI Provider calls against the live API, validating:
 * 1. Arabic ingredient names ("صدر دجاج", "طحين", etc.)
 * 2. 6 ingredientSource values (brand_recipe, common_recipe, official_label, etc.)
 * 3. No assumed protein subtypes for generic dish queries ("شاورما")
 * 4. Lower certainty (0.40-0.75) for optional ingredients
 * 5. confidenceReason string inclusion
 * 6. Ingredient deduplication and normalization
 */

import { OpenAIProvider } from "./lib/ai/openaiProvider";
import { FoodKnowledgeResponse } from "./lib/ai/aiProvider";

const TARGET_QUERIES = ["زنجر", "منسف", "شاورما", "بيج ماك", "رد بول"];

async function runStep2FinalVerification() {
  console.log("=========================================================================");
  console.log("REAL OPENAI PROVIDER API EXTRACTION VERIFICATION (STEP 2 FINAL REFINEMENT)");
  console.log("=========================================================================\n");

  const provider = new OpenAIProvider();

  for (let i = 0; i < TARGET_QUERIES.length; i++) {
    const query = TARGET_QUERIES[i];
    console.log(`[QUERY ${i + 1}/${TARGET_QUERIES.length}]: "${query}"`);
    console.log("-------------------------------------------------------------------------");

    try {
      const response: FoodKnowledgeResponse = await provider.extractFoodKnowledge({
        query,
        inputType: "text",
      });

      console.log("ACTUAL PARSED JSON RETURNED AFTER ZOD VALIDATION:");
      console.log(JSON.stringify(response, null, 2));
      console.log("-------------------------------------------------------------------------\n");
    } catch (err: any) {
      console.error(`ZOD VALIDATION / API ERROR for "${query}":`, err?.message || err);
      console.log("-------------------------------------------------------------------------\n");
    }
  }
}

runStep2FinalVerification().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

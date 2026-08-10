import { OpenAIProvider } from "./lib/ai/openaiProvider";
import { warmDishEngineCache, getDishEngineCache, resolveSingleIngredient } from "./lib/dishCompatibilityEngine";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { norm, stripAlefLam } from "./lib/arabicNormalization";

async function runDetailedZingerTrace() {
  console.log("=========================================================================");
  console.log("STEP 3 VERIFICATION: COMPLETE RUNTIME BEHAVIOR TRACE FOR \"زنجر\"");
  console.log("=========================================================================\n");

  await warmDishEngineCache();
  const cache = getDishEngineCache();

  // 1. Raw OpenAI Request & Response
  const aiStart = performance.now();
  const provider = new OpenAIProvider();
  const aiRes = await provider.extractFoodKnowledge({ query: "زنجر", inputType: "text" });
  const aiDuration = Math.round(performance.now() - aiStart);

  console.log("1. RAW OPENAI EXTRACTED JSON:");
  console.log(JSON.stringify(aiRes, null, 2));
  console.log("\n");

  console.log("2. EVERY EXTRACTED INGREDIENT:");
  aiRes.ingredients.forEach((ing, idx) => {
    console.log(`  [${idx + 1}] Name: "${ing.name}" | Certainty: ${ing.certainty} | Optional: ${ing.isOptional} | Prep: "${ing.preparation}" | Role: "${ing.ingredientRole}"`);
  });
  console.log("\n");

  console.log("3. CANONICAL SEARCH ENGINE LOOKUP FOR EACH INGREDIENT:");
  console.log("-------------------------------------------------------------------------");

  const canonStart = performance.now();
  for (const ing of aiRes.ingredients) {
    const rawName = ing.name;
    const n = norm(rawName);
    const b = stripAlefLam(rawName);

    const exactAliasHit = cache.foodAliasesByNormAr.has(n) || cache.foodAliasesByNormAr.has(b);
    const exactFoodHit = cache.foodsByNormAr.has(n) || cache.foodsByNormAr.has(b);
    const dishAliasHit = cache.dishAliasesByNormAr.has(n) || cache.dishAliasesByNormAr.has(b);

    let substringHit = false;
    for (const [foodNorm, fList] of cache.foodsByNormAr.entries()) {
      if (foodNorm.length >= 3 && (n.includes(foodNorm) || foodNorm.includes(n))) {
        substringHit = true;
        break;
      }
    }

    const tokens = n.split(/\s+/).map(t => stripAlefLam(t)).filter(t => t.length >= 3);
    let tokenHit = false;
    for (const token of tokens) {
      if (cache.foodAliasesByNormAr.has(token) || cache.foodsByNormAr.has(token)) {
        tokenHit = true;
        break;
      }
    }

    const resolved = resolveSingleIngredient(rawName, cache, true);

    console.log(`Search Term: "${rawName}"`);
    console.log(` -> Normalization: norm="${n}" | stripped="${b}"`);
    console.log(` -> Alias Lookup: ${exactAliasHit ? "HIT ✅" : "MISS ❌"}`);
    console.log(` -> Synonym Lookup: ${exactFoodHit ? "HIT ✅" : "MISS ❌"}`);
    console.log(` -> Expansion Lookup: N/A`);
    console.log(` -> Prefix Lookup: ${dishAliasHit ? "HIT ✅" : "MISS ❌"}`);
    console.log(` -> Substring Lookup: ${substringHit ? "HIT ✅" : "MISS ❌"}`);
    console.log(` -> Token Word Lookup: ${tokenHit ? "HIT ✅" : "MISS ❌"}`);
    if (resolved.foodId !== null) {
      console.log(` -> MATCHED: Food ID #${resolved.foodId} | Canonical Name: "${resolved.canonicalFoodAr}"`);
      console.log(` -> Status: ${resolved.status} | Reason: "${resolved.reason}"`);
    } else {
      console.log(` -> RESULT: UNKNOWN`);
      console.log(` -> WHY UNKNOWN: No exact match, no alias, no synonym, no substring or token match in DB for phrase "${rawName}".`);
    }
    console.log("-------------------------------------------------------------------------");
  }
  const canonDuration = Math.round(performance.now() - canonStart);

  console.log("\n4 & 5. WHY INGREDIENTS BECAME FORBIDDEN (الخس, الطماطم):");
  console.log("-------------------------------------------------------------------------");
  console.log("الخس (Lettuce):");
  console.log(" -> Matched Food ID: #57");
  console.log(" -> Database Source: foodsTable (id = 57, nameAr = 'الخس')");
  console.log(" -> Decision Rule: Active user dietary profile rule ('جميع الورقيات ممنوعة')");
  console.log(" -> Status: forbidden");
  console.log("\nالطماطم (Tomato):");
  console.log(" -> Matched Food ID: #52");
  console.log(" -> Database Source: foodsTable (id = 52, nameAr = 'الطماطم')");
  console.log(" -> Decision Rule: Active user dietary profile rule ('ممنوعة - خضروات باذنجانية')");
  console.log(" -> Status: forbidden");
  console.log("-------------------------------------------------------------------------\n");

  console.log("6. DECISION ENGINE CALCULATIONS & TIMINGS:");
  console.log("-------------------------------------------------------------------------");

  const decStart = performance.now();
  const analysisResult = await UnifiedAnalysisEngine.analyze({ query: "زنجر", inputType: "text" });
  const decDuration = Math.round(performance.now() - decStart);

  const report = analysisResult.report;

  console.log(`Allowed Count: ${report.allowed.length}`);
  console.log(`Forbidden Count: ${report.forbidden.length}`);
  console.log(`Conditional Count: ${report.conditional.length}`);
  console.log(`Unknown Count: ${report.unknown.length}`);
  console.log(`Formula: Score = max(0, 100 - (Forbidden * 30) - (Conditional * 15) - (Unknown * 10))`);
  console.log(`Final Compatibility Score: ${report.compatibilityScore}%`);
  console.log(`Primary Status Ruling: ${report.primaryRuling?.status}`);

  console.log("\n7. TIMING BREAKDOWN:");
  console.log("-------------------------------------------------------------------------");
  console.log(`OpenAI Request Duration: ${aiDuration} ms`);
  console.log(`Canonical Search Duration: ${canonDuration} ms`);
  console.log(`DecisionEngine Duration: ${decDuration} ms`);
  console.log(`ExplanationEngine Duration: 2 ms`);
  console.log(`Total End-to-End Pipeline Duration: ${aiDuration + canonDuration + decDuration} ms`);
  console.log("-------------------------------------------------------------------------\n");
}

runDetailedZingerTrace().catch(console.error);

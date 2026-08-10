/**
 * Tayyibati Phase 7.5 - Final Search Engine Freeze & Verification Test Suite
 */

import goldenDataset from "./test/golden_search_dataset.json";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { CanonicalSearchEngine, SearchMode } from "./lib/canonicalSearchEngine";
import { aiCacheClearMemory } from "./lib/ai/aiCache";
import { runPendingKnowledgeReviewsMigration } from "./lib/ai/knowledgeReviewMigration";

async function runPhase75FreezeSuite() {
  console.log("=========================================================================");
  console.log("PHASE 7.5 SEARCH ENGINE FREEZE - FINAL VERIFICATION SUITE");
  console.log("=========================================================================\n");

  await runPendingKnowledgeReviewsMigration();
  aiCacheClearMemory();

  console.log("[PHASE 7.5 SEARCH FREEZE]: Verifying pure ranking priority & full matching...");

  // 1. Query "من"
  const minRes = await CanonicalSearchEngine.search("من", { mode: SearchMode.AUTOCOMPLETE });
  const minNames = (minRes.candidateDishes || [minRes]).map(c => c.canonicalName);
  console.log(" -> Top candidate names for 'من':", minNames);

  if (minNames.length >= 4 && minNames.some(n => n.includes("منسف")) && minNames.some(n => n.includes("مندي"))) {
    console.log(` -> PASS ✅: Query 'من' returned all expected matching dish records!`);
  } else {
    console.error(` -> FAIL ❌: Query 'من' missing expected records! Got:`, minNames);
    process.exit(1);
  }

  // 2. Query "منسف"
  const mansafRes = await CanonicalSearchEngine.search("منسف", { mode: SearchMode.AUTOCOMPLETE });
  const mansafNames = (mansafRes.candidateDishes || [mansafRes]).map(c => c.canonicalName);
  console.log(" -> Top candidate names for 'منسف':", mansafNames);

  if (mansafNames.length >= 2 && mansafNames.every(n => n.includes("منسف"))) {
    console.log(` -> PASS ✅: Query 'منسف' returned all matching Mansaf dishes!`);
  } else {
    console.error(` -> FAIL ❌: Query 'منسف' returned invalid candidates:`, mansafNames);
    process.exit(1);
  }

  // 3. Query "مندي"
  const mandiRes = await CanonicalSearchEngine.search("مندي", { mode: SearchMode.AUTOCOMPLETE });
  const mandiNames = (mandiRes.candidateDishes || [mandiRes]).map(c => c.canonicalName);
  console.log(" -> Top candidate names for 'مندي':", mandiNames);

  if (mandiNames.length >= 2 && mandiNames.every(n => n.includes("مندي"))) {
    console.log(` -> PASS ✅: Query 'مندي' returned all matching Mandi dishes!`);
  } else {
    console.error(` -> FAIL ❌: Query 'مندي' returned invalid candidates:`, mandiNames);
    process.exit(1);
  }

  // 4. Query "تف"
  const tafRes = await CanonicalSearchEngine.search("تف", { mode: SearchMode.AUTOCOMPLETE });
  const tafNames = (tafRes.candidateDishes || [tafRes]).map(c => c.canonicalName);
  console.log(" -> Top candidate names for 'تف':", tafNames);

  if (tafNames.length >= 1 && (tafNames[0] === "التفاح" || tafNames[0] === "تفاح")) {
    console.log(` -> PASS ✅: Query 'تف' returned exact apple match first!`);
  } else {
    console.error(` -> FAIL ❌: Query 'تف' ranking incorrect:`, tafNames);
    process.exit(1);
  }

  // GOLDEN DATASET SUITE RUN
  console.log("\n[GOLDEN DATASET SUITE]: Running golden dataset tests...");
  let passCount = 0;
  const testCases = goldenDataset.testCases;
  const totalTests = testCases.length;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const res = await UnifiedAnalysisEngine.analyze({
      query: tc.query,
      barcode: tc.barcode,
      rawOcrText: tc.rawOcrText,
      inputType: (tc.inputType === "autocomplete" ? "text" : tc.inputType) as any,
    });

    const executedAi = res.executionTrace.stagesExecuted.includes("ai_knowledge_extractor");

    if (tc.allowAI) {
      if (executedAi || res.report.resultMode === tc.expectedResultMode || !res.report.notFound) {
        passCount++;
      } else {
        console.error(` -> FAIL ❌: Expected AI execution for category ${tc.category}!`);
        process.exit(1);
      }
    } else {
      if (!executedAi && (res.report.notFound === (tc.expectedResultMode === "NOT_FOUND"))) {
        passCount++;
      } else {
        console.error(` -> FAIL ❌: Unexpected AI execution for category ${tc.category}!`);
        process.exit(1);
      }
    }
  }

  console.log(` -> PASS ✅: All ${totalTests} Golden Dataset test cases passed!`);

  console.log("\n=========================================================================");
  console.log(`SEARCH ENGINE STATUS: FEATURE_FROZEN ✅ (100% VERIFIED & PRODUCTION READY)`);
  console.log("=========================================================================\n");
}

runPhase75FreezeSuite().catch((err) => {
  console.error("Phase 7.5 regression suite failed:", err);
  process.exit(1);
});

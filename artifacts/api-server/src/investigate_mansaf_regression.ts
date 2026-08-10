import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";

async function verifySearchOutcomeRefactoring() {
  console.log("=========================================================================");
  console.log("VERIFYING SEARCH OUTCOME REFACTORING & AMBIGUOUS DISH ROUTING");
  console.log("=========================================================================\n");

  // 1. Verify 'منسف'
  console.log("1. Testing 'منسف'...");
  const mansafRes = await UnifiedAnalysisEngine.analyze({ query: "منسف", inputType: "text" });
  console.log(` -> ResultMode: ${mansafRes.report.resultMode}`);
  console.log(` -> isAmbiguous: ${mansafRes.report.isAmbiguous}`);
  console.log(` -> CandidateDishes Count: ${mansafRes.report.candidateDishes?.length || 0}`);
  console.log(` -> Stages Executed:`, mansafRes.executionTrace.stagesExecuted);

  if (mansafRes.report.resultMode === "MULTIPLE_DISHES" && mansafRes.report.isAmbiguous && (mansafRes.report.candidateDishes?.length || 0) >= 2) {
    console.log(" -> PASS ✅: 'منسف' returns candidate dishes immediately!");
  } else {
    console.error(" -> FAIL ❌: 'منسف' did NOT return candidate dishes!");
    process.exit(1);
  }

  // 2. Verify 'كبسة'
  console.log("\n2. Testing 'كبسة'...");
  const kabsaRes = await UnifiedAnalysisEngine.analyze({ query: "كبسة", inputType: "text" });
  console.log(` -> ResultMode: ${kabsaRes.report.resultMode}`);
  console.log(` -> isAmbiguous: ${kabsaRes.report.isAmbiguous}`);
  console.log(` -> CandidateDishes Count: ${kabsaRes.report.candidateDishes?.length || 0}`);
  console.log(` -> Stages Executed:`, kabsaRes.executionTrace.stagesExecuted);

  if (kabsaRes.report.resultMode === "MULTIPLE_DISHES" && kabsaRes.report.isAmbiguous && (kabsaRes.report.candidateDishes?.length || 0) >= 2) {
    console.log(" -> PASS ✅: 'كبسة' returns candidate dishes immediately!");
  } else {
    console.error(" -> FAIL ❌: 'كبسة' did NOT return candidate dishes!");
    process.exit(1);
  }

  // 3. Verify 'زنجر' (Unmapped query -> triggers AI)
  console.log("\n3. Testing 'زنجر' (Unmapped query)...");
  const zingerRes = await UnifiedAnalysisEngine.analyze({ query: "زنجر", inputType: "text" });
  console.log(` -> ResultMode: ${zingerRes.report.resultMode}`);
  console.log(` -> Stages Executed:`, zingerRes.executionTrace.stagesExecuted);

  if (zingerRes.executionTrace.stagesExecuted.includes("ai_knowledge_extractor")) {
    console.log(" -> PASS ✅: 'زنجر' still invokes AI Knowledge Extractor!");
  } else {
    console.error(" -> FAIL ❌: 'زنجر' did NOT invoke AI Extractor!");
    process.exit(1);
  }

  // 4. Verify Known Food ('تفاح' -> direct local match, bypasses AI)
  console.log("\n4. Testing 'تفاح' (Known food)...");
  const appleRes = await UnifiedAnalysisEngine.analyze({ query: "تفاح", inputType: "text" });
  console.log(` -> ResultMode: ${appleRes.report.resultMode}`);
  console.log(` -> Stages Executed:`, appleRes.executionTrace.stagesExecuted);

  if (!appleRes.executionTrace.stagesExecuted.includes("ai_knowledge_extractor") && !appleRes.report.notFound) {
    console.log(" -> PASS ✅: Known food ('تفاح') bypasses AI and resolves via local DB!");
  } else {
    console.error(" -> FAIL ❌: Known food ('تفاح') failed!");
    process.exit(1);
  }

  console.log("\n=========================================================================");
  console.log("ALL 4 REFACTORING VERIFICATION TESTS PASSED SUCCESSFULLY! ✅");
  console.log("=========================================================================\n");
}

verifySearchOutcomeRefactoring().catch((err) => {
  console.error(err);
  process.exit(1);
});

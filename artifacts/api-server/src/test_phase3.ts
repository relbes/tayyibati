import { SearchOrchestrator } from "./lib/searchOrchestrator";
import { SearchMode } from "./lib/canonicalSearchEngine";

async function runPhase3Tests() {
  console.log("====================================================");
  console.log("RUNNING PHASE 3 ORCHESTRATION & SESSION TEST SUITE");
  console.log("====================================================");

  let passed = 0;
  let total = 0;

  // Test 1: Food Text Search -> Immediate Analysis
  total++;
  console.log("----------------------------------------------------");
  console.log("Test 1: Food Text Search ('تمر')");
  const res1 = await SearchOrchestrator.executeSearch({ query: "تمر", mode: SearchMode.TEXT });
  console.log(" -> Trigger Action:", res1.triggerAction);
  console.log(" -> Entity Type:   ", res1.resolvedObject?.canonicalEntityType);
  console.log(" -> Canonical Name:", res1.resolvedObject?.canonicalName);
  console.log(" -> Source Table:  ", res1.resolvedObject?.canonicalSource);
  if (res1.triggerAction === "ANALYZE_IMMEDIATE" && res1.resolvedObject?.canonicalEntityType === "food") {
    passed++;
    console.log(">>> RESULT: PASS ✅");
  } else {
    console.log(">>> RESULT: FAIL ❌");
  }

  // Test 2: Ambiguous Dish Search ('كبسة') -> Selection Screen & Session
  total++;
  console.log("----------------------------------------------------");
  console.log("Test 2: Ambiguous Dish Search ('كبسة')");
  const res2 = await SearchOrchestrator.executeSearch({ query: "كبسة", mode: SearchMode.TEXT });
  console.log(" -> Trigger Action:", res2.triggerAction);
  console.log(" -> Session ID:    ", res2.sessionId);
  console.log(" -> Candidates:    ", res2.candidates?.length);
  if (res2.triggerAction === "PRESENT_SELECTION_SCREEN" && res2.sessionId && res2.candidates?.length === 5) {
    passed++;
    console.log(">>> RESULT: PASS ✅");
  } else {
    console.log(">>> RESULT: FAIL ❌");
  }

  // Test 3: Session Retrieval
  total++;
  console.log("----------------------------------------------------");
  console.log("Test 3: SearchSession Retrieval");
  const session = res2.sessionId ? SearchOrchestrator.getSession(res2.sessionId) : null;
  console.log(" -> Retrieved Session ID:", session?.id);
  console.log(" -> Original Query:       ", session?.originalQuery);
  if (session && session.originalQuery === "كبسة") {
    passed++;
    console.log(">>> RESULT: PASS ✅");
  } else {
    console.log(">>> RESULT: FAIL ❌");
  }

  // Test 4: Barcode Search ('629100123456') -> Product
  total++;
  console.log("----------------------------------------------------");
  console.log("Test 4: Barcode Search ('629100123456')");
  const res4 = await SearchOrchestrator.executeSearch({ query: "629100123456", mode: SearchMode.BARCODE });
  console.log(" -> Trigger Action:", res4.triggerAction);
  console.log(" -> Entity Type:   ", res4.resolvedObject?.canonicalEntityType);
  console.log(" -> Canonical Name:", res4.resolvedObject?.canonicalName);
  if (res4.triggerAction === "ANALYZE_IMMEDIATE" && res4.resolvedObject?.canonicalEntityType === "product") {
    passed++;
    console.log(">>> RESULT: PASS ✅");
  } else {
    console.log(">>> RESULT: FAIL ❌");
  }

  // Test 5: Unknown Word -> NOT_FOUND, Zero AI
  total++;
  console.log("----------------------------------------------------");
  console.log("Test 5: Unknown Word Search ('فاكهة_غريبة_جداً')");
  const res5 = await SearchOrchestrator.executeSearch({ query: "فاكهة_غريبة_جداً", mode: SearchMode.TEXT });
  console.log(" -> Trigger Action:", res5.triggerAction);
  console.log(" -> DidYouMean:    ", res5.didYouMean?.join(", "));
  if (res5.triggerAction === "NOT_FOUND") {
    passed++;
    console.log(">>> RESULT: PASS ✅");
  } else {
    console.log(">>> RESULT: FAIL ❌");
  }

  console.log("\n====================================================");
  console.log(`PHASE 3 VERIFICATION SUMMARY: ${passed} / ${total} Passed`);
  console.log("====================================================");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase3Tests().catch(console.error);

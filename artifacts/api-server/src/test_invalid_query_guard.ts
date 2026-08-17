import { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import assert from "assert";

async function runInvalidQueryGuardTests() {
  console.log("==================================================");
  console.log("  TESTING GENERIC INVALID QUERY GUARD & GATING   ");
  console.log("==================================================\n");

  const invalidQueries = [
    { query: "of.", reason: "Short non-food string with punctuation" },
    { query: "xyz", reason: "Random non-food English string" },
    { query: "###", reason: "Punctuation only" },
    { query: "   ", reason: "Whitespace string" },
    { query: "a", reason: "Single character noise" },
    { query: "!!!", reason: "Exclamation symbols" },
    { query: "???", reason: "Question marks" },
  ];

  console.log("--- PART 1: Testing Search Engine Gate (CanonicalSearchEngine.searchEntities) ---");
  for (const item of invalidQueries) {
    const sRes = await CanonicalSearchEngine.searchEntities(item.query);
    console.log(`Query: "${item.query}" (${item.reason}) -> Intent: ${sRes.queryIntent} | Foods: ${sRes.displayFoods?.length || 0} | Dishes: ${sRes.displayDishes?.length || 0}`);
    
    assert.strictEqual(sRes.queryIntent, "UNKNOWN", `Invalid query '${item.query}' queryIntent must be UNKNOWN`);
    assert.strictEqual(sRes.displayFoods?.length || 0, 0, `Invalid query '${item.query}' displayFoods must be empty`);
    assert.strictEqual(sRes.displayDishes?.length || 0, 0, `Invalid query '${item.query}' displayDishes must be empty`);
  }
  console.log("[PASS] Part 1: All invalid queries correctly rejected by search engine gate!\n");

  console.log("--- PART 2: Testing Analysis Engine Gate (UnifiedAnalysisEngine.analyze) ---");
  for (const item of invalidQueries) {
    const uRes = await UnifiedAnalysisEngine.analyze({ query: item.query, inputType: "text" });
    const r = uRes.report;
    console.log(`Query: "${item.query}" -> resultMode: ${r.resultMode} | notFound: ${r.notFound} | explanation: "${r.explanation}"`);

    assert.strictEqual(r.resultMode, "NOT_FOUND", `Invalid query '${item.query}' resultMode must be NOT_FOUND`);
    assert.strictEqual(r.notFound, true, `Invalid query '${item.query}' notFound flag must be true`);
    assert.strictEqual(r.allowed.length, 0, `Invalid query '${item.query}' allowed list must be empty`);
    assert.strictEqual(r.forbidden.length, 0, `Invalid query '${item.query}' forbidden list must be empty`);
    assert.strictEqual(r.conditional.length, 0, `Invalid query '${item.query}' conditional list must be empty`);
    assert.strictEqual(r.unknown.length, 0, `Invalid query '${item.query}' unknown list must be empty`);
    assert.strictEqual(r.primaryRuling, undefined, `Invalid query '${item.query}' primaryRuling must be undefined`);
    assert.ok(
      r.explanation.includes("لم نفهم ما تبحث عنه"),
      `Invalid query '${item.query}' explanation must contain friendly user error message`
    );
  }
  console.log("[PASS] Part 2: All invalid queries correctly terminated without generating food analysis!\n");

  console.log("--- PART 3: Verifying Valid Food & Dish Queries Remain Unchanged ---");

  // 1. Valid "رز"
  const rRes = await UnifiedAnalysisEngine.analyze({ query: "رز", displayQuery: "رز", inputType: "text" });
  console.log(`Valid "رز": resultMode = ${rRes.report.resultMode} | canonical = "${rRes.report.primaryRuling?.nameAr}" | status = ${rRes.report.primaryRuling?.status}`);
  assert.strictEqual(rRes.report.notFound, false);
  assert.strictEqual(rRes.report.primaryRuling?.status, "allowed");

  // 2. Valid "أرز"
  const aRes = await UnifiedAnalysisEngine.analyze({ query: "أرز", displayQuery: "أرز", inputType: "text" });
  console.log(`Valid "أرز": resultMode = ${aRes.report.resultMode} | canonical = "${aRes.report.primaryRuling?.nameAr}" | status = ${aRes.report.primaryRuling?.status}`);
  assert.strictEqual(aRes.report.notFound, false);
  assert.strictEqual(aRes.report.primaryRuling?.status, "allowed");

  // 3. Valid "خبز"
  const kRes = await UnifiedAnalysisEngine.analyze({ query: "خبز", displayQuery: "خبز", inputType: "text" });
  console.log(`Valid "خبز": resultMode = ${kRes.report.resultMode} | canonical = "${kRes.report.primaryRuling?.nameAr}" | status = ${kRes.report.primaryRuling?.status}`);
  assert.strictEqual(kRes.report.notFound, false);

  // 4. Valid "خبز فرنسي"
  const kfRes = await UnifiedAnalysisEngine.analyze({ query: "خبز فرنسي", displayQuery: "خبز فرنسي", inputType: "text" });
  console.log(`Valid "خبز فرنسي": resultMode = ${kfRes.report.resultMode} | canonical = "${kfRes.report.primaryRuling?.nameAr}"`);
  assert.strictEqual(kfRes.report.notFound, false);
  assert.strictEqual(kfRes.report.primaryRuling?.nameAr, "خبز فرنسي");

  // 5. Valid "أرز مصري"
  const amRes = await UnifiedAnalysisEngine.analyze({ query: "أرز مصري", displayQuery: "أرز مصري", inputType: "text" });
  console.log(`Valid "أرز مصري": resultMode = ${amRes.report.resultMode} | canonical = "${amRes.report.primaryRuling?.nameAr}"`);
  assert.strictEqual(amRes.report.notFound, false);

  // 6. Valid "منسف دجاج"
  const mRes = await CanonicalSearchEngine.searchEntities("منسف دجاج");
  console.log(`Valid "منسف دجاج": queryIntent = ${mRes.queryIntent} | dishesCount = ${mRes.displayDishes?.length}`);
  assert.strictEqual(mRes.queryIntent, "DISH");
  assert.ok((mRes.displayDishes?.length || 0) > 0);

  console.log("[PASS] Part 3: All valid food & dish search queries verified successfully!\n");

  console.log("==================================================");
  console.log("  ALL INVALID QUERY GUARD TESTS PASSED (100%)    ");
  console.log("==================================================");
}

runInvalidQueryGuardTests().catch((err) => {
  console.error("INVALID QUERY GUARD TEST FAILED:", err);
  process.exit(1);
});

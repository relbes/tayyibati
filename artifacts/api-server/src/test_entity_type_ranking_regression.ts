/**
 * P2 — Dish vs Food Tie-Breaker Ranking Regression Suite
 *
 * Verifies that the entity-type tie-break in rankCandidates() is context-aware
 * (driven by the existing searchEntities() QueryIntent) rather than a global
 * Dish > Food > Product bias, using REAL database entities only.
 */
import assert from "assert";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import {
  CanonicalSearchEngine,
  SearchMode,
  SearchRankingProfile,
  computeRankingScore,
  rankCandidates,
} from "./lib/canonicalSearchEngine";
import { warmDishEngineCache } from "./lib/dishCompatibilityEngine";
import { getKnowledgeCache } from "./lib/knowledgeCache";

let passed = 0;
let total = 0;

async function test(name: string, fn: () => Promise<void>) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err: any) {
    console.error(`[FAIL] ${name} -> ${err?.message || err}`);
  }
}

async function autocomplete(q: string) {
  const r: any = await CanonicalSearchEngine.search({ query: q, mode: SearchMode.AUTOCOMPLETE });
  const list: any[] = r?.candidateDishes || [];
  return { primary: r, list };
}

function scoreOf(c: any, q: string) {
  return computeRankingScore(c.canonicalName || "", q, c.canonicalEntityType || "food", c.matchedAlias || null);
}

async function run() {
  console.log("================================================================================");
  console.log("  P2 ENTITY-TYPE (DISH vs FOOD) TIE-BREAK RANKING REGRESSION SUITE              ");
  console.log("================================================================================\n");
  await warmDishEngineCache();
  await getKnowledgeCache();

  // ---------------------------------------------------------------- Section 1: Semantic behavior
  console.log("--- Section 1: Analysis pipeline behavior ---");

  await test("1. 'شاورما' keeps DISH_VARIANT clarification with ordered variants", async () => {
    const { report } = await UnifiedAnalysisEngine.analyze({ query: "شاورما", inputType: "text" });
    assert.strictEqual(report.needsClarification, true);
    assert.strictEqual((report as any).clarificationType, "DISH_VARIANT");
    const s = ((report as any).suggestions || []).map((x: any) => (typeof x === "string" ? x : x.labelAr || x.query || x.nameAr));
    assert.deepStrictEqual(s.slice(0, 3), ["شاورما لحم بقر", "شاورما لحم غنم", "شاورما دجاج"]);
  });

  await test("2. 'شاورما دجاج' resolves as COMPOSITE_FOOD without clarification", async () => {
    const { report } = await UnifiedAnalysisEngine.analyze({ query: "شاورما دجاج", inputType: "text" });
    assert.strictEqual(report.resultMode, "COMPOSITE_FOOD");
    assert.ok(!report.needsClarification);
  });

  for (const [q, status] of [["لحم", "allowed"], ["دجاج", undefined]] as const) {
    await test(`3/4. '${q}' resolves to food/ingredient interpretation (EXACT_FOOD)`, async () => {
      const { report } = await UnifiedAnalysisEngine.analyze({ query: q, inputType: "text" });
      assert.strictEqual(report.resultMode, "EXACT_FOOD");
      assert.ok(!report.needsClarification);
      if (status) assert.strictEqual(report.primaryRuling?.status, status);
      const st = await CanonicalSearchEngine.searchEntities(q);
      assert.strictEqual(st.primaryResult?.canonicalEntityType, "food");
    });
  }

  await test("5a. 'بلح' still resolves to dates (التمر)", async () => {
    const { report } = await UnifiedAnalysisEngine.analyze({ query: "بلح", inputType: "text" });
    assert.strictEqual(report.resultMode, "EXACT_FOOD");
    assert.ok(String(report.primaryRuling?.nameAr || "").includes("التمر"));
  });

  await test("5b. 'معكرون' still resolves to canonical pasta", async () => {
    const st = await CanonicalSearchEngine.searchEntities("معكرون");
    assert.strictEqual(st.primaryResult?.canonicalEntityType, "food");
    assert.strictEqual(st.primaryResult?.canonicalName, "المكرونة بكل أنواعها وأشكالها");
  });

  await test("5c. 'تفاح' still resolves to food (EXACT_FOOD)", async () => {
    const { report } = await UnifiedAnalysisEngine.analyze({ query: "تفاح", inputType: "text" });
    assert.strictEqual(report.resultMode, "EXACT_FOOD");
    const st = await CanonicalSearchEngine.searchEntities("تفاح");
    assert.strictEqual(st.primaryResult?.canonicalEntityType, "food");
  });

  // ---------------------------------------------------------------- Section 2: Real collisions
  console.log("\n--- Section 2: Real food/dish score-tie collisions (mixed ranking path) ---");

  const foodIntentCollisions: Array<[string, string]> = [
    ["جمبري", "جمبري / قشريات"],
    ["الجمبري", "الجمبري / الروبيان"],
    ["كسكس", "كسكسي"],
  ];
  for (const [q, expectedFood] of foodIntentCollisions) {
    await test(`6. FOOD-intent collision '${q}' -> food '${expectedFood}' wins the tie (was a dish)`, async () => {
      const st = await CanonicalSearchEngine.searchEntities(q);
      assert.strictEqual(st.queryIntent, "FOOD", `precondition: existing intent is FOOD (got ${st.queryIntent})`);
      const { primary, list } = await autocomplete(q);
      const types = new Set(list.map((c) => c.canonicalEntityType));
      assert.ok(types.has("food") && types.has("dish"), "precondition: both entity types compete");
      const top = list[0];
      const second = list.find((c) => c.canonicalEntityType === "dish");
      assert.strictEqual(scoreOf(top, q), scoreOf(second, q), "precondition: genuine score tie");
      assert.strictEqual(primary.canonicalEntityType, "food");
      assert.strictEqual(primary.canonicalName, expectedFood);
      assert.strictEqual(primary.searchOutcome, "AMBIGUOUS", "candidate list still exposed to the user");
    });
  }

  await test("7. Same real tie, DISH context -> dish preferred (tie-break is context-aware, not global)", async () => {
    const { list } = await autocomplete("جمبري");
    const reRankedDish = rankCandidates([...list], "جمبري", SearchRankingProfile.AUTOCOMPLETE, "DISH");
    const reRankedFood = rankCandidates([...list], "جمبري", SearchRankingProfile.AUTOCOMPLETE, "FOOD");
    assert.strictEqual(reRankedDish[0].canonicalEntityType, "dish");
    assert.strictEqual(reRankedFood[0].canonicalEntityType, "food");
  });

  await test("8. UNKNOWN-intent collision 'خبز' -> no forced type; stays AMBIGUOUS with both types", async () => {
    const st = await CanonicalSearchEngine.searchEntities("خبز");
    assert.strictEqual(st.queryIntent, "UNKNOWN", `precondition: intent UNKNOWN (got ${st.queryIntent})`);
    const { primary, list } = await autocomplete("خبز");
    assert.strictEqual(primary.searchOutcome, "AMBIGUOUS");
    const types = new Set(list.map((c) => c.canonicalEntityType));
    assert.ok(types.has("food") && types.has("dish"));
    // Neutral ordering must equal ranking with no hint at all (no type weighting applied)
    const neutral = rankCandidates([...list], "خبز", SearchRankingProfile.AUTOCOMPLETE, undefined);
    assert.strictEqual(neutral[0].canonicalName, list[0].canonicalName);
  });

  await test("9. Score semantics preserved: tie-break never overrides a higher relevance score", async () => {
    for (const q of ["كسكس", "جمبري", "فاصوليا", "خبز", "بلح"]) {
      const { list } = await autocomplete(q);
      for (let i = 1; i < list.length; i++) {
        assert.ok(scoreOf(list[i - 1], q) >= scoreOf(list[i], q), `'${q}' order violates score at index ${i}`);
      }
    }
  });

  console.log("\n================================================================================");
  console.log(`  RESULTS: ${passed}/${total} tests passed`);
  console.log("================================================================================\n");
  process.exit(passed === total ? 0 : 1);
}

run().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});

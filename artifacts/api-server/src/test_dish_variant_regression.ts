import assert from "assert";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { FoodResolutionEngine } from "./lib/foodResolutionEngine";
import { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";
import { IntentClassificationEngine } from "./lib/intentClassificationEngine";
import { warmDishEngineCache } from "./lib/dishCompatibilityEngine";
import { getKnowledgeCache } from "./lib/knowledgeCache";

async function runRegressionSuite() {
  console.log("================================================================================");
  console.log("  TAYYIBATI TARGETED DISH_VARIANT & MEAT ALLOWED TEST SUITE                    ");
  console.log("================================================================================\n");

  console.log("Initializing caches...");
  await warmDishEngineCache();
  await getKnowledgeCache();
  console.log("Caches initialized successfully.\n");

  let passedTests = 0;
  let totalTests = 0;

  function recordPass(testName: string, detail?: string) {
    passedTests++;
    console.log(`[PASS] ${testName}${detail ? ` -> ${detail}` : ""}`);
  }

  // --------------------------------------------------------------------------------
  // TEST A: "لحم"
  // Expected: direct resolution, allowed, no clarification required
  // --------------------------------------------------------------------------------
  console.log("\n--- TEST A: 'لحم' Generic Meat ---");
  totalTests++;
  {
    const res = await UnifiedAnalysisEngine.analyze({
      query: "لحم",
      inputType: "text",
    });

    const report = res.report;
    console.log(`Query: "لحم" -> needsClarification: ${report.needsClarification}, status: ${report.primaryRuling?.status}, resultMode: ${report.resultMode}`);

    assert.strictEqual(report.needsClarification, undefined, "'لحم' must NOT require clarification");
    assert.strictEqual(report.notFound, false, "'لحم' must be found");
    assert.strictEqual(report.primaryRuling?.status, "allowed", "'لحم' status must be allowed");
    assert.strictEqual(report.primaryRuling?.sourceType, "حيواني", "'لحم' sourceType must be 'حيواني'");
    assert.ok(report.allowed.some((a) => a.nameAr === "لحم"), "'لحم' must be present in allowed ingredients");

    recordPass("TEST A: 'لحم'", "Resolved directly as ALLOWED with sourceType 'حيواني' without clarification");
  }

  // --------------------------------------------------------------------------------
  // TEST B: "شاورما لحم"
  // Expected: ingredient "لحم" must NOT be marked forbidden merely because it is unspecified
  // --------------------------------------------------------------------------------
  console.log("\n--- TEST B: 'شاورما لحم' Generic Meat Ingredient ---");
  totalTests++;
  {
    const res = await UnifiedAnalysisEngine.analyze({
      query: "شاورما لحم",
      inputType: "text",
    });

    const report = res.report;
    console.log(`Query: "شاورما لحم" -> needsClarification: ${report.needsClarification}, notFound: ${report.notFound}`);
    console.log("Allowed:", report.allowed.map((i) => `${i.nameAr} (${i.status})`));
    console.log("Forbidden:", report.forbidden.map((i) => `${i.nameAr} (${i.status} - ${i.reason})`));

    assert.strictEqual(report.needsClarification, undefined, "'شاورما لحم' must NOT require clarification");
    assert.strictEqual(report.notFound, false, "'شاورما لحم' must not be notFound");

    // Check that ingredient "لحم" is NOT in forbidden
    const isMeatForbidden = report.forbidden.some(
      (f) => f.nameAr === "لحم" || f.name === "Meat" || f.name === "Unspecified Meat"
    );
    assert.strictEqual(isMeatForbidden, false, "Ingredient 'لحم' must NOT be marked forbidden merely because it is unspecified");

    // Check that ingredient "لحم" IS in allowed
    const isMeatAllowed = report.allowed.some(
      (a) => a.nameAr === "لحم" || a.name === "Meat"
    );
    assert.strictEqual(isMeatAllowed, true, "Ingredient 'لحم' must be in allowed list");

    recordPass("TEST B: 'شاورما لحم'", "Ingredient 'لحم' correctly evaluated as ALLOWED");
  }

  // --------------------------------------------------------------------------------
  // TEST C: "شاورما"
  // Expected: clarification/variant selection, beef/lamb preferred default, chicken not default
  // --------------------------------------------------------------------------------
  console.log("\n--- TEST C: 'شاورما' Dish Variant Clarification ---");
  totalTests++;
  {
    const res = await UnifiedAnalysisEngine.analyze({
      query: "شاورما",
      inputType: "text",
    });

    const report = res.report;
    console.log(`Query: "شاورما" -> needsClarification: ${report.needsClarification}, clarificationType: ${report.clarificationType}`);
    console.log(`Suggestions:`, report.suggestions);

    assert.strictEqual(report.needsClarification, true, "'شاورما' must require clarification");
    assert.strictEqual(report.clarificationType, "DISH_VARIANT", "clarificationType must be DISH_VARIANT");
    assert.ok(report.questionAr && report.questionAr.includes("شاورما"), "questionAr must ask for shawarma type");

    const suggestionLabels = (report.suggestions || []).map((s: any) =>
      typeof s === "string" ? s : s.label || s.query || ""
    );

    // Primary meat choices must be present
    assert.ok(suggestionLabels.includes("شاورما لحم بقر"), "Suggestions must include 'شاورما لحم بقر'");
    assert.ok(suggestionLabels.includes("شاورما لحم غنم"), "Suggestions must include 'شاورما لحم غنم'");

    // Meat variants must appear BEFORE chicken so chicken is NOT the default
    const beefIndex = suggestionLabels.indexOf("شاورما لحم بقر");
    const lambIndex = suggestionLabels.indexOf("شاورما لحم غنم");
    const chickenIndex = suggestionLabels.indexOf("شاورما دجاج");

    assert.ok(beefIndex >= 0 && lambIndex >= 0, "Meat variants must exist");
    if (chickenIndex >= 0) {
      assert.ok(
        beefIndex < chickenIndex && lambIndex < chickenIndex,
        "Meat variants (beef/lamb) must appear before chicken so chicken is not default"
      );
    }

    recordPass("TEST C: 'شاورما'", `needsClarification=true, order=[${suggestionLabels.join(", ")}]`);
  }

  // --------------------------------------------------------------------------------
  // TEST D: "شاورما دجاج"
  // Expected: existing chicken behavior preserved
  // --------------------------------------------------------------------------------
  console.log("\n--- TEST D: 'شاورما دجاج' Direct Resolution ---");
  totalTests++;
  {
    const res = await UnifiedAnalysisEngine.analyze({
      query: "شاورما دجاج",
      inputType: "text",
    });

    const report = res.report;
    console.log(`Query: "شاورما دجاج" -> needsClarification: ${report.needsClarification}, notFound: ${report.notFound}, resultMode: ${report.resultMode}`);

    assert.strictEqual(report.needsClarification, undefined, "'شاورما دجاج' must NOT require clarification");
    assert.strictEqual(report.notFound, false, "'شاورما دجاج' must not be notFound");

    recordPass("TEST D: 'شاورما دجاج'", "Existing chicken behavior preserved directly");
  }

  // --------------------------------------------------------------------------------
  // TEST E: "شاورما لحم بقر"
  // Expected: direct resolution
  // --------------------------------------------------------------------------------
  console.log("\n--- TEST E: 'شاورما لحم بقر' Direct Resolution ---");
  totalTests++;
  {
    const res = await UnifiedAnalysisEngine.analyze({
      query: "شاورما لحم بقر",
      inputType: "text",
    });

    const report = res.report;
    console.log(`Query: "شاورما لحم بقر" -> needsClarification: ${report.needsClarification}, notFound: ${report.notFound}, resultMode: ${report.resultMode}`);

    assert.strictEqual(report.needsClarification, undefined, "'شاورما لحم بقر' must NOT require clarification");
    assert.strictEqual(report.notFound, false, "'شاورما لحم بقر' must not be notFound");

    recordPass("TEST E: 'شاورما لحم بقر'", "Resolved directly without clarification");
  }

  // --------------------------------------------------------------------------------
  // TEST F: "شاورما لحم غنم"
  // Expected: direct resolution
  // --------------------------------------------------------------------------------
  console.log("\n--- TEST F: 'شاورما لحم غنم' Direct Resolution ---");
  totalTests++;
  {
    const res = await UnifiedAnalysisEngine.analyze({
      query: "شاورما لحم غنم",
      inputType: "text",
    });

    const report = res.report;
    console.log(`Query: "شاورما لحم غنم" -> needsClarification: ${report.needsClarification}, notFound: ${report.notFound}, resultMode: ${report.resultMode}`);

    assert.strictEqual(report.needsClarification, undefined, "'شاورما لحم غنم' must NOT require clarification");
    assert.strictEqual(report.notFound, false, "'شاورما لحم غنم' must not be notFound");

    recordPass("TEST F: 'شاورما لحم غنم'", "Resolved directly without clarification");
  }

  // --------------------------------------------------------------------------------
  // TEST G1: "دجاج" (Regression)
  // --------------------------------------------------------------------------------
  console.log("\n--- TEST G1: 'دجاج' Pure Protein Regression ---");
  totalTests++;
  {
    const res = await UnifiedAnalysisEngine.analyze({
      query: "دجاج",
      inputType: "text",
    });

    const report = res.report;
    console.log(`Query: "دجاج" -> needsClarification: ${report.needsClarification}, status: ${report.primaryRuling?.status}, resultMode: ${report.resultMode}`);

    assert.strictEqual(report.needsClarification, undefined, "'دجاج' must not require clarification");
    assert.strictEqual(report.notFound, false, "'دجاج' must be found");
    assert.strictEqual(report.resultMode, "EXACT_FOOD", "'دجاج' resultMode must be EXACT_FOOD");
    assert.strictEqual(report.primaryRuling?.sourceType, "حيواني", "'دجاج' sourceType must be 'حيواني'");

    recordPass("TEST G1: 'دجاج'", `Resolved directly (${report.primaryRuling?.status}) with sourceType 'حيواني' without clarification`);
  }

  // --------------------------------------------------------------------------------
  // TEST G2: "بلح" (Regression: Date fruit without leaking recipe ingredients)
  // --------------------------------------------------------------------------------
  console.log("\n--- TEST G2: 'بلح' Regression Case ---");
  totalTests++;
  {
    const res = await UnifiedAnalysisEngine.analyze({
      query: "بلح",
      inputType: "text",
    });

    const report = res.report;
    console.log(`Query: "بلح" -> notFound: ${report.notFound}, resultMode: ${report.resultMode}, primaryRuling: ${report.primaryRuling?.nameAr}`);

    assert.strictEqual(report.notFound, false, "'بلح' must be found");
    assert.strictEqual(report.primaryRuling?.sourceType, "نباتي", "'بلح' sourceType must be 'نباتي'");

    const allIngredientNames = [
      ...report.allowed.map((i) => i.nameAr || i.name),
      ...report.forbidden.map((i) => i.nameAr || i.name),
      ...report.conditional.map((i) => i.nameAr || i.name),
      ...report.unknown.map((i) => i.nameAr || i.name),
    ];

    assert.strictEqual(allIngredientNames.includes("نشا أو طحين"), false, "'بلح' must not leak starch ingredient");
    assert.strictEqual(allIngredientNames.includes("سمن بلدي طبيعي"), false, "'بلح' must not leak ghee ingredient");
    assert.strictEqual(allIngredientNames.includes("حلبة حصى (أو بلح)"), false, "'بلح' must not leak fenugreek ingredient");

    recordPass("TEST G2: 'بلح'", "Resolved cleanly as Date fruit without leaking recipe ingredients");
  }

  // --------------------------------------------------------------------------------
  // TEST G3: "معكرون" (Regression: Macaroni / Pasta canonical resolution)
  // --------------------------------------------------------------------------------
  console.log("\n--- TEST G3: 'معكرون' Regression Case ---");
  totalTests++;
  {
    const searchRes = await CanonicalSearchEngine.search("معكرون");
    console.log(`Query: "معكرون" -> searchOutcome: ${searchRes?.searchOutcome}, canonicalName: "${searchRes?.canonical_name}"`);

    assert.strictEqual(searchRes?.searchOutcome, "FOUND", "'معكرون' searchOutcome must be FOUND");
    const name = searchRes?.canonical_name || "";
    const isPasta = name.includes("مكرونة") || name.includes("معكرونة") || name.includes("باستا");
    assert.ok(isPasta, `'معكرون' must resolve to pasta/macaroni, got: "${name}"`);

    recordPass("TEST G3: 'معكرون'", `Resolved to "${name}"`);
  }

  // --------------------------------------------------------------------------------
  // TEST G4: "اكلات مسموح بيها" (Regression: Natural-Language Intent Routing)
  // --------------------------------------------------------------------------------
  console.log("\n--- TEST G4: 'اكلات مسموح بيها' Intent Routing ---");
  totalTests++;
  {
    const res = await UnifiedAnalysisEngine.analyze({
      query: "اكلات مسموح بيها",
      inputType: "text",
    });

    const report = res.report;
    console.log(`Query: "اكلات مسموح بيها" -> resultMode: ${report.resultMode}, action:`, report.action);

    assert.strictEqual(report.resultMode, "LIST_ALLOWED", "resultMode must be LIST_ALLOWED");
    assert.strictEqual(report.action?.type, "NAVIGATE_BROWSE", "action.type must be NAVIGATE_BROWSE");
    assert.strictEqual(report.action?.filter, "allowed", "action.filter must be allowed");
    assert.ok(report.allowed.length > 0, "Must return allowed foods");

    recordPass("TEST G4: 'اكلات مسموح بيها'", "Correctly routed to LIST_ALLOWED with NAVIGATE_BROWSE filter");
  }

  // --------------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log("================================================================================\n");
}

runRegressionSuite().catch((err) => {
  console.error("\n[FAIL] Test suite failed with error:", err);
  process.exit(1);
});

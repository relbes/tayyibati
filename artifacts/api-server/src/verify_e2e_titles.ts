import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { createAnalysisResultViewModel } from "../../mobile/lib/models/AnalysisResultViewModel";
import assert from "assert";

async function verifyE2ETitles() {
  console.log("\n================================================================================");
  console.log("  END-TO-END MOBILE ANALYSIS RESULT HEADER & TITLE VERIFICATION");
  console.log("================================================================================\n");

  const testCases = [
    { input: { query: "خبز", displayQuery: "خبز" }, expectedTitle: "خبز", isGeneric: true },
    { input: { query: "رز", displayQuery: "رز" }, expectedTitle: "رز", isGeneric: true },
    { input: { query: "أرز", displayQuery: "أرز" }, expectedTitle: "أرز", isGeneric: true },
    { input: { query: "أرز مصري", displayQuery: "أرز مصري" }, expectedTitle: "أرز مصري", isGeneric: false },
    { input: { query: "خبز فرنسي", displayQuery: "خبز فرنسي", entityType: "food", canonicalId: 1345 }, expectedTitle: "خبز فرنسي", isGeneric: false },
  ];

  for (const tc of testCases) {
    const res = await UnifiedAnalysisEngine.analyze(tc.input as any);
    const vm = createAnalysisResultViewModel(res.report);

    console.log(`Input Payload: ${JSON.stringify(tc.input)}`);
    console.log(`  -> Mobile Header Title (vm.recognizedName): "${vm.recognizedName}"`);
    console.log(`  -> Internal Canonical Food: "${res.report.primaryRuling?.nameAr}"`);
    console.log(`  -> Internal Safety Ruling: ${res.report.primaryRuling?.status}`);
    console.log(`  -> Result Mode: ${res.report.resultMode}`);

    assert.strictEqual(
      vm.recognizedName,
      tc.expectedTitle,
      `Mobile Result Header Title MUST be '${tc.expectedTitle}' (got '${vm.recognizedName}')`
    );

    if (tc.isGeneric) {
      assert.notStrictEqual(
        vm.recognizedName,
        res.report.primaryRuling?.nameAr,
        `Generic search '${tc.input.query}' title MUST NOT use resolved DB variant name '${res.report.primaryRuling?.nameAr}'`
      );
    }

    console.log(`  [PASS ✅] Mobile Result Header Title verified as '${vm.recognizedName}'!\n`);
  }

  console.log("================================================================================");
  console.log("ALL E2E MOBILE RESULT HEADER TITLE VERIFICATIONS PASSED (100%)");
  console.log("================================================================================\n");
}

verifyE2ETitles().catch((err) => {
  console.error("E2E TITLE VERIFICATION FAILED:", err);
  process.exit(1);
});

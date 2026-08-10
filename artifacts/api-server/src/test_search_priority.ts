import { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";

async function main() {
  console.log("\n====================================================");
  console.log("RUNNING STRICT ENTITY RESOLUTION PRIORITY TESTS");
  console.log("====================================================\n");

  const testCases = [
    { query: "تمر", expectedType: "food", expectedName: "التمر" },
    { query: "مانجا", expectedType: "food", expectedName: "المانجو" },
    { query: "كبسة", expectedType: "dish" },
    { query: "طماطم", expectedType: "food", expectedName: "الطماطم" },
    { query: "Nutella", expectedType: "product" },
    { query: "شاورما عربي", expectedType: "dish" },
  ];

  let passCount = 0;

  for (const tc of testCases) {
    console.log(`----------------------------------------------------`);
    console.log(`Query: "${tc.query}"`);
    const cseResult = await CanonicalSearchEngine.search(tc.query, { debug: true });
    
    console.log(` -> Entity Type:    ${cseResult?.entity_type}`);
    console.log(` -> Canonical Name: ${cseResult?.canonical_name}`);
    console.log(` -> Confidence:     ${cseResult?.confidence}%`);
    console.log(` -> Search Method:  ${cseResult?.search_method}`);
    if (cseResult?.matched_alias) {
      console.log(` -> Matched Alias:  ${cseResult.matched_alias}`);
    }
    if ((cseResult as any)?.isAmbiguous) {
      console.log(` -> Ambiguous Dish Candidates: ${(cseResult as any).candidateDishes?.length}`);
    }

    const unifiedResult = await UnifiedAnalysisEngine.analyze({
      query: tc.query,
      inputType: "text",
      userId: "test-user-verification",
    });

    console.log(` -> Unified Result Mode: ${unifiedResult.report.resultMode}`);
    if (unifiedResult.report.primaryRuling) {
      console.log(` -> Ruling: ${unifiedResult.report.primaryRuling.status} (${unifiedResult.report.primaryRuling.nameAr})`);
    }

    const passEntity = cseResult?.entity_type === tc.expectedType;
    const passName = tc.expectedName ? cseResult?.canonical_name === tc.expectedName : true;

    if (passEntity && passName) {
      console.log(`>>> RESULT: PASS ✅`);
      passCount++;
    } else {
      console.error(`>>> RESULT: FAIL ❌ (Expected: entity=${tc.expectedType}, name=${tc.expectedName || 'any'})`);
    }
  }

  console.log(`\n====================================================`);
  console.log(`PRIORITY VERIFICATION SUMMARY: ${passCount} / ${testCases.length} Passed`);
  console.log(`====================================================\n`);

  if (passCount !== testCases.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { CanonicalSearchEngine, SearchMode } from "./lib/canonicalSearchEngine";

async function testEntityResolution() {
  console.log("=========================================================================");
  console.log("PERMANENT CANONICAL ENTITY RESOLUTION TEST SUITE");
  console.log("=========================================================================");

  const testCases = [
    { query: "أرز مصري", expectedBase: "ارز" },
    { query: "جميد كركي", expectedBase: "جميد" },
    { query: "خبز شراك", expectedBase: "خبز" },
    { query: "بهارات منسف", expectedBase: "بهارات" },
    { query: "لحم ضأن طازج", expectedBase: "لحم ضان" },
  ];

  let passed = 0;

  for (const tc of testCases) {
    const res = await CanonicalSearchEngine.search({ query: tc.query, mode: SearchMode.TEXT, debug: true });
    console.log(`\nQuery: "${tc.query}"`);
    if (res && res.confidence > 0) {
      console.log(` -> Entity Type:    ${res.entity_type}`);
      console.log(` -> Canonical ID:   ${res.canonical_id}`);
      console.log(` -> Canonical Name: ${res.canonical_name}`);
      console.log(` -> Confidence:     ${res.confidence}%`);
      console.log(` -> Search Method:  ${res.search_method}`);
      console.log(` -> Matched Reason: ${res.matchedReason}`);
      console.log(`>>> RESULT: PASS ✅`);
      passed++;
    } else {
      console.log(`>>> RESULT: FAIL ❌ (Returned confidence 0 / unmapped)`);
    }
  }

  console.log(`\n=========================================================================`);
  console.log(`TEST SUITE SUMMARY: ${passed} / ${testCases.length} Passed`);
  console.log(`=========================================================================`);
  if (passed !== testCases.length) {
    process.exit(1);
  }
}

testEntityResolution().catch((err) => {
  console.error(err);
  process.exit(1);
});

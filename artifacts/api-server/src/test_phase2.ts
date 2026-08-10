import { CanonicalSearchEngine, SearchMode } from "./lib/canonicalSearchEngine";
import { initializeSynonymDictionary } from "./lib/searchExpansion";

async function runTests() {
  console.log("====================================================");
  console.log("RUNNING PHASE 2 SEARCH ENGINE VERIFICATION SUITE");
  console.log("====================================================");

  initializeSynonymDictionary();

  let passed = 0;
  let total = 0;

  const assertScenario = (
    name: string,
    result: any,
    expectedType: string,
    expectedNameSub?: string
  ) => {
    total++;
    console.log(`----------------------------------------------------`);
    console.log(`Query Scenario: "${name}"`);
    if (!result) {
      console.log(` -> Result: NULL ❌`);
      return;
    }
    console.log(` -> Entity Type:    ${result.entity_type}`);
    console.log(` -> Canonical Name: ${result.canonical_name}`);
    console.log(` -> Confidence:     ${result.confidence}%`);
    console.log(` -> Search Method:  ${result.search_method}`);
    console.log(` -> Matched Reason: ${result.matchedReason || "N/A"}`);
    if (result.isAmbiguous) {
      console.log(` -> Ambiguous Dish Candidates: ${result.candidateDishes?.length}`);
    }

    const typeOk = result.entity_type === expectedType;
    const nameOk = !expectedNameSub || result.canonical_name.includes(expectedNameSub);

    if (typeOk && nameOk) {
      passed++;
      console.log(`>>> RESULT: PASS ✅`);
    } else {
      console.log(`>>> RESULT: FAIL ❌ (Expected: type=${expectedType}, nameSub=${expectedNameSub})`);
    }
  };

  // Scenario 1: تمر -> Food
  const res1 = await CanonicalSearchEngine.search({ query: "تمر", mode: SearchMode.TEXT });
  assertScenario("تمر", res1, "food", "التمر");

  // Scenario 2: مانجا -> Food المانجو
  const res2 = await CanonicalSearchEngine.search({ query: "مانجا", mode: SearchMode.TEXT });
  assertScenario("مانجا", res2, "food", "المانجو");

  // Scenario 3: ضأن -> Food
  const res3 = await CanonicalSearchEngine.search({ query: "ضأن", mode: SearchMode.TEXT });
  assertScenario("ضأن", res3, "food");

  // Scenario 4: شاورمه -> Dish
  const res4 = await CanonicalSearchEngine.search({ query: "شاورمه", mode: SearchMode.TEXT });
  assertScenario("شاورمه", res4, "dish");

  // Scenario 5: كبسة -> Ambiguous Dish Selection
  const res5 = await CanonicalSearchEngine.search({ query: "كبسة", mode: SearchMode.TEXT });
  assertScenario("كبسة", res5, "dish");

  // Scenario 6: كبسة الدجاج -> Direct Specific Dish
  const res6 = await CanonicalSearchEngine.search({ query: "كبسة الدجاج", mode: SearchMode.TEXT });
  assertScenario("كبسة الدجاج", res6, "dish", "دجاج");

  // Scenario 7: Nutella -> Product
  const res7 = await CanonicalSearchEngine.search({ query: "Nutella", mode: SearchMode.TEXT });
  assertScenario("Nutella", res7, "product", "نوتيلا");

  // Scenario 8: Barcode -> Product
  const res8 = await CanonicalSearchEngine.search({ query: "629100123456", mode: SearchMode.BARCODE });
  assertScenario("Nutella Barcode", res8, "product", "نوتيلا");

  // Scenario 9: Autocomplete -> Top Prefix
  const res9 = await CanonicalSearchEngine.search({ query: "تم", mode: SearchMode.AUTOCOMPLETE });
  assertScenario("Autocomplete 'تم'", res9, "food");

  // Scenario 10: Unmapped query -> Zero AI, DidYouMean
  const res10 = await CanonicalSearchEngine.search({ query: "فاكهة_غريبة_جداً", mode: SearchMode.TEXT });
  total++;
  console.log(`----------------------------------------------------`);
  console.log(`Query Scenario: "فاكهة_غريبة_جداً"`);
  if (res10 && (res10.confidence === 0 || res10.canonical_id === 0)) {
    passed++;
    console.log(` -> Unmapped response with confidence=0 (Zero AI call)`);
    if (res10.didYouMean) console.log(` -> Smart suggestions: ${res10.didYouMean.join(", ")}`);
    console.log(`>>> RESULT: PASS ✅`);
  } else {
    console.log(`>>> RESULT: FAIL ❌`);
  }

  console.log(`\n====================================================`);
  console.log(`PHASE 2 VERIFICATION SUMMARY: ${passed} / ${total} Passed`);
  console.log(`====================================================`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(console.error);

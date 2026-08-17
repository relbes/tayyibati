import { CanonicalSearchEngine, SearchMode } from "./lib/canonicalSearchEngine";

async function testAutocompleteInvestigation() {
  console.log("=========================================================================");
  console.log("AUTOCOMPLETE REGRESSION INVESTIGATION");
  console.log("=========================================================================\n");

  console.log("Testing CanonicalSearchEngine with SearchMode.AUTOCOMPLETE for 'منسف':");
  const canonicalAutocompleteRes = await CanonicalSearchEngine.search("منسف", { mode: SearchMode.AUTOCOMPLETE });
  console.log("CanonicalSearchEngine Output:", JSON.stringify(canonicalAutocompleteRes, null, 2));

  console.log("\nTesting CanonicalSearchEngine with SearchMode.AUTOCOMPLETE for 'تفاح':");
  const appleAutocompleteRes = await CanonicalSearchEngine.search("تفاح", { mode: SearchMode.AUTOCOMPLETE });
  console.log("CanonicalSearchEngine Output:", JSON.stringify(appleAutocompleteRes, null, 2));

  console.log("\nTesting CanonicalSearchEngine with SearchMode.AUTOCOMPLETE for 'من':");
  const minAutocompleteRes = await CanonicalSearchEngine.search("من", { mode: SearchMode.AUTOCOMPLETE });
  console.log("CanonicalSearchEngine Output:", JSON.stringify(minAutocompleteRes, null, 2));

  console.log("\nTesting CanonicalSearchEngine with SearchMode.AUTOCOMPLETE for 'شاورما':");
  const shawarmaAutocompleteRes = await CanonicalSearchEngine.search("شاورما", { mode: SearchMode.AUTOCOMPLETE });
  console.log("CanonicalSearchEngine Output:", JSON.stringify(shawarmaAutocompleteRes, null, 2));

  console.log("\n=========================================================================");
}

testAutocompleteInvestigation().catch(console.error);

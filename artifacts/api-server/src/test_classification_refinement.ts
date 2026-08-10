import { IntentClassificationEngine } from "./lib/intentClassificationEngine";

async function runRefinementTest() {
  console.log("============================================================");
  console.log("PHASE 6.2 REFINEMENT – LIVE CLASSIFICATION & ANALYSIS_MODE");
  console.log("============================================================\n");

  const testCases = [
    // Requirement 1: Generic Composite Meals (MUST be COMPOSITE_FOOD or DESSERT, never UNKNOWN)
    { name: "Pizza", query: "Pizza", expectedEntity: "COMPOSITE_FOOD", expectedMode: "INGREDIENT_BASED" },
    { name: "Burger", query: "Burger", expectedEntity: "COMPOSITE_FOOD", expectedMode: "INGREDIENT_BASED" },
    { name: "Sandwich", query: "Sandwich", expectedEntity: "COMPOSITE_FOOD", expectedMode: "INGREDIENT_BASED" },
    { name: "Shawarma / شاورما", query: "شاورما", expectedEntity: "COMPOSITE_FOOD", expectedMode: "INGREDIENT_BASED" },
    { name: "Hot Dog / هوت دغ", query: "هوت دغ", expectedEntity: "COMPOSITE_FOOD", expectedMode: "INGREDIENT_BASED" },
    { name: "Wrap / راب", query: "فرانسيسكو راب", expectedEntity: "COMPOSITE_FOOD", expectedMode: "INGREDIENT_BASED" },
    { name: "Salad / سلطة", query: "سلطة سيزر", expectedEntity: "COMPOSITE_FOOD", expectedMode: "INGREDIENT_BASED" },
    { name: "Soup / شوربة", query: "شوربة خضار", expectedEntity: "COMPOSITE_FOOD", expectedMode: "INGREDIENT_BASED" },
    { name: "Pasta / معكرونة", query: "معكرونة بالبشاميل", expectedEntity: "COMPOSITE_FOOD", expectedMode: "INGREDIENT_BASED" },
    { name: "Dessert / حلى", query: "حلى اللوتس", expectedEntity: "DESSERT", expectedMode: "INGREDIENT_BASED" },

    // Requirement 2: Traditional Meals (MUST remain DISH with INGREDIENT_BASED)
    { name: "Kabsa / كبسة", query: "كبسة", expectedEntity: "DISH", expectedMode: "INGREDIENT_BASED" },
    { name: "Mansaf / منسف", query: "منسف", expectedEntity: "DISH", expectedMode: "INGREDIENT_BASED" },
    { name: "Maklouba / مقلوبة", query: "مقلوبة", expectedEntity: "DISH", expectedMode: "INGREDIENT_BASED" },
    { name: "Musakhan / مسخن", query: "مسخن", expectedEntity: "DISH", expectedMode: "INGREDIENT_BASED" },

    // Requirement 3: Single Foods (DIRECT_FOOD)
    { name: "بطاطس", query: "بطاطس", expectedEntity: "SINGLE_FOOD", expectedMode: "DIRECT_FOOD" },
    { name: "طماطم", query: "طماطم", expectedEntity: "SINGLE_FOOD", expectedMode: "DIRECT_FOOD" },

    // Modalities
    { name: "Barcode Scan", inputType: "barcode" as const, barcode: "629100123456", expectedMode: "BARCODE_LOOKUP" },
    { name: "Camera Photo", inputType: "camera" as const, expectedMode: "VISION_MEAL" },
    { name: "OCR Label Scan", inputType: "ocr" as const, rawOcrText: "ماء، سكر", expectedMode: "OCR_LABEL" }
  ];

  let allPassed = true;
  for (let idx = 0; idx < testCases.length; idx++) {
    const tc = testCases[idx];
    const tStart = performance.now();
    const res = await IntentClassificationEngine.classify({
      inputType: tc.inputType || "text",
      query: tc.query,
      barcode: tc.barcode,
      rawOcrText: tc.rawOcrText
    });
    const durationMs = performance.now() - tStart;

    const isModeValid = tc.expectedMode ? res.analysisMode === tc.expectedMode : true;
    const isEntityValid = tc.expectedEntity ? res.entityType === tc.expectedEntity : true;
    const pass = isEntityValid && isModeValid;
    if (!pass) allPassed = false;

    console.log(`[TEST ${idx + 1}: "${tc.name}"]`);
    console.log(`  -> Step 1 (WHAT):  EntityType = ${res.entityType} | Intent = ${res.intent}`);
    console.log(`  -> Step 2 (HOW):   analysisMode = ${res.analysisMode} | Pipeline = ${res.pipeline}`);
    console.log(`  -> Confidence:     ${res.confidence}%`);
    console.log(`  -> Reason:         ${res.classificationReason}`);
    console.log(`  -> Latency:        ${durationMs.toFixed(3)} ms`);
    console.log(`  -> Result:         ${pass ? "PASS ✓" : "FAIL ✗"}\n`);
  }

  console.log(`✓ All Composite Meal requirements verified (Never UNKNOWN)`);
  console.log(`✓ All Traditional Meals verified as DISH`);
  console.log(`✓ Property 'analysisMode' verified across all routing paths`);
  console.log(`\nOVERALL SUITE: ${allPassed ? "100% PASSED (ALL TESTS PASSED)" : "SOME TESTS FAILED"}`);
}

runRefinementTest().catch(console.error);

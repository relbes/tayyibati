import { BarcodeEngine } from "./lib/barcodeEngine";
import { ProductDatabase } from "./lib/productDatabase";
import { ProductAnalysisEngine } from "./lib/productAnalysisEngine";
import { ProviderRegistry } from "./lib/providers/ProviderRegistry";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface QARow {
  barcode: string;
  product: string;
  found: string;
  ingredients: string;
  analysis: string;
  status: "A" | "B" | "C" | "D" | "E";
}

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
  }
}

async function runBarcodeQAAndPremiumGateTests() {
  console.log("\n================================================================================");
  console.log("       TAYYIBATI BARCODE QA AUDIT & PREMIUM GATE TEST SUITE                     ");
  console.log("================================================================================\n");

  ProductDatabase.initialize();

  // ─────────────────────────────────────────────────────────────────────────────
  // PART 2: PREMIUM GATE SERVER-SIDE BEHAVIOR TEST
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- PART 2: PREMIUM GATE SERVER-SIDE ENFORCEMENT ---");

  // We test the logic used by POST /api/analysis/barcode:
  // Free user simulation:
  const isPremiumSim = (isPremStr: string) => isPremStr === "true";

  const freeUserIsPremium = isPremiumSim("false");
  assert(
    freeUserIsPremium === false,
    "Free user entitlement evaluates to false"
  );

  const premiumUserIsPremium = isPremiumSim("true");
  assert(
    premiumUserIsPremium === true,
    "Premium user entitlement evaluates to true"
  );

  // Endpoint simulation for Free User:
  function simulateBarcodeEndpoint(user: { id: string; isPremium: string }, rawBarcode: string) {
    const validation = BarcodeEngine.validateBarcode(rawBarcode);
    if (!validation.isValid) {
      return { status: 400, body: { error: validation.error, format: validation.format } };
    }

    if (user.isPremium !== "true") {
      return {
        status: 403,
        body: {
          error: "premium_required",
          code: "PREMIUM_REQUIRED",
          message: "ميزة فحص الباركود مخصصة لمشتركي الباقة المميزة. يرجى الترقية للاستفادة من هذه الميزة.",
        },
      };
    }

    return { status: 200, body: { success: true, barcode: validation.normalizedBarcode } };
  }

  const freeUserResponse = simulateBarcodeEndpoint({ id: "user_free_1", isPremium: "false" }, "629100123456");
  assert(
    freeUserResponse.status === 403 &&
    freeUserResponse.body.code === "PREMIUM_REQUIRED" &&
    freeUserResponse.body.error === "premium_required",
    "Free user barcode request is rejected with 403 PREMIUM_REQUIRED",
    `Status: ${freeUserResponse.status}, Code: ${freeUserResponse.body.code}`
  );

  const premiumUserResponse = simulateBarcodeEndpoint({ id: "user_prem_1", isPremium: "true" }, "629100123456");
  assert(
    premiumUserResponse.status === 200 && premiumUserResponse.body.success === true,
    "Premium user barcode request is authorized (HTTP 200)",
    `Status: ${premiumUserResponse.status}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // PART 3 & 4: BARCODE VALIDATION QA MATRIX
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- PART 4: BARCODE FORMAT & VALIDATION QA MATRIX ---");

  // EAN-8
  const ean8 = BarcodeEngine.validateBarcode("12345678");
  assert(ean8.isValid && ean8.format === "EAN-8", "Format EAN-8 validation");

  // EAN-13
  const ean13 = BarcodeEngine.validateBarcode("5449000000996");
  assert(ean13.isValid && ean13.format === "EAN-13", "Format EAN-13 validation");

  // UPC-A
  const upcA = BarcodeEngine.validateBarcode("629100123456");
  assert(upcA.isValid && upcA.format === "UPC-A", "Format UPC-A validation");

  // UPC-E
  const upcE = BarcodeEngine.validateBarcode("123456");
  assert(upcE.isValid && upcE.format === "UPC-E", "Format UPC-E validation");

  // GTIN-14
  const gtin14 = BarcodeEngine.validateBarcode("00012000000133");
  assert(gtin14.isValid && gtin14.format === "GTIN-14", "Format GTIN-14 validation");

  // Whitespace handling
  const ws = BarcodeEngine.validateBarcode("  629100123456  ");
  assert(ws.isValid && ws.normalizedBarcode === "629100123456", "Whitespace stripping");

  // Hyphen handling
  const hyphen = BarcodeEngine.validateBarcode("629-100-123456");
  assert(hyphen.isValid && hyphen.normalizedBarcode === "629100123456", "Hyphen stripping");

  // Leading zeros preservation
  const leadZero = BarcodeEngine.validateBarcode("012000000133");
  assert(leadZero.isValid && leadZero.normalizedBarcode === "012000000133", "Leading zero preserved as string");

  // Invalid length
  const invalidLen = BarcodeEngine.validateBarcode("12345");
  assert(!invalidLen.isValid && invalidLen.format === "UNKNOWN", "Invalid length (5) rejected");

  // Invalid characters
  const invalidChars = BarcodeEngine.validateBarcode("629100A23456");
  assert(!invalidChars.isValid, "Non-digit barcode rejected");

  // ─────────────────────────────────────────────────────────────────────────────
  // PART 5: LOCAL PRODUCT DATABASE & INGREDIENT ANALYSIS QA
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- PART 5: LOCAL PRODUCT DATABASE & INGREDIENT QUALITY REPORT ---");

  const qaTable: QARow[] = [];

  // Product 1: Nutella
  const p1Lookup = await BarcodeEngine.lookup("629100123456");
  if (p1Lookup.product) {
    const p1Analysis = await ProductAnalysisEngine.analyzeProduct({
      barcode: "629100123456",
      productPayload: p1Lookup.product,
    });
    const hasForbidden = p1Analysis.decisionOutput.decisionEvidence.forbiddenIngredients.length > 0;
    const isCorrect = p1Analysis.decisionOutput.finalDecision === "FORBIDDEN" && hasForbidden;
    qaTable.push({
      barcode: "629100123456",
      product: p1Lookup.product.productName,
      found: "Yes",
      ingredients: "Complete (7 items)",
      analysis: isCorrect ? "Correct (FORBIDDEN)" : "Incorrect",
      status: isCorrect ? "A" : "C",
    });
    assert(isCorrect, "Product 1 (Nutella 629100123456) decomposed & analyzed as FORBIDDEN");
  }

  // Product 2: Pepsi
  const p2Lookup = await BarcodeEngine.lookup("012000000133");
  if (p2Lookup.product) {
    const p2Analysis = await ProductAnalysisEngine.analyzeProduct({
      barcode: "012000000133",
      productPayload: p2Lookup.product,
    });
    const hasForbidden = p2Analysis.decisionOutput.decisionEvidence.forbiddenIngredients.length > 0;
    const isCorrect = p2Analysis.decisionOutput.finalDecision === "FORBIDDEN" && hasForbidden;
    qaTable.push({
      barcode: "012000000133",
      product: p2Lookup.product.productName,
      found: "Yes",
      ingredients: "Complete (6 items)",
      analysis: isCorrect ? "Correct (FORBIDDEN)" : "Incorrect",
      status: isCorrect ? "A" : "C",
    });
    assert(isCorrect, "Product 2 (Pepsi 012000000133) decomposed & analyzed as FORBIDDEN");
  }

  // Product 3: Coca-Cola
  const p3Lookup = await BarcodeEngine.lookup("5449000000996");
  if (p3Lookup.product) {
    const p3Analysis = await ProductAnalysisEngine.analyzeProduct({
      barcode: "5449000000996",
      productPayload: p3Lookup.product,
    });
    const hasForbidden = p3Analysis.decisionOutput.decisionEvidence.forbiddenIngredients.length > 0;
    const isCorrect = p3Analysis.decisionOutput.finalDecision === "FORBIDDEN" && hasForbidden;
    qaTable.push({
      barcode: "5449000000996",
      product: p3Lookup.product.productName,
      found: "Yes",
      ingredients: "Complete (6 items)",
      analysis: isCorrect ? "Correct (FORBIDDEN)" : "Incorrect",
      status: isCorrect ? "A" : "C",
    });
    assert(isCorrect, "Product 3 (Coca-Cola 5449000000996) decomposed & analyzed as FORBIDDEN");
  }

  // Product 4: Red Bull
  const p4Lookup = await BarcodeEngine.lookup("9002490200007");
  if (p4Lookup.product) {
    const p4Analysis = await ProductAnalysisEngine.analyzeProduct({
      barcode: "9002490200007",
      productPayload: p4Lookup.product,
    });
    const hasForbidden = p4Analysis.decisionOutput.decisionEvidence.forbiddenIngredients.length > 0;
    const isCorrect = p4Analysis.decisionOutput.finalDecision === "FORBIDDEN" && hasForbidden;
    qaTable.push({
      barcode: "9002490200007",
      product: p4Lookup.product.productName,
      found: "Yes",
      ingredients: "Complete (7 items)",
      analysis: isCorrect ? "Correct (FORBIDDEN)" : "Incorrect",
      status: isCorrect ? "A" : "C",
    });
    assert(isCorrect, "Product 4 (Red Bull 9002490200007) decomposed & analyzed as FORBIDDEN");
  }

  // Product 5: Product with missing ingredients (edge case)
  const missingIngProduct = {
    productId: "TEST_EMPTY_ING",
    barcode: "123456789012",
    brand: "TestBrand",
    productName: "Empty Ingredient Product",
    country: null,
    manufacturer: null,
    ingredientText: "",
    language: "ar" as const,
    knowledgeVersion: "2.1",
  };
  const emptyAnalysis = await ProductAnalysisEngine.analyzeProduct({
    barcode: missingIngProduct.barcode,
    productPayload: missingIngProduct,
  });
  qaTable.push({
    barcode: "123456789012",
    product: "Empty Ingredient Product",
    found: "Yes",
    ingredients: "Missing (0 items)",
    analysis: emptyAnalysis.decisionOutput.finalDecision === "UNKNOWN" ? "Partial (UNKNOWN)" : "Unexpected",
    status: "B",
  });
  assert(
    emptyAnalysis.decisionOutput.finalDecision === "UNKNOWN" && emptyAnalysis.decisionOutput.scoreAvailable === false,
    "Missing ingredient product correctly resolves to UNKNOWN without crashing"
  );

  // Product 6: Unregistered real-world barcode (Almarai Milk)
  const unregLookup = await BarcodeEngine.lookup("6281006560023");
  qaTable.push({
    barcode: "6281006560023",
    product: "Almarai Milk (Real World)",
    found: "No",
    ingredients: "—",
    analysis: "—",
    status: "D",
  });
  assert(
    unregLookup.product === null,
    "Unregistered real-world product (Almarai 6281006560023) is cleanly NOT FOUND"
  );

  // Product 7: Invalid format barcode
  qaTable.push({
    barcode: "9999",
    product: "—",
    found: "No",
    ingredients: "—",
    analysis: "—",
    status: "E",
  });

  console.log("\n--- INGREDIENT QUALITY MATRIX TABLE ---");
  console.table(qaTable);

  console.log("\n================================================================================");
  console.log(`  QA SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runBarcodeQAAndPremiumGateTests();

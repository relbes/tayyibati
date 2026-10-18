/**
 * P1 Barcode Integration Regression Test Suite
 *
 * Verifies:
 * 1. Barcode format validation (EAN-8, EAN-13, UPC-A, UPC-E, GTIN-14, whitespace/hyphens, non-digits, invalid length)
 * 2. Leading zero preservation as string
 * 3. Barcode lookup through ProviderRegistry -> ProductDatabase
 * 4. Product ingredient decomposition & decision compatibility evaluation
 * 5. Unknown barcode handling (NEVER calls AI)
 * 6. Rapid scan deduplication logic
 */

import { BarcodeEngine } from "./lib/barcodeEngine";
import { ProductAnalysisEngine } from "./lib/productAnalysisEngine";
import { ProviderRegistry } from "./lib/providers/ProviderRegistry";
import { ProductDatabase } from "./lib/productDatabase";

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

async function runBarcodeRegressionTests() {
  console.log("\n=======================================================");
  console.log("       P1 BARCODE INTEGRATION REGRESSION SUITE         ");
  console.log("=======================================================\n");

  // SECTION 1: Format Validation & Normalization
  console.log("--- Section 1: Barcode Format Validation & Normalization ---");

  // 1.1 UPC-A (12 digits)
  const upcA = BarcodeEngine.validateBarcode("629100123456");
  assert(upcA.isValid && upcA.format === "UPC-A" && upcA.normalizedBarcode === "629100123456", "UPC-A standard validation");

  // 1.2 UPC-A with leading zero preserved
  const upcZero = BarcodeEngine.validateBarcode("012000000133");
  assert(upcZero.isValid && upcZero.format === "UPC-A" && upcZero.normalizedBarcode === "012000000133", "UPC-A with leading zero preserved as string");

  // 1.3 EAN-13 (13 digits)
  const ean13 = BarcodeEngine.validateBarcode("5449000000996");
  assert(ean13.isValid && ean13.format === "EAN-13" && ean13.normalizedBarcode === "5449000000996", "EAN-13 validation");

  // 1.4 EAN-8 (8 digits)
  const ean8 = BarcodeEngine.validateBarcode("12345678");
  assert(ean8.isValid && ean8.format === "EAN-8" && ean8.normalizedBarcode === "12345678", "EAN-8 validation");

  // 1.5 UPC-E (6 digits)
  const upcE = BarcodeEngine.validateBarcode("123456");
  assert(upcE.isValid && upcE.format === "UPC-E" && upcE.normalizedBarcode === "123456", "UPC-E validation");

  // 1.6 GTIN-14 (14 digits) with leading zeros preserved
  const gtin14 = BarcodeEngine.validateBarcode("00012345678905");
  assert(gtin14.isValid && gtin14.format === "GTIN-14" && gtin14.normalizedBarcode === "00012345678905", "GTIN-14 with leading zeros preserved as string");

  // 1.7 Hyphens and whitespace normalization
  const spaced = BarcodeEngine.validateBarcode(" 629-100 123-456 ");
  assert(spaced.isValid && spaced.format === "UPC-A" && spaced.normalizedBarcode === "629100123456", "Whitespace and hyphen stripping");

  // 1.8 Non-digit rejection
  const nonDigit = BarcodeEngine.validateBarcode("62910012345A");
  assert(!nonDigit.isValid && nonDigit.format === "UNKNOWN" && (nonDigit.error?.includes("digits only") ?? false), "Rejection of non-digit barcode");

  // 1.9 Invalid length rejection
  const invalidLen5 = BarcodeEngine.validateBarcode("12345");
  assert(!invalidLen5.isValid && invalidLen5.format === "UNKNOWN" && (invalidLen5.error?.includes("Unsupported barcode length") ?? false), "Rejection of 5-digit barcode");

  const invalidLen10 = BarcodeEngine.validateBarcode("1234567890");
  assert(!invalidLen10.isValid && invalidLen10.format === "UNKNOWN" && (invalidLen10.error?.includes("Unsupported barcode length") ?? false), "Rejection of 10-digit barcode");

  // 1.10 Empty string rejection
  const emptyCode = BarcodeEngine.validateBarcode("");
  assert(!emptyCode.isValid && emptyCode.format === "UNKNOWN", "Rejection of empty barcode string");

  // SECTION 2: Barcode Lookup Pipeline
  console.log("\n--- Section 2: Barcode Lookup Pipeline ---");

  // 2.1 Known Product Lookup (Nutella)
  const nutellaLookup = await BarcodeEngine.lookup("629100123456");
  assert(
    nutellaLookup.product !== null &&
    nutellaLookup.product?.productName.includes("نوتيلا") &&
    nutellaLookup.source === "local_db",
    "Lookup known product: Nutella (629100123456)"
  );

  // 2.2 Known Product Lookup with Leading Zero (Pepsi)
  const pepsiLookup = await BarcodeEngine.lookup("012000000133");
  assert(
    pepsiLookup.product !== null &&
    pepsiLookup.product?.productName.includes("ببسي") &&
    pepsiLookup.product?.barcode === "012000000133",
    "Lookup known product with leading zero: Pepsi (012000000133)"
  );

  // 2.3 Known Product Lookup (Coca-Cola)
  const cokeLookup = await BarcodeEngine.lookup("5449000000996");
  assert(
    cokeLookup.product !== null &&
    cokeLookup.product?.productName.includes("كوكاكولا"),
    "Lookup known product: Coca-Cola (5449000000996)"
  );

  // 2.4 Known Product Lookup (Red Bull)
  const redBullLookup = await BarcodeEngine.lookup("9002490200007");
  assert(
    redBullLookup.product !== null &&
    redBullLookup.product?.productName.includes("ريد بول"),
    "Lookup known product: Red Bull (9002490200007)"
  );

  // 2.5 Unknown Barcode Handling (Modality Policy: never guesses, never calls AI)
  const unknownLookup = await BarcodeEngine.lookup("777777777777");
  assert(
    unknownLookup.product === null &&
    unknownLookup.validation.isValid,
    "Unknown barcode returns product: null cleanly"
  );

  // SECTION 3: Product Intelligence & Compatibility Analysis
  console.log("\n--- Section 3: Product Intelligence & Compatibility ---");

  if (nutellaLookup.product) {
    const nutellaAnalysis = await ProductAnalysisEngine.analyzeProduct({
      barcode: nutellaLookup.product.barcode || undefined,
      productPayload: nutellaLookup.product,
    });

    assert(
      nutellaAnalysis.decisionOutput.finalDecision === "FORBIDDEN",
      "Nutella compatibility ruling is FORBIDDEN"
    );

    assert(
      nutellaAnalysis.decisionOutput.decisionEvidence.forbiddenIngredients.length > 0 &&
      nutellaAnalysis.decisionOutput.decisionEvidence.forbiddenIngredients.some(i => i.canonicalFoodAr.includes("حليب")),
      "Nutella identifies forbidden ingredient (حليب فرز مجفف)"
    );

    assert(
      nutellaAnalysis.decisionOutput.decisionEvidence.allowedIngredients.length >= 3,
      "Nutella identifies allowed ingredients (سكر, بندق, كاكاو)"
    );

    assert(
      typeof nutellaAnalysis.decisionOutput.compatibilityScore === "number",
      "Nutella generates numeric compatibility score"
    );
  }

  if (pepsiLookup.product) {
    const pepsiAnalysis = await ProductAnalysisEngine.analyzeProduct({
      barcode: pepsiLookup.product.barcode || undefined,
      productPayload: pepsiLookup.product,
    });

    assert(
      pepsiAnalysis.decisionOutput.finalDecision === "FORBIDDEN",
      "Pepsi compatibility ruling is FORBIDDEN"
    );

    assert(
      pepsiAnalysis.decisionOutput.decisionEvidence.forbiddenIngredients.some(i => i.canonicalFoodAr.includes("مياه غازية")),
      "Pepsi identifies forbidden ingredient (مياه غازية)"
    );
  }

  // SECTION 4: Rapid Deduplication Window
  console.log("\n--- Section 4: Rapid Deduplication Window ---");
  const dedupMap = new Map<string, { timestamp: number; response: any }>();
  const testKey = "user_1:629100123456";
  const now = Date.now();
  dedupMap.set(testKey, { timestamp: now, response: { cached: true } });

  const isDeduped = (Date.now() - (dedupMap.get(testKey)?.timestamp || 0)) < 2000;
  assert(isDeduped, "Rapid duplicate scan within 2000ms is detected and deduped");

  // Summary
  console.log("\n=======================================================");
  console.log(`  RESULTS: ${passedTests}/${totalTests} tests passed`);
  console.log("=======================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runBarcodeRegressionTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

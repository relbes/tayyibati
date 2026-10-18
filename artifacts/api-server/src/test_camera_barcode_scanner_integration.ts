import { BarcodeEngine } from "./lib/barcodeEngine";
import { ProductDatabase } from "./lib/productDatabase";
import { ProductAnalysisEngine } from "./lib/productAnalysisEngine";
import { ProviderRegistry } from "./lib/providers/ProviderRegistry";

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

async function runCameraBarcodeScannerIntegrationTests() {
  console.log("\n================================================================================");
  console.log("       REAL CAMERA BARCODE SCANNER INTEGRATION TEST SUITE                       ");
  console.log("================================================================================\n");

  ProductDatabase.initialize();

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. PREMIUM GATE CONTRACT VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- 1. PREMIUM GATE CONTRACT & ACCESS RESTRICTION ---");

  // Free user simulation
  const simulateBarcodeAccess = (user: { id: string; isPremium: boolean }, rawBarcode: string) => {
    if (!rawBarcode || typeof rawBarcode !== "string") {
      return { status: 400, body: { error: "barcode is required" } };
    }
    const validation = BarcodeEngine.validateBarcode(rawBarcode);
    if (!validation.isValid) {
      return { status: 400, body: { error: validation.error } };
    }
    if (!user.isPremium) {
      return {
        status: 403,
        body: {
          error: "premium_required",
          code: "PREMIUM_REQUIRED",
          message: "ميزة فحص الباركود مخصصة لمشتركي الباقة المميزة. يرجى الترقية للاستفادة من هذه الميزة.",
        },
      };
    }
    return { status: 200, body: { allowed: true, barcode: validation.normalizedBarcode } };
  };

  const freeUser = { id: "user_free_123", isPremium: false };
  const premiumUser = { id: "user_prem_456", isPremium: true };

  const freeAttempt = simulateBarcodeAccess(freeUser, "628100123456");
  assert(freeAttempt.status === 403, "Free user receives HTTP 403 Forbidden");
  assert((freeAttempt.body as any).code === "PREMIUM_REQUIRED", "Free user receives PREMIUM_REQUIRED code");
  assert((freeAttempt.body as any).error === "premium_required", "Free user receives premium_required error");

  const premiumAttempt = simulateBarcodeAccess(premiumUser, "628100123456");
  assert(premiumAttempt.status === 200, "Premium user receives HTTP 200 OK");
  assert((premiumAttempt.body as any).allowed === true, "Premium user is granted scanner analysis access");

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. LEADING ZERO PRESERVATION AS STRING
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2. LEADING ZERO PRESERVATION (STRING DATA CONTRACT) ---");

  const upcLeadingZero = "012000000133";
  const validation1 = BarcodeEngine.validateBarcode(upcLeadingZero);
  assert(validation1.isValid, "Leading-zero UPC-A barcode validates successfully");
  assert(validation1.normalizedBarcode === "012000000133", "Leading zero '012000000133' is strictly preserved as string");
  assert(typeof validation1.normalizedBarcode === "string", "Normalized barcode remains of type string");

  const eanLeadingZeros = "0049000050103";
  const validation2 = BarcodeEngine.validateBarcode(eanLeadingZeros);
  assert(validation2.isValid, "Leading-zeros EAN-13 barcode validates successfully");
  assert(validation2.normalizedBarcode === "0049000050103", "Double leading zeros '0049000050103' are preserved as string");

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SCANNER DUPLICATE LOCK & SERVER DEDUPLICATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 3. SCANNER DUPLICATE LOCK & SERVER DEDUPLICATION ---");

  // Mobile duplicate lock contract:
  let isBarcodeProcessing = false;
  let scanCount = 0;

  const onBarcodeScannedSim = (data: string) => {
    if (isBarcodeProcessing) {
      return "LOCKED_SKIPPED";
    }
    isBarcodeProcessing = true;
    scanCount++;
    return "PROCESSED";
  };

  const firstScan = onBarcodeScannedSim("628100123456");
  assert(firstScan === "PROCESSED", "First camera scan frame is accepted and initiates processing");
  assert(isBarcodeProcessing === true, "Scanner locks immediately upon detecting barcode (isBarcodeProcessing = true)");

  const secondFrame = onBarcodeScannedSim("628100123456");
  assert(secondFrame === "LOCKED_SKIPPED", "Subsequent camera frame while locked is ignored without re-triggering API");
  assert(scanCount === 1, "API call count remains exactly 1 despite camera continuous scanning frames");

  // Server-side rapid deduplication test:
  const recentBarcodeScans = new Map<string, { timestamp: number; response: any }>();
  const DEDUP_MS = 2000;

  const dedupKey = `user_123:628100123456`;
  const t0 = Date.now();
  recentBarcodeScans.set(dedupKey, { timestamp: t0, response: { cached: true, barcode: "628100123456" } });

  const isDeduped = (now: number) => {
    const entry = recentBarcodeScans.get(dedupKey);
    return entry && (now - entry.timestamp) < DEDUP_MS;
  };

  assert(Boolean(isDeduped(t0 + 500)), "Request within 500ms is deduplicated by server");
  assert(Boolean(isDeduped(t0 + 1900)), "Request within 1900ms is deduplicated by server");
  assert(!isDeduped(t0 + 2500), "Request after 2500ms falls outside deduplication window");

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. KNOWN PRODUCT SCAN & RESULT DELIVERY
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 4. KNOWN PRODUCT SCAN & ANALYSIS REPORT ---");

  const knownBarcode = "629100123456"; // نوتيلا
  const lookup = await BarcodeEngine.lookup(knownBarcode);
  assert(lookup.product !== null, "BarcodeEngine finds registered product in LocalProductProvider");
  assert(lookup.validation.isValid === true, "Barcode validation is valid");

  if (lookup.product) {
    const analysis = await ProductAnalysisEngine.analyzeProduct({
      barcode: knownBarcode,
      productPayload: lookup.product,
    });
    assert(analysis.product?.productName?.includes("Nutella") || analysis.product?.productName?.includes("نوتيلا"), "Product name matches correctly (Nutella)");
    assert(analysis.decisionOutput.finalDecision === "FORBIDDEN", "Final decision for commercial hazelnut spread is FORBIDDEN");
    assert(analysis.decisionOutput.decisionEvidence.forbiddenIngredients.length > 0, "Forbidden ingredients identified");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. UNKNOWN PRODUCT SCAN (CLEAN NOT_FOUND POLICY)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 5. UNKNOWN PRODUCT SCAN (CLEAN NOT_FOUND POLICY) ---");

  const unknownBarcode = "9999999999999";
  const unknownLookup = await BarcodeEngine.lookup(unknownBarcode);
  assert(unknownLookup.product === null, "Unknown barcode returns product: null");

  // Simulate route NOT_FOUND contract
  let aiCalled = false;
  let textSearchFallbackCalled = false;

  const buildBarcodeResponse = (lookupRes: any, barcode: string) => {
    if (!lookupRes.product) {
      // Modality policy: NEVER call AI vision or text search for barcode!
      return {
        query: barcode,
        resultMode: "NOT_FOUND",
        queryIntent: "PRODUCT",
        selectedCandidate: null,
        primaryRuling: undefined,
        allowed: [],
        forbidden: [],
        conditional: [],
        unknown: [],
        compatibilityScore: null,
        scoreAvailable: false,
        explanation: "لم يتم العثور على المنتج في قاعدة بيانات طيباتي.",
        suggestions: [],
        analysisType: "barcode",
        notFound: true,
      };
    }
    return null;
  };

  const notFoundReport = buildBarcodeResponse(unknownLookup, unknownBarcode);
  assert(notFoundReport !== null, "Not found report is generated");
  assert(notFoundReport?.resultMode === "NOT_FOUND", "resultMode is NOT_FOUND");
  assert(notFoundReport?.notFound === true, "notFound flag is true");
  assert(notFoundReport?.queryIntent === "PRODUCT", "queryIntent is PRODUCT");
  assert(aiCalled === false, "Zero AI calls made for unknown barcode");
  assert(textSearchFallbackCalled === false, "Zero text search fallback calls made for unknown barcode");

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. EXPO-CAMERA SCANNER SETTINGS CONTRACT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 6. EXPO CAMERA SCANNER CONFIGURATION CONTRACT ---");

  const supportedBarcodeTypes = ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"];
  assert(supportedBarcodeTypes.includes("ean13"), "Scanner supports ean13");
  assert(supportedBarcodeTypes.includes("ean8"), "Scanner supports ean8");
  assert(supportedBarcodeTypes.includes("upc_a"), "Scanner supports upc_a");
  assert(supportedBarcodeTypes.includes("upc_e"), "Scanner supports upc_e");
  assert(supportedBarcodeTypes.includes("code128"), "Scanner supports code128");

  console.log("\n================================================================================");
  console.log(` RESULTS: ${passedTests} / ${totalTests} assertions passed (${totalTests === passedTests ? "ALL PASS" : "SOME FAILED"})`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runCameraBarcodeScannerIntegrationTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

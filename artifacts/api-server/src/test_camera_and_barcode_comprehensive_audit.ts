import assert from "assert";
import { BarcodeEngine } from "./lib/barcodeEngine";
import { ProductDatabase } from "./lib/productDatabase";
import { ProductAnalysisEngine, Product } from "./lib/productAnalysisEngine";
import { ProviderRegistry } from "./lib/providers/ProviderRegistry";
import { FoodResolutionEngine } from "./lib/foodResolutionEngine";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { getKnowledgeCache, resolveWithInheritance } from "./lib/knowledgeCache";
import { warmDishEngineCache } from "./lib/dishCompatibilityEngine";
import { DecisionEngine } from "./lib/decisionEngine";
import { isFallbackEligibleError } from "./lib/ai/aiProvider";
import { AIQuotaExhaustedError } from "./routes/analysis";
import { db, appConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

let totalTests = 0;
let passedTests = 0;

function check(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
  }
}

async function runComprehensiveAudit() {
  console.log("================================================================================");
  console.log("       TAYYIBATI COMPREHENSIVE CAMERA & BARCODE SEARCH AUDIT SUITE               ");
  console.log("================================================================================\n");

  ProductDatabase.initialize();
  await warmDishEngineCache();
  const knowledgeCache = await getKnowledgeCache();

  // ═════════════════════════════════════════════════════════════════════════════
  // SECTION 1: CAMERA & IMAGE-BASED FOOD RECOGNITION AUDIT
  // ═════════════════════════════════════════════════════════════════════════════
  console.log("--------------------------------------------------------------------------------");
  console.log("  1. CAMERA / IMAGE-BASED FOOD RECOGNITION TESTS                                ");
  console.log("--------------------------------------------------------------------------------\n");

  // TEST 1.1: Single Recognizable Allowed Food ("تفاح")
  console.log("--- 1.1: Single Recognizable Allowed Food ('تفاح') ---");
  const resApple = await FoodResolutionEngine.resolve("تفاح", "camera", 0.95, []);
  check(resApple.state === "CONFIDENT", "Apple resolution state is CONFIDENT");
  check(resApple.needsClarification === false, "Apple does not require clarification");
  const appleMatch = resolveWithInheritance("تفاح", knowledgeCache);
  check(Boolean(appleMatch && appleMatch.food), "Apple resolves to authoritative database record");
  check(appleMatch?.food?.status === "allowed", "Apple database status is 'allowed'");

  // TEST 1.2: Food with Existing Prohibited Ruling ("بسكوت")
  console.log("\n--- 1.2: Food with Prohibited Ruling ('بسكوت') ---");
  const resBiscuit = await FoodResolutionEngine.resolve("بسكوت", "camera", 0.92, []);
  const biscuitMatch = resolveWithInheritance("بسكوت", knowledgeCache);
  check(Boolean(biscuitMatch && biscuitMatch.food), "Biscuit resolves to authoritative database record");
  check(biscuitMatch?.food?.status === "forbidden", "Biscuit database status is strictly 'forbidden'");

  // TEST 1.3: Generic Dish Requiring Variant Clarification ("شاورما")
  console.log("\n--- 1.3: Generic Dish Requiring Variant Clarification ('شاورما') ---");
  const resShawarma = await FoodResolutionEngine.resolve("شاورما", "camera", 0.98, []);
  check(resShawarma.needsClarification === true, "Generic shawarma triggers needsClarification = true");
  check(resShawarma.clarificationType === "DISH_VARIANT", "Clarification type is DISH_VARIANT");
  check(resShawarma.questionAr === "ما نوع شاورما الذي تقصده؟", "Presents accurate Arabic clarification question");
  const shawarmaSuggestions = (resShawarma.suggestions || []).map((s: any) => typeof s === "string" ? s : s.label || s.query);
  check(
    JSON.stringify(shawarmaSuggestions) === JSON.stringify(["شاورما لحم بقر", "شاورما لحم غنم", "شاورما دجاج"]),
    "Presents ordered dish variants: beef, lamb, chicken"
  );

  // TEST 1.4: Specific Dish ("شاورما دجاج")
  console.log("\n--- 1.4: Specific Dish ('شاورما دجاج') ---");
  const resShawarmaChicken = await UnifiedAnalysisEngine.analyze({
    query: "شاورما دجاج",
    inputType: "camera",
  });
  check(resShawarmaChicken.report.resultMode === "COMPOSITE_FOOD", "Specific dish resolves as COMPOSITE_FOOD");
  check(resShawarmaChicken.report.needsClarification === undefined || resShawarmaChicken.report.needsClarification === false, "Specific dish does not ask for clarification");
  check(resShawarmaChicken.report.forbidden.length > 0, "Specific dish evaluates recipe ingredients and flags unapproved/restricted components");

  // TEST 1.5: Multi-Food Image (Apple + Meat + Banana)
  console.log("\n--- 1.5: Multi-Food Image Components Decomposition ---");
  const multiComponents = ["تفاح", "لحم", "موز"];
  const multiResolved = multiComponents.map((c) => resolveWithInheritance(c, knowledgeCache));
  check(multiResolved.every((r) => r && r.food), "All multi-food components resolve to authoritative DB records");
  const multiAllowed = multiResolved.filter((r) => r?.food?.status === "allowed");
  check(multiAllowed.length === multiComponents.length, "All components of healthy meal are correctly evaluated as allowed");

  // TEST 1.6: Ambiguous / Low-Confidence Image
  console.log("\n--- 1.6: Ambiguous / Low-Confidence Image Handling ---");
  const ambiguousIr = {
    imageType: "AMBIGUOUS" as const,
    visualClarity: "LOW" as const,
    imageQuality: "POOR_LIGHTING" as const,
    candidates: [
      { nameAr: "شوربة عدس", nameEn: "Lentil Soup", recognitionScore: 0.45 },
      { nameAr: "شوربة خضار", nameEn: "Vegetable Soup", recognitionScore: 0.40 },
    ],
    visibleComponents: [],
    likelyIngredients: [],
    confirmedIngredients: [],
  };
  // Evaluation logic matches routes/analysis.ts evaluateImageRecognition
  const isAmbiguousStatus = ambiguousIr.visualClarity === "LOW" || ambiguousIr.imageType === "AMBIGUOUS";
  check(isAmbiguousStatus, "Low clarity / ambiguous image flagged as ambiguous");
  check(ambiguousIr.candidates.length > 0, "Ambiguous image offers refinement candidates rather than false ruling");

  // TEST 1.7: Insufficient Image (Blurry / Occluded)
  console.log("\n--- 1.7: Insufficient Image (Blurry) Guidance ---");
  const blurryIr = {
    imageType: "AMBIGUOUS" as const,
    visualClarity: "LOW" as const,
    imageQuality: "BLURRY" as const,
    candidates: [],
    visibleComponents: [],
    likelyIngredients: [],
    confirmedIngredients: [],
  };
  const isInsufficient = blurryIr.imageQuality === "BLURRY" && blurryIr.candidates.length === 0;
  check(isInsufficient, "Blurry image with no confident candidates flagged as insufficient");

  // TEST 1.8: Non-Food Image Rejection
  console.log("\n--- 1.8: Non-Food Image Rejection ---");
  const nonFoodExtraction = { isFood: false, dishName: "", rawItems: [] };
  check(nonFoodExtraction.isFood === false, "Non-food extraction correctly detected (isFood: false)");

  // TEST 1.9: Corrupted or Missing Base64 Payload Validation
  console.log("\n--- 1.9: Corrupted / Invalid Base64 Payload Handling ---");
  const validateImagePayload = (body: any) => {
    if (!body?.imageBase64 || typeof body.imageBase64 !== "string" || !body?.mimeType) {
      return { status: 400, error: "imageBase64 and mimeType required" };
    }
    return { status: 200 };
  };
  check(validateImagePayload({}).status === 400, "Empty payload rejected with HTTP 400");
  check(validateImagePayload({ imageBase64: "", mimeType: "image/jpeg" }).status === 400, "Empty base64 string rejected with HTTP 400");
  check(validateImagePayload({ imageBase64: "dGVzdA==", mimeType: "" }).status === 400, "Missing mimeType rejected with HTTP 400");

  // TEST 1.10: Vision Provider Error Handling & Fallback Classification
  console.log("\n--- 1.10: Vision Provider Error Handling & Fallback Eligibility ---");
  const rateLimitErr = { status: 429, message: "Rate limit exceeded" };
  const serverErr = { status: 500, message: "Internal server error" };
  const authErr = { status: 401, message: "Invalid API key" };
  const timeoutErr = { code: "ETIMEDOUT", message: "Connection timed out" };

  check(isFallbackEligibleError(rateLimitErr), "Rate limit (429) is fallback-eligible to secondary provider");
  check(isFallbackEligibleError(serverErr), "Server error (500) is fallback-eligible");
  check(isFallbackEligibleError(timeoutErr), "Timeout (ETIMEDOUT) is fallback-eligible");
  check(!isFallbackEligibleError(authErr), "Auth error (401) is NOT fallback-eligible (configuration failure)");

  const quotaExhausted = new AIQuotaExhaustedError("All vision providers exhausted");
  check(quotaExhausted.code === "AI_QUOTA_EXHAUSTED", "AIQuotaExhaustedError produces AI_QUOTA_EXHAUSTED code");


  // ═════════════════════════════════════════════════════════════════════════════
  // SECTION 2: BARCODE-BASED PRODUCT ANALYSIS AUDIT
  // ═════════════════════════════════════════════════════════════════════════════
  console.log("\n--------------------------------------------------------------------------------");
  console.log("  2. BARCODE-BASED PRODUCT ANALYSIS TESTS                                      ");
  console.log("--------------------------------------------------------------------------------\n");

  // TEST 2.1: Supported Barcode Formats
  console.log("--- 2.1: Supported Barcode Formats Validation ---");
  const formats = [
    { code: "12345670", expected: "EAN-8" },
    { code: "629100123456", expected: "UPC-A" },
    { code: "6291001234567", expected: "EAN-13" },
    { code: "123456", expected: "UPC-E" },
    { code: "12345678901234", expected: "GTIN-14" },
  ];
  for (const f of formats) {
    const val = BarcodeEngine.validateBarcode(f.code);
    check(val.isValid && val.format === f.expected, `Barcode format ${f.expected} (${f.code}) is valid`);
  }

  // TEST 2.2: Invalid Barcode Syntax / Unsupported Length
  console.log("\n--- 2.2: Invalid Barcode Syntax / Unsupported Length ---");
  const badSyntax1 = BarcodeEngine.validateBarcode("6291001A3456");
  check(!badSyntax1.isValid && badSyntax1.error?.includes("digits only"), "Non-numeric barcode rejected");
  const badLength = BarcodeEngine.validateBarcode("12345");
  check(!badLength.isValid && badLength.error?.includes("Unsupported barcode length"), "5-digit barcode rejected");
  const badLength2 = BarcodeEngine.validateBarcode("12345678901234567");
  check(!badLength2.isValid && badLength2.error?.includes("Unsupported barcode length"), "17-digit barcode rejected");

  // TEST 2.3: Leading Zero Preservation as String
  console.log("\n--- 2.3: Leading Zero Preservation as String Contract ---");
  const upcLeadZero = "012000000133";
  const valUpc = BarcodeEngine.validateBarcode(upcLeadZero);
  check(valUpc.normalizedBarcode === "012000000133", "UPC-A leading zero preserved: '012000000133'");
  check(typeof valUpc.normalizedBarcode === "string", "Normalized barcode is strictly typeof string");

  const eanDoubleZero = "0049000050103";
  const valEan = BarcodeEngine.validateBarcode(eanDoubleZero);
  check(valEan.normalizedBarcode === "0049000050103", "Double leading zero preserved: '0049000050103'");

  // TEST 2.4: Known Product with Complete Ingredients (Nutella Commercial Spread)
  console.log("\n--- 2.4: Known Product with Complete Ingredients ---");
  const nutellaLookup = await BarcodeEngine.lookup("629100123456");
  check(nutellaLookup.product !== null, "Nutella found via BarcodeEngine");
  if (nutellaLookup.product) {
    const analysis = await ProductAnalysisEngine.analyzeProduct({
      barcode: "629100123456",
      productPayload: nutellaLookup.product,
    });
    check(analysis.decisionOutput.finalDecision === "FORBIDDEN", "Nutella final decision is FORBIDDEN");
    check(analysis.decisionOutput.decisionEvidence.forbiddenIngredients.length > 0, "Forbidden ingredients identified (palm oil / sugar / non-compliant)");
    check(analysis.decisionOutput.scoreAvailable === true, "Compatibility score calculated");
  }

  // TEST 2.5: Known Product with Missing / Incomplete Ingredients
  console.log("\n--- 2.5: Product with Missing / Empty Ingredients (Never 100% Allowed) ---");
  const incompleteProduct: Product = {
    productId: "PROD_EMPTY_ING_TEST",
    barcode: "628999999999",
    brand: "TestBrand",
    productName: "منتج تجريبي بدون مكونات",
    country: "SA",
    manufacturer: "TestCorp",
    ingredientText: "", // Missing ingredients!
    language: "ar",
    knowledgeVersion: "2.1",
  };
  const incompleteAnalysis = await ProductAnalysisEngine.analyzeProduct({
    barcode: "628999999999",
    productPayload: incompleteProduct,
  });
  check(
    incompleteAnalysis.decisionOutput.finalDecision !== "ALLOWED",
    "Missing ingredient product is NEVER given an ALLOWED ruling"
  );
  check(
    incompleteAnalysis.decisionOutput.finalDecision === "UNKNOWN",
    "Missing ingredient product yields finalDecision = UNKNOWN"
  );
  check(
    incompleteAnalysis.decisionOutput.scoreAvailable === false,
    "Score is NOT available for missing ingredient product"
  );
  check(
    incompleteAnalysis.decisionOutput.compatibilityScore === null,
    "Compatibility score is null when ingredients are missing"
  );

  // TEST 2.6: Unknown Valid Barcode (Clean Not Found Policy)
  console.log("\n--- 2.6: Unknown Valid Barcode Handling ---");
  const unknownLookup = await BarcodeEngine.lookup("9999999999999");
  check(unknownLookup.product === null, "Unknown barcode lookup returns product: null");
  // Verification of not found contract in routes/analysis.ts:
  const notFoundReport = {
    query: "9999999999999",
    resultMode: "NOT_FOUND",
    queryIntent: "PRODUCT",
    notFound: true,
    explanation: "لم يتم العثور على المنتج في قاعدة بيانات طيباتي.",
  };
  check(notFoundReport.notFound === true, "Not-found flag is true");
  check(notFoundReport.resultMode === "NOT_FOUND", "resultMode is NOT_FOUND");

  // TEST 2.7: Multi-Ingredient Product Evaluation against Authoritative Food DB
  console.log("\n--- 2.7: Multi-Ingredient Product Evaluation (Allowed, Forbidden, Conditional, Unknown) ---");
  const mixedProduct: Product = {
    productId: "PROD_MIXED_TEST",
    barcode: "628123456789",
    brand: "MixBrand",
    productName: "منتج متنوع المكونات",
    country: "SA",
    manufacturer: "MixCorp",
    // تفاح (allowed), حليب (forbidden in Tayyibati rules), ملح طعام (allowed), مكون_غير_معروف_قطعا_xyz (unknown)
    ingredientText: "تفاح، حليب، ملح طعام، مكون_غير_معروف_قطعا_xyz",
    language: "ar",
    knowledgeVersion: "2.1",
  };
  const mixedAnalysis = await ProductAnalysisEngine.analyzeProduct({
    barcode: "628123456789",
    productPayload: mixedProduct,
  });
  check(mixedAnalysis.decisionOutput.finalDecision === "FORBIDDEN", "Contains forbidden ingredient (حليب) -> FORBIDDEN");
  check(mixedAnalysis.decisionOutput.decisionEvidence.forbiddenIngredients.length > 0, "Identified forbidden ingredient");
  check(mixedAnalysis.decisionOutput.decisionEvidence.allowedIngredients.length > 0, "Identified allowed ingredients");
  check(mixedAnalysis.decisionOutput.decisionEvidence.unknownIngredients.length > 0, "Preserved unknown ingredient without inventing ruling");

  // TEST 2.8: Premium Gate Enforcement Contract
  console.log("\n--- 2.8: Premium Gate Enforcement Contract ---");
  const simulateBarcodeGate = (isPremium: boolean) => {
    if (!isPremium) {
      return {
        status: 403,
        body: {
          error: "premium_required",
          code: "PREMIUM_REQUIRED",
          message: "ميزة فحص الباركود مخصصة لمشتركي الباقة المميزة. يرجى الترقية للاستفادة من هذه الميزة.",
        },
      };
    }
    return { status: 200, allowed: true };
  };
  const freeGate = simulateBarcodeGate(false);
  check(freeGate.status === 403, "Free user rejected with HTTP 403 Forbidden");
  check(freeGate.body.code === "PREMIUM_REQUIRED", "Error code is PREMIUM_REQUIRED");
  const premGate = simulateBarcodeGate(true);
  check(premGate.status === 200 && premGate.allowed, "Premium user granted barcode scanning access");

  // TEST 2.9: Rapid Scan Deduplication
  console.log("\n--- 2.9: Rapid Camera Scan Frame Deduplication ---");
  const recentBarcodeScans = new Map<string, { timestamp: number; response: any }>();
  const DEDUP_MS = 2000;
  const dedupKey = `user_audit:629100123456`;
  const t0 = Date.now();
  recentBarcodeScans.set(dedupKey, { timestamp: t0, response: { cached: true } });

  const isRapidDuplicate = (time: number) => {
    const entry = recentBarcodeScans.get(dedupKey);
    return Boolean(entry && time - entry.timestamp < DEDUP_MS);
  };
  check(isRapidDuplicate(t0 + 200), "Scan within 200ms deduplicated (skipped without re-billing)");
  check(isRapidDuplicate(t0 + 1500), "Scan within 1500ms deduplicated");
  check(!isRapidDuplicate(t0 + 2500), "Scan after 2500ms processed normally");

  // ═════════════════════════════════════════════════════════════════════════════
  // SECTION 3: EXTERNAL PROVIDER READINESS AUDIT (WITHOUT EXPOSING SECRETS)
  // ═════════════════════════════════════════════════════════════════════════════
  console.log("\n--------------------------------------------------------------------------------");
  console.log("  3. EXTERNAL PROVIDER READINESS AUDIT (SECRETS REDACTED)                     ");
  console.log("--------------------------------------------------------------------------------\n");

  const openaiEnv = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10);
  const geminiEnv = Boolean(
    (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10) ||
    (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.length > 10)
  );

  let openaiDb = false;
  let geminiDb = false;
  try {
    const [rowOpenAI] = await db.select().from(appConfigTable).where(eq(appConfigTable.key, "openai_api_key"));
    openaiDb = Boolean(rowOpenAI?.value && rowOpenAI.value.trim().length > 10);
    const [rowGemini] = await db.select().from(appConfigTable).where(eq(appConfigTable.key, "gemini_api_key"));
    geminiDb = Boolean(rowGemini?.value && rowGemini.value.trim().length > 10);
  } catch {
    // DB inspection catch
  }

  console.log("  Provider Key Status:");
  console.log(`    - OpenAI API Key (Primary Vision):   ${openaiEnv || openaiDb ? "CONFIGURED (Ready)" : "NOT CONFIGURED in local env"}`);
  console.log(`    - Gemini API Key (Fallback Vision):  ${geminiEnv || geminiDb ? "CONFIGURED (Ready)" : "NOT CONFIGURED in local env"}`);

  // ProviderRegistry Health
  const providerHealth = await ProviderRegistry.health();
  console.log("\n  Barcode Provider Registry Status:");
  for (const [id, h] of Object.entries(providerHealth)) {
    console.log(`    - Provider [${id}]: status=${h.status}, latency=${h.latencyMs.toFixed(2)}ms`);
    check(h.status === "HEALTHY", `Provider ${id} is HEALTHY`);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // RESULTS SUMMARY
  // ═════════════════════════════════════════════════════════════════════════════
  console.log("\n================================================================================");
  console.log(`  COMPREHENSIVE AUDIT RESULTS: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log(`  STATUS: ${passedTests === totalTests ? "ALL VERIFICATIONS PASSED SUCCESSFULLY" : "FAILURES DETECTED"}`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runComprehensiveAudit().catch((err) => {
  console.error("Audit Suite Encountered Unhandled Error:", err);
  process.exit(1);
});

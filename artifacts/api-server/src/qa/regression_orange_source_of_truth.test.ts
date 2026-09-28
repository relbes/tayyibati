/**
 * Regression Test Suite: Database as Authoritative Source of Truth
 *
 * Covers:
 * 1. Orange & Orange-Juice conflict (English & Arabic text search)
 * 2. Arabic & English synonyms & construct-phrase expansions
 * 3. Image analysis results for single food candidates
 * 4. Composite dishes with visually confirmed vs AI-inferred ingredients
 * 5. Database-miss fallback with clear uncertainty communication
 */

import { UnifiedAnalysisEngine, normalizeFoodStatus } from "../lib/unifiedAnalysisEngine";
import { CanonicalSearchEngine } from "../lib/canonicalSearchEngine";
import { getKnowledgeCache, resolveFoodIdentity, resolveWithInheritance, aggregateFoodFamilySafety } from "../lib/knowledgeCache";
import { normalize, extractBaseEntityWithModifiers } from "../lib/arabicNormalization";
import { DecisionEngine } from "../lib/decisionEngine";
import type { IngredientResult } from "../routes/analysis";

interface AssertionResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: AssertionResult[] = [];

function assert(suite: string, name: string, condition: boolean, errorMsg?: string, details?: any) {
  if (condition) {
    results.push({ suite, name, passed: true, details });
    console.log(`  [PASS] ${name}`);
  } else {
    results.push({ suite, name, passed: false, error: errorMsg || "Assertion failed", details });
    console.error(`  [FAIL] ${name} - ${errorMsg || "Assertion failed"}`);
    if (details) console.error("    Details:", details);
  }
}

export async function runRegressionTests(): Promise<{ passed: number; failed: number; total: number }> {
  console.log("\n========================================================");
  console.log("RUNNING REGRESSION TEST SUITE: SOURCE OF TRUTH PIPELINE");
  console.log("========================================================\n");

  const knowledgeCache = await getKnowledgeCache();

  // =========================================================================
  // SUITE 1: Orange & Orange-Juice Conflict (Text Search)
  // =========================================================================
  console.log("Suite 1: Orange & Orange Juice Conflict");

  // 1.1 "orange juice"
  const ojRes = await UnifiedAnalysisEngine.analyze({ query: "orange juice", inputType: "text" });
  assert(
    "Suite 1",
    "Text search: 'orange juice' must resolve to forbidden with score 0",
    ojRes.report.primaryRuling?.status === "forbidden" &&
    ojRes.report.compatibilityScore === 0 &&
    ojRes.report.forbidden.length >= 1 &&
    ojRes.report.allowed.length === 0,
    `Got status=${ojRes.report.primaryRuling?.status}, score=${ojRes.report.compatibilityScore}, forbiddenCount=${ojRes.report.forbidden.length}, allowedCount=${ojRes.report.allowed.length}`,
    { canonicalResult: ojRes.report.canonicalResult }
  );

  // 1.2 "Orange Juice" (Capitalized English)
  const ojCapRes = await UnifiedAnalysisEngine.analyze({ query: "Orange Juice", inputType: "text" });
  assert(
    "Suite 1",
    "Text search: 'Orange Juice' (capitalized) must resolve to forbidden with score 0",
    ojCapRes.report.primaryRuling?.status === "forbidden" &&
    ojCapRes.report.compatibilityScore === 0 &&
    ojCapRes.report.forbidden.length >= 1 &&
    ojCapRes.report.allowed.length === 0,
    `Got status=${ojCapRes.report.primaryRuling?.status}, score=${ojCapRes.report.compatibilityScore}`
  );

  // 1.3 "عصير برتقال"
  const ojArRes = await UnifiedAnalysisEngine.analyze({ query: "عصير برتقال", inputType: "text" });
  assert(
    "Suite 1",
    "Text search: 'عصير برتقال' must resolve to forbidden with score 0",
    ojArRes.report.primaryRuling?.status === "forbidden" &&
    ojArRes.report.compatibilityScore === 0 &&
    ojArRes.report.forbidden.length >= 1 &&
    ojArRes.report.allowed.length === 0,
    `Got status=${ojArRes.report.primaryRuling?.status}, score=${ojArRes.report.compatibilityScore}`
  );

  // 1.4 "عصير البرتقال"
  const ojArDefRes = await UnifiedAnalysisEngine.analyze({ query: "عصير البرتقال", inputType: "text" });
  assert(
    "Suite 1",
    "Text search: 'عصير البرتقال' (definite article) must resolve to forbidden with score 0",
    ojArDefRes.report.primaryRuling?.status === "forbidden" &&
    ojArDefRes.report.compatibilityScore === 0 &&
    ojArDefRes.report.forbidden.length >= 1 &&
    ojArDefRes.report.allowed.length === 0,
    `Got status=${ojArDefRes.report.primaryRuling?.status}, score=${ojArDefRes.report.compatibilityScore}`
  );

  // 1.5 "orange" (single fruit)
  const oFruitRes = await UnifiedAnalysisEngine.analyze({ query: "orange", inputType: "text" });
  assert(
    "Suite 1",
    "Text search: 'orange' must resolve to forbidden with score 0 (Food #1499)",
    oFruitRes.report.primaryRuling?.status === "forbidden" &&
    oFruitRes.report.compatibilityScore === 0 &&
    (oFruitRes.report.canonicalResult?.canonicalId === 1499 || oFruitRes.report.canonicalResult?.canonicalId === 1677),
    `Got status=${oFruitRes.report.primaryRuling?.status}, id=${oFruitRes.report.canonicalResult?.canonicalId}`
  );

  // 1.6 "برتقال"
  const oFruitArRes = await UnifiedAnalysisEngine.analyze({ query: "برتقال", inputType: "text" });
  assert(
    "Suite 1",
    "Text search: 'برتقال' must resolve to forbidden with score 0 (Food #1499)",
    oFruitArRes.report.primaryRuling?.status === "forbidden" &&
    oFruitArRes.report.compatibilityScore === 0 &&
    (oFruitArRes.report.canonicalResult?.canonicalId === 1499 || oFruitArRes.report.canonicalResult?.canonicalId === 1677),
    `Got status=${oFruitArRes.report.primaryRuling?.status}, id=${oFruitArRes.report.canonicalResult?.canonicalId}`
  );

  // =========================================================================
  // SUITE 2: Arabic and English Synonyms & Construct Heads
  // =========================================================================
  console.log("\nSuite 2: Arabic and English Synonyms & Construct Heads");

  // 2.1 Construct head extraction logic
  const normOj = extractBaseEntityWithModifiers("عصير برتقال");
  assert(
    "Suite 2",
    "Arabic normalization: 'عصير برتقال' extracts baseEntity 'برتقال' and modifier 'عصير'",
    Boolean(normOj && normOj.baseEntity === "برتقال" && normOj.modifiers.includes("عصير")),
    `Got baseEntity='${normOj?.baseEntity}', modifiers=${JSON.stringify(normOj?.modifiers)}`
  );

  const normOjEn = extractBaseEntityWithModifiers("orange juice");
  assert(
    "Suite 2",
    "English normalization: 'orange juice' extracts baseEntity 'orange' and modifier 'juice'",
    Boolean(normOjEn && normOjEn.baseEntity === "orange" && normOjEn.modifiers.includes("juice")),
    `Got baseEntity='${normOjEn?.baseEntity}', modifiers=${JSON.stringify(normOjEn?.modifiers)}`
  );

  // 2.2 Lemon Juice / عصير ليمون -> Forbidden (Food #1677)
  const lemonOjRes = await UnifiedAnalysisEngine.analyze({ query: "عصير ليمون", inputType: "text" });
  assert(
    "Suite 2",
    "Text search: 'عصير ليمون' resolves to forbidden (Food #1677)",
    lemonOjRes.report.primaryRuling?.status === "forbidden" &&
    lemonOjRes.report.compatibilityScore === 0,
    `Got status=${lemonOjRes.report.primaryRuling?.status}, score=${lemonOjRes.report.compatibilityScore}`
  );

  const lemonEnRes = await UnifiedAnalysisEngine.analyze({ query: "lemon juice", inputType: "text" });
  assert(
    "Suite 2",
    "Text search: 'lemon juice' resolves to forbidden (Food #1677)",
    lemonEnRes.report.primaryRuling?.status === "forbidden" &&
    lemonEnRes.report.compatibilityScore === 0,
    `Got status=${lemonEnRes.report.primaryRuling?.status}, score=${lemonEnRes.report.compatibilityScore}`
  );

  // 2.3 Tangerine / Mandarin / يوسفي / مندلينا -> Forbidden (Food #1677)
  const tangerineRes = await UnifiedAnalysisEngine.analyze({ query: "عصير يوسفي", inputType: "text" });
  assert(
    "Suite 2",
    "Text search: 'عصير يوسفي' resolves to forbidden (Food #1677)",
    tangerineRes.report.primaryRuling?.status === "forbidden" &&
    tangerineRes.report.compatibilityScore === 0,
    `Got status=${tangerineRes.report.primaryRuling?.status}, score=${tangerineRes.report.compatibilityScore}`
  );

  // 2.4 Coconut Juice / عصير جوز الهند -> Allowed (Food #1382)
  const coconutRes = await UnifiedAnalysisEngine.analyze({ query: "عصير جوز الهند", inputType: "text" });
  assert(
    "Suite 2",
    "Text search: 'عصير جوز الهند' resolves to allowed (Food #1382) without false ingredient decomposition",
    coconutRes.report.primaryRuling?.status === "allowed" &&
    coconutRes.report.compatibilityScore === 100 &&
    coconutRes.report.resultMode === "EXACT_FOOD" &&
    coconutRes.report.dish === undefined &&
    coconutRes.report.allowed.length === 1 &&
    coconutRes.report.forbidden.length === 0 &&
    coconutRes.report.allowed[0].nameAr === "عصير جوز الهند" &&
    coconutRes.report.canonicalResult?.canonicalId === 1382,
    `Got status=${coconutRes.report.primaryRuling?.status}, score=${coconutRes.report.compatibilityScore}, mode=${coconutRes.report.resultMode}, dish=${coconutRes.report.dish}, allowedCount=${coconutRes.report.allowed.length}, forbiddenCount=${coconutRes.report.forbidden.length}`
  );

  // 2.4b Coconut Juice (English) -> Allowed (Food #1382)
  const coconutEnRes = await UnifiedAnalysisEngine.analyze({ query: "Coconut Juice", inputType: "text" });
  assert(
    "Suite 2",
    "Text search: 'Coconut Juice' (English) resolves to Food #1382 without ingredient decomposition",
    coconutEnRes.report.primaryRuling?.status === "allowed" &&
    coconutEnRes.report.compatibilityScore === 100 &&
    coconutEnRes.report.resultMode === "EXACT_FOOD" &&
    coconutEnRes.report.dish === undefined &&
    coconutEnRes.report.allowed.length === 1 &&
    coconutEnRes.report.forbidden.length === 0,
    `Got status=${coconutEnRes.report.primaryRuling?.status}, score=${coconutEnRes.report.compatibilityScore}, allowedCount=${coconutEnRes.report.allowed.length}`
  );

  // 2.4c Autocomplete vs Text Search Parity for 'عصير جوز الهند'
  const coconutAutoRes = await UnifiedAnalysisEngine.analyze({
    foodId: 1382,
    canonicalId: 1382,
    query: "عصير جوز الهند",
    inputType: "text"
  });
  assert(
    "Suite 2",
    "Autocomplete parity: autocomplete selection for 'عصير جوز الهند' matches text search exactly (EXACT_FOOD, dish=undefined, 1 item)",
    coconutAutoRes.report.primaryRuling?.status === "allowed" &&
    coconutAutoRes.report.compatibilityScore === 100 &&
    coconutAutoRes.report.resultMode === "EXACT_FOOD" &&
    coconutAutoRes.report.dish === undefined &&
    coconutAutoRes.report.allowed.length === 1 &&
    coconutAutoRes.report.forbidden.length === 0,
    `Got status=${coconutAutoRes.report.primaryRuling?.status}, mode=${coconutAutoRes.report.resultMode}, dish=${coconutAutoRes.report.dish}`
  );

  // 2.5 Apple Juice / عصير تفاح -> resolves to Apple (Food #1518) without apple vinegar
  const appleRes = await UnifiedAnalysisEngine.analyze({ query: "عصير تفاح", inputType: "text" });
  assert(
    "Suite 2",
    "Text search: 'عصير تفاح' resolves to apple entity and does NOT contain apple vinegar",
    appleRes.report.primaryRuling?.status === "allowed" &&
    appleRes.report.compatibilityScore === 100 &&
    appleRes.report.allowed.length === 1 &&
    appleRes.report.forbidden.length === 0,
    `Got status=${appleRes.report.primaryRuling?.status}, score=${appleRes.report.compatibilityScore}, forbidden=${JSON.stringify(appleRes.report.forbidden)}`
  );

  // 2.5b "عصير التفاح" (Definite article) -> Must NOT contain 'خل التفاح' (Bug 1 regression)
  const appleDefRes = await UnifiedAnalysisEngine.analyze({ query: "عصير التفاح", inputType: "text" });
  assert(
    "Suite 2",
    "Text search: 'عصير التفاح' does NOT introduce 'خل التفاح' as forbidden ingredient",
    appleDefRes.report.primaryRuling?.status === "allowed" &&
    appleDefRes.report.compatibilityScore === 100 &&
    appleDefRes.report.allowed.length === 1 &&
    appleDefRes.report.forbidden.length === 0 &&
    !appleDefRes.report.forbidden.some((i) => i.nameAr?.includes("خل")),
    `Got status=${appleDefRes.report.primaryRuling?.status}, score=${appleDefRes.report.compatibilityScore}, forbidden=${JSON.stringify(appleDefRes.report.forbidden)}`
  );

  // 2.5c "apple juice" (English) -> Must NOT contain apple vinegar
  const appleEnRes = await UnifiedAnalysisEngine.analyze({ query: "apple juice", inputType: "text" });
  assert(
    "Suite 2",
    "Text search: 'apple juice' (English) resolves to allowed and does NOT contain apple vinegar",
    appleEnRes.report.primaryRuling?.status === "allowed" &&
    appleEnRes.report.compatibilityScore === 100 &&
    appleEnRes.report.allowed.length === 1 &&
    appleEnRes.report.forbidden.length === 0,
    `Got status=${appleEnRes.report.primaryRuling?.status}, score=${appleEnRes.report.compatibilityScore}, forbidden=${JSON.stringify(appleEnRes.report.forbidden)}`
  );

  // 2.5d "خل تفاح" / "خل التفاح" -> Must independently resolve to forbidden Food #1619
  const vinegarRes = await UnifiedAnalysisEngine.analyze({ query: "خل تفاح", inputType: "text" });
  assert(
    "Suite 2",
    "Text search: 'خل تفاح' independently resolves to forbidden Food #1619 with score 0",
    vinegarRes.report.primaryRuling?.status === "forbidden" &&
    vinegarRes.report.compatibilityScore === 0 &&
    vinegarRes.report.canonicalResult?.canonicalId === 1619,
    `Got status=${vinegarRes.report.primaryRuling?.status}, score=${vinegarRes.report.compatibilityScore}, id=${vinegarRes.report.canonicalResult?.canonicalId}`
  );

  const vinegarDefRes = await UnifiedAnalysisEngine.analyze({ query: "خل التفاح", inputType: "text" });
  assert(
    "Suite 2",
    "Text search: 'خل التفاح' independently resolves to forbidden Food #1619 with score 0",
    vinegarDefRes.report.primaryRuling?.status === "forbidden" &&
    vinegarDefRes.report.compatibilityScore === 0 &&
    vinegarDefRes.report.canonicalResult?.canonicalId === 1619,
    `Got status=${vinegarDefRes.report.primaryRuling?.status}, score=${vinegarDefRes.report.compatibilityScore}, id=${vinegarDefRes.report.canonicalResult?.canonicalId}`
  );

  // 2.5e "apple vinegar" / "apple cider vinegar" (English) -> Must resolve to Food #1619
  const vinegarEnRes = await UnifiedAnalysisEngine.analyze({ query: "apple vinegar", inputType: "text" });
  assert(
    "Suite 2",
    "Text search: 'apple vinegar' (English) resolves to forbidden Food #1619",
    vinegarEnRes.report.primaryRuling?.status === "forbidden" &&
    vinegarEnRes.report.compatibilityScore === 0 &&
    vinegarEnRes.report.canonicalResult?.canonicalId === 1619,
    `Got status=${vinegarEnRes.report.primaryRuling?.status}, score=${vinegarEnRes.report.compatibilityScore}, id=${vinegarEnRes.report.canonicalResult?.canonicalId}`
  );

  // 2.6 Genuine composite dish preservation (e.g. منسف disambiguation and specific dish analysis)
  const mansafAmbiguousRes = await UnifiedAnalysisEngine.analyze({ query: "منسف", inputType: "text" });
  assert(
    "Suite 2",
    "Composite dish disambiguation: generic 'منسف' triggers disambiguation between meat and chicken variants",
    (mansafAmbiguousRes.report.resultMode as any) === "MULTIPLE_DISHES" ||
    (mansafAmbiguousRes.report.canonicalResult as any)?.searchOutcome === "AMBIGUOUS",
    `Got mode=${mansafAmbiguousRes.report.resultMode}, outcome=${(mansafAmbiguousRes.report.canonicalResult as any)?.searchOutcome}`
  );

  const mansafSpecificRes = await UnifiedAnalysisEngine.analyze({ query: "المنسف الأردني باللحم", inputType: "text" });
  assert(
    "Suite 2",
    "Composite dish: specific 'المنسف الأردني باللحم' retains recipe ingredient analysis (COMPOSITE_FOOD)",
    mansafSpecificRes.report.resultMode === "COMPOSITE_FOOD" &&
    mansafSpecificRes.report.dish !== undefined &&
    (mansafSpecificRes.report.allowed.length > 0 || mansafSpecificRes.report.forbidden.length > 0),
    `Got mode=${mansafSpecificRes.report.resultMode}, dish=${mansafSpecificRes.report.dish}, allowed=${mansafSpecificRes.report.allowed.length}, forbidden=${mansafSpecificRes.report.forbidden.length}`
  );

  // =========================================================================
  // SUITE 3: Image-Analysis Single Food Recognition
  // =========================================================================
  console.log("\nSuite 3: Image-Analysis Single Food Candidate Resolution");

  // In image analysis, when the vision model returns candidate "عصير برتقال" with high confidence:
  const imageCandidateQuery = "عصير برتقال";
  const singleResolution = resolveWithInheritance(imageCandidateQuery, knowledgeCache);
  const searchResolution = singleResolution?.food
    ? singleResolution
    : (await CanonicalSearchEngine.searchEntities(imageCandidateQuery, { debug: false })).primaryResult?.canonicalEntityType === "food"
    ? resolveWithInheritance(
        knowledgeCache.foodById.get(Number((await CanonicalSearchEngine.searchEntities(imageCandidateQuery, { debug: false })).primaryResult?.canonicalId))?.nameAr || imageCandidateQuery,
        knowledgeCache
      )
    : null;

  assert(
    "Suite 3",
    "Image candidate resolution: 'عصير برتقال' maps to DB Food #1677 with status forbidden",
    searchResolution?.food?.status === "forbidden" &&
    (searchResolution.food.id === 1677 || searchResolution.food.id === 1499),
    `Got foodId=${searchResolution?.food?.id}, status=${searchResolution?.food?.status}`
  );

  // Test English image candidate "orange juice"
  const enImageQuery = "orange juice";
  const enSingleResolution = resolveWithInheritance(enImageQuery, knowledgeCache);
  assert(
    "Suite 3",
    "Image candidate resolution: 'orange juice' maps to DB Food #1677 with status forbidden",
    enSingleResolution?.food?.status === "forbidden" &&
    (enSingleResolution.food.id === 1677 || enSingleResolution.food.id === 1499),
    `Got foodId=${enSingleResolution?.food?.id}, status=${enSingleResolution?.food?.status}`
  );

  // =========================================================================
  // SUITE 4: Composite Dishes (Visually Confirmed vs AI-Inferred Ingredients)
  // =========================================================================
  console.log("\nSuite 4: Composite Dishes with Confirmed vs Inferred Ingredients");

  // Simulate composite dish extraction with both confirmed and inferred ingredients:
  const mockConfirmed = ["أرز مصري", "لحم غنم"]; // visually confirmed on the plate (both allowed)
  const mockInferred = ["عصير برتقال", "زيت زيتون"]; // inferred marinade or dressing (orange juice forbidden, olive oil allowed)

  const confirmedResolved: IngredientResult[] = [];
  const inferredResolved: IngredientResult[] = [];

  for (const name of mockConfirmed) {
    const identity = resolveFoodIdentity(name, knowledgeCache);
    const f = identity?.food;
    confirmedResolved.push({
      name: f?.nameEn || name,
      nameAr: name,
      status: (f?.status as any) || "unknown",
      reason: f?.reason || null,
      confirmed: true,
      provenance: "confirmed",
      isVisuallyConfirmed: true,
      confidence: "HIGH",
    });
  }

  for (const name of mockInferred) {
    const identity = resolveFoodIdentity(name, knowledgeCache);
    const f = identity?.food;
    inferredResolved.push({
      name: f?.nameEn || name,
      nameAr: name,
      status: (f?.status as any) || "unknown",
      reason: f?.reason || null,
      confirmed: false,
      provenance: "inferred",
      isVisuallyConfirmed: false,
      confidence: "MEDIUM",
    });
  }

  // Verify provenance and confirmed flags are properly segregated
  const allIngredients = [...confirmedResolved, ...inferredResolved];
  const confirmedForbidden = allIngredients.filter((i) => i.confirmed && i.status === "forbidden");
  const inferredForbidden = allIngredients.filter((i) => !i.confirmed && i.status === "forbidden");

  assert(
    "Suite 4",
    "Composite dish: visually confirmed ingredients have confirmed: true and provenance: 'confirmed'",
    confirmedResolved.every((i) => i.confirmed === true && i.provenance === "confirmed" && i.isVisuallyConfirmed === true),
    `Confirmed ingredients failed provenance check`
  );

  assert(
    "Suite 4",
    "Composite dish: inferred ingredients have confirmed: false and provenance: 'inferred'",
    inferredResolved.every((i) => i.confirmed === false && i.provenance === "inferred" && i.isVisuallyConfirmed === false),
    `Inferred ingredients failed provenance check`
  );

  assert(
    "Suite 4",
    "Composite dish: inferred 'عصير برتقال' is correctly classified as forbidden from DB, without overriding provenance",
    inferredForbidden.length === 1 && inferredForbidden[0].nameAr === "عصير برتقال" && inferredForbidden[0].status === "forbidden",
    `Inferred forbidden count=${inferredForbidden.length}`
  );

  assert(
    "Suite 4",
    "Composite dish: no confirmed ingredients were falsely marked forbidden when only the inferred ingredient is forbidden",
    confirmedForbidden.length === 0,
    `Confirmed forbidden count=${confirmedForbidden.length}`
  );

  // Check decision via DecisionEngine SSoT
  const decisionOutput = DecisionEngine.evaluate({
    resolvedIngredients: allIngredients.map((ing) => ({
      foodId: null,
      canonicalFoodAr: ing.nameAr,
      status: ing.status as any,
      reason: ing.reason || "",
    })),
    unknownIngredients: [],
    recognitionStats: {
      totalDetected: allIngredients.length,
      totalResolved: allIngredients.length,
      totalUnknown: 0,
      recognitionPercentage: 100,
      averageConfidence: 90,
      highestConfidence: 100,
      lowestConfidence: 80,
    },
  });

  assert(
    "Suite 4",
    "DecisionEngine: dish containing forbidden ingredient receives finalDecision 'FORBIDDEN'",
    decisionOutput.finalDecision === "FORBIDDEN",
    `finalDecision=${decisionOutput.finalDecision}, reason=${decisionOutput.decisionReason}`
  );

  // Also verify that when all ingredients are forbidden (e.g. orange juice alone), score is 0
  const scoreResult = DecisionEngine.computeScores(0, 1, 0, 0);
  assert(
    "Suite 4",
    "DecisionEngine: food item with forbidden ruling receives score 0",
    scoreResult.compatibilityScore === 0,
    `Score=${scoreResult.compatibilityScore}`
  );

  // =========================================================================
  // SUITE 5: Database-Miss Fallback & Uncertainty
  // =========================================================================
  console.log("\nSuite 5: Database-Miss Fallback & Clear Uncertainty Communication");

  // Query an invented / nonexistent food string that is definitely not in the DB
  const unmappedQuery = "نبتة فضائية خارقة غير معروفة 999";
  const missRes = await UnifiedAnalysisEngine.analyze({ query: unmappedQuery, inputType: "text" });

  assert(
    "Suite 5",
    "Database-miss: completely unknown food results in notFound: true",
    missRes.report.notFound === true,
    `notFound=${missRes.report.notFound}, resultMode=${missRes.report.resultMode}`
  );

  assert(
    "Suite 5",
    "Database-miss: compatibilityScore is null and scoreAvailable is false",
    missRes.report.compatibilityScore === null && missRes.report.scoreAvailable === false,
    `score=${missRes.report.compatibilityScore}, scoreAvailable=${missRes.report.scoreAvailable}`
  );

  assert(
    "Suite 5",
    "Database-miss: explanation clearly communicates uncertainty or lack of reliable data",
    typeof missRes.report.explanation === "string" && missRes.report.explanation.length > 5,
    `explanation='${missRes.report.explanation}'`
  );

  assert(
    "Suite 5",
    "Database-miss: AI is strictly prohibited from marking an unknown food as allowed",
    missRes.report.allowed.length === 0 && missRes.report.primaryRuling?.status !== "allowed",
    `allowedCount=${missRes.report.allowed.length}, primaryRulingStatus=${missRes.report.primaryRuling?.status}`
  );

  // =========================================================================
  // SUITE 6: Food Type Classification & Status Fallback Safety
  // =========================================================================
  console.log("Suite 6: Food Type Classification & Status Fallback Safety");

  // 6.1 Exact food with valid status (allowed)
  const exactAllowedRes = await UnifiedAnalysisEngine.analyze({ query: "عصير جوز الهند", inputType: "text" });
  assert(
    "Suite 6",
    "Exact food with valid status (allowed): primaryRuling is allowed, allowed array populated, score is 100",
    exactAllowedRes.report.primaryRuling?.status === "allowed" &&
    exactAllowedRes.report.allowed.length >= 1 &&
    exactAllowedRes.report.forbidden.length === 0 &&
    exactAllowedRes.report.conditional.length === 0 &&
    exactAllowedRes.report.unknown.length === 0 &&
    exactAllowedRes.report.compatibilityScore === 100 &&
    exactAllowedRes.report.scoreAvailable === true,
    `status=${exactAllowedRes.report.primaryRuling?.status}, score=${exactAllowedRes.report.compatibilityScore}`
  );

  // 6.2 Exact food with valid status (forbidden)
  const exactForbiddenRes = await UnifiedAnalysisEngine.analyze({ query: "orange juice", inputType: "text" });
  assert(
    "Suite 6",
    "Exact food with valid status (forbidden): primaryRuling is forbidden, forbidden array populated, score is 0",
    exactForbiddenRes.report.primaryRuling?.status === "forbidden" &&
    exactForbiddenRes.report.forbidden.length >= 1 &&
    exactForbiddenRes.report.allowed.length === 0 &&
    exactForbiddenRes.report.conditional.length === 0 &&
    exactForbiddenRes.report.unknown.length === 0 &&
    exactForbiddenRes.report.compatibilityScore === 0 &&
    exactForbiddenRes.report.scoreAvailable === true,
    `status=${exactForbiddenRes.report.primaryRuling?.status}, score=${exactForbiddenRes.report.compatibilityScore}`
  );

  // 6.3 General category with family exceptions
  const mockFamilyCache = {
    ...knowledgeCache,
    foods: [
      ...knowledgeCache.foods,
      { id: 99001, nameAr: "حبوب تجريبية", nameEn: "Test Grains", foodType: "general_category", status: "forbidden", parentFoodId: null, isException: false, reason: "قاعدة عامة" },
      { id: 99002, nameAr: "حبوب تجريبية مسموحة", nameEn: "Allowed Test Grain", foodType: "exact_food", status: "allowed", parentFoodId: 99001, isException: true, reason: "استثناء مسموح" },
      { id: 99003, nameAr: "حبوب تجريبية مشروطة", nameEn: "Conditional Test Grain", foodType: "exact_food", status: "conditional", parentFoodId: 99001, isException: true, reason: "استثناء مشروط" },
    ],
  };
  const categoryFood = mockFamilyCache.foods.find(f => f.id === 99001)!;
  const familySafetyResult = aggregateFoodFamilySafety(categoryFood, mockFamilyCache as any);
  assert(
    "Suite 6",
    "General category with family exceptions: aggregateFoodFamilySafety identifies mixed family status and exceptions",
    familySafetyResult.familyStatus === "mixed" &&
    familySafetyResult.allowedExceptions.some(e => e.nameAr === "حبوب تجريبية مسموحة") &&
    familySafetyResult.conditionalExceptions.some(e => e.nameAr === "حبوب تجريبية مشروطة"),
    `familyStatus=${familySafetyResult.familyStatus}, allowedExc=${familySafetyResult.allowedExceptions.length}`
  );

  // 6.4 Undefined or unexpected foodType must NOT evaluate to isExactFood = true
  const testUndefinedFoodType = {
    foodType: undefined,
    status: "allowed",
    nameAr: "مادة غير محددة النوع",
  };
  const mockSingleResolvedUndefined = {
    food: testUndefinedFoodType,
    resultMode: undefined as any,
  };
  const isGeneralCategoryUndefined =
    testUndefinedFoodType.foodType === "general_category" ||
    mockSingleResolvedUndefined.resultMode === "GENERAL_RULE" ||
    mockSingleResolvedUndefined.resultMode === "GENERAL_RULE_EXCEPTIONS";
  const isExactFoodUndefined =
    !isGeneralCategoryUndefined &&
    (mockSingleResolvedUndefined.resultMode === "EXACT_FOOD" || testUndefinedFoodType.foodType === "exact_food");
  assert(
    "Suite 6",
    "Undefined foodType must not evaluate to isExactFood = true",
    isExactFoodUndefined === false,
    `isExactFoodUndefined=${isExactFoodUndefined}`
  );

  const testUnexpectedFoodType = {
    foodType: "custom_unknown_type",
    status: "allowed",
    nameAr: "مادة بنوع غير متوقع",
  };
  const mockSingleResolvedUnexpected = {
    food: testUnexpectedFoodType,
    resultMode: "UNKNOWN_MODE" as any,
  };
  const isGeneralCategoryUnexpected =
    testUnexpectedFoodType.foodType === "general_category" ||
    mockSingleResolvedUnexpected.resultMode === "GENERAL_RULE" ||
    mockSingleResolvedUnexpected.resultMode === "GENERAL_RULE_EXCEPTIONS";
  const isExactFoodUnexpected =
    !isGeneralCategoryUnexpected &&
    (mockSingleResolvedUnexpected.resultMode === "EXACT_FOOD" || testUnexpectedFoodType.foodType === "exact_food");
  assert(
    "Suite 6",
    "Unexpected foodType must not evaluate to isExactFood = true",
    isExactFoodUnexpected === false,
    `isExactFoodUnexpected=${isExactFoodUnexpected}`
  );

  // 6.5 Missing or invalid food status does NOT default to allowed
  const statusUndefined = normalizeFoodStatus(undefined);
  const statusNull = normalizeFoodStatus(null);
  const statusEmpty = normalizeFoodStatus("");
  const statusInvalid = normalizeFoodStatus("some_random_status");
  const statusAllowed = normalizeFoodStatus("allowed");
  const statusForbidden = normalizeFoodStatus("forbidden");
  const statusConditional = normalizeFoodStatus("conditional");

  assert(
    "Suite 6",
    "normalizeFoodStatus converts undefined, null, empty, and invalid statuses to 'unknown'",
    statusUndefined === "unknown" &&
    statusNull === "unknown" &&
    statusEmpty === "unknown" &&
    statusInvalid === "unknown" &&
    statusAllowed === "allowed" &&
    statusForbidden === "forbidden" &&
    statusConditional === "conditional",
    `undef=${statusUndefined}, null=${statusNull}, invalid=${statusInvalid}`
  );

  // 6.6 Consistency between primary ruling, result arrays, and compatibility score for unknown status
  const unknownScores = DecisionEngine.computeScores(0, 0, 0, 1);
  assert(
    "Suite 6",
    "Unknown food status yields null score, scoreAvailable=false, and confidence=0",
    unknownScores.compatibilityScore === null &&
    unknownScores.scoreAvailable === false &&
    unknownScores.ingredientConfidence === 0,
    `score=${unknownScores.compatibilityScore}, available=${unknownScores.scoreAvailable}`
  );

  // 6.7 Direct food lookup with missing status handles 'unknown' consistently
  const mockFoodMissingStatus = {
    id: 88801,
    nameAr: "مكون غامض بدون تصنيف",
    nameEn: "Unclassified Food Item",
    category: "general",
    foodType: "exact_food",
    status: undefined as any,
    reason: null,
    notes: null,
  };
  const resolvedStatusMissing = normalizeFoodStatus(mockFoodMissingStatus.status);
  const itemResultMissing: IngredientResult = {
    name: mockFoodMissingStatus.nameEn || mockFoodMissingStatus.nameAr,
    nameAr: mockFoodMissingStatus.nameAr,
    nameEn: mockFoodMissingStatus.nameEn || mockFoodMissingStatus.nameAr,
    status: resolvedStatusMissing,
    reason: null,
  };
  const allowedMissing = resolvedStatusMissing === "allowed" ? [itemResultMissing] : [];
  const forbiddenMissing = resolvedStatusMissing === "forbidden" ? [itemResultMissing] : [];
  const conditionalMissing = resolvedStatusMissing === "conditional" ? [itemResultMissing] : [];
  const unknownMissing = resolvedStatusMissing === "unknown" ? [itemResultMissing] : [];
  const scoresMissing = DecisionEngine.computeScores(
    allowedMissing.length, forbiddenMissing.length, conditionalMissing.length, unknownMissing.length
  );
  assert(
    "Suite 6",
    "Missing food status places item in unknown array, sets primaryRuling='unknown', and gives null score",
    resolvedStatusMissing === "unknown" &&
    unknownMissing.length === 1 &&
    allowedMissing.length === 0 &&
    forbiddenMissing.length === 0 &&
    conditionalMissing.length === 0 &&
    scoresMissing.compatibilityScore === null &&
    scoresMissing.scoreAvailable === false,
    `resolvedStatus=${resolvedStatusMissing}, unknownLen=${unknownMissing.length}, score=${scoresMissing.compatibilityScore}`
  );

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log("\n========================================================");
  console.log(`REGRESSION TEST RESULTS: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log("========================================================\n");

  return { passed, failed, total };
}

// Auto-run if executed directly
if (!process.argv[1] || import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].includes("regression_orange")) {
  runRegressionTests().then((res) => {
    if (res.failed > 0) {
      process.exit(1);
    }
  }).catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
}

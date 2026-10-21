import { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";
import { getKnowledgeCache, clearKnowledgeCache } from "./lib/knowledgeCache";
import { warmDishEngineCache } from "./lib/dishCompatibilityEngine";
import { FoodResolutionEngine } from "./lib/foodResolutionEngine";
import dotenv from "dotenv";

dotenv.config();

async function runBiryaniAndKiriRegressionSuite() {
  console.log("============================================================");
  console.log("TAYYIBATI BIRYANI & KIRI REGRESSION VERIFICATION SUITE");
  console.log("============================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, detail: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  [PASS] ${testName}`);
      console.log(`         -> ${detail}`);
    } else {
      console.error(`  [FAIL] ${testName}`);
      console.error(`         -> ${detail}`);
    }
  }

  // Ensure test fixture is null to test live DB
  CanonicalSearchEngine.setTestFixture(null);
  clearKnowledgeCache();

  console.log("--- 1. Testing Biryani Fix & Regional Dishes ---");
  const dCache = await warmDishEngineCache();
  const kCache = await getKnowledgeCache();
  await CanonicalSearchEngine.buildIndexes();

  // Test 1.1: Dish Cache Parity (Exact 560 DB dishes, 0 synthetic dishes)
  assert(
    dCache.dishes.length === 560,
    "Live Dish Cache Count equals 560 (100% database parity)",
    `Cache size: ${dCache.dishes.length} (Expected: 560)`
  );

  // Test 1.2: Synthetic dish ID 9998 does NOT exist in cache
  const dish9998 = dCache.dishesById.get(9998);
  assert(
    dish9998 === undefined,
    "Synthetic dish ID 9998 is completely absent from dish cache",
    `Dish 9998 found: ${Boolean(dish9998)}`
  );

  // Test 1.3: Search for generic 'برياني' must NOT return synthetic #9998
  const resGenBiryani = await CanonicalSearchEngine.searchEntities("برياني");
  const pGenBiryani = resGenBiryani.primaryResult;
  assert(
    pGenBiryani?.canonicalId !== 9998,
    "Query 'برياني' never returns synthetic dish #9998",
    `Resolved: #${pGenBiryani?.canonicalId || 0} "${pGenBiryani?.canonicalName || "NONE"}" (searchOutcome: ${resGenBiryani.searchOutcome})`
  );

  // Test 1.4: Clarification flow for generic 'برياني'
  const resolutionRes = await FoodResolutionEngine.resolve("برياني", dCache.dishes, 80);
  assert(
    resolutionRes.needsClarification === true || Boolean(resolutionRes.questionAr),
    "FoodResolutionEngine triggers clarification for generic 'برياني'",
    `needsClarification: ${resolutionRes.needsClarification} | Question: ${resolutionRes.questionAr || "NONE"}`
  );

  // Test 1.5 - 1.11: The 7 regional Biryani dishes in database resolve correctly
  const regionalBiryanis = [
    { name: "البرياني العدني", expectedId: 1004 },
    { name: "البرياني الحيدر آبادي (Kacchi Biryani)", expectedId: 1005 },
    { name: "البرياني اللكناوي / الأواذي (Pakki Biryani)", expectedId: 1006 },
    { name: "البرياني السندي", expectedId: 1007 },
    { name: "البرياني الخليجي", expectedId: 1008 },
    { name: "البرياني بالخضار", expectedId: 1009 },
    { name: "برياني كلكتا", expectedId: 1010 },
  ];

  for (const rb of regionalBiryanis) {
    const res = await CanonicalSearchEngine.searchEntities(rb.name);
    const p = res.primaryResult;
    assert(
      p?.canonicalId === rb.expectedId,
      `Regional Biryani '${rb.name}' resolves to ID #${rb.expectedId}`,
      `Resolved: #${p?.canonicalId} "${p?.canonicalName}" (Confidence: ${p?.confidence}%)`
    );
  }

  // -------------------------------------------------------------------------
  // 2. Testing Kiri Search Collision Fix (Live DB state: Kiri not inserted)
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Testing Kiri Search Collision Fix on Live DB ---");

  // Test 2.1: 'كيري' must NOT resolve to forbidden #1578
  const resKiri = await CanonicalSearchEngine.searchEntities("كيري");
  const pKiri = resKiri.primaryResult || resKiri.displayFoods?.[0];
  assert(
    pKiri?.canonicalId !== 1578,
    "Query 'كيري' does NOT resolve to forbidden Food #1578",
    `Resolved: #${pKiri?.canonicalId || 0} "${pKiri?.canonicalName || "BLOCKED / NOT_FOUND"}" (Outcome: ${resKiri.searchOutcome || "NOT_FOUND"})`
  );

  // Test 2.2: 'الكيري' must NOT resolve to forbidden #1578
  const resAlKiri = await CanonicalSearchEngine.searchEntities("الكيري");
  const pAlKiri = resAlKiri.primaryResult || resAlKiri.displayFoods?.[0];
  assert(
    pAlKiri?.canonicalId !== 1578,
    "Query 'الكيري' does NOT resolve to forbidden Food #1578",
    `Resolved: #${pAlKiri?.canonicalId || 0} "${pAlKiri?.canonicalName || "BLOCKED / NOT_FOUND"}" (Outcome: ${resAlKiri.searchOutcome || "NOT_FOUND"})`
  );

  // Test 2.3: 'طعمة' MUST continue to resolve to forbidden #1578
  const resTaama = await CanonicalSearchEngine.searchEntities("طعمة");
  const pTaama = resTaama.primaryResult || resTaama.displayFoods?.[0];
  const food1578Status = kCache.foodById.get(1578)?.status;
  assert(
    pTaama?.canonicalId === 1578 && food1578Status === "forbidden",
    "Query 'طعمة' continues to resolve to forbidden Food #1578",
    `Resolved: #${pTaama?.canonicalId} "${pTaama?.canonicalName}" (status: ${food1578Status})`
  );

  // Test 2.4: 'لبنيتا' MUST continue to resolve to forbidden #1578
  const resLabnita = await CanonicalSearchEngine.searchEntities("لبنيتا");
  const pLabnita = resLabnita.primaryResult || resLabnita.displayFoods?.[0];
  assert(
    pLabnita?.canonicalId === 1578 && food1578Status === "forbidden",
    "Query 'لبنيتا' continues to resolve to forbidden Food #1578",
    `Resolved: #${pLabnita?.canonicalId} "${pLabnita?.canonicalName}" (status: ${food1578Status})`
  );

  // -------------------------------------------------------------------------
  // 3. Testing Future Kiri Insertion in Isolated In-Memory Fixture
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Testing Isolated Fixture with Dedicated Kiri Cheese #2001 ---");
  const testFoods = [
    { id: 1314, nameAr: "خبز التوست الابيض", nameEn: "Whole Wheat Toast", category: "Grains & Starches", status: "forbidden" },
    { id: 1551, nameAr: "توست القمح الكامل / النخالة", nameEn: "Whole Grain Toast", category: "Grains & Starches", status: "allowed" },
    { id: 1578, nameAr: "الكيري / لبنيتا / طعمة", nameEn: "Cream Cheese Spreads", category: "Dairy & Cheese", status: "forbidden" },
    { id: 2001, nameAr: "جبنة كيري", nameEn: "Kiri Cheese", category: "Permitted Cheeses", status: "allowed" },
  ];
  const testAliases = [
    { id: 1, foodId: 2001, aliasAr: "كيري", aliasType: "synonym", isCanonical: true, priority: 100 },
    { id: 2, foodId: 2001, aliasAr: "الكيري", aliasType: "synonym", isCanonical: true, priority: 100 },
  ];

  CanonicalSearchEngine.setTestFixture({
    knowledgeCache: {
      foods: testFoods,
      aliases: testAliases,
      foodById: new Map(testFoods.map((f: any) => [f.id, f])),
      lastLoaded: Date.now(),
      entities: [],
      categories: [],
    },
    dishCache: {
      dishes: [],
      dishesById: new Map(),
      dishesByNormAr: new Map(),
      dishAliasesByNormAr: new Map(),
      dishIngredientsByDishId: new Map(),
      dishCountriesByDishId: new Map(),
      lastLoaded: Date.now(),
    },
  });

  // Test 3.1: In fixture with Kiri food, 'كيري' resolves to allowed Kiri #2001
  const fResKiri = await CanonicalSearchEngine.searchEntities("كيري");
  const fPKiri = fResKiri.displayFoods?.[0] || fResKiri.primaryResult;
  assert(
    fPKiri?.canonicalId === 2001,
    "Fixture Query 'كيري' -> resolves cleanly to separate allowed Kiri #2001",
    `Resolved: #${fPKiri?.canonicalId} "${fPKiri?.canonicalName}" (NOT #1578)`
  );

  // Test 3.2: In fixture with Kiri food, 'الكيري' resolves to allowed Kiri #2001
  const fResAlKiri = await CanonicalSearchEngine.searchEntities("الكيري");
  const fPAlKiri = fResAlKiri.displayFoods?.[0] || fResAlKiri.primaryResult;
  assert(
    fPAlKiri?.canonicalId === 2001,
    "Fixture Query 'الكيري' -> resolves cleanly to separate allowed Kiri #2001",
    `Resolved: #${fPAlKiri?.canonicalId} "${fPAlKiri?.canonicalName}" (NOT #1578)`
  );

  // Test 3.3: In fixture, 'طعمة' remains forbidden #1578
  const fResTaama = await CanonicalSearchEngine.searchEntities("طعمة");
  const fPTaama = fResTaama.displayFoods?.[0] || fResTaama.primaryResult;
  assert(
    fPTaama?.canonicalId === 1578,
    "Fixture Query 'طعمة' -> resolves to forbidden #1578 (never to Kiri)",
    `Resolved: #${fPTaama?.canonicalId} "${fPTaama?.canonicalName}"`
  );

  // Test 3.4: In fixture, 'لبنيتا' remains forbidden #1578
  const fResLabnita = await CanonicalSearchEngine.searchEntities("لبنيتا");
  const fPLabnita = fResLabnita.displayFoods?.[0] || fResLabnita.primaryResult;
  assert(
    fPLabnita?.canonicalId === 1578,
    "Fixture Query 'لبنيتا' -> resolves to forbidden #1578 (never to Kiri)",
    `Resolved: #${fPLabnita?.canonicalId} "${fPLabnita?.canonicalName}"`
  );

  // Reset fixture
  CanonicalSearchEngine.setTestFixture(null);

  // -------------------------------------------------------------------------
  // 4. Toast Specificity Regression Guard Verification
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Verifying Toast Specificity Regression Guard ---");
  const resWhite = await CanonicalSearchEngine.searchEntities("توست أبيض");
  const pWhite = resWhite.primaryResult || resWhite.displayFoods?.[0];
  assert(
    pWhite?.canonicalId === 1694,
    "Query 'توست أبيض' -> resolves to forbidden white toast #1694",
    `Resolved: #${pWhite?.canonicalId} "${pWhite?.canonicalName}"`
  );

  const resToasted = await CanonicalSearchEngine.searchEntities("توست محمص");
  const pToasted = resToasted.primaryResult || resToasted.displayFoods?.[0];
  assert(
    pToasted?.canonicalId === 1694,
    "Query 'توست محمص' -> resolves to white toast #1694 (never allowed bran toast)",
    `Resolved: #${pToasted?.canonicalId} "${pToasted?.canonicalName}"`
  );

  const resBran = await CanonicalSearchEngine.searchEntities("توست ريتش بيك سن بالنخالة");
  const pBran = resBran.primaryResult || resBran.displayFoods?.[0];
  assert(
    pBran?.canonicalId === 1710,
    "Query 'توست ريتش بيك سن بالنخالة' -> resolves to allowed bran toast #1710",
    `Resolved: #${pBran?.canonicalId} "${pBran?.canonicalName}"`
  );

  console.log(`\n============================================================`);
  console.log(`FINAL RESULT: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log(`============================================================`);

  if (passedTests !== totalTests) {
    throw new Error(`Regression suite failed: ${totalTests - passedTests} test(s) failed!`);
  }
}

runBiryaniAndKiriRegressionSuite().then(() => {
  console.log("Suite execution completed successfully!");
  process.exit(0);
}).catch((err) => {
  console.error("Suite failed:", err);
  process.exit(1);
});

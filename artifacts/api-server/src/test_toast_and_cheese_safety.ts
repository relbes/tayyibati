import { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";

interface TestFood {
  id: number;
  nameAr: string;
  nameEn: string;
  category: string;
  status: "allowed" | "forbidden" | "conditional";
  foodType?: string;
  isException?: boolean;
}

interface TestAlias {
  id: number;
  foodId: number;
  aliasAr: string;
  aliasEn?: string;
  aliasType: string;
  isCanonical: boolean;
  priority: number;
}

async function runSafetyRegressionSuite() {
  console.log("============================================================");
  console.log("TAYYIBATI TOAST & CHEESE SEARCH SAFETY REGRESSION SUITE");
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

  function createMockKnowledgeCache(foods: TestFood[], aliases: TestAlias[]) {
    const foodById = new Map<number, any>();
    foods.forEach((f) => foodById.set(f.id, f));
    return {
      foods,
      aliases,
      foodById,
      lastLoaded: Date.now(),
      entities: [],
      categories: [],
    };
  }

  function createMockDishCache(dishes: any[] = []) {
    return {
      dishes,
      dishesById: new Map<number, any>(),
      dishesByNormAr: new Map<string, any>(),
      dishAliasesByNormAr: new Map<string, any[]>(),
      dishIngredientsByDishId: new Map<number, any[]>(),
      dishCountriesByDishId: new Map<number, any[]>(),
      lastLoaded: Date.now(),
    };
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 1: Baseline Isolated Fixture (Current DB snapshot + Code Guard)
  // -------------------------------------------------------------------------
  console.log("--- SUITE 1: Baseline Isolated Fixture (Unaltered DB State + Toast Guard) ---");
  const baselineFoods: TestFood[] = [
    { id: 1314, nameAr: "خبز التوست الابيض", nameEn: "Whole Wheat Toast", category: "Grains & Starches", status: "forbidden" },
    { id: 1551, nameAr: "توست القمح الكامل / النخالة", nameEn: "Whole Grain Toast", category: "Grains & Starches", status: "allowed" },
    { id: 1578, nameAr: "الكيري / لبنيتا / طعمة", nameEn: "Cream Cheese Spreads", category: "Dairy & Cheese", status: "forbidden" },
  ];
  const baselineAliases: TestAlias[] = [
    { id: 101, foodId: 1551, aliasAr: "توست قمح كامل", aliasType: "synonym", isCanonical: false, priority: 1 },
  ];

  CanonicalSearchEngine.setTestFixture({
    knowledgeCache: createMockKnowledgeCache(baselineFoods, baselineAliases),
    dishCache: createMockDishCache(),
  });

  // 1.1 White toast must never resolve to allowed bran toast #1551
  const resWhite = await CanonicalSearchEngine.searchEntities("توست أبيض");
  const foodWhite = resWhite.displayFoods?.[0] || resWhite.primaryResult;
  assert(
    foodWhite?.canonicalId !== 1551,
    "Query 'توست أبيض' -> never resolves to allowed bran toast #1551",
    `Resolved: #${foodWhite?.canonicalId || 0} "${foodWhite?.canonicalName || "BLOCKED"}" (Outcome: ${resWhite.searchOutcome || "NOT_FOUND"})`
  );

  // 1.2 White toast alternate spelling must never resolve to allowed bran toast #1551
  const resWhiteAlt = await CanonicalSearchEngine.searchEntities("توست ابيض");
  const foodWhiteAlt = resWhiteAlt.displayFoods?.[0] || resWhiteAlt.primaryResult;
  assert(
    foodWhiteAlt?.canonicalId !== 1551,
    "Query 'توست ابيض' -> never resolves to allowed bran toast #1551",
    `Resolved: #${foodWhiteAlt?.canonicalId || 0} "${foodWhiteAlt?.canonicalName || "BLOCKED"}" (Outcome: ${resWhiteAlt.searchOutcome || "NOT_FOUND"})`
  );

  // 1.3 Toasted generic toast must never resolve to allowed bran toast #1551
  const resToasted = await CanonicalSearchEngine.searchEntities("توست محمص");
  const foodToasted = resToasted.displayFoods?.[0] || resToasted.primaryResult;
  assert(
    foodToasted?.canonicalId !== 1551,
    "Query 'توست محمص' -> never resolves to allowed bran toast #1551",
    `Outcome: ${resToasted.searchOutcome || foodToasted?.searchOutcome || "BLOCKED"} | CanonicalId: ${foodToasted?.canonicalId || 0}`
  );

  // 1.4 Plain toast must never resolve to allowed bran toast #1551
  const resPlain = await CanonicalSearchEngine.searchEntities("توست سادة");
  const foodPlain = resPlain.displayFoods?.[0] || resPlain.primaryResult;
  assert(
    foodPlain?.canonicalId !== 1551,
    "Query 'توست سادة' -> never resolves to allowed bran toast #1551",
    `Outcome: ${resPlain.searchOutcome || foodPlain?.searchOutcome || "BLOCKED"} | CanonicalId: ${foodPlain?.canonicalId || 0}`
  );

  // 1.5 Plain toast alternate spelling must never resolve to allowed bran toast #1551
  const resPlainAlt = await CanonicalSearchEngine.searchEntities("توست ساده");
  const foodPlainAlt = resPlainAlt.displayFoods?.[0] || resPlainAlt.primaryResult;
  assert(
    foodPlainAlt?.canonicalId !== 1551,
    "Query 'توست ساده' -> never resolves to allowed bran toast #1551",
    `Outcome: ${resPlainAlt.searchOutcome || foodPlainAlt?.searchOutcome || "BLOCKED"} | CanonicalId: ${foodPlainAlt?.canonicalId || 0}`
  );

  // 1.6 Bare 'توست' query must never resolve to allowed bran toast #1551
  const resBare = await CanonicalSearchEngine.searchEntities("توست");
  const foodBare = resBare.displayFoods?.[0] || resBare.primaryResult;
  assert(
    foodBare?.canonicalId !== 1551,
    "Query 'توست' -> never resolves to allowed bran toast #1551",
    `Outcome: ${resBare.searchOutcome || foodBare?.searchOutcome || "BLOCKED"} | CanonicalId: ${foodBare?.canonicalId || 0}`
  );

  // 1.7 Bare 'التوست' query must never resolve to allowed bran toast #1551
  const resBareAl = await CanonicalSearchEngine.searchEntities("التوست");
  const foodBareAl = resBareAl.displayFoods?.[0] || resBareAl.primaryResult;
  assert(
    foodBareAl?.canonicalId !== 1551,
    "Query 'التوست' -> never resolves to allowed bran toast #1551",
    `Outcome: ${resBareAl.searchOutcome || foodBareAl?.searchOutcome || "BLOCKED"} | CanonicalId: ${foodBareAl?.canonicalId || 0}`
  );

  // 1.8 Qualified Rich Bake bran toast query resolves to allowed bran toast
  const resQualified = await CanonicalSearchEngine.searchEntities("توست ريتش بيك سن بالنخالة");
  const foodQualified = resQualified.displayFoods?.[0] || resQualified.primaryResult;
  assert(
    foodQualified?.canonicalId === 1551,
    "Query 'توست ريتش بيك سن بالنخالة' -> allowed bran toast #1551",
    `Resolved: #${foodQualified?.canonicalId} "${foodQualified?.canonicalName}" (Confidence: ${foodQualified?.confidence}%)`
  );

  // 1.9 Ta'ma query resolves to #1578 (forbidden)
  const resTaama = await CanonicalSearchEngine.searchEntities("طعمة");
  const foodTaama = resTaama.displayFoods?.[0] || resTaama.primaryResult;
  assert(
    foodTaama?.canonicalId === 1578,
    "Query 'طعمة' -> forbidden Food #1578",
    `Resolved: #${foodTaama?.canonicalId} "${foodTaama?.canonicalName}" (Confidence: ${foodTaama?.confidence}%)`
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 2: Reconciled Isolated Fixture (Separated Kiri & Proposed Additions)
  // -------------------------------------------------------------------------
  console.log("\n--- SUITE 2: Reconciled Isolated Fixture (Separated Kiri & Proposed Additions) ---");
  const reconciledFoods: TestFood[] = [
    { id: 1314, nameAr: "خبز التوست الابيض", nameEn: "Whole Wheat Toast", category: "Grains & Starches", status: "forbidden" },
    { id: 1551, nameAr: "توست القمح الكامل / النخالة", nameEn: "Whole Grain Toast", category: "Grains & Starches", status: "allowed" },
    { id: 1578, nameAr: "لبنيتا / طعمة", nameEn: "Cream Cheese Spreads", category: "Dairy & Cheese", status: "forbidden" }, // Renamed to remove Kiri collision
    { id: 2001, nameAr: "جبنة كيري", nameEn: "Kiri Cheese", category: "Permitted Cheeses", status: "allowed" }, // PROP-FOOD-43
    { id: 2002, nameAr: "توست أبيض", nameEn: "White Toast", category: "Flour & Baked Goods", status: "forbidden" }, // PROP-FOOD-13
    { id: 2003, nameAr: "توست ريتش بيك سن بالنخالة", nameEn: "Rich Bake Bran Toast", category: "Flour & Baked Goods", status: "allowed" }, // PROP-FOOD-29
  ];
  const reconciledAliases: TestAlias[] = [
    { id: 201, foodId: 2001, aliasAr: "كيري", aliasType: "synonym", isCanonical: false, priority: 1 },
    { id: 202, foodId: 2001, aliasAr: "الكيري", aliasType: "synonym", isCanonical: false, priority: 1 },
    { id: 203, foodId: 1578, aliasAr: "طعمة", aliasType: "synonym", isCanonical: false, priority: 1 },
  ];

  CanonicalSearchEngine.setTestFixture({
    knowledgeCache: createMockKnowledgeCache(reconciledFoods, reconciledAliases),
    dishCache: createMockDishCache(),
  });

  // 2.1 'كيري' resolves to separate allowed Kiri record #2001 (NOT #1578)
  const resKiri = await CanonicalSearchEngine.searchEntities("كيري");
  const foodKiri = resKiri.displayFoods?.[0] || resKiri.primaryResult;
  assert(
    foodKiri?.canonicalId === 2001 && foodKiri?.canonicalId !== 1578,
    "Query 'كيري' -> separate allowed Kiri record #2001 (NOT #1578)",
    `Resolved: #${foodKiri?.canonicalId} "${foodKiri?.canonicalName}" (Confidence: ${foodKiri?.confidence}%)`
  );

  // 2.2 'الكيري' resolves to separate allowed Kiri record #2001 (NOT #1578)
  const resAlKiri = await CanonicalSearchEngine.searchEntities("الكيري");
  const foodAlKiri = resAlKiri.displayFoods?.[0] || resAlKiri.primaryResult;
  assert(
    foodAlKiri?.canonicalId === 2001 && foodAlKiri?.canonicalId !== 1578,
    "Query 'الكيري' -> separate allowed Kiri record #2001 (NOT #1578)",
    `Resolved: #${foodAlKiri?.canonicalId} "${foodAlKiri?.canonicalName}" (Confidence: ${foodAlKiri?.confidence}%)`
  );

  // 2.3 'طعمة' remains forbidden and never resolves to Kiri #2001
  const resTaamaReconciled = await CanonicalSearchEngine.searchEntities("طعمة");
  const foodTaamaReconciled = resTaamaReconciled.displayFoods?.[0] || resTaamaReconciled.primaryResult;
  assert(
    foodTaamaReconciled?.canonicalId === 1578 && foodTaamaReconciled?.canonicalId !== 2001,
    "Query 'طعمة' -> remains forbidden #1578 and never resolves to Kiri #2001",
    `Resolved: #${foodTaamaReconciled?.canonicalId} "${foodTaamaReconciled?.canonicalName}" (Confidence: ${foodTaamaReconciled?.confidence}%)`
  );

  // 2.4 'توست أبيض' matches new canonical #2002 (forbidden)
  const resWhiteReconciled = await CanonicalSearchEngine.searchEntities("توست أبيض");
  const foodWhiteReconciled = resWhiteReconciled.displayFoods?.[0] || resWhiteReconciled.primaryResult;
  assert(
    foodWhiteReconciled?.canonicalId === 2002,
    "Query 'توست أبيض' -> new canonical forbidden record #2002 (status: forbidden)",
    `Resolved: #${foodWhiteReconciled?.canonicalId} "${foodWhiteReconciled?.canonicalName}" (Confidence: ${foodWhiteReconciled?.confidence}%)`
  );

  // 2.5 'توست ابيض' matches new canonical #2002 (forbidden)
  const resWhiteAltReconciled = await CanonicalSearchEngine.searchEntities("توست ابيض");
  const foodWhiteAltReconciled = resWhiteAltReconciled.displayFoods?.[0] || resWhiteAltReconciled.primaryResult;
  assert(
    foodWhiteAltReconciled?.canonicalId === 2002,
    "Query 'توست ابيض' -> new canonical forbidden record #2002 (status: forbidden)",
    `Resolved: #${foodWhiteAltReconciled?.canonicalId} "${foodWhiteAltReconciled?.canonicalName}" (Confidence: ${foodWhiteAltReconciled?.confidence}%)`
  );

  // 2.6 'توست محمص' never resolves to allowed bran toast
  const resToastedReconciled = await CanonicalSearchEngine.searchEntities("توست محمص");
  const foodToastedReconciled = resToastedReconciled.displayFoods?.[0] || resToastedReconciled.primaryResult;
  assert(
    foodToastedReconciled?.canonicalId !== 1551 && foodToastedReconciled?.canonicalId !== 2003,
    "Query 'توست محمص' -> never resolves to allowed bran toast (#1551 or #2003)",
    `Outcome: ${resToastedReconciled.searchOutcome || foodToastedReconciled?.searchOutcome || "BLOCKED"} | CanonicalId: ${foodToastedReconciled?.canonicalId || 0}`
  );

  // 2.7 'توست سادة' never resolves to allowed bran toast
  const resPlainReconciled = await CanonicalSearchEngine.searchEntities("توست سادة");
  const foodPlainReconciled = resPlainReconciled.displayFoods?.[0] || resPlainReconciled.primaryResult;
  assert(
    foodPlainReconciled?.canonicalId !== 1551 && foodPlainReconciled?.canonicalId !== 2003,
    "Query 'توست سادة' -> never resolves to allowed bran toast (#1551 or #2003)",
    `Outcome: ${resPlainReconciled.searchOutcome || foodPlainReconciled?.searchOutcome || "BLOCKED"} | CanonicalId: ${foodPlainReconciled?.canonicalId || 0}`
  );

  // 2.8 'توست' bare query never resolves to allowed bran toast (returns AMBIGUOUS with canonicalId 0)
  const resBareReconciled = await CanonicalSearchEngine.searchEntities("توست");
  assert(
    resBareReconciled.primaryResult?.canonicalId === 0 && (resBareReconciled.primaryResult as any)?.matchType === "AMBIGUOUS",
    "Query 'توست' -> never resolves to allowed bran toast (returns AMBIGUOUS with canonicalId: 0)",
    `MatchType: ${(resBareReconciled.primaryResult as any)?.matchType} | Primary CanonicalId: ${resBareReconciled.primaryResult?.canonicalId} | Question: ${resBareReconciled.primaryResult?.questionAr}`
  );

  // 2.9 'توست ريتش بيك سن بالنخالة' resolves to PROP-FOOD-29 #2003 (allowed)
  const resRichBake = await CanonicalSearchEngine.searchEntities("توست ريتش بيك سن بالنخالة");
  const foodRichBake = resRichBake.displayFoods?.[0] || resRichBake.primaryResult;
  assert(
    foodRichBake?.canonicalId === 2003,
    "Query 'توست ريتش بيك سن بالنخالة' -> allowed Rich Bake bran toast #2003",
    `Resolved: #${foodRichBake?.canonicalId} "${foodRichBake?.canonicalName}" (Confidence: ${foodRichBake?.confidence}%)`
  );

  // Clean up fixture after test
  CanonicalSearchEngine.setTestFixture(null);

  console.log("\n============================================================");
  console.log(`FINAL RESULT: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("============================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSafetyRegressionSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

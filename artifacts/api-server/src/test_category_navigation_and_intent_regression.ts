import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { warmDishEngineCache } from "./lib/dishCompatibilityEngine";
import { getKnowledgeCache } from "./lib/knowledgeCache";
import { IntentClassificationEngine } from "./lib/intentClassificationEngine";
import { SmartFallbackEngine } from "./lib/smartFallbackEngine";
import { createAnalysisResultViewModel } from "../../mobile/lib/models/AnalysisResultViewModel";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, title: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${title}${detail ? ` -> ${detail}` : ""}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${title}${detail ? ` -> ${detail}` : ""}`);
  }
}

async function runRegressionSuite() {
  console.log("================================================================================");
  console.log("  TAYYIBATI CATEGORY INTENT & NAVIGATION REGRESSION TEST SUITE                  ");
  console.log("================================================================================\n");

  await warmDishEngineCache();
  await getKnowledgeCache();

  // --------------------------------------------------------------------------
  // TEST GROUP 1: All Listed Arabic Category Variants
  // --------------------------------------------------------------------------
  console.log("--- TEST GROUP 1: All Listed Arabic Category Variants ---");
  const vegetableVariants = [
    "خضروات",
    "الخضروات",
    "خضار",
    "الخضار",
    "خضره",
    "الخضره",
    "خضرة",
    "الخضرة",
  ];

  for (const q of vegetableVariants) {
    const earlyIntent = IntentClassificationEngine.detectQueryIntent(q);
    assert(
      earlyIntent.intent === "CATEGORY_SEARCH" && earlyIntent.targetCategory === "خضروات",
      `'${q}' detected as CATEGORY_SEARCH for 'خضروات'`,
      `intent=${earlyIntent.intent}, cat=${earlyIntent.targetCategory}`
    );

    const res = await UnifiedAnalysisEngine.analyze({ query: q });
    const rep = res.report;
    assert(
      rep.resultMode === ("CATEGORY_REPORT" as any) && rep.queryIntent === "CATEGORY_SEARCH",
      `'${q}' produces CATEGORY_REPORT resultMode`,
      `mode=${rep.resultMode}, queryIntent=${rep.queryIntent}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Category Queries Routing to Existing Catalog
  // --------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 2: Category Queries Routing to Existing Catalog ---");
  {
    const res = await UnifiedAnalysisEngine.analyze({ query: "خضروات" });
    const rep = res.report;
    const vm = createAnalysisResultViewModel(rep);

    assert(
      rep.action?.type === "NAVIGATE_BROWSE",
      "Action type is NAVIGATE_BROWSE",
      rep.action?.type
    );
    assert(
      rep.action?.category === "خضروات",
      "Action category is 'خضروات'",
      rep.action?.category
    );
    assert(
      rep.action?.route?.includes("/(tabs)/browse?category="),
      "Action route targets existing /(tabs)/browse with category param",
      rep.action?.route
    );
    assert(
      vm.presentationMode === "LIST_CATALOG",
      "ViewModel presentationMode transforms to LIST_CATALOG",
      vm.presentationMode
    );
    assert(
      vm.listCatalogViewModel?.catalogType === "category",
      "ViewModel catalogType is 'category'",
      vm.listCatalogViewModel?.catalogType
    );
    assert(
      vm.listCatalogViewModel?.actionRoute === rep.action?.route,
      "ViewModel actionRoute matches API route exactly",
      vm.listCatalogViewModel?.actionRoute
    );
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Unrelated Partial Color Matches (Green Tea/Beans/Almonds) Blocked
  // --------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 3: No Unrelated Color Matches for Vegetable Category Query ---");
  {
    const fb = await SmartFallbackEngine.suggest("خضره");
    const names = fb.suggestions.map((s) => s.nameAr);

    assert(
      !names.includes("شاي أخضر"),
      "Fallback does NOT return 'شاي أخضر' for 'خضره'",
      `Found: ${names.join(", ")}`
    );
    assert(
      !names.includes("فول أخضر"),
      "Fallback does NOT return 'فول أخضر' for 'خضره'",
      `Found: ${names.join(", ")}`
    );
    assert(
      !names.some((n) => n.includes("لوز اخضر") || n.includes("لوز أخضر")),
      "Fallback does NOT return 'لوز أخضر' for 'خضره'",
      `Found: ${names.join(", ")}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Specific Food Query (بطاطا) Retains Food Analysis
  // --------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 4: 'بطاطا' Retains Specific Food Analysis ---");
  {
    const res = await UnifiedAnalysisEngine.analyze({ query: "بطاطا" });
    const rep = res.report;
    const vm = createAnalysisResultViewModel(rep);

    assert(
      rep.resultMode === "EXACT_FOOD",
      "'بطاطا' resultMode is EXACT_FOOD",
      rep.resultMode
    );
    assert(
      rep.primaryRuling?.nameAr?.includes("بطاط"),
      "'بطاطا' resolves to authentic potato record",
      rep.primaryRuling?.nameAr
    );
    assert(
      rep.primaryRuling?.status === "allowed",
      "'بطاطا' status is allowed",
      rep.primaryRuling?.status
    );
    assert(
      vm.presentationMode === "SPECIFIC_FOOD",
      "UI ViewModel presentationMode is SPECIFIC_FOOD",
      vm.presentationMode
    );
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Specific Dish Query (خضار سوتيه) Retains Dish/Food Analysis
  // --------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 5: 'خضار سوتيه' Retains Food/Dish Analysis ---");
  {
    const res = await UnifiedAnalysisEngine.analyze({ query: "خضار سوتيه" });
    const rep = res.report;

    assert(
      rep.resultMode === "EXACT_FOOD" || rep.resultMode === "COMPOSITE_FOOD",
      "'خضار سوتيه' is NOT intercepted as generic category browsing",
      `resultMode=${rep.resultMode}`
    );
    assert(
      rep.queryIntent !== "CATEGORY_SEARCH",
      "'خضار سوتيه' queryIntent is NOT CATEGORY_SEARCH",
      rep.queryIntent
    );
    assert(
      rep.primaryRuling?.nameAr === "خضار سوتيه",
      "'خضار سوتيه' resolves to its specific ruling",
      `${rep.primaryRuling?.nameAr} (${rep.primaryRuling?.status})`
    );
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 6: List Intents (أطعمة مسموحة & الأطعمة الممنوعة) Retained
  // --------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 6: List Intents Retained ---");
  {
    const resAllowed = await UnifiedAnalysisEngine.analyze({ query: "أطعمة مسموحة" });
    const vmAllowed = createAnalysisResultViewModel(resAllowed.report);
    assert(
      resAllowed.report.resultMode === "LIST_ALLOWED",
      "'أطعمة مسموحة' resultMode is LIST_ALLOWED",
      resAllowed.report.resultMode
    );
    assert(
      resAllowed.report.action?.filter === "allowed",
      "'أطعمة مسموحة' action filter is 'allowed'",
      resAllowed.report.action?.filter
    );
    assert(
      vmAllowed.presentationMode === "LIST_CATALOG" && vmAllowed.listCatalogViewModel?.actionFilter === "allowed",
      "UI ViewModel for 'أطعمة مسموحة' has actionFilter 'allowed'",
      vmAllowed.listCatalogViewModel?.actionFilter
    );

    const resForbidden = await UnifiedAnalysisEngine.analyze({ query: "الأطعمة الممنوعة" });
    const vmForbidden = createAnalysisResultViewModel(resForbidden.report);
    assert(
      resForbidden.report.resultMode === "LIST_RESTRICTED",
      "'الأطعمة الممنوعة' resultMode is LIST_RESTRICTED",
      resForbidden.report.resultMode
    );
    assert(
      resForbidden.report.action?.filter === "forbidden",
      "'الأطعمة الممنوعة' action filter is 'forbidden'",
      resForbidden.report.action?.filter
    );
    assert(
      vmForbidden.presentationMode === "LIST_CATALOG" && vmForbidden.listCatalogViewModel?.actionFilter === "forbidden",
      "UI ViewModel for 'الأطعمة الممنوعة' has actionFilter 'forbidden'",
      vmForbidden.listCatalogViewModel?.actionFilter
    );
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Existing Dish Variant & Multi-Item Regression Scenarios
  // --------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 7: Existing Dish Variant & Multi-Item Regression Scenarios ---");
  {
    const resBiryani = await UnifiedAnalysisEngine.analyze({ query: "برياني بالخضار" });
    assert(
      Boolean(resBiryani.report.needsClarification),
      "'برياني بالخضار' triggers needsClarification=true",
      `clarificationType=${resBiryani.report.clarificationType}`
    );
    assert(
      resBiryani.report.suggestions?.includes("برياني بالخضار واللحم") &&
      resBiryani.report.suggestions?.includes("برياني بالخضار والدجاج"),
      "'برياني بالخضار' offers meat and poultry variants independently",
      JSON.stringify(resBiryani.report.suggestions)
    );

    const resShawarma = await UnifiedAnalysisEngine.analyze({ query: "شاورما الدجاج" });
    assert(
      resBiryani.report.resultMode !== "MULTI_ITEM" && resShawarma.report.resultMode === "COMPOSITE_FOOD",
      "'شاورما الدجاج' is evaluated as composite food dish without multi-item splitting",
      resShawarma.report.resultMode
    );

    const resMulti = await UnifiedAnalysisEngine.analyze({ query: "بطيخ وشمام وتفاح وبرتقال" });
    assert(
      resMulti.report.resultMode === "MULTI_ITEM",
      "'بطيخ وشمام وتفاح وبرتقال' evaluates as MULTI_ITEM",
      resMulti.report.resultMode
    );
    assert(
      resMulti.report.multiItemResults?.length === 4,
      "Multi-item query decomposed into 4 items",
      `count=${resMulti.report.multiItemResults?.length}`
    );
  }

  console.log("\n================================================================================");
  console.log(`  REGRESSION TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (Total: ${totalTests})`);
  console.log("================================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runRegressionSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

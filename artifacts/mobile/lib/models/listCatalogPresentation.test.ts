import { createAnalysisResultViewModel, AnalysisResultViewModel } from "./AnalysisResultViewModel";
import type { AnalysisReport } from "../../context/AnalysisContext";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    failedCount++;
    console.error(`[FAIL] ${msg}`);
    throw new Error(msg);
  }
}

function test(name: string, fn: () => void) {
  try {
    fn();
    passedCount++;
    console.log(`[PASS] ${name}`);
  } catch (err: any) {
    console.error(`       Error: ${err.message}`);
  }
}

console.log("==========================================================================");
console.log("   TAYYIBATI MOBILE UI: LIST_CATALOG PRESENTATION REGRESSION SUITE        ");
console.log("==========================================================================");

// Case 1: LIST_ALLOWED (أكلات مسموح بيها)
test("1. LIST_ALLOWED query transforms to LIST_CATALOG presentation mode with correct browse filter", () => {
  const allowedReport: AnalysisReport = {
    query: "أكلات مسموح بيها",
    displayQuery: "أكلات مسموح بيها",
    resultMode: "LIST_ALLOWED" as any,
    queryIntent: "LIST_ALLOWED",
    explanation: "دليل الأطعمة المسموحة في نظام طيباتي لتناولها بأمان.",
    allowed: [
      { id: 1, name: "Lamb", nameAr: "لحم ضأن", status: "allowed", dbReason: "مسموح وهو الخيار الأول" },
      { id: 2, name: "Fish", nameAr: "سمك طازج", status: "allowed", dbReason: "مسموح طازج وبحري" },
    ],
    forbidden: [],
    conditional: [],
    unknown: [],
    compatibilityScore: 100,
    scoreAvailable: true,
    suggestions: ["اللحوم", "الأسماك", "الخضار"],
    analysisType: "text",
    notFound: false,
    action: {
      type: "NAVIGATE_BROWSE",
      filter: "allowed",
      route: "/(tabs)/browse?status=allowed",
      label: "عرض دليل الأطعمة المسموحة كاملة",
    },
  };

  const vm: AnalysisResultViewModel = createAnalysisResultViewModel(allowedReport);

  assert(vm.presentationMode === "LIST_CATALOG", `Expected presentationMode to be 'LIST_CATALOG', got '${vm.presentationMode}'`);
  assert(Boolean(vm.listCatalogViewModel), "Expected listCatalogViewModel to be defined");
  assert(vm.listCatalogViewModel?.catalogType === "allowed", `Expected catalogType 'allowed', got '${vm.listCatalogViewModel?.catalogType}'`);
  assert(vm.listCatalogViewModel?.actionFilter === "allowed", `Expected actionFilter 'allowed', got '${vm.listCatalogViewModel?.actionFilter}'`);
  assert(vm.listCatalogViewModel?.actionRoute === "/(tabs)/browse?status=allowed", `Expected actionRoute '/(tabs)/browse?status=allowed', got '${vm.listCatalogViewModel?.actionRoute}'`);
  assert(vm.listCatalogViewModel?.sampleFoods.length === 2, `Expected 2 sample foods, got ${vm.listCatalogViewModel?.sampleFoods.length}`);
  assert(vm.listCatalogViewModel?.sampleFoods[0].nameAr === "لحم ضأن", "Expected first sample food nameAr 'لحم ضأن'");
  assert(vm.listCatalogViewModel?.sampleFoods[0].status === "allowed", "Expected first sample food status 'allowed'");
});

// Case 2: LIST_RESTRICTED (أكلات ممنوعة)
test("2. LIST_RESTRICTED query transforms to LIST_CATALOG presentation mode with correct browse filter", () => {
  const restrictedReport: AnalysisReport = {
    query: "أكلات ممنوعة",
    displayQuery: "أكلات ممنوعة",
    resultMode: "LIST_RESTRICTED" as any,
    queryIntent: "LIST_RESTRICTED",
    explanation: "قائمة الأطعمة المحظورة والممنوعة في نظام طيباتي لتجنبها.",
    allowed: [],
    forbidden: [
      { id: 10, name: "Chicken", nameAr: "دجاج تجاري", status: "forbidden", dbReason: "ممنوع في النظام" },
      { id: 11, name: "Pork", nameAr: "لحم خنزير", status: "forbidden", dbReason: "محرم قطعا" },
    ],
    conditional: [],
    unknown: [],
    compatibilityScore: 0,
    scoreAvailable: true,
    suggestions: ["أطعمة مصنعة", "سكريات مضافة"],
    analysisType: "text",
    notFound: false,
    action: {
      type: "NAVIGATE_BROWSE",
      filter: "forbidden",
      route: "/(tabs)/browse?status=forbidden",
      label: "عرض دليل الأطعمة الممنوعة كاملة",
    },
  };

  const vm: AnalysisResultViewModel = createAnalysisResultViewModel(restrictedReport);

  assert(vm.presentationMode === "LIST_CATALOG", `Expected presentationMode to be 'LIST_CATALOG', got '${vm.presentationMode}'`);
  assert(Boolean(vm.listCatalogViewModel), "Expected listCatalogViewModel to be defined");
  assert(vm.listCatalogViewModel?.catalogType === "forbidden", `Expected catalogType 'forbidden', got '${vm.listCatalogViewModel?.catalogType}'`);
  assert(vm.listCatalogViewModel?.actionFilter === "forbidden", `Expected actionFilter 'forbidden', got '${vm.listCatalogViewModel?.actionFilter}'`);
  assert(vm.listCatalogViewModel?.actionRoute === "/(tabs)/browse?status=forbidden", `Expected actionRoute '/(tabs)/browse?status=forbidden', got '${vm.listCatalogViewModel?.actionRoute}'`);
  assert(vm.listCatalogViewModel?.sampleFoods.length === 2, `Expected 2 sample foods, got ${vm.listCatalogViewModel?.sampleFoods.length}`);
  assert(vm.listCatalogViewModel?.sampleFoods[0].nameAr === "دجاج تجاري", "Expected first sample food nameAr 'دجاج تجاري'");
  assert(vm.listCatalogViewModel?.sampleFoods[0].status === "forbidden", "Expected first sample food status 'forbidden'");
});

// Case 3: Preserving single specific food (تفاح / دجاج / لحم)
test("3. Single food query (e.g. تفاح) preserves SPECIFIC_FOOD mode without fake catalog mode", () => {
  const singleFoodReport: AnalysisReport = {
    query: "تفاح",
    displayQuery: "تفاح",
    resultMode: "EXACT_FOOD" as any,
    queryIntent: "FOOD",
    allowed: [{ id: 100, name: "Apple", nameAr: "تفاح", status: "allowed", dbReason: "فاكهة مسموحة" }],
    forbidden: [],
    conditional: [],
    unknown: [],
    primaryRuling: {
      foodId: 100,
      nameAr: "تفاح",
      status: "allowed",
      categoryAr: "فواكه",
    },
    mealDecision: {
      status: "allowed",
      allowedCount: 1,
      forbiddenCount: 0,
      conditionalCount: 0,
      unknownCount: 0,
      totalIngredients: 1,
      breakdown: { allowed: [], forbidden: [], conditional: [], unknown: [] },
    },
    compatibilityScore: 100,
    scoreAvailable: true,
    analysisType: "text",
    notFound: false,
  };

  const vm: AnalysisResultViewModel = createAnalysisResultViewModel(singleFoodReport);

  assert(vm.presentationMode === "SPECIFIC_FOOD", `Expected presentationMode 'SPECIFIC_FOOD', got '${vm.presentationMode}'`);
  assert(!vm.listCatalogViewModel, "listCatalogViewModel should NOT be present for single food");
});

// Case 4: Preserving ambiguous dish variant clarification (شاورما)
test("4. Ambiguous dish query (e.g. شاورما) preserves DISH mode and needsClarification", () => {
  const clarifyReport: AnalysisReport = {
    query: "شاورما",
    displayQuery: "شاورما",
    resultMode: "NOT_FOUND" as any,
    needsClarification: true,
    clarificationType: "DISH_VARIANT",
    questionAr: "أي نوع شاورما تقصد؟",
    suggestions: ["شاورما لحم (بقري / غنم)", "شاورما دجاج"],
    allowed: [],
    forbidden: [],
    conditional: [],
    unknown: [],
    compatibilityScore: null,
    scoreAvailable: false,
    analysisType: "text",
    notFound: true,
  };

  const vm: AnalysisResultViewModel = createAnalysisResultViewModel(clarifyReport);

  assert(vm.presentationMode === "DISH", `Expected presentationMode 'DISH', got '${vm.presentationMode}'`);
  assert(!vm.listCatalogViewModel, "listCatalogViewModel should NOT be present for dish clarification");
});

console.log(`\nResults: ${passedCount} passed, ${failedCount} failed.`);
if (failedCount > 0) {
  process.exit(1);
} else {
  console.log("ALL LIST_CATALOG TESTS PASSED SUCCESSFULLY! ✅");
}

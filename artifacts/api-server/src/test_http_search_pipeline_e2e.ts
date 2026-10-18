import http from "http";
import app from "./app";
import { warmDishEngineCache } from "./lib/dishCompatibilityEngine";
import { getKnowledgeCache } from "./lib/knowledgeCache";
import { issueToken } from "./lib/session";
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

async function runHttpE2eSuite() {
  console.log("================================================================================");
  console.log("  TAYYIBATI REAL HTTP API & MOBILE UI VIEWMODEL REPRODUCTION SUITE              ");
  console.log("================================================================================\n");

  console.log("Initializing caches...");
  await warmDishEngineCache();
  await getKnowledgeCache();
  console.log("Caches initialized successfully.\n");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const endpoint = `http://127.0.0.1:${address.port}/api/analysis/text`;
  console.log(`HTTP Endpoint: ${endpoint}\n`);

  const testUserId = "test_history_id_user_premium";
  const authToken = issueToken(testUserId);

  const callSearchApi = async (query: string) => {
    const payload = { query, displayQuery: query };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
    const status = res.status;
    const data = await res.json();
    const report = data.report || data;
    const uiViewModel = createAnalysisResultViewModel(report, {});
    return { status, data, report, uiViewModel };
  };

  try {
    // --------------------------------------------------------------------------
    // Query 1: برياني بالخضار
    // --------------------------------------------------------------------------
    console.log("--------------------------------------------------------------------------------");
    console.log("QUERY 1: 'برياني بالخضار'");
    console.log("--------------------------------------------------------------------------------");
    {
      const { status, report, uiViewModel } = await callSearchApi("برياني بالخضار");
      console.log(`  HTTP Status: ${status}`);
      console.log(`  needsClarification: ${report.needsClarification}`);
      console.log(`  clarificationType: ${report.clarificationType}`);
      console.log(`  suggestions: ${JSON.stringify(report.suggestions)}`);
      console.log(`  UI Presentation Mode: ${uiViewModel.presentationMode}`);
      console.log(`  UI Suggestions Count: ${uiViewModel.clarificationSuggestions?.length}`);

      assert(status === 200, "Query 1 returns HTTP 200");
      assert(Boolean(report.needsClarification), "Query 1 triggers needsClarification=true");
      assert(report.clarificationType === "DISH_VARIANT", "Query 1 clarificationType is DISH_VARIANT");
      const sug = report.suggestions || [];
      assert(
        sug.length === 2 && sug[0] === "برياني بالخضار واللحم" && sug[1] === "برياني بالخضار والدجاج",
        "Query 1 offers Meat first, Chicken second",
        JSON.stringify(sug)
      );
      assert(!sug.some((s: string) => s.includes("نباتي")), "Query 1 does not invent a vegetarian variant");
      assert(uiViewModel.presentationMode === "DISH", "UI ViewModel mode is DISH");
    }

    // --------------------------------------------------------------------------
    // Query 2: برياني بالخضار واللحم
    // --------------------------------------------------------------------------
    console.log("\n--------------------------------------------------------------------------------");
    console.log("QUERY 2: 'برياني بالخضار واللحم'");
    console.log("--------------------------------------------------------------------------------");
    {
      const { status, report, uiViewModel } = await callSearchApi("برياني بالخضار واللحم");
      console.log(`  HTTP Status: ${status}`);
      console.log(`  resultMode: ${report.resultMode}`);
      console.log(`  needsClarification: ${report.needsClarification}`);
      const allowedNames = (report.allowed || []).map((x: any) => x.nameAr);
      const forbiddenNames = (report.forbidden || []).map((x: any) => x.nameAr);
      const allIngredients = [...allowedNames, ...forbiddenNames];
      console.log(`  Allowed Ingredients: ${allowedNames.join(", ")}`);
      console.log(`  Forbidden Ingredients: ${forbiddenNames.join(", ")}`);
      console.log(`  UI Presentation Mode: ${uiViewModel.presentationMode}`);

      assert(status === 200, "Query 2 returns HTTP 200");
      assert(!report.needsClarification, "Query 2 resolves directly without clarification");
      assert(report.resultMode === "COMPOSITE_FOOD", "Query 2 resultMode is COMPOSITE_FOOD");
      const hasMeat = allowedNames.some((n: string) => n.includes("لحم"));
      const hasChicken = allIngredients.some((n: string) => n.includes("دجاج"));
      assert(hasMeat, "Query 2 includes Meat in ingredients");
      assert(!hasChicken, "Query 2 completely excludes Chicken from ingredients");
      assert(uiViewModel.presentationMode === "DISH", "UI ViewModel mode is DISH");
    }

    // --------------------------------------------------------------------------
    // Query 3: برياني بالخضار والدجاج
    // --------------------------------------------------------------------------
    console.log("\n--------------------------------------------------------------------------------");
    console.log("QUERY 3: 'برياني بالخضار والدجاج'");
    console.log("--------------------------------------------------------------------------------");
    {
      const { status, report, uiViewModel } = await callSearchApi("برياني بالخضار والدجاج");
      console.log(`  HTTP Status: ${status}`);
      console.log(`  resultMode: ${report.resultMode}`);
      console.log(`  needsClarification: ${report.needsClarification}`);
      const allowedNames = (report.allowed || []).map((x: any) => x.nameAr);
      const forbiddenNames = (report.forbidden || []).map((x: any) => x.nameAr);
      const allIngredients = [...allowedNames, ...forbiddenNames];
      console.log(`  Allowed Ingredients: ${allowedNames.join(", ")}`);
      console.log(`  Forbidden Ingredients: ${forbiddenNames.join(", ")}`);
      console.log(`  UI Presentation Mode: ${uiViewModel.presentationMode}`);

      assert(status === 200, "Query 3 returns HTTP 200");
      assert(!report.needsClarification, "Query 3 resolves directly without clarification");
      assert(report.resultMode === "COMPOSITE_FOOD", "Query 3 resultMode is COMPOSITE_FOOD");
      const hasChicken = forbiddenNames.some((n: string) => n.includes("دجاج"));
      const hasMeat = allIngredients.some((n: string) => n.includes("لحم"));
      assert(hasChicken, "Query 3 includes Chicken in forbidden ingredients");
      assert(!hasMeat, "Query 3 completely excludes Meat from ingredients");
      assert(uiViewModel.presentationMode === "DISH", "UI ViewModel mode is DISH");
    }

    // --------------------------------------------------------------------------
    // Query 4: بطيخ وشمام وتفاح وبرتقال
    // --------------------------------------------------------------------------
    console.log("\n--------------------------------------------------------------------------------");
    console.log("QUERY 4: 'بطيخ وشمام وتفاح وبرتقال'");
    console.log("--------------------------------------------------------------------------------");
    {
      const { status, report, uiViewModel } = await callSearchApi("بطيخ وشمام وتفاح وبرتقال");
      console.log(`  HTTP Status: ${status}`);
      console.log(`  resultMode: ${report.resultMode}`);
      console.log(`  multiItemResults count: ${report.multiItemResults?.length}`);
      if (report.multiItemResults) {
        for (const item of report.multiItemResults) {
          console.log(`    - ${item.nameAr}: status=${item.status}, type=${item.itemType}`);
        }
      }
      console.log(`  UI Presentation Mode: ${uiViewModel.presentationMode}`);
      console.log(`  UI multiItemViewModel items: ${uiViewModel.multiItemViewModel?.items.length}`);

      assert(status === 200, "Query 4 returns HTTP 200");
      assert(report.resultMode === "MULTI_ITEM", "Query 4 resultMode is MULTI_ITEM");
      assert(report.multiItemResults?.length === 4, "Query 4 decomposes into 4 items");

      const items = report.multiItemResults || [];
      const apple = items.find((x: any) => x.nameAr.includes("تفاح"));
      const watermelon = items.find((x: any) => x.nameAr.includes("بطيخ"));
      const melon = items.find((x: any) => x.nameAr.includes("شمام"));
      const orange = items.find((x: any) => x.nameAr.includes("برتقال"));

      assert(apple?.status === "allowed", "Apple evaluated as allowed per DB policy");
      assert(watermelon?.status === "forbidden", "Watermelon evaluated as forbidden per DB policy");
      assert(melon?.status === "forbidden", "Melon evaluated as forbidden per DB policy");
      assert(orange?.status === "forbidden", "Orange evaluated as forbidden per DB policy");
      assert(uiViewModel.presentationMode === "MULTI_ITEM", "UI ViewModel mode is MULTI_ITEM");
      assert(uiViewModel.multiItemViewModel?.items.length === 4, "UI ViewModel has 4 multiItem items");
    }

    // --------------------------------------------------------------------------
    // Query 5: الدجاج والبيض والورقيات والبقوليات
    // --------------------------------------------------------------------------
    console.log("\n--------------------------------------------------------------------------------");
    console.log("QUERY 5: 'الدجاج والبيض والورقيات والبقوليات'");
    console.log("--------------------------------------------------------------------------------");
    {
      const { status, report, uiViewModel } = await callSearchApi("الدجاج والبيض والورقيات والبقوليات");
      console.log(`  HTTP Status: ${status}`);
      console.log(`  resultMode: ${report.resultMode}`);
      console.log(`  multiItemResults count: ${report.multiItemResults?.length}`);
      if (report.multiItemResults) {
        for (const item of report.multiItemResults) {
          console.log(`    - ${item.nameAr}: status=${item.status}, type=${item.itemType}, source=${item.sourceType}`);
          if (item.categoryStats?.exceptions?.length) {
            console.log(`      Exceptions: ${JSON.stringify(item.categoryStats.exceptions)}`);
          }
        }
      }
      console.log(`  UI Presentation Mode: ${uiViewModel.presentationMode}`);

      assert(status === 200, "Query 5 returns HTTP 200");
      assert(report.resultMode === "MULTI_ITEM", "Query 5 resultMode is MULTI_ITEM");
      assert(report.multiItemResults?.length === 4, "Query 5 decomposes into 4 items");

      const items = report.multiItemResults || [];
      const chicken = items.find((x: any) => x.nameAr.includes("دجاج"));
      const egg = items.find((x: any) => x.nameAr.includes("بيض"));
      const veg = items.find((x: any) => x.nameAr.includes("خضروات"));
      const leg = items.find((x: any) => x.nameAr.includes("بقوليات"));

      assert(chicken?.status === "forbidden" && chicken?.sourceType === "حيواني", "Chicken is forbidden animal food");
      assert(egg?.status === "forbidden" && egg?.sourceType === "حيواني", "Egg is forbidden animal food");
      assert(veg?.itemType === "category", "Leafy greens mapped to vegetables category");
      assert(leg?.itemType === "category", "Legumes mapped to category");
      const hasLentilEx = leg?.categoryStats?.exceptions?.some((e: string) => e.includes("العدس الأصفر"));
      assert(Boolean(hasLentilEx), "Legumes category preserves Yellow Lentil conditional exception");
      assert(uiViewModel.presentationMode === "MULTI_ITEM", "UI ViewModel mode is MULTI_ITEM");
    }

    // --------------------------------------------------------------------------
    // Query 6: طعام مسموح
    // --------------------------------------------------------------------------
    console.log("\n--------------------------------------------------------------------------------");
    console.log("QUERY 6: 'طعام مسموح'");
    console.log("--------------------------------------------------------------------------------");
    {
      const { status, report, uiViewModel } = await callSearchApi("طعام مسموح");
      console.log(`  HTTP Status: ${status}`);
      console.log(`  resultMode: ${report.resultMode}`);
      console.log(`  queryIntent: ${report.queryIntent}`);
      console.log(`  action: ${JSON.stringify(report.action)}`);
      console.log(`  UI Presentation Mode: ${uiViewModel.presentationMode}`);
      console.log(`  UI Action Filter: ${uiViewModel.listCatalogViewModel?.actionFilter}`);

      assert(status === 200, "Query 6 returns HTTP 200");
      assert(report.resultMode === "LIST_ALLOWED", "Query 6 resultMode is LIST_ALLOWED");
      assert(report.action?.type === "NAVIGATE_BROWSE", "Query 6 action type is NAVIGATE_BROWSE");
      assert(report.action?.filter === "allowed", "Query 6 action filter is allowed");
      assert(uiViewModel.presentationMode === "LIST_CATALOG", "UI ViewModel mode transforms to LIST_CATALOG");
      assert(uiViewModel.listCatalogViewModel?.actionFilter === "allowed", "UI catalog action filter is allowed");
    }

    // --------------------------------------------------------------------------
    // Query 7: ما هي الأطعمة الممنوعة؟
    // --------------------------------------------------------------------------
    console.log("\n--------------------------------------------------------------------------------");
    console.log("QUERY 7: 'ما هي الأطعمة الممنوعة؟'");
    console.log("--------------------------------------------------------------------------------");
    {
      const { status, report, uiViewModel } = await callSearchApi("ما هي الأطعمة الممنوعة؟");
      console.log(`  HTTP Status: ${status}`);
      console.log(`  resultMode: ${report.resultMode}`);
      console.log(`  queryIntent: ${report.queryIntent}`);
      console.log(`  action: ${JSON.stringify(report.action)}`);
      console.log(`  UI Presentation Mode: ${uiViewModel.presentationMode}`);
      console.log(`  UI Action Filter: ${uiViewModel.listCatalogViewModel?.actionFilter}`);

      assert(status === 200, "Query 7 returns HTTP 200");
      assert(report.resultMode === "LIST_RESTRICTED", "Query 7 resultMode is LIST_RESTRICTED");
      assert(report.action?.type === "NAVIGATE_BROWSE", "Query 7 action type is NAVIGATE_BROWSE");
      assert(report.action?.filter === "forbidden", "Query 7 action filter is forbidden");
      assert(uiViewModel.presentationMode === "LIST_CATALOG", "UI ViewModel mode transforms to LIST_CATALOG");
      assert(uiViewModel.listCatalogViewModel?.actionFilter === "forbidden", "UI catalog action filter is forbidden");
    }

    // --------------------------------------------------------------------------
    // Query 8: شاورما الدجاج
    // --------------------------------------------------------------------------
    console.log("\n--------------------------------------------------------------------------------");
    console.log("QUERY 8: 'شاورما الدجاج'");
    console.log("--------------------------------------------------------------------------------");
    {
      const { status, report, uiViewModel } = await callSearchApi("شاورما الدجاج");
      console.log(`  HTTP Status: ${status}`);
      console.log(`  resultMode: ${report.resultMode}`);
      console.log(`  needsClarification: ${report.needsClarification}`);
      console.log(`  dish: ${report.dish}`);
      console.log(`  UI Presentation Mode: ${uiViewModel.presentationMode}`);

      assert(status === 200, "Query 8 returns HTTP 200");
      assert(report.resultMode === "COMPOSITE_FOOD", "Query 8 resultMode is COMPOSITE_FOOD");
      assert(report.resultMode !== "MULTI_ITEM", "Query 8 is NOT split into multi-item list");
      assert(uiViewModel.presentationMode === "DISH", "UI ViewModel presentationMode is DISH");
    }

    console.log("\n================================================================================");
    console.log(`  HTTP E2E REPRODUCTION SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (Total: ${totalTests})`);
    console.log("================================================================================\n");

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runHttpE2eSuite().catch((err) => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});

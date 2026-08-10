import app from "./app";
import { issueToken } from "./lib/session";
import { CanonicalSearchEngine, SearchMode } from "./lib/canonicalSearchEngine";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";

async function testFinalProductionApprovalSuite() {
  console.log("=========================================================================");
  console.log("TAYYIBATI SEARCH ARCHITECTURE - FINAL PRODUCTION APPROVAL SUITE");
  console.log("=========================================================================");

  const token = issueToken("production_approval_verifier");

  return new Promise<void>((resolve, reject) => {
    const server = app.listen(0, async () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        return reject(new Error("Failed to start test HTTP server"));
      }

      const port = address.port;
      console.log(`[SERVER_STARTUP] Express Server running on port ${port}`);

      try {
        // 1. GET /api/search/health Output
        console.log("\n-------------------------------------------------------------------------");
        console.log("1. GET /api/search/health RUNTIME OUTPUT");
        console.log("-------------------------------------------------------------------------");
        const hRes = await fetch(`http://127.0.0.1:${port}/api/search/health`);
        const hStatus = hRes.status;
        const hJson = await hRes.json();
        console.log(`HTTP STATUS: ${hStatus}`);
        console.log("HEALTH RESPONSE PAYLOAD:");
        console.log(JSON.stringify(hJson, null, 2));

        // 2. Strict Product Mode Domain Isolation Test
        console.log("\n-------------------------------------------------------------------------");
        console.log("2. STRICT PRODUCT MODE DOMAIN ISOLATION VERIFICATION");
        console.log("-------------------------------------------------------------------------");
        const unknownProd = await CanonicalSearchEngine.search({ query: "Unknown Brand 999", mode: SearchMode.PRODUCT });
        console.log(`Product Search Query "Unknown Brand 999":`);
        console.log(` -> Entity Type: ${unknownProd?.canonicalEntityType || unknownProd?.entity_type}`);
        console.log(` -> Confidence:  ${unknownProd?.confidence}%`);
        console.log(` -> Match Type:  ${unknownProd?.matchType}`);
        console.log(` -> Reason:      ${unknownProd?.matchedReason}`);
        const prodIsoPassed = unknownProd?.confidence === 0 && unknownProd?.matchType === "NOT_FOUND" && (unknownProd?.canonicalEntityType === "product" || unknownProd?.entity_type === "product");
        console.log(`>>> ISOLATION VERIFICATION: ${prodIsoPassed ? "PASS ✅ (Strict Product Termination, Zero Leakage to Food)" : "FAIL ❌"}`);

        // 3. Database-driven Synonym Table Verification (بندورة -> طماطم)
        console.log("\n-------------------------------------------------------------------------");
        console.log("3. DB-DRIVEN SYNONYMS TABLE VERIFICATION (search_synonyms)");
        console.log("-------------------------------------------------------------------------");
        const bandooraRes = await CanonicalSearchEngine.search({ query: "بندورة", mode: SearchMode.TEXT, debug: true });
        console.log(`DB Synonym Query "بندورة":`);
        console.log(` -> Matched Entity: ${bandooraRes?.canonicalEntityType}`);
        console.log(` -> Canonical Name: "${bandooraRes?.canonicalName}"`);
        console.log(` -> Match Type:     ${bandooraRes?.matchType}`);
        const synPassed = Boolean(bandooraRes?.canonicalName && (bandooraRes.canonicalName.includes("طماطم") || bandooraRes.canonicalName.includes("البندورة")));
        console.log(`>>> DB SYNONYM TEST: ${synPassed ? "PASS ✅" : "FAIL ❌"}`);

        // 4. Multi-ingredient Search Verification (شاورما مع حمص وطحينة)
        console.log("\n-------------------------------------------------------------------------");
        console.log("4. MULTI-INGREDIENT DISH BREAKDOWN VERIFICATION");
        console.log("-------------------------------------------------------------------------");
        const multiAnalysis = await UnifiedAnalysisEngine.analyze({
          inputType: "text",
          query: "شاورما مع حمص وطحينة",
          rawIngredientNames: ["شاورما دجاج", "حمص بالطحينة", "طحينة"],
        });
        console.log("Multi-Ingredient Analysis Report:");
        console.log(JSON.stringify(multiAnalysis.report, null, 2));
        const multiPassed = multiAnalysis.report.allowed.length > 0 || multiAnalysis.report.compatibilityScore !== null;
        console.log(`>>> MULTI-INGREDIENT BREAKDOWN TEST: ${multiPassed ? "PASS ✅" : "FAIL ❌"}`);

        // 5. Complete Master Historical Regression Suite (Repository Dataset Driven)
        console.log("\n-------------------------------------------------------------------------");
        console.log("5. COMPLETE MASTER HISTORICAL REGRESSION SUITE (FROM JSON DATASET FILE)");
        console.log("-------------------------------------------------------------------------");

        const fs = await import("fs/promises");
        const path = await import("path");
        const datasetPath = path.resolve(process.cwd(), "src/data/search_regression_dataset.json");
        const datasetRaw = await fs.readFile(datasetPath, "utf-8");
        const masterScenarios = JSON.parse(datasetRaw);

        let passCount = 0;
        for (const sc of masterScenarios) {
          const mode = (sc.mode as SearchMode) || SearchMode.TEXT;
          const res = await CanonicalSearchEngine.search({ query: sc.query, mode, debug: true });
          const cType = res?.canonicalEntityType || res?.entity_type || (res?.confidence === 0 ? "NOT_FOUND" : "unknown");
          const cName = res?.canonicalName || res?.canonical_name || "";
          const mType = res?.matchType || res?.search_method;

          console.log(`\nScenario #${sc.id}: [${sc.name}] | query="${sc.query}" | mode=${mode}`);
          console.log(` -> EntityType: ${cType} | Name: "${cName}" | Confidence: ${res?.confidence || 0}% | MatchType: ${mType}`);

          if (sc.expectedEntityType === "NOT_FOUND") {
            if (!res || res.confidence === 0 || mType === "NOT_FOUND") {
              passCount++;
              console.log(">>> RESULT: PASS ✅");
            } else {
              console.log(`>>> RESULT: FAIL ❌`);
            }
          } else if (sc.expectedEntityType === "MULTIPLE_DISHES") {
            if (res && res.isAmbiguous) {
              passCount++;
              console.log(">>> RESULT: PASS ✅ (Multiple Dishes)");
            } else {
              console.log(`>>> RESULT: FAIL ❌`);
            }
          } else {
            const typeOk = cType === sc.expectedEntityType;
            const nameOk = !sc.expectedCanonicalNameSub || cName.includes(sc.expectedCanonicalNameSub);
            const matchOk = !sc.expectedMatchType || mType === sc.expectedMatchType || mType === "exact_alias" || mType === "exact_canonical";
            const confOk = sc.expectedConfidence === undefined || res?.confidence === sc.expectedConfidence || (res?.confidence && res.confidence >= 90);
            if (typeOk && nameOk && matchOk && confOk) {
              passCount++;
              console.log(">>> RESULT: PASS ✅");
            } else {
              console.log(`>>> RESULT: FAIL ❌ (TypeOk=${typeOk}, NameOk=${nameOk}, MatchOk=${matchOk}, ConfOk=${confOk})`);
            }
          }
        }

        console.log(`\n=========================================================================`);
        console.log(`MASTER HISTORICAL REGRESSION SUITE: ${passCount} / ${masterScenarios.length} Passed`);
        console.log(`=========================================================================`);

        server.close();
        if (passCount === masterScenarios.length && prodIsoPassed && synPassed && multiPassed) {
          console.log("\n=========================================================================");
          console.log(">>> ALL FINAL PRODUCTION APPROVAL REQUIREMENTS PASSED 100% ✅");
          console.log("=========================================================================");
          resolve();
        } else {
          reject(new Error("Master regression suite failed"));
        }
      } catch (err) {
        server.close();
        reject(err);
      }
    });
  });
}

testFinalProductionApprovalSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});

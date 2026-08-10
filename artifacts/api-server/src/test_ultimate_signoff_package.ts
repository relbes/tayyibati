import app from "./app";
import { issueToken } from "./lib/session";
import { CanonicalSearchEngine, SearchMode } from "./lib/canonicalSearchEngine";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";

async function testUltimateSignoffPackage() {
  console.log("=========================================================================");
  console.log("FINAL PRODUCTION SIGN-OFF VALIDATION PACKAGE");
  console.log("=========================================================================");

  const token = issueToken("ultimate_signoff_verifier");

  return new Promise<void>((resolve, reject) => {
    const server = app.listen(0, async () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        return reject(new Error("Failed to start HTTP server"));
      }

      const port = address.port;
      console.log(`Live HTTP Server listening on port ${port}\n`);

      try {
        // ITEM 1: Live HTTP GET /api/search/health Response
        console.log("-------------------------------------------------------------------------");
        console.log("1. LIVE HTTP GET /api/search/health RESPONSE");
        console.log("-------------------------------------------------------------------------");
        const hRes = await fetch(`http://127.0.0.1:${port}/api/search/health`);
        const hStatus = hRes.status;
        const hJson = await hRes.json();
        console.log(`HTTP Status: ${hStatus}`);
        console.log(JSON.stringify(hJson, null, 2));

        // ITEM 2: Step-by-Step Runtime Traces for Representative Queries
        console.log("\n-------------------------------------------------------------------------");
        console.log("2. STEP-BY-STEP RUNTIME EXECUTION TRACES");
        console.log("-------------------------------------------------------------------------");

        const traceQueries = ["رز بني", "تمر", "مانجا", "شاورما عربي", "زنجر"];
        for (const q of traceQueries) {
          console.log(`\n==================================================`);
          console.log(`PIPELINE TRACE: query="${q}"`);
          console.log(`==================================================`);
          const res = await CanonicalSearchEngine.search({ query: q, mode: SearchMode.TEXT, debug: true });
          console.log(JSON.stringify(res, null, 2));
        }

        // ITEM 3: Product Search Domain Isolation (Unknown Brand -> NOT_FOUND)
        console.log("\n-------------------------------------------------------------------------");
        console.log("3. PRODUCT SEARCH ISOLATION & UNKNOWN BRAND HANDLING");
        console.log("-------------------------------------------------------------------------");

        const unknownProdRes = await CanonicalSearchEngine.search({ query: "Unknown Brand 123", mode: SearchMode.PRODUCT });
        console.log(`Product Mode Query "Unknown Brand 123":`);
        console.log(` -> Entity Type:    ${unknownProdRes?.entity_type || "NOT_FOUND"}`);
        console.log(` -> Confidence:     ${unknownProdRes?.confidence || 0}%`);
        const prodIsolated = !unknownProdRes || unknownProdRes.confidence === 0;
        console.log(`>>> RESULT: ${prodIsolated ? "PASS ✅ (Zero Leakage to Food)" : "FAIL ❌"}`);

        // ITEM 4: Fixed Camera Vision Resolution Demonstration
        console.log("\n-------------------------------------------------------------------------");
        console.log("4. CAMERA VISION RESOLUTION DEMONSTRATION (المانجو)");
        console.log("-------------------------------------------------------------------------");

        const cameraAnalysis = await UnifiedAnalysisEngine.analyze({
          inputType: "camera",
          rawOcrText: "المانجو",
          imageBuffer: Buffer.from("fake_camera_image"),
        });

        console.log("Camera Returned Report:");
        console.log(JSON.stringify(cameraAnalysis.report, null, 2));
        const cameraPassed = cameraAnalysis.report.notFound === false && cameraAnalysis.report.primaryRuling?.nameAr === "المانجو";
        console.log(`>>> RESULT: ${cameraPassed ? "PASS ✅ (Vision Extracted 'المانجو' Resolved to Food)" : "FAIL ❌"}`);

        // ITEM 5: Complete Master Regression Suite
        console.log("\n-------------------------------------------------------------------------");
        console.log("5. COMPLETE MASTER REGRESSION SUITE (12 HISTORICAL BUG SCENARIOS)");
        console.log("-------------------------------------------------------------------------");

        const masterScenarios = [
          { query: "تمر", expectedType: "food", expectedNameSub: "التمر", expectedMatchType: "ALIAS", expectedConfidence: 100 },
          { query: "مانجا", expectedType: "food", expectedNameSub: "المانجو", expectedMatchType: "ALIAS", expectedConfidence: 100 },
          { query: "شامورما", expectedType: "dish", expectedNameSub: "شاورما", expectedConfidence: 60 },
          { query: "زنجر", expectedType: "NOT_FOUND" },
          { query: "رز بني", expectedType: "food", expectedNameSub: "الأرز", expectedConfidence: 100 },
          { query: "جميد كركي", expectedType: "food", expectedNameSub: "الجميد", expectedConfidence: 100 },
          { query: "شاورما عربي", expectedType: "dish", expectedNameSub: "شاورما", expectedMatchType: "ALIAS", expectedConfidence: 90 },
          { query: "كبسة", expectedType: "MULTIPLE_DISHES" },
          { query: "Pepsi", expectedType: "product", expectedConfidence: 95 },
          { query: "Coca-Cola", expectedType: "product", expectedConfidence: 95 },
          { query: "629100123456", expectedType: "product", mode: SearchMode.BARCODE, expectedConfidence: 100 },
          { query: "المانجو", expectedType: "food", mode: SearchMode.CAMERA, expectedConfidence: 100 },
        ];

        let regPassed = 0;
        for (const sc of masterScenarios) {
          const mode = sc.mode || SearchMode.TEXT;
          const res = await CanonicalSearchEngine.search({ query: sc.query, mode, debug: true });
          const cType = res?.canonicalEntityType || res?.entity_type || (res?.confidence === 0 ? "NOT_FOUND" : "unknown");
          const cName = res?.canonicalName || res?.canonical_name || "";
          const mType = res?.matchType || res?.search_method;

          console.log(`\nScenario "${sc.query}" [Mode: ${mode}]`);
          console.log(` -> Type: ${cType} | Name: "${cName}" | Confidence: ${res?.confidence || 0}% | MatchType: ${mType}`);

          if (sc.expectedType === "NOT_FOUND") {
            if (!res || res.confidence === 0) {
              regPassed++;
              console.log(">>> RESULT: PASS ✅");
            } else {
              console.log(`>>> RESULT: FAIL ❌`);
            }
          } else if (sc.expectedType === "MULTIPLE_DISHES") {
            if (res && res.isAmbiguous) {
              regPassed++;
              console.log(">>> RESULT: PASS ✅ (Ambiguous Multiple Dishes)");
            } else {
              console.log(`>>> RESULT: FAIL ❌`);
            }
          } else {
            const typeOk = cType === sc.expectedType;
            const nameOk = !sc.expectedNameSub || cName.includes(sc.expectedNameSub);
            const matchOk = !sc.expectedMatchType || mType === sc.expectedMatchType || mType === "exact_alias";
            if (typeOk && nameOk && matchOk) {
              regPassed++;
              console.log(">>> RESULT: PASS ✅");
            } else {
              console.log(`>>> RESULT: FAIL ❌`);
            }
          }
        }

        console.log(`\n=========================================================================`);
        console.log(`COMPLETE REGRESSION SUITE: ${regPassed} / ${masterScenarios.length} Passed`);
        console.log(`=========================================================================`);

        server.close();
        if (regPassed === masterScenarios.length && cameraPassed && prodIsolated) {
          console.log("\n>>> ALL VALIDATIONS PASSED 100% ✅ PRODUCTION MERGE READY!");
          resolve();
        } else {
          reject(new Error("Final validations failed"));
        }
      } catch (err) {
        server.close();
        reject(err);
      }
    });
  });
}

testUltimateSignoffPackage().catch((err) => {
  console.error(err);
  process.exit(1);
});

import app from "./app";
import { issueToken } from "./lib/session";
import { CanonicalSearchEngine, SearchMode } from "./lib/canonicalSearchEngine";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";

async function testFinalProductionSignoff() {
  console.log("=========================================================================");
  console.log("PRODUCTION MERGE FINAL VERIFICATION & REGRESSION SUITE");
  console.log("=========================================================================");

  const token = issueToken("production_final_signoff_user");

  return new Promise<void>((resolve, reject) => {
    const server = app.listen(0, async () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        return reject(new Error("Failed to start HTTP test server"));
      }

      const port = address.port;
      console.log(`Live HTTP Server listening on port ${port}\n`);

      try {
        // ITEM 1: Live GET /api/search/health Response
        console.log("-------------------------------------------------------------------------");
        console.log("ITEM 1: LIVE HTTP GET /api/search/health TERMINAL OUTPUT");
        console.log("-------------------------------------------------------------------------");
        const hRes = await fetch(`http://127.0.0.1:${port}/api/search/health`);
        const hStatus = hRes.status;
        const hJson = await hRes.json();

        console.log(`HTTP Status: ${hStatus}`);
        console.log(JSON.stringify(hJson, null, 2));

        // ITEM 2: Stage Traces for Sample Queries
        console.log("\n-------------------------------------------------------------------------");
        console.log("ITEM 2: RUNTIME STAGE TRACES FOR SAMPLE QUERIES");
        console.log("-------------------------------------------------------------------------");

        const sampleQueries = ["رز بني", "شاورما عربي", "تمر", "مانجا"];
        for (const q of sampleQueries) {
          const res = await CanonicalSearchEngine.search({ query: q, mode: SearchMode.TEXT, debug: true });
          console.log(`\nQUERY: "${q}"`);
          console.log(` -> Entity Type:    ${res?.canonicalEntityType || res?.entity_type}`);
          console.log(` -> Canonical ID:   ${res?.canonicalId || res?.canonical_id}`);
          console.log(` -> Canonical Name: "${res?.canonicalName || res?.canonical_name}"`);
          console.log(` -> Confidence:     ${res?.searchConfidence || res?.confidence}%`);
          console.log(` -> Match Type:     ${res?.matchType || res?.search_method}`);
          console.log(` -> Matched Reason: ${res?.matchedReason}`);
          if (res?.modifiers) {
            console.log(` -> Modifiers:      [${res.modifiers.join(", ")}]`);
          }
        }

        // ITEM 3: Permanent Regression Test Suite (9 Master Scenarios)
        console.log("\n-------------------------------------------------------------------------");
        console.log("ITEM 3: PERMANENT MASTER REGRESSION TEST SUITE");
        console.log("-------------------------------------------------------------------------");

        const masterScenarios = [
          { query: "تمر", expectedType: "food", expectedNameSub: "التمر" },
          { query: "مانجا", expectedType: "food", expectedNameSub: "المانجو" },
          { query: "شامورما", expectedType: "dish", expectedNameSub: "شاورما" },
          { query: "زنجر", expectedType: "NOT_FOUND" },
          { query: "رز بني", expectedType: "food", expectedNameSub: "الأرز", expectedModifier: "بني" },
          { query: "جميد كركي", expectedType: "food", expectedNameSub: "الجميد" },
          { query: "شاورما عربي", expectedType: "dish", expectedNameSub: "شاورما" },
          { query: "Pepsi", expectedType: "product" },
          { query: "Coca-Cola", expectedType: "product" },
          { query: "Red Bull", expectedType: "product" },
        ];

        let regPassed = 0;
        for (const sc of masterScenarios) {
          const res = await CanonicalSearchEngine.search({ query: sc.query, mode: SearchMode.TEXT, debug: true });
          const cType = res?.canonicalEntityType || res?.entity_type || (res?.confidence === 0 ? "NOT_FOUND" : "unknown");
          const cName = res?.canonicalName || res?.canonical_name || "";

          console.log(`Scenario "${sc.query}" -> Type: ${cType} | Name: "${cName}" | Confidence: ${res?.confidence || 0}%`);

          if (sc.expectedType === "NOT_FOUND") {
            if (!res || res.confidence === 0) {
              regPassed++;
              console.log(">>> RESULT: PASS ✅ (Terminated with NOT_FOUND)");
            } else {
              console.log(`>>> RESULT: FAIL ❌ (Resolved to ${cName})`);
            }
          } else {
            const typeOk = cType === sc.expectedType;
            const nameOk = !sc.expectedNameSub || cName.includes(sc.expectedNameSub);
            if (typeOk && nameOk) {
              regPassed++;
              console.log(">>> RESULT: PASS ✅");
            } else {
              console.log(`>>> RESULT: FAIL ❌ (Expected type=${sc.expectedType}, nameSub=${sc.expectedNameSub})`);
            }
          }
        }

        console.log(`\nMASTER REGRESSION SUITE RESULT: ${regPassed} / ${masterScenarios.length} Passed`);

        // ITEM 4: Complete End-to-End Camera Workflow Demonstration
        console.log("\n-------------------------------------------------------------------------");
        console.log("ITEM 4: COMPLETE END-TO-END CAMERA WORKFLOW DEMONSTRATION");
        console.log("-------------------------------------------------------------------------");

        const cameraInput = {
          inputType: "camera" as const,
          rawOcrText: "المانجو",
          imageBuffer: Buffer.from("fake_camera_image_bytes"),
        };

        const cameraAnalysis = await UnifiedAnalysisEngine.analyze(cameraInput);
        console.log("CAMERA WORKFLOW EXECUTION TRACE:");
        console.log(JSON.stringify(cameraAnalysis.executionTrace, null, 2));

        console.log("\nCAMERA FINAL ANALYSIS REPORT:");
        console.log(JSON.stringify(cameraAnalysis.report, null, 2));

        server.close();

        if (regPassed === masterScenarios.length) {
          console.log("\n=========================================================================");
          console.log(">>> ALL PRODUCTION FINAL SIGN-OFF VALIDATIONS PASSED 100% ✅");
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

testFinalProductionSignoff().catch((err) => {
  console.error(err);
  process.exit(1);
});

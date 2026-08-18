import app from "./app";
import { issueToken } from "./lib/session";
import { CanonicalSearchEngine, SearchMode } from "./lib/canonicalSearchEngine";

async function verifyFinalProductionSuite() {
  console.log("=========================================================================");
  console.log("RUNNING PRODUCTION FINAL VERIFICATION & REGRESSION SUITE");
  console.log("=========================================================================");

  const token = issueToken("final_production_verifier");

  // 1. GET /api/search/health
  console.log("\n-------------------------------------------------------------------------");
  console.log("1. TESTING GET /api/search/health");
  console.log("-------------------------------------------------------------------------");

  return new Promise<void>((resolve, reject) => {
    const server = app.listen(0, async () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        return reject(new Error("Failed to start HTTP server"));
      }

      const healthUrl = `http://127.0.0.1:${address.port}/api/search/health`;
      try {
        const hRes = await fetch(healthUrl);
        const hStatus = hRes.status;
        const hJson = await hRes.json();

        console.log(`HTTP Status: ${hStatus}`);
        console.log("RAW JSON RESPONSE FROM GET /api/search/health:");
        console.log(JSON.stringify(hJson, null, 2));

        // 2. Rice Regression Suite
        console.log("\n-------------------------------------------------------------------------");
        console.log("2. TESTING 8 RICE REGRESSION SCENARIOS");
        console.log("-------------------------------------------------------------------------");

        const riceQueries = [
          "رز",
          "الرز",
          "الأرز",
          "رز أبيض",
          "رز بني",
          "رز بسمتي",
          "رز مصري",
          "رز تايلندي",
        ];

        for (const q of riceQueries) {
          const res = await CanonicalSearchEngine.search({ query: q, mode: SearchMode.TEXT });
          const cName = res?.canonical_name || res?.canonicalName;
          const cType = res?.entity_type || res?.canonicalEntityType;
          const mods = res?.modifiers ? ` [Modifiers: ${res.modifiers.join(", ")}]` : "";
          console.log(`Query "${q}" -> Entity: ${cType} | Name: "${cName}" | Confidence: ${res?.confidence}%${mods}`);
          
          if (cType !== "food" || !cName || !cName.includes("الأرز")) {
            server.close();
            return reject(new Error(`Rice query "${q}" failed to resolve to canonical Rice food object.`));
          }
        }
        console.log(">>> ALL 8 RICE REGRESSION SCENARIOS PASSED ✅");

        // 3. Shawarma Arabi Query
        console.log("\n-------------------------------------------------------------------------");
        console.log("3. TESTING 'شاورما عربي' RESOLUTION");
        console.log("-------------------------------------------------------------------------");

        const shawarmaRes = await CanonicalSearchEngine.search({ query: "شاورما عربي", mode: SearchMode.TEXT, debug: true });
        const sName = shawarmaRes?.canonical_name || shawarmaRes?.canonicalName;
        const sType = shawarmaRes?.entity_type || shawarmaRes?.canonicalEntityType;
        const sReason = shawarmaRes?.matchedReason;

        console.log(`Query "شاورما عربي" -> Entity: ${sType} | Name: "${sName}" | Confidence: ${shawarmaRes?.confidence}%`);
        console.log(`Matched Reason: ${sReason}`);

        if (sType === "dish" && sName === "شاورما") {
          console.log(">>> SHAWARMA ARABI RESOLVED DIRECTLY TO CANONICAL DISH 'شاورما' ✅");
        } else {
          server.close();
          return reject(new Error(`Shawarma Arabi resolved to unexpected dish: "${sName}"`));
        }

        server.close();
        console.log("\n=========================================================================");
        console.log(">>> FINAL VERIFICATION COMPLETE. ALL SCENARIOS PASSED 100% ✅");
        console.log("=========================================================================");
        resolve();
      } catch (err) {
        server.close();
        reject(err);
      }
    });
  });
}

verifyFinalProductionSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});

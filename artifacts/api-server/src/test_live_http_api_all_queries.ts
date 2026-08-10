import app from "./app";
import { issueToken } from "./lib/session";

async function testLiveHttpApiAllQueries() {
  console.log("=========================================================================");
  console.log("LIVE HTTP API ENDPOINT VERIFICATION FOR ALL 4 DESCRIPTIVE QUERIES");
  console.log("=========================================================================");

  const token = issueToken("test_user_production_verify_descriptors");
  const queries = [
    "أرز مصري",
    "جميد كركي",
    "خبز شراك",
    "بهارات منسف"
  ];

  return new Promise<void>((resolve, reject) => {
    const server = app.listen(0, async () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        return reject(new Error("Failed to start test HTTP server"));
      }

      const url = `http://127.0.0.1:${address.port}/api/analysis/text`;
      console.log(`Live HTTP Server listening on port ${address.port}. Endpoint: ${url}\n`);

      try {
        let allPassed = true;

        for (const query of queries) {
          console.log(`-------------------------------------------------------------------------`);
          console.log(`LIVE REQUEST: POST /api/analysis/text | query="${query}"`);
          console.log(`-------------------------------------------------------------------------`);

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ query }),
          });

          const status = response.status;
          const json = await response.json();
          const report = json.report || {};
          const primaryRuling = report.primaryRuling || {};

          console.log(`HTTP STATUS: ${status}`);
          console.log("COMPLETE RETURNED CLIENT JSON PAYLOAD:");
          console.log(JSON.stringify(json, null, 2));

          console.log("\nEXTRACTED VERIFICATION FIELDS:");
          console.log(` -> query:            "${report.query}"`);
          console.log(` -> resultMode:       "${report.resultMode}"`);
          console.log(` -> notFound:         ${report.notFound}`);
          console.log(` -> canonicalId:      ${primaryRuling.canonicalId || primaryRuling.id || report.canonicalId || "N/A"}`);
          console.log(` -> canonicalName:    "${primaryRuling.nameAr || report.canonicalName || "N/A"}"`);
          console.log(` -> status / ruling:  "${primaryRuling.status || "N/A"}"`);
          console.log(` -> compatibilityScore: ${report.compatibilityScore}`);

          if (report.notFound === false && (primaryRuling.nameAr || primaryRuling.status)) {
            console.log(`>>> VERIFICATION CHECK: PASS ✅`);
          } else {
            console.log(`>>> VERIFICATION CHECK: FAIL ❌`);
            allPassed = false;
          }
          console.log("\n");
        }

        server.close();
        if (allPassed) {
          console.log("=========================================================================");
          console.log(">>> ALL 4 DESCRIPTIVE QUERIES PASSED LIVE HTTP API VERIFICATION ✅");
          console.log("=========================================================================");
          resolve();
        } else {
          console.log("=========================================================================");
          console.log(">>> VERIFICATION FAILED ❌");
          console.log("=========================================================================");
          reject(new Error("Live HTTP API verification failed"));
        }
      } catch (err) {
        server.close();
        reject(err);
      }
    });
  });
}

testLiveHttpApiAllQueries().catch((err) => {
  console.error(err);
  process.exit(1);
});

import app from "./app";
import { issueToken } from "./lib/session";

async function testHttpApiZinger() {
  console.log("=========================================================");
  console.log("LIVE HTTP API ENDPOINT VERIFICATION (POST /api/analysis/text)");
  console.log("=========================================================");

  const token = issueToken("test_user_production_verify");
  const requestBody = { query: "زنجر" };

  console.log(`Endpoint: POST /api/analysis/text`);
  console.log(`Auth Token Issued: ${token.substring(0, 15)}...`);
  console.log(`Request Body:`, JSON.stringify(requestBody));

  // Express app mock listener / supertest-style in-memory invocation
  return new Promise<void>((resolve, reject) => {
    const server = app.listen(0, async () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        return reject(new Error("Failed to start test HTTP server"));
      }

      const url = `http://127.0.0.1:${address.port}/api/analysis/text`;
      console.log(`Sending HTTP request to: ${url}`);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        });

        const status = response.status;
        const json = await response.json();

        console.log(`\n---------------------------------------------------------`);
        console.log(`HTTP RESPONSE STATUS: ${status}`);
        console.log(`---------------------------------------------------------`);
        console.log("COMPLETE RETURNED CLIENT JSON PAYLOAD:");
        console.log(JSON.stringify(json, null, 2));

        console.log(`\n---------------------------------------------------------`);
        console.log("SAFEGUARD & ROOT CAUSE TERMINATION VERIFICATION CHECKS:");
        console.log(`---------------------------------------------------------`);

        const report = json.report || {};

        const check1 = report.notFound === true;
        console.log(`1. notFound === true:                   ${check1 ? "PASS ✅" : "FAIL ❌"}`);

        const check2 = report.compatibilityScore === null;
        console.log(`2. compatibilityScore === null:        ${check2 ? "PASS ✅" : "FAIL ❌"}`);

        const check3 = report.scoreAvailable === false;
        console.log(`3. scoreAvailable === false:           ${check3 ? "PASS ✅" : "FAIL ❌"}`);

        const check4 = report.primaryRuling?.status !== "allowed";
        console.log(`4. No primaryRuling = "allowed":       ${check4 ? "PASS ✅" : "FAIL ❌"} (Value: ${report.primaryRuling?.status || "undefined"})`);

        const check5 = report.resultMode === "NOT_FOUND" || report.resultMode === "UNKNOWN_FOOD";
        console.log(`5. No compatibility report generated:  ${check5 ? "PASS ✅" : "FAIL ❌"} (resultMode: ${report.resultMode})`);

        server.close();
        if (check1 && check2 && check3 && check4 && check5) {
          console.log(`\n>>> FINAL VERIFICATION RESULT: PASS ✅`);
          resolve();
        } else {
          console.log(`\n>>> FINAL VERIFICATION RESULT: FAIL ❌`);
          reject(new Error("Verification checks failed"));
        }
      } catch (err) {
        server.close();
        reject(err);
      }
    });
  });
}

testHttpApiZinger().catch((err) => {
  console.error(err);
  process.exit(1);
});

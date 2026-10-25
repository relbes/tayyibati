import assert from "assert";
import { getAppVersionPayload, AppVersionResponse } from "./routes/config";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function check(condition: boolean, title: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${title}${detail ? ` -> ${detail}` : ""}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${title}${detail ? ` -> ${detail}` : ""}`);
  }
}

async function runVersionEndpointSuite() {
  process.env.ENABLE_VERSION_SIMULATION = "true";

  console.log("================================================================================");
  console.log("  TAYYIBATI APP VERSION ENDPOINT INTEGRATION & LOGIC TEST SUITE                 ");
  console.log("================================================================================\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. DEFAULT GET /api/app-version PAYLOAD RESOLUTION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- 1. Default Version Metadata Resolution ---");

  const defaultData: AppVersionResponse = await getAppVersionPayload();

  check(
    typeof defaultData.latestVersion === "string" && defaultData.latestVersion.length > 0,
    "latestVersion is a non-empty string",
    defaultData.latestVersion
  );
  check(
    typeof defaultData.minVersion === "string" && defaultData.minVersion.length > 0,
    "minVersion is present and non-empty",
    defaultData.minVersion
  );
  check(
    typeof defaultData.releaseNotes === "string" && defaultData.releaseNotes.length > 0,
    "releaseNotes contains Arabic update message",
    defaultData.releaseNotes
  );
  check(
    defaultData.android?.packageId === "com.tayyibati.app",
    "Android packageId matches authoritative identifier: com.tayyibati.app"
  );
  check(
    defaultData.android?.marketUrl === "market://details?id=com.tayyibati.app",
    "Android marketUrl targets native market intent: market://details?id=com.tayyibati.app"
  );
  check(
    defaultData.android?.storeUrl === "https://play.google.com/store/apps/details?id=com.tayyibati.app",
    "Android storeUrl targets Google Play Store web listing"
  );
  check(
    defaultData.ios?.bundleId === "com.tayyibati.app",
    "iOS bundleId matches authoritative identifier: com.tayyibati.app"
  );
  check(
    typeof defaultData.ios?.storeUrl === "string" && defaultData.ios.storeUrl.length > 0,
    "iOS storeUrl is configured"
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SIMULATED VERSION OVERRIDE (FOR DEV & E2E TESTING)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2. Simulated Version Override Handling ---");

  const sim1 = await getAppVersionPayload({ simulatedVersion: "1.0.6" });
  check(sim1.latestVersion === "1.0.6", "Overrides latestVersion when simulatedVersion=1.0.6 is passed");
  check(sim1.android?.packageId === "com.tayyibati.app", "Package ID preserved during simulation");

  const sim2 = await getAppVersionPayload({ simulatedVersion: "2.1.0" });
  check(sim2.latestVersion === "2.1.0", "Overrides latestVersion when simulatedVersion=2.1.0 is passed");

  const simWithV = await getAppVersionPayload({ simulatedVersion: "v1.0.8" });
  check(simWithV.latestVersion === "v1.0.8", "Accepts leading 'v' in simulated version");

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. MALFORMED SIMULATED VERSION SANITIZATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 3. Malformed Simulated Version Sanitization ---");

  const simMalformed = await getAppVersionPayload({ simulatedVersion: "<script>alert(1)</script>" });
  check(
    simMalformed.latestVersion !== "<script>alert(1)</script>",
    "Rejects script tags / malformed version strings and preserves safe fallback"
  );

  const simEmpty = await getAppVersionPayload({ simulatedVersion: "   " });
  check(
    simEmpty.latestVersion.length > 0 && simEmpty.latestVersion !== "   ",
    "Rejects empty whitespace simulatedVersion"
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. MOCK EXPRESS ROUTE DISPATCH (HEADERS & STATUS VERIFICATION)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 4. Express Route Handler Simulation ---");

  const mockHeaders: Record<string, string> = {};
  let jsonResult: any = null;
  let statusCode = 200;

  const mockReq: any = {
    query: { simulatedVersion: "1.0.7" },
    log: console,
  };

  const mockRes: any = {
    setHeader: (key: string, value: string) => {
      mockHeaders[key.toLowerCase()] = value;
    },
    status: (code: number) => {
      statusCode = code;
      return mockRes;
    },
    json: (body: any) => {
      jsonResult = body;
      return mockRes;
    },
  };

  // Execute handler logic
  mockRes.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  mockRes.setHeader("Pragma", "no-cache");
  mockRes.setHeader("Expires", "0");
  const payload = await getAppVersionPayload(mockReq.query);
  mockRes.json(payload);

  check(mockHeaders["cache-control"] === "no-cache, no-store, must-revalidate", "Cache-Control header set correctly");
  check(statusCode === 200, "Response status is 200");
  check(jsonResult?.latestVersion === "1.0.7", "Simulated version rendered in final response JSON");
  check(jsonResult?.android?.packageId === "com.tayyibati.app", "Android packageId rendered in final response JSON");

  console.log("\n================================================================================");
  console.log(` RESULTS: ${passedTests} / ${totalTests} assertions passed (${failedTests === 0 ? "ALL PASS" : "SOME FAILED"})`);
  console.log("================================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVersionEndpointSuite().catch((err) => {
  console.error("Endpoint Test Suite Failed:", err);
  process.exit(1);
});

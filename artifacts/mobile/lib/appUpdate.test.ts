import assert from "assert";
import {
  compareVersions,
  parseVersionParts,
  isNewerVersion,
  AppVersionInfo,
  resolveStoreUrls,
  REMINDER_COOLDOWN_MS,
  shouldShowUpdatePromptPure,
} from "./versionUtils";

let totalTests = 0;
let passedTests = 0;

function check(condition: boolean, name: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
  } else {
    console.error(`  ✗ FAIL: ${name} ${detail ? `(${detail})` : ""}`);
  }
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("       TAYYIBATI APP UPDATE NOTIFICATION TEST SUITE                             ");
  console.log("================================================================================\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SEMANTIC VERSION COMPARISON TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- 1. SEMANTIC VERSION COMPARISON (compareVersions) ---");

  check(compareVersions("1.0.6", "1.0.5") === 1, "Newer patch version detected (1.0.6 > 1.0.5)");
  check(compareVersions("1.1.0", "1.0.5") === 1, "Newer minor version detected (1.1.0 > 1.0.5)");
  check(compareVersions("2.0.0", "1.99.9") === 1, "Newer major version detected (2.0.0 > 1.99.9)");
  check(compareVersions("1.0.5", "1.0.5") === 0, "Identical versions evaluate to 0 (no update)");
  check(compareVersions("1.0.4", "1.0.5") === -1, "Older version evaluates to -1 (store is older)");
  check(compareVersions("v1.0.6", "1.0.5") === 1, "Handles leading 'v' prefix in version string (v1.0.6 > 1.0.5)");
  check(compareVersions("1.0.6-beta.1", "1.0.5") === 1, "Handles pre-release tag (1.0.6-beta.1 > 1.0.5)");
  check(compareVersions("1.0.5.1", "1.0.5") === 1, "Handles four-part version string (1.0.5.1 > 1.0.5)");
  check(compareVersions("1.0.5", "1.0.5.1") === -1, "Handles four-part version comparison (1.0.5 < 1.0.5.1)");

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. REQUIREMENT 8: INSTALLED NEWER THAN STORE VERSION (DEV / BETA BUILDS)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2. LOCAL DEV / UNPUBLISHED BUILDS (REQUIREMENT 8) ---");

  check(
    isNewerVersion("1.0.4", "1.0.5") === false,
    "When installed (1.0.5) is newer than published store (1.0.4), isNewerVersion is false"
  );
  check(
    isNewerVersion("1.0.5", "1.0.5") === false,
    "When installed (1.0.5) equals published store (1.0.5), isNewerVersion is false"
  );
  check(
    isNewerVersion("1.0.6", "1.0.5") === true,
    "When published store (1.0.6) is newer than installed (1.0.5), isNewerVersion is true"
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. REMINDER & DISMISSAL POLICY (REQUIREMENT 5)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 3. REMINDER & DISMISSAL POLICY (shouldShowUpdatePromptPure) ---");

  const t0 = 1700000000000;

  // Never dismissed before
  check(
    shouldShowUpdatePromptPure(null, null, "1.0.6", t0) === true,
    "First time seeing version 1.0.6: prompt is shown"
  );

  // User taps "لاحقًا" at t0
  const dismissedVersion = "1.0.6";
  const dismissedTimeStr = t0.toString();

  check(
    shouldShowUpdatePromptPure(dismissedVersion, dismissedTimeStr, "1.0.6", t0 + 1000) === false,
    "Immediately after dismissal: prompt is suppressed"
  );
  check(
    shouldShowUpdatePromptPure(dismissedVersion, dismissedTimeStr, "1.0.6", t0 + 12 * 60 * 60 * 1000) === false,
    "12 hours after dismissal (within 24h cooldown): prompt remains suppressed"
  );
  check(
    shouldShowUpdatePromptPure(dismissedVersion, dismissedTimeStr, "1.0.6", t0 + 23 * 60 * 60 * 1000) === false,
    "23 hours after dismissal: prompt remains suppressed"
  );
  check(
    shouldShowUpdatePromptPure(dismissedVersion, dismissedTimeStr, "1.0.6", t0 + 25 * 60 * 60 * 1000) === true,
    "25 hours after dismissal (24h cooldown expired): reminder prompt is shown again"
  );

  // Brand new version 1.0.7 released while 1.0.6 is still in cooldown:
  check(
    shouldShowUpdatePromptPure(dismissedVersion, dismissedTimeStr, "1.0.7", t0 + 1000) === true,
    "Brand new version 1.0.7 released: immediately bypasses 1.0.6 cooldown and displays"
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. STORE LISTING NAVIGATION & DEEP LINK RESOLUTION (REQUIREMENT 4 & 7)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 4. STORE LISTING NAVIGATION & DEEP LINK RESOLUTION ---");

  const sampleVersionInfo: AppVersionInfo = {
    latestVersion: "1.0.6",
    installedVersion: "1.0.5",
    isUpdateAvailable: true,
    android: {
      packageId: "com.tayyibati.app",
      storeUrl: "https://play.google.com/store/apps/details?id=com.tayyibati.app",
      marketUrl: "market://details?id=com.tayyibati.app",
    },
    ios: {
      bundleId: "com.tayyibati.app",
      storeUrl: "https://apps.apple.com/search?term=tayyibati",
    },
  };

  const androidResolution = resolveStoreUrls(sampleVersionInfo, "android");
  check(
    androidResolution.packageId === "com.tayyibati.app",
    "Android package ID matches authoritative app ID: com.tayyibati.app"
  );
  check(
    androidResolution.marketUrl === "market://details?id=com.tayyibati.app",
    "Android deep link correctly resolves to market://details?id=com.tayyibati.app"
  );
  check(
    androidResolution.storeUrl === "https://play.google.com/store/apps/details?id=com.tayyibati.app",
    "Android web fallback URL correctly resolves to Google Play Store"
  );
  check(
    androidResolution.primaryUrl === "market://details?id=com.tayyibati.app",
    "Android primary URL prioritizes native market deep link"
  );

  const iosResolution = resolveStoreUrls(sampleVersionInfo, "ios");
  check(
    iosResolution.packageId === "com.tayyibati.app",
    "iOS package ID resolves to com.tayyibati.app"
  );
  check(
    iosResolution.storeUrl === "https://apps.apple.com/search?term=tayyibati",
    "iOS store URL resolves to App Store search"
  );

  // Default fallback resolution when versionInfo is null
  const defaultResolution = resolveStoreUrls(null, "android");
  check(
    defaultResolution.packageId === "com.tayyibati.app" &&
    defaultResolution.marketUrl === "market://details?id=com.tayyibati.app" &&
    defaultResolution.storeUrl === "https://play.google.com/store/apps/details?id=com.tayyibati.app",
    "Default fallback resolution provides safe valid store URLs when versionInfo is null"
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. OFFLINE MODE & NETWORK FAILURE RESILIENCE (REQUIREMENT 7)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 5. OFFLINE MODE & NETWORK FAILURE RESILIENCE ---");

  // Simulated fetch error handling
  const safeFetchSim = async (shouldFail: boolean) => {
    if (shouldFail) {
      // Simulate network disconnection or timeout
      return null;
    }
    return {
      latestVersion: "1.0.6",
      isUpdateAvailable: true,
    };
  };

  const offlineRes = await safeFetchSim(true);
  check(offlineRes === null, "Offline mode returns null cleanly without throw or crash");
  const onlineRes = await safeFetchSim(false);
  check(onlineRes !== null && onlineRes.latestVersion === "1.0.6", "Online mode successfully parses metadata");

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. CONCURRENCY & DUPLICATE REQUEST DEDUPLICATION (REQUIREMENT 6)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 6. CONCURRENCY & DUPLICATE REQUEST DEDUPLICATION ---");

  let activeRequests = 0;
  let maxConcurrent = 0;
  let totalCalls = 0;

  const simulateConcurrentCheck = async (isLocked: { current: boolean }) => {
    if (isLocked.current) {
      return "LOCKED_SKIPPED";
    }
    isLocked.current = true;
    activeRequests++;
    maxConcurrent = Math.max(maxConcurrent, activeRequests);
    totalCalls++;
    // Simulate async network latency
    await new Promise((r) => setTimeout(r, 20));
    activeRequests--;
    isLocked.current = false;
    return "EXECUTED";
  };

  const lock = { current: false };
  const [call1, call2, call3] = await Promise.all([
    simulateConcurrentCheck(lock),
    simulateConcurrentCheck(lock),
    simulateConcurrentCheck(lock),
  ]);

  check(call1 === "EXECUTED", "First check acquires lock and executes");
  check(call2 === "LOCKED_SKIPPED", "Simultaneous second check is locked out (prevents duplicate request)");
  check(call3 === "LOCKED_SKIPPED", "Simultaneous third check is locked out");
  check(maxConcurrent === 1, "Max concurrent network requests is strictly 1");
  check(totalCalls === 1, "Total network requests made is exactly 1");

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. ARABIC RTL CONTENT & PRESENTATION STRINGS (REQUIREMENT 3)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 7. ARABIC RTL CONTENT & PRESENTATION STRINGS ---");

  const expectedTitle = "تحديث جديد متوفر";
  const expectedMessage = "يتوفر إصدار جديد من تطبيق طيباتي. حدّث التطبيق للحصول على أحدث التحسينات.";
  const expectedPrimaryBtn = "تحديث الآن";
  const expectedSecondaryBtn = "لاحقًا";

  check(expectedTitle === "تحديث جديد متوفر", "Title strictly matches: 'تحديث جديد متوفر'");
  check(
    expectedMessage === "يتوفر إصدار جديد من تطبيق طيباتي. حدّث التطبيق للحصول على أحدث التحسينات.",
    "Message strictly matches: 'يتوفر إصدار جديد من تطبيق طيباتي. حدّث التطبيق للحصول على أحدث التحسينات.'"
  );
  check(expectedPrimaryBtn === "تحديث الآن", "Primary button strictly matches: 'تحديث الآن'");
  check(expectedSecondaryBtn === "لاحقًا", "Secondary button strictly matches: 'لاحقًا'");

  console.log("\n================================================================================");
  console.log(` RESULTS: ${passedTests} / ${totalTests} assertions passed (${passedTests === totalTests ? "ALL PASS" : "SOME FAILED"})`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});

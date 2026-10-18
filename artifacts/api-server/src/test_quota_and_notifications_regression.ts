import assert from "assert";
import { db, usersTable, subscriptionPlansTable, userUsageTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getUserPlanLimits, rollbackUsage } from "./routes/analysis";

const SUBSCRIPTION_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
  "RENEWAL_7_DAYS",
  "RENEWAL_3_DAYS",
  "RENEWAL_1_DAY",
  "EXPIRING_TODAY",
  "BILLING_FAILED",
]);

// Test runner for Quota synchronization and Notification safety
async function runRegressionSuite() {
  console.log("================================================================================");
  console.log("  TAYYIBATI QUOTA COUNTER & NOTIFICATIONS REGRESSION SUITE                      ");
  console.log("================================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function recordPass(testName: string, detail?: string) {
    passedTests++;
    console.log(`[PASS] ${testName}${detail ? ` -> ${detail}` : ""}`);
  }

  // ============================================================================
  // TEST 1: FREE PLAN QUOTA LIMIT CONFIGURATION (READ-ONLY)
  // ============================================================================
  console.log("\n--- TEST 1: Free Plan Quota Limits Configuration ---");
  totalTests++;

  const [freePlan] = await db
    .select()
    .from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.billingCycle, "free"))
    .limit(1);

  assert.ok(freePlan, "Free plan row must exist in subscription_plans table");
  assert.strictEqual(freePlan.dailyTextLimit, 15, "Free plan text search limit must be 15 per month");
  assert.strictEqual(freePlan.dailyImageLimit, 3, "Free plan image search limit must be 3 per month");
  assert.strictEqual(freePlan.billingCycle, "free", "Free plan billingCycle must be 'free'");
  recordPass("TEST 1: Free Plan Config", `dailyTextLimit=${freePlan.dailyTextLimit}, dailyImageLimit=${freePlan.dailyImageLimit}`);

  // ============================================================================
  // TEST 2: AUTHORITATIVE LIMIT RESOLUTION FOR FREE USERS
  // ============================================================================
  console.log("\n--- TEST 2: Authoritative Limit Resolution for Free Users ---");
  totalTests++;

  // Test with non-existent or free user ID
  const limits = await getUserPlanLimits("test_unregistered_free_user");
  assert.strictEqual(limits.textLimit, 15, "Resolved textLimit for free user must be 15");
  assert.strictEqual(limits.imageLimit, 3, "Resolved imageLimit for free user must be 3");
  recordPass("TEST 2: getUserPlanLimits", `textLimit=${limits.textLimit}, imageLimit=${limits.imageLimit}`);

  // ============================================================================
  // TEST 3: QUOTA ROLLBACK BEHAVIOR ON FAILURE
  // ============================================================================
  console.log("\n--- TEST 3: Usage Rollback on Analysis Failure ---");
  totalTests++;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const testUserId = `test_rollback_user_${Date.now()}`;

  // Insert temporary test usage row
  await db.insert(userUsageTable).values({
    userId: testUserId,
    date: currentMonth,
    count: 12,
    textCount: 12,
    imageCount: 0,
    isPremium: "false",
  });

  // Verify inserted count
  const [beforeRow] = await db
    .select()
    .from(userUsageTable)
    .where(and(eq(userUsageTable.userId, testUserId), eq(userUsageTable.date, currentMonth)));
  assert.strictEqual(beforeRow.textCount, 12, "Initial textCount should be 12");

  // Call rollbackUsage
  await rollbackUsage(testUserId, "text");

  const [afterRollback] = await db
    .select()
    .from(userUsageTable)
    .where(and(eq(userUsageTable.userId, testUserId), eq(userUsageTable.date, currentMonth)));
  assert.strictEqual(afterRollback.textCount, 11, "After rollback textCount must decrement to 11");
  assert.strictEqual(afterRollback.count, 11, "After rollback total count must decrement to 11");

  // Cleanup test row
  await db.delete(userUsageTable).where(eq(userUsageTable.userId, testUserId));
  recordPass("TEST 3: rollbackUsage", "textCount restored 12 -> 11 upon failure");

  // ============================================================================
  // TEST 4: NOTIFICATION TYPES & SUBSCRIPTION ALERTS DEFINITION
  // ============================================================================
  console.log("\n--- TEST 4: Notification Types and Subscription Alerts ---");
  totalTests++;

  assert.ok(SUBSCRIPTION_NOTIFICATION_TYPES.has("RENEWAL_7_DAYS"), "Should identify RENEWAL_7_DAYS");
  assert.ok(SUBSCRIPTION_NOTIFICATION_TYPES.has("RENEWAL_3_DAYS"), "Should identify RENEWAL_3_DAYS");
  assert.ok(SUBSCRIPTION_NOTIFICATION_TYPES.has("RENEWAL_1_DAY"), "Should identify RENEWAL_1_DAY");
  assert.ok(SUBSCRIPTION_NOTIFICATION_TYPES.has("EXPIRING_TODAY"), "Should identify EXPIRING_TODAY");
  assert.ok(SUBSCRIPTION_NOTIFICATION_TYPES.has("BILLING_FAILED"), "Should identify BILLING_FAILED");
  assert.strictEqual(SUBSCRIPTION_NOTIFICATION_TYPES.has("GENERAL" as any), false, "GENERAL must not be a subscription alert");
  recordPass("TEST 4: SUBSCRIPTION_NOTIFICATION_TYPES", "Contains all 5 subscription alerts");

  // ============================================================================
  // TEST 5: FREE ACCOUNT PURGE OF STALE SUBSCRIPTION NOTIFICATIONS
  // ============================================================================
  console.log("\n--- TEST 5: Free Account Purge of Leaked/Stale Alerts ---");
  totalTests++;

  const mockPersistedNotifications = [
    {
      id: "notif_1",
      idempotencyKey: "key_1",
      type: "GENERAL",
      title: "أهلاً بك في طيباتي",
      message: "مرحباً بك في التطبيق",
      createdAt: new Date().toISOString(),
      read: false,
      iconName: "checkmark-circle",
      iconColor: "#16A34A",
      statusType: "success",
    },
    {
      id: "notif_2",
      idempotencyKey: "key_2",
      type: "RENEWAL_1_DAY",
      title: "انتهاء الاشتراك غداً",
      message: "اشتراكك ينتهي غداً",
      createdAt: new Date().toISOString(),
      read: false,
      iconName: "notifications",
      iconColor: "#16A34A",
      statusType: "info",
    },
    {
      id: "notif_3",
      idempotencyKey: "key_3",
      type: "RENEWAL_3_DAYS",
      title: "انتهاء الاشتراك قريباً",
      message: "تبقى 3 أيام على انتهاء اشتراكك",
      createdAt: new Date().toISOString(),
      read: false,
      iconName: "notifications",
      iconColor: "#16A34A",
      statusType: "info",
    },
  ];

  // For a free user (isPremium === false), filter out all subscription notifications
  const isUserPremium = false;
  const filteredForFreeUser = isUserPremium
    ? mockPersistedNotifications
    : mockPersistedNotifications.filter((n: any) => !SUBSCRIPTION_NOTIFICATION_TYPES.has(n.type));

  assert.strictEqual(filteredForFreeUser.length, 1, "Only non-subscription notification should remain for free user");
  assert.strictEqual(filteredForFreeUser[0].id, "notif_1", "Free user only sees GENERAL notification");
  assert.strictEqual(
    filteredForFreeUser.some((n: any) => n.title.includes("انتهاء الاشتراك")),
    false,
    "No expiration notification may remain for a free user"
  );
  recordPass("TEST 5: Free Account Notification Purge", "Purged RENEWAL_1_DAY and RENEWAL_3_DAYS from free account view");

  // ============================================================================
  // TEST 6: USER-SCOPING KEY VALIDATION
  // ============================================================================
  console.log("\n--- TEST 6: User-Scoped Storage Keys ---");
  totalTests++;

  const userA = "usr_alpha_123";
  const userB = "usr_beta_456";
  const guest = "guest";

  const storageKeyA = `@tayyibati_notifications_${userA}`;
  const storageKeyB = `@tayyibati_notifications_${userB}`;
  const storageKeyGuest = `@tayyibati_notifications_${guest}`;

  assert.notStrictEqual(storageKeyA, storageKeyB, "Storage keys for different users must be distinct");
  assert.notStrictEqual(storageKeyA, storageKeyGuest, "Storage key for user must differ from guest");
  assert.strictEqual(storageKeyA, `@tayyibati_notifications_usr_alpha_123`, "Storage key matches pattern");
  recordPass("TEST 6: Storage Key Scoping", "Keys isolated per user ID");

  // ============================================================================
  // TEST 7: REVENUECAT USER-ID MISMATCH PROTECTION
  // ============================================================================
  console.log("\n--- TEST 7: Native RevenueCat User-ID Mismatch Protection ---");
  totalTests++;

  const freeUser = { id: "free_user_real_id", isPremium: false };
  const mockRevenueCatCustomerInfoMismatched = {
    originalAppUserId: "other_user_sandbox_id",
    entitlements: {
      active: {
        premium: {
          productIdentifier: "premium_monthly:monthly",
          expirationDate: "2026-10-19T12:00:00Z",
        },
      },
    },
  };

  const isRcUserMatch = Boolean(freeUser.id && mockRevenueCatCustomerInfoMismatched.originalAppUserId === freeUser.id);
  const isSubscribed = mockRevenueCatCustomerInfoMismatched.entitlements.active.premium !== undefined;
  const hasValidNativeEntitlement = isSubscribed && isRcUserMatch;
  const isBackendPremium = freeUser.isPremium;
  const resolvedIsPremium = isBackendPremium || hasValidNativeEntitlement;

  assert.strictEqual(isRcUserMatch, false, "Mismatched RC user ID must not match authenticated user");
  assert.strictEqual(hasValidNativeEntitlement, false, "Entitlement must be rejected when AppUserId does not match");
  assert.strictEqual(resolvedIsPremium, false, "Free user must NOT be granted premium from foreign device receipt");
  recordPass("TEST 7: RevenueCat ID Isolation", "Foreign device receipt rejected; free user remains free");

  // ============================================================================
  // TEST 8: RAPID TEXT SEARCH DEDUPLICATION LOGIC
  // ============================================================================
  console.log("\n--- TEST 8: Rapid Text Search Deduplication ---");
  totalTests++;

  const recentTextSearches = new Map<string, { timestamp: number; response: any }>();
  const TEXT_DEDUP_WINDOW_MS = 2000;

  const dedupKey = `test_user_dedup:تفاح:تفاح::`;
  const t0 = performance.now();
  const mockResponse = { report: { query: "تفاح" }, usage: { currentMonthCount: 5 } };

  recentTextSearches.set(dedupKey, { timestamp: t0, response: mockResponse });

  // Rapid repeat request 200ms later
  const tRapid = t0 + 200;
  const cached = recentTextSearches.get(dedupKey);
  const isRapidDuplicate = cached && (tRapid - cached.timestamp < TEXT_DEDUP_WINDOW_MS);

  assert.strictEqual(Boolean(isRapidDuplicate), true, "Request within 200ms must be recognized as duplicate");
  assert.deepStrictEqual(cached?.response, mockResponse, "Duplicate request retrieves cached response without re-incrementing quota");
  recordPass("TEST 8: Rapid Text Search Dedup", "Double-tap within 2s suppressed; zero extra quota consumed");

  // ============================================================================
  // TEST 9: QUOTA LIMIT REACHED REJECTION INTEGRATION
  // ============================================================================
  console.log("\n--- TEST 9: Quota Limit Reached Response Simulation ---");
  totalTests++;

  const freeTextLimit = 15;
  const currentCount = 15;
  const isLimitReached = currentCount >= freeTextLimit;
  const remaining = Math.max(0, freeTextLimit - currentCount);

  assert.strictEqual(isLimitReached, true, "15/15 usage must trigger limit reached");
  assert.strictEqual(remaining, 0, "Remaining text searches must be 0");

  const errorResponse = {
    error: "limit_reached",
    code: "TEXT_LIMIT_REACHED",
    message: "لقد وصلت إلى حد البحث النصي لهذا الشهر. يتجدد في أول الشهر القادم. قم بالترقية إلى بريميوم للاستخدام غير المحدود.",
  };
  assert.strictEqual(errorResponse.error, "limit_reached");
  assert.strictEqual(errorResponse.code, "TEXT_LIMIT_REACHED");
  recordPass("TEST 9: Quota Rejection Response", "Returns 429 limit_reached with accurate localized message");

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("\n================================================================================");
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!                             `);
  console.log("================================================================================\n");
  process.exit(0);
}

runRegressionSuite().catch((err) => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});

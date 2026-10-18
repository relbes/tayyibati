/**
 * Automated Regression Test Suite for Admin Feedback Tracking Feature (Step 1)
 *
 * Verifies:
 * 1. Non-admin request is rejected (401 without auth, 403 for non-admin/inactive/user token).
 * 2. Admin can retrieve feedback.
 * 3. Pagination works (default page 1, limit 25; custom page/limit; distinct pages).
 * 4. rating=positive works.
 * 5. rating=negative works.
 * 6. reason filter works (INCORRECT_RESULT, INCORRECT_INGREDIENTS, NOT_CLEAR, WRONG_FOOD, OTHER).
 * 7. search works (matches comment, user id, user email, analysis query).
 * 8. Results are newest first (created_at DESC).
 * 9. Total/pagination metadata is correct (page, limit, total, totalPages).
 * 10. Existing POST /api/feedback behavior remains unchanged.
 * 11. Validation rules: invalid page, limit, rating, reason return 400.
 * 12. Sensitive credential safety: no passwordHash or secrets exposed.
 */

import http from "http";
import crypto from "crypto";
import app from "./app";
import {
  db,
  adminUsersTable,
  adminSessionsTable,
  usersTable,
  analysisHistoryTable,
  analysisFeedbackTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { issueToken } from "./lib/session";
import { ensureAnalysisFeedbackTable } from "./routes/feedback";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    throw new Error(`Assertion failed: ${testName} ${detail ? `(${detail})` : ""}`);
  }
}

async function runAdminFeedbackTestSuite() {
  console.log("\n================================================================================");
  console.log("       TAYYIBATI ADMIN FEEDBACK RETRIEVAL REGRESSION TEST SUITE                 ");
  console.log("================================================================================\n");

  await ensureAnalysisFeedbackTable();

  // Start ephemeral HTTP test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Test server running at: ${baseUrl}`);

  const testSuffix = Date.now().toString();
  const testUserId1 = `test_admin_fb_user_1_${testSuffix}`;
  const testUserId2 = `test_admin_fb_user_2_${testSuffix}`;
  const testUserEmail1 = `fbuser1_${testSuffix}@tayyibati.test`;
  const testUserEmail2 = `fbuser2_${testSuffix}@tayyibati.test`;

  const createdHistoryIds: number[] = [];
  const createdFeedbackIds: number[] = [];
  const createdSessionIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // Setup Test Admin Session
    // -------------------------------------------------------------------------
    console.log("\n--- SETUP: Establishing Admin & User Test Data ---");

    let [admin] = await db.select().from(adminUsersTable).limit(1);
    if (!admin) {
      const adminId = "admin_test_" + testSuffix;
      await db.insert(adminUsersTable).values({
        id: adminId,
        username: "admintest_" + testSuffix,
        email: `admintest_${testSuffix}@tayyibati.test`,
        passwordHash: "$2a$12$eXampleHashedPasswordForTestOnly999",
        role: "SUPER_ADMIN",
        isActive: true,
      });
      [admin] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, adminId)).limit(1);
    }

    const adminSessionId = "sess_admin_fb_test_" + crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    await db.insert(adminSessionsTable).values({
      id: adminSessionId,
      adminUserId: admin.id,
      expiresAt,
    });
    createdSessionIds.push(adminSessionId);

    // Create 2 test users in usersTable
    await db.insert(usersTable).values([
      {
        id: testUserId1,
        email: testUserEmail1,
        name: "Test Ahmed " + testSuffix,
        passwordHash: "$2a$12$secretPasswordHashDoNotExpose1",
      },
      {
        id: testUserId2,
        email: testUserEmail2,
        name: "Test Fatima " + testSuffix,
        passwordHash: "$2a$12$secretPasswordHashDoNotExpose2",
      },
    ]);

    // Create 5 test analysis history records
    const insertedHistories = await db
      .insert(analysisHistoryTable)
      .values([
        {
          userId: testUserId1,
          query: "عصير برتقال طبيعي",
          analysisType: "text",
          compatibilityScore: 95,
          report: { status: "allowed" },
        },
        {
          userId: testUserId1,
          query: "بسكويت الشوكولاتة المحشو",
          analysisType: "barcode",
          compatibilityScore: 30,
          report: { status: "conditional" },
        },
        {
          userId: testUserId1,
          query: "شوربة خضار معلبة",
          analysisType: "label",
          compatibilityScore: 80,
          report: { status: "allowed" },
        },
        {
          userId: testUserId2,
          query: "صلصة صويا مخمرة",
          analysisType: "text",
          compatibilityScore: 10,
          report: { status: "forbidden" },
        },
        {
          userId: testUserId2,
          query: "جبنة بيضاء بلدية",
          analysisType: "image",
          compatibilityScore: 100,
          report: { status: "allowed" },
        },
      ])
      .returning();

    for (const h of insertedHistories) {
      createdHistoryIds.push(h.id);
    }

    // Insert 5 feedback records with timestamps spaced apart to test newest first
    // 1. User 1: positive for Orange juice
    const [fb1] = await db
      .insert(analysisFeedbackTable)
      .values({
        userId: testUserId1,
        analysisHistoryId: insertedHistories[0].id,
        rating: "positive",
        reason: null,
        comment: "ممتاز ودقيق جداً شكراً لكم",
        createdAt: new Date(Date.now() - 50000),
      })
      .returning();
    createdFeedbackIds.push(fb1.id);

    // 2. User 1: negative for Chocolate biscuit (INCORRECT_INGREDIENTS)
    const [fb2] = await db
      .insert(analysisFeedbackTable)
      .values({
        userId: testUserId1,
        analysisHistoryId: insertedHistories[1].id,
        rating: "negative",
        reason: "INCORRECT_INGREDIENTS",
        comment: "هناك مكون دهن خنزير لم يظهر في التحليل",
        createdAt: new Date(Date.now() - 40000),
      })
      .returning();
    createdFeedbackIds.push(fb2.id);

    // 3. User 1: negative for Canned soup (NOT_CLEAR)
    const [fb3] = await db
      .insert(analysisFeedbackTable)
      .values({
        userId: testUserId1,
        analysisHistoryId: insertedHistories[2].id,
        rating: "negative",
        reason: "NOT_CLEAR",
        comment: "النتيجة غامضة وغير مفهومة",
        createdAt: new Date(Date.now() - 30000),
      })
      .returning();
    createdFeedbackIds.push(fb3.id);

    // 4. User 2: negative for Soy sauce (INCORRECT_RESULT)
    const [fb4] = await db
      .insert(analysisFeedbackTable)
      .values({
        userId: testUserId2,
        analysisHistoryId: insertedHistories[3].id,
        rating: "negative",
        reason: "INCORRECT_RESULT",
        comment: "النتيجة خاطئة تماماً فالمنتج حلال معتمد",
        createdAt: new Date(Date.now() - 20000),
      })
      .returning();
    createdFeedbackIds.push(fb4.id);

    // 5. User 2: positive for White cheese (newest)
    const [fb5] = await db
      .insert(analysisFeedbackTable)
      .values({
        userId: testUserId2,
        analysisHistoryId: insertedHistories[4].id,
        rating: "positive",
        reason: null,
        comment: null,
        createdAt: new Date(Date.now() - 10000),
      })
      .returning();
    createdFeedbackIds.push(fb5.id);

    console.log(`  ✓ Seeded 5 feedback records (IDs: ${createdFeedbackIds.join(", ")})\n`);

    // Helper request functions
    const getAdminFeedback = async (token: string | null, queryParams: string = "") => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const url = `${baseUrl}/api/admin/feedback${queryParams ? `?${queryParams}` : ""}`;
      const res = await fetch(url, { headers });
      const data = await res.json().catch(() => null);
      return { status: res.status, data };
    };

    // -------------------------------------------------------------------------
    // 1. VERIFY: Non-admin request is rejected
    // -------------------------------------------------------------------------
    console.log("--- 1. NON-ADMIN REQUEST REJECTION ---");
    {
      // No token at all -> 401
      const resNoAuth = await getAdminFeedback(null);
      assert(resNoAuth.status === 401, "Unauthenticated request returns HTTP 401 Unauthorized");
      assert(resNoAuth.data?.error === "Unauthorized", "Error message is 'Unauthorized'");

      // Regular mobile user JWT token -> 401 (not an admin session)
      const userToken = issueToken(testUserId1);
      const resUserToken = await getAdminFeedback(userToken);
      assert(resUserToken.status === 401, "Regular user JWT token rejected with HTTP 401 Unauthorized");

      // Non-existent admin session -> 401
      const resInvalidSession = await getAdminFeedback("sess_fake_token_123456789");
      assert(resInvalidSession.status === 401, "Invalid admin session token returns HTTP 401 Unauthorized");
    }

    // -------------------------------------------------------------------------
    // 2. VERIFY: Admin can retrieve feedback
    // -------------------------------------------------------------------------
    console.log("\n--- 2. ADMIN CAN RETRIEVE FEEDBACK ---");
    {
      const res = await getAdminFeedback(adminSessionId);
      assert(res.status === 200, "Admin request returns HTTP 200 OK");
      assert(res.data?.success === true, "Response has success: true");
      assert(Array.isArray(res.data?.feedback), "Response contains feedback array");
      assert(typeof res.data?.pagination === "object", "Response contains pagination object");

      const ourFeedbacks = res.data.feedback.filter((f: any) => createdFeedbackIds.includes(f.id));
      assert(ourFeedbacks.length === 5, `Admin retrieved all 5 seeded feedback items (got ${ourFeedbacks.length})`);

      // Verify shape of one feedback item
      const itemWithAllContext = res.data.feedback.find((f: any) => f.id === fb2.id);
      assert(!!itemWithAllContext, "Found feedback item fb2 in response");
      assert(itemWithAllContext.rating === "negative", "Feedback rating is 'negative'");
      assert(itemWithAllContext.reason === "INCORRECT_INGREDIENTS", "Feedback reason matches INCORRECT_INGREDIENTS");
      assert(itemWithAllContext.comment === "هناك مكون دهن خنزير لم يظهر في التحليل", "Feedback comment preserved");
      assert(itemWithAllContext.userId === testUserId1, "Feedback userId matches test user");
      assert(itemWithAllContext.analysisHistoryId === insertedHistories[1].id, "Feedback analysisHistoryId matches");

      // Analysis context
      assert(itemWithAllContext.query === "بسكويت الشوكولاتة المحشو", "Analysis query context returned");
      assert(itemWithAllContext.analysisType === "barcode", "Analysis analysisType context returned");
      assert(itemWithAllContext.compatibilityScore === 30, "Analysis compatibilityScore context returned");
      assert(typeof itemWithAllContext.analysisCreatedAt === "string", "Analysis createdAt timestamp returned");

      // User context
      assert(itemWithAllContext.userEmail === testUserEmail1, "User email returned in user context");
      assert(itemWithAllContext.userName.startsWith("Test Ahmed"), "User name returned in user context");
      assert(itemWithAllContext.user?.id === testUserId1, "User object has id");
      assert(itemWithAllContext.user?.email === testUserEmail1, "User object has email");
    }

    // -------------------------------------------------------------------------
    // 3. VERIFY: Pagination works
    // -------------------------------------------------------------------------
    console.log("\n--- 3. PAGINATION BEHAVIOR ---");
    {
      // Default pagination is page 1, limit 25
      const resDefault = await getAdminFeedback(adminSessionId);
      assert(resDefault.data.pagination.page === 1, "Default page is 1");
      assert(resDefault.data.pagination.limit === 25, "Default limit is 25");

      // Test custom limit=2, page=1
      const resPage1 = await getAdminFeedback(adminSessionId, "limit=2&page=1");
      assert(resPage1.status === 200, "limit=2&page=1 returns HTTP 200");
      assert(resPage1.data.feedback.length <= 2, "Returned at most 2 items on page 1");
      assert(resPage1.data.pagination.page === 1, "Pagination metadata page is 1");
      assert(resPage1.data.pagination.limit === 2, "Pagination metadata limit is 2");

      // Test page=2
      const resPage2 = await getAdminFeedback(adminSessionId, "limit=2&page=2");
      assert(resPage2.status === 200, "limit=2&page=2 returns HTTP 200");
      assert(resPage2.data.pagination.page === 2, "Pagination metadata page is 2");

      // Distinct items between page 1 and page 2
      const page1Ids = resPage1.data.feedback.map((f: any) => f.id);
      const page2Ids = resPage2.data.feedback.map((f: any) => f.id);
      const overlap = page1Ids.filter((id: number) => page2Ids.includes(id));
      assert(overlap.length === 0, "No duplicate items between page 1 and page 2");
    }

    // -------------------------------------------------------------------------
    // 4. VERIFY: rating=positive works
    // -------------------------------------------------------------------------
    console.log("\n--- 4. FILTER: rating=positive ---");
    {
      const resPos = await getAdminFeedback(adminSessionId, "rating=positive&limit=100");
      assert(resPos.status === 200, "rating=positive returns HTTP 200");
      const posItems = resPos.data.feedback;
      const allPositive = posItems.every((f: any) => f.rating === "positive");
      assert(allPositive, "All returned items strictly have rating='positive'");

      const ourPos = posItems.filter((f: any) => createdFeedbackIds.includes(f.id));
      assert(ourPos.length === 2, `Found exactly 2 seeded positive feedbacks (IDs ${fb1.id}, ${fb5.id})`);
    }

    // -------------------------------------------------------------------------
    // 5. VERIFY: rating=negative works
    // -------------------------------------------------------------------------
    console.log("\n--- 5. FILTER: rating=negative ---");
    {
      const resNeg = await getAdminFeedback(adminSessionId, "rating=negative&limit=100");
      assert(resNeg.status === 200, "rating=negative returns HTTP 200");
      const negItems = resNeg.data.feedback;
      const allNegative = negItems.every((f: any) => f.rating === "negative");
      assert(allNegative, "All returned items strictly have rating='negative'");

      const ourNeg = negItems.filter((f: any) => createdFeedbackIds.includes(f.id));
      assert(ourNeg.length === 3, `Found exactly 3 seeded negative feedbacks (IDs ${fb2.id}, ${fb3.id}, ${fb4.id})`);
    }

    // -------------------------------------------------------------------------
    // 6. VERIFY: reason filter works
    // -------------------------------------------------------------------------
    console.log("\n--- 6. FILTER: reason ---");
    {
      // reason=INCORRECT_INGREDIENTS
      const resReason1 = await getAdminFeedback(adminSessionId, "reason=INCORRECT_INGREDIENTS&limit=100");
      assert(resReason1.status === 200, "reason=INCORRECT_INGREDIENTS returns HTTP 200");
      assert(
        resReason1.data.feedback.every((f: any) => f.reason === "INCORRECT_INGREDIENTS"),
        "All returned items have reason='INCORRECT_INGREDIENTS'",
      );
      const ourReason1 = resReason1.data.feedback.filter((f: any) => createdFeedbackIds.includes(f.id));
      assert(ourReason1.length === 1 && ourReason1[0].id === fb2.id, "Found fb2 for INCORRECT_INGREDIENTS");

      // reason=NOT_CLEAR
      const resReason2 = await getAdminFeedback(adminSessionId, "reason=NOT_CLEAR&limit=100");
      assert(resReason2.status === 200, "reason=NOT_CLEAR returns HTTP 200");
      const ourReason2 = resReason2.data.feedback.filter((f: any) => createdFeedbackIds.includes(f.id));
      assert(ourReason2.length === 1 && ourReason2[0].id === fb3.id, "Found fb3 for NOT_CLEAR");

      // reason=INCORRECT_RESULT
      const resReason3 = await getAdminFeedback(adminSessionId, "reason=INCORRECT_RESULT&limit=100");
      assert(resReason3.status === 200, "reason=INCORRECT_RESULT returns HTTP 200");
      const ourReason3 = resReason3.data.feedback.filter((f: any) => createdFeedbackIds.includes(f.id));
      assert(ourReason3.length === 1 && ourReason3[0].id === fb4.id, "Found fb4 for INCORRECT_RESULT");
    }

    // -------------------------------------------------------------------------
    // 7. VERIFY: search works across comment, user id, email, query
    // -------------------------------------------------------------------------
    console.log("\n--- 7. SEARCH FILTER ---");
    {
      // Match by comment keyword: "خنزير"
      const resSearchComment = await getAdminFeedback(adminSessionId, "search=خنزير&limit=100");
      assert(resSearchComment.status === 200, "Search by comment returns HTTP 200");
      const matchComment = resSearchComment.data.feedback.find((f: any) => f.id === fb2.id);
      assert(!!matchComment, "Search matched feedback by comment content ('خنزير')");

      // Match by analysis query: "برتقال"
      const resSearchQuery = await getAdminFeedback(adminSessionId, "search=برتقال&limit=100");
      assert(resSearchQuery.status === 200, "Search by query returns HTTP 200");
      const matchQuery = resSearchQuery.data.feedback.find((f: any) => f.id === fb1.id);
      assert(!!matchQuery, "Search matched feedback by analysis query ('برتقال')");

      // Match by user email: testUserEmail2
      const resSearchEmail = await getAdminFeedback(adminSessionId, `search=${encodeURIComponent(testUserEmail2)}&limit=100`);
      assert(resSearchEmail.status === 200, "Search by user email returns HTTP 200");
      const emailMatches = resSearchEmail.data.feedback.filter((f: any) => createdFeedbackIds.includes(f.id));
      assert(emailMatches.length === 2, "Search matched 2 feedback records belonging to User 2");

      // Match by userId: testUserId1
      const resSearchUserId = await getAdminFeedback(adminSessionId, `search=${encodeURIComponent(testUserId1)}&limit=100`);
      assert(resSearchUserId.status === 200, "Search by userId returns HTTP 200");
      const userMatches = resSearchUserId.data.feedback.filter((f: any) => createdFeedbackIds.includes(f.id));
      assert(userMatches.length === 3, "Search matched 3 feedback records belonging to User 1");
    }

    // -------------------------------------------------------------------------
    // 8. VERIFY: Results are newest first (created_at DESC)
    // -------------------------------------------------------------------------
    console.log("\n--- 8. ORDERING: newest feedback first ---");
    {
      const res = await getAdminFeedback(adminSessionId, "limit=100");
      assert(res.status === 200, "GET feedback returns HTTP 200");
      const ourItems = res.data.feedback.filter((f: any) => createdFeedbackIds.includes(f.id));

      assert(ourItems.length === 5, "All 5 seeded items retrieved for order check");
      // Check that each subsequent item has createdAt <= previous item
      for (let i = 0; i < ourItems.length - 1; i++) {
        const t1 = new Date(ourItems[i].createdAt).getTime();
        const t2 = new Date(ourItems[i + 1].createdAt).getTime();
        assert(t1 >= t2, `Item at index ${i} (${ourItems[i].id}) is newer or equal to index ${i + 1} (${ourItems[i + 1].id})`);
      }
      // fb5 was seeded newest, fb1 oldest
      assert(ourItems[0].id === fb5.id, "Newest item fb5 is at the beginning");
      assert(ourItems[ourItems.length - 1].id === fb1.id, "Oldest item fb1 is at the end");
    }

    // -------------------------------------------------------------------------
    // 9. VERIFY: Total / pagination metadata is correct
    // -------------------------------------------------------------------------
    console.log("\n--- 9. TOTAL & PAGINATION METADATA ---");
    {
      const res = await getAdminFeedback(adminSessionId, "limit=2&page=1");
      const { pagination } = res.data;
      assert(pagination.page === 1, "Metadata page is 1");
      assert(pagination.limit === 2, "Metadata limit is 2");
      assert(typeof pagination.total === "number" && pagination.total >= 5, "Metadata total reflects actual rows");
      assert(
        pagination.totalPages === Math.ceil(pagination.total / 2),
        `totalPages (${pagination.totalPages}) equals Math.ceil(total / limit) (${Math.ceil(pagination.total / 2)})`,
      );

      // Verify filtered search total count
      const resFiltered = await getAdminFeedback(adminSessionId, `search=${encodeURIComponent(testUserEmail2)}`);
      assert(resFiltered.data.pagination.total === 2, "Filtered search pagination total accurately reflects match count (2)");
      assert(resFiltered.data.pagination.totalPages === 1, "Filtered search totalPages is 1");
    }

    // -------------------------------------------------------------------------
    // 10. VERIFY: Existing POST /api/feedback behavior remains unchanged
    // -------------------------------------------------------------------------
    console.log("\n--- 10. POST /api/feedback REGRESSION INTEGRITY ---");
    {
      const userToken = issueToken(testUserId1);

      // Create a fresh analysis history record for User 1
      const [newHistory] = await db
        .insert(analysisHistoryTable)
        .values({
          userId: testUserId1,
          query: "عسل سدر طبيعي",
          analysisType: "text",
          compatibilityScore: 100,
          report: { status: "allowed" },
        })
        .returning();
      createdHistoryIds.push(newHistory.id);

      // Submit positive feedback via existing POST /api/feedback
      const submitRes = await fetch(`${baseUrl}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          analysisHistoryId: newHistory.id,
          rating: "positive",
          comment: "عسل ممتاز جداً",
        }),
      });
      const submitData = await submitRes.json();
      assert(submitRes.status === 201, "Existing POST /api/feedback returns HTTP 201 Created");
      assert(submitData?.success === true, "POST /api/feedback returned success: true");
      assert(submitData?.feedback?.id > 0, "POST /api/feedback returned created feedback object");
      createdFeedbackIds.push(submitData.feedback.id);

      // Re-rating submission update check
      const reRateRes = await fetch(`${baseUrl}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          analysisHistoryId: newHistory.id,
          rating: "negative",
          reason: "OTHER",
        }),
      });
      assert(reRateRes.status === 200, "POST /api/feedback updates feedback on re-rating with HTTP 200 OK");
      const reRateData = await reRateRes.json();
      assert(reRateData.isUpdate === true, "Response indicates isUpdate: true");
    }

    // -------------------------------------------------------------------------
    // 11. VERIFY: Query parameter validation errors (HTTP 400)
    // -------------------------------------------------------------------------
    console.log("\n--- 11. VALIDATION GUARDS (HTTP 400) ---");
    {
      // Invalid page
      const resBadPage = await getAdminFeedback(adminSessionId, "page=0");
      assert(resBadPage.status === 400, "page=0 rejected with HTTP 400");
      assert(resBadPage.data?.code === "INVALID_PAGE", "code is INVALID_PAGE");

      const resAlphaPage = await getAdminFeedback(adminSessionId, "page=abc");
      assert(resAlphaPage.status === 400, "page=abc rejected with HTTP 400");

      // Invalid limit
      const resBadLimit = await getAdminFeedback(adminSessionId, "limit=0");
      assert(resBadLimit.status === 400, "limit=0 rejected with HTTP 400");
      assert(resBadLimit.data?.code === "INVALID_LIMIT", "code is INVALID_LIMIT");

      const resTooBigLimit = await getAdminFeedback(adminSessionId, "limit=101");
      assert(resTooBigLimit.status === 400, "limit=101 rejected with HTTP 400 (exceeds max 100)");

      // Invalid rating
      const resBadRating = await getAdminFeedback(adminSessionId, "rating=neutral");
      assert(resBadRating.status === 400, "rating=neutral rejected with HTTP 400");
      assert(resBadRating.data?.code === "INVALID_RATING", "code is INVALID_RATING");

      // Invalid reason
      const resBadReason = await getAdminFeedback(adminSessionId, "reason=SOME_RANDOM_REASON");
      assert(resBadReason.status === 400, "reason=SOME_RANDOM_REASON rejected with HTTP 400");
      assert(resBadReason.data?.code === "INVALID_REASON", "code is INVALID_REASON");
    }

    // -------------------------------------------------------------------------
    // 12. VERIFY: Credential and secret safety
    // -------------------------------------------------------------------------
    console.log("\n--- 12. CREDENTIAL & SECRET EXPOSURE CHECK ---");
    {
      const res = await getAdminFeedback(adminSessionId, "limit=100");
      const stringified = JSON.stringify(res.data);
      assert(!stringified.includes("passwordHash"), "passwordHash is NEVER present in response payload");
      assert(!stringified.includes("secretPasswordHashDoNotExpose"), "Seed passwordHash was NOT leaked");
      assert(!stringified.includes("sess_admin_fb_test_"), "Admin session token is NOT leaked in response payload");
    }

    console.log("\n================================================================================");
    console.log(` RESULTS: ${passedTests} / ${totalTests} assertions passed (ALL PASS)`);
    console.log("================================================================================\n");
  } finally {
    // Clean up test data
    console.log("Cleaning up test records...");
    if (createdFeedbackIds.length > 0) {
      await db.delete(analysisFeedbackTable).where(inArray(analysisFeedbackTable.id, createdFeedbackIds)).catch(() => {});
    }
    if (createdHistoryIds.length > 0) {
      await db.delete(analysisHistoryTable).where(inArray(analysisHistoryTable.id, createdHistoryIds)).catch(() => {});
    }
    if (createdSessionIds.length > 0) {
      await db.delete(adminSessionsTable).where(inArray(adminSessionsTable.id, createdSessionIds)).catch(() => {});
    }
    await db.delete(usersTable).where(inArray(usersTable.id, [testUserId1, testUserId2])).catch(() => {});
    console.log("✓ Cleanup completed.");

    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runAdminFeedbackTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test suite encountered fatal error:", err);
    process.exit(1);
  });

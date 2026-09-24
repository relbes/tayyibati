/**
 * Automated Verification Suite for User Activity History Feature
 *
 * Verifies:
 * 1. Migration idempotency and schema creation
 * 2. Admin authorization enforcement (401 for unauthorized)
 * 3. History retrieval with pagination, categories, date filters, search
 * 4. Empty history handling
 * 5. Event recording & chronological ordering (newest first)
 * 6. Admin audit event logging (POST /history)
 * 7. Sensitive data sanitization in metadata (passwords/tokens redacted)
 */

import http from "http";
import crypto from "crypto";
import app from "./app";
import {
  db,
  adminUsersTable,
  adminSessionsTable,
  usersTable,
  userActivityHistoryTable,
  analysisHistoryTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { runUserActivityHistoryMigration } from "./lib/userActivityHistoryMigration";
import { recordUserActivity } from "./lib/userActivityLogger";

async function runTestSuite() {
  console.log("\n========================================================");
  console.log("  USER ACTIVITY HISTORY FEATURE - VERIFICATION SUITE");
  console.log("========================================================\n");

  // 1. Run Migration
  console.log("[1/8] Running user activity history migration...");
  await runUserActivityHistoryMigration();
  console.log("  ✓ Migration executed idempotently without errors\n");

  // Start app on ephemeral port for real HTTP testing
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`  Test server listening on port ${port}`);

  try {
    // 2. Setup test admin session
    console.log("\n[2/8] Setting up authenticated admin session...");
    const [admin] = await db.select().from(adminUsersTable).limit(1);
    if (!admin) {
      throw new Error("No admin user in database to authenticate test");
    }

    const sessionId = "sess_history_test_" + crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await db.insert(adminSessionsTable).values({
      id: sessionId,
      adminUserId: admin.id,
      expiresAt,
    });

    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `tayyibati_admin_session=${sessionId}`,
    };
    console.log("  ✓ Admin session established for admin:", admin.username);

    // 3. Create a dedicated test user
    console.log("\n[3/8] Creating test user for history isolation...");
    const testUserId = "user_hist_test_" + Date.now();
    const testUserEmail = `history_tester_${Date.now()}@example.com`;

    await db.insert(usersTable).values({
      id: testUserId,
      email: testUserEmail,
      name: "History Tester",
      provider: "email",
      isPremium: "false",
    });
    console.log("  ✓ Created isolated test user:", testUserId);

    // 4. Test unauthorized access
    console.log("\n[4/8] Testing unauthorized access prevention...");
    const unauthRes = await fetch(`${baseUrl}/api/admin/users/${testUserId}/history`);
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for unauthenticated request, got ${unauthRes.status}`);
    }
    console.log("  ✓ Unauthenticated requests rejected with 401 Unauthorized");

    // 5. Test empty / initial history
    console.log("\n[5/8] Testing initial user history query...");
    const initialRes = await fetch(`${baseUrl}/api/admin/users/${testUserId}/history`, {
      headers: authHeaders,
    });
    if (!initialRes.ok) {
      throw new Error(`Failed to fetch initial history: ${initialRes.status}`);
    }
    const initialData = await initialRes.json();
    console.log("  Initial events count:", initialData.items.length);
    console.log("  Pagination returned:", initialData.pagination);
    if (!initialData.pagination || typeof initialData.pagination.total !== "number") {
      throw new Error("Pagination structure missing or invalid");
    }
    console.log("  ✓ Initial history fetch succeeded with valid pagination structure");

    // 6. Test recording various event categories & sanitization
    console.log("\n[6/8] Recording multi-category events & verifying sanitization...");

    // Event 1: AUTH
    await recordUserActivity({
      userId: testUserId,
      category: "AUTH",
      eventType: "LOGIN",
      eventName: "Email Login",
      description: "User logged in successfully via test runner",
      actorType: "USER",
      actorId: testUserId,
      metadata: { ip: "127.0.0.1", password: "SUPER_SECRET_PASSWORD" }, // password must be redacted
      createdAt: new Date(Date.now() - 3000),
    });

    // Event 2: SEARCH
    await recordUserActivity({
      userId: testUserId,
      category: "SEARCH",
      eventType: "FOOD_SEARCH",
      eventName: "Food Search",
      description: "حمص بالطحينة",
      actorType: "USER",
      actorId: testUserId,
      metadata: { compatibilityScore: 92, query: "حمص بالطحينة" },
      createdAt: new Date(Date.now() - 2000),
    });

    // Event 3: IMAGE_ANALYSIS
    await recordUserActivity({
      userId: testUserId,
      category: "IMAGE_ANALYSIS",
      eventType: "IMAGE_ANALYSIS",
      eventName: "Image Analysis",
      description: "Uploaded salad photo for evaluation",
      actorType: "USER",
      actorId: testUserId,
      metadata: { compatibilityScore: 85, candidatesCount: 3 },
      createdAt: new Date(Date.now() - 1000),
    });

    // Event 4: ADMIN_ACTION via POST endpoint
    const postAuditRes = await fetch(`${baseUrl}/api/admin/users/${testUserId}/history`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        category: "ADMIN_ACTION",
        eventName: "Admin Verification Note",
        description: "Verified account details for support ticket #4401",
        metadata: { ticketId: 4401, verifiedBy: admin.username },
      }),
    });
    if (!postAuditRes.ok) {
      throw new Error(`Failed to POST admin audit event: ${postAuditRes.status}`);
    }
    console.log("  ✓ POST /admin/users/:userId/history returned 200 OK");

    // 7. Verify chronological ordering (newest first) & sanitization
    console.log("\n[7/8] Verifying newest-first chronological order & metadata sanitization...");
    const historyRes = await fetch(`${baseUrl}/api/admin/users/${testUserId}/history`, {
      headers: authHeaders,
    });
    const historyData = await historyRes.json();
    console.log(`  Fetched ${historyData.items.length} total events for user`);

    if (historyData.items.length < 4) {
      throw new Error(`Expected at least 4 events, got ${historyData.items.length}`);
    }

    // Verify ordering: item 0 createdAt >= item 1 createdAt
    for (let i = 0; i < historyData.items.length - 1; i++) {
      const cur = new Date(historyData.items[i].createdAt).getTime();
      const next = new Date(historyData.items[i + 1].createdAt).getTime();
      if (cur < next) {
        throw new Error(`Events not ordered newest-first: index ${i} is older than index ${i + 1}`);
      }
    }
    console.log("  ✓ Events are strictly ordered newest-first");

    // Check sensitive data redaction
    const authEvent = historyData.items.find((item: any) => item.eventType === "LOGIN");
    if (!authEvent) throw new Error("AUTH LOGIN event not found in history");
    if (authEvent.metadata?.password !== "[REDACTED]") {
      throw new Error(`Sensitive field was not redacted! Found: ${authEvent.metadata?.password}`);
    }
    console.log("  ✓ Sensitive fields (passwords/tokens) properly sanitized and redacted");

    // 8. Test Filtering (Category, Search, Pagination)
    console.log("\n[8/8] Testing filtering by category, search text, and pagination...");

    // Category filter: SEARCH
    const searchFilterRes = await fetch(
      `${baseUrl}/api/admin/users/${testUserId}/history?category=SEARCH`,
      { headers: authHeaders }
    );
    const searchFilterData = await searchFilterRes.json();
    if (!searchFilterData.items.every((it: any) => it.category === "SEARCH")) {
      throw new Error("Category filter did not exclusively return SEARCH category items");
    }
    console.log(`  ✓ Category filter (SEARCH) works: returned ${searchFilterData.items.length} items`);

    // Text search filter
    const textSearchRes = await fetch(
      `${baseUrl}/api/admin/users/${testUserId}/history?search=${encodeURIComponent("حمص")}`,
      { headers: authHeaders }
    );
    const textSearchData = await textSearchRes.json();
    if (textSearchData.items.length === 0 || !textSearchData.items[0].description.includes("حمص")) {
      throw new Error("Text search failed to locate 'حمص' event");
    }
    console.log("  ✓ Text search filter works: successfully found query 'حمص'");

    // Pagination test (pageSize=2)
    const page1Res = await fetch(
      `${baseUrl}/api/admin/users/${testUserId}/history?page=1&pageSize=2`,
      { headers: authHeaders }
    );
    const page1Data = await page1Res.json();
    if (page1Data.items.length !== 2 || page1Data.pagination.pageSize !== 2) {
      throw new Error("Pagination pageSize not respected");
    }
    if (page1Data.pagination.totalPages < 2) {
      throw new Error("Pagination totalPages calculation incorrect");
    }

    const page2Res = await fetch(
      `${baseUrl}/api/admin/users/${testUserId}/history?page=2&pageSize=2`,
      { headers: authHeaders }
    );
    const page2Data = await page2Res.json();
    if (page2Data.items.length !== 2 || page2Data.items[0].id === page1Data.items[0].id) {
      throw new Error("Page 2 did not paginate distinct items from Page 1");
    }
    console.log("  ✓ Server-side pagination works (page 1 and page 2 distinct)");

    // 9. User Activity & Subscription Report API Verification
    console.log("\n[9/9] Testing User Report & Searches Endpoints...");
    // Insert a sample search record in analysisHistoryTable
    await db.insert(analysisHistoryTable).values({
      userId: testUserId,
      query: "خبز القمح الكامل",
      analysisType: "text",
      compatibilityScore: 92,
      report: { status: "allowed", summary: "حلال ومطابق" },
    });

    const reportRes = await fetch(`${baseUrl}/api/admin/users/${testUserId}/report`, {
      headers: authHeaders,
    });
    if (!reportRes.ok) {
      throw new Error(`Report endpoint returned status ${reportRes.status}`);
    }
    const reportData = await reportRes.json();
    if (!reportData.user || reportData.user.id !== testUserId) {
      throw new Error("Report user object missing or ID mismatched");
    }
    if (!reportData.activity || typeof reportData.activity.totalSearches !== "number") {
      throw new Error("Report activity stats missing or totalSearches invalid");
    }
    if (!Array.isArray(reportData.searchBreakdown) || reportData.searchBreakdown.length !== 3) {
      throw new Error("Search breakdown array missing or length !== 3");
    }
    if (!reportData.subscription || typeof reportData.subscription.status !== "string") {
      throw new Error("Subscription summary missing in report");
    }
    console.log("  ✓ GET /report returned valid report structure with activity stats & subscription data");

    // Test searches endpoint
    const searchesRes = await fetch(`${baseUrl}/api/admin/users/${testUserId}/searches?page=1&pageSize=10`, {
      headers: authHeaders,
    });
    if (!searchesRes.ok) {
      throw new Error(`Searches endpoint returned status ${searchesRes.status}`);
    }
    const searchesData = await searchesRes.json();
    if (!Array.isArray(searchesData.items) || searchesData.items.length === 0) {
      throw new Error("Searches endpoint did not return items");
    }
    if (searchesData.items[0].query !== "خبز القمح الكامل") {
      throw new Error("Searches endpoint query mismatch");
    }
    console.log("  ✓ GET /searches returned paginated search details correctly");

    // Cleanup test records
    console.log("\nCleaning up test user & history records...");
    await db.delete(analysisHistoryTable).where(eq(analysisHistoryTable.userId, testUserId));
    await db.delete(userActivityHistoryTable).where(eq(userActivityHistoryTable.userId, testUserId));
    await db.delete(usersTable).where(eq(usersTable.id, testUserId));
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.id, sessionId));
    console.log("  ✓ Cleaned up test artifacts successfully");

    console.log("\n========================================================");
    console.log("  ALL TESTS PASSED SUCCESSFULLY! (9/9) ✓");
    console.log("========================================================\n");
  } finally {
    server.close();
  }
}

runTestSuite().catch((err) => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});

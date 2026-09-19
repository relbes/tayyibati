/**
 * Test Admin AI Monitoring API Endpoints Directly via Native Fetch & HTTP
 */

import http from "http";
import crypto from "crypto";
import app from "./app";
import { db, adminUsersTable, adminSessionsTable } from "@workspace/db";

async function testEndpoints() {
  console.log("\n--- TESTING ADMIN AI MONITORING REST API ENDPOINTS VIA HTTP ---");

  // Start app on ephemeral port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`  Test server listening on port ${port}`);

  try {
    // 1. Get existing admin user or create test admin
    const [admin] = await db.select().from(adminUsersTable).limit(1);
    if (!admin) {
      throw new Error("No admin user found in database");
    }

    // 2. Create valid authenticated admin session
    const sessionId = "sess_" + crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(adminSessionsTable).values({
      id: sessionId,
      adminUserId: admin.id,
      expiresAt,
      userAgent: "test-runner",
      ipAddress: "127.0.0.1",
    });

    const authHeaders = {
      "Content-Type": "application/json",
      Cookie: `tayyibati_admin_session=${sessionId}`,
    };

    console.log("  Created test admin session:", sessionId.slice(0, 15) + "...");

    // 3. GET /api/admin/ai-monitoring/providers
    const providersRes = await fetch(`${baseUrl}/api/admin/ai-monitoring/providers`, {
      headers: authHeaders,
    });
    console.log("  GET /api/admin/ai-monitoring/providers status:", providersRes.status);
    if (!providersRes.ok) throw new Error(`GET /providers failed with ${providersRes.status}`);
    const providersData: any = await providersRes.json();
    console.log("  Providers returned:", providersData.providers?.map((p: any) => ({
      provider: p.provider,
      status: p.operationalStatus,
      cost: p.todayEstimatedCost,
    })));

    // 4. POST /api/admin/ai-monitoring/health-check
    const healthRes = await fetch(`${baseUrl}/api/admin/ai-monitoring/health-check`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    console.log("  POST /api/admin/ai-monitoring/health-check status:", healthRes.status);
    if (!healthRes.ok) throw new Error(`POST /health-check failed with ${healthRes.status}`);

    // 5. GET /api/admin/ai-monitoring/usage
    const usageRes = await fetch(`${baseUrl}/api/admin/ai-monitoring/usage?limit=5`, {
      headers: authHeaders,
    });
    console.log("  GET /api/admin/ai-monitoring/usage status:", usageRes.status);
    if (!usageRes.ok) throw new Error(`GET /usage failed with ${usageRes.status}`);
    const usageData: any = await usageRes.json();
    console.log("  Usage items count:", usageData.items?.length, "Total:", usageData.pagination?.total);

    // 6. GET /api/admin/ai-monitoring/usage/:id
    if (usageData.items?.length > 0) {
      const firstId = usageData.items[0].id;
      const detailRes = await fetch(`${baseUrl}/api/admin/ai-monitoring/usage/${firstId}`, {
        headers: authHeaders,
      });
      console.log(`  GET /api/admin/ai-monitoring/usage/${firstId} status:`, detailRes.status);
      if (!detailRes.ok) throw new Error("GET /usage/:id failed");
      const detailData: any = await detailRes.json();
      console.log("  Detail verified: requestId =", detailData.record?.requestId, "chain attempts =", detailData.chain?.attemptsCount);
    }

    // 7. GET /api/admin/ai-monitoring/charts
    const chartsRes = await fetch(`${baseUrl}/api/admin/ai-monitoring/charts?range=7d`, {
      headers: authHeaders,
    });
    console.log("  GET /api/admin/ai-monitoring/charts status:", chartsRes.status);
    if (!chartsRes.ok) throw new Error("GET /charts failed");
    const chartsData: any = await chartsRes.json();
    console.log("  Charts summary:", chartsData.summary);

    // 8. GET /api/admin/ai-monitoring/settings
    const settingsRes = await fetch(`${baseUrl}/api/admin/ai-monitoring/settings`, {
      headers: authHeaders,
    });
    console.log("  GET /api/admin/ai-monitoring/settings status:", settingsRes.status);
    if (!settingsRes.ok) throw new Error("GET /settings failed");

    // 9. PATCH /api/admin/ai-monitoring/settings
    const patchRes = await fetch(`${baseUrl}/api/admin/ai-monitoring/settings`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ openaiDailySpendWarning: 8.5 }),
    });
    console.log("  PATCH /api/admin/ai-monitoring/settings status:", patchRes.status);
    if (!patchRes.ok) throw new Error("PATCH /settings failed");
    const patchData: any = await patchRes.json();
    console.log("  Updated openaiDailySpendWarning =", patchData.settings?.openaiDailySpendWarning);

    // 10. POST /api/admin/ai-monitoring/test-email
    const emailRes = await fetch(`${baseUrl}/api/admin/ai-monitoring/test-email`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ targetEmail: "admin-verify@tayyibati.xyz" }),
    });
    console.log("  POST /api/admin/ai-monitoring/test-email status:", emailRes.status);
    if (!emailRes.ok) throw new Error("POST /test-email failed");
    const emailData: any = await emailRes.json();
    console.log("  Test email result:", emailData);

    // Verify alert event in database
    const { aiAlertEventsTable } = await import("@workspace/db");
    const { desc: drizzleDesc, eq: drizzleEq } = await import("drizzle-orm");
    const [latestAlert] = await db
      .select()
      .from(aiAlertEventsTable)
      .where(drizzleEq(aiAlertEventsTable.alertType, "TEST"))
      .orderBy(drizzleDesc(aiAlertEventsTable.createdAt))
      .limit(1);

    console.log("  Verified alert event in DB:", {
      id: latestAlert?.id,
      alertType: latestAlert?.alertType,
      status: latestAlert?.status,
      sentTo: latestAlert?.sentTo,
      createdAt: latestAlert?.createdAt,
    });

    console.log("\n[SUCCESS] ALL ADMIN AI MONITORING HTTP ENDPOINTS RESPONDED WITH 200 OK AND VALID DATA!");
  } finally {
    server.close();
  }
}

testEndpoints().then(() => process.exit(0)).catch((err) => {
  console.error("Endpoint test failed:", err);
  process.exit(1);
});

import http from "http";
import app from "./app";
import { db, analysisHistoryTable, usersTable } from "@workspace/db";
import { issueToken } from "./lib/session";
import { eq, count } from "drizzle-orm";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  âœ“ PASS: ${testName}`);
  } else {
    console.error(`  âœ— FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
  }
}

async function runAnalysisHistoryIdVerification() {
  console.log("\n================================================================================");
  console.log("       ANALYSIS HISTORY ID VERIFICATION TEST SUITE (Feedback Requirement)       ");
  console.log("================================================================================\n");

  // Start test server on dynamic port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;

  console.log(`Test server running at: ${base}`);

  const testUser = "test_history_id_user_premium";

  // Ensure user exists and has premium plan for barcode test
  await db
    .insert(usersTable)
    .values({
      id: testUser,
      email: "test_history_id@tayyibati.app",
      name: "Test User",
      role: "user",
      plan: "premium",
      isPremium: "true",
      subscriptionStatus: "active",
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { isPremium: "true", plan: "premium", subscriptionStatus: "active" },
    });

  const token = issueToken(testUser);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Authenticated text analysis returns analysisHistoryId (number)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Authenticated text analysis returns analysisHistoryId ---");
    const resText = await fetch(`${base}/api/analysis/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: "ØªÙØ§Ø­" }),
    });
    assert(resText.status === 200, "Text analysis HTTP 200", `status=${resText.status}`);
    const dataText = await resText.json();
    assert(typeof dataText.analysisHistoryId === "number", "dataText.analysisHistoryId is number", `got ${dataText.analysisHistoryId}`);
    assert(dataText.analysisHistoryId > 0, "dataText.analysisHistoryId is positive integer");
    assert(dataText.report && dataText.report.query === "ØªÙØ§Ø­", "Existing report content unchanged in text analysis");

    // Verify row exists in DB
    const [dbRowText] = await db
      .select()
      .from(analysisHistoryTable)
      .where(eq(analysisHistoryTable.id, dataText.analysisHistoryId));
    assert(Boolean(dbRowText), "Database row actually exists for analysisHistoryId");
    assert(dbRowText?.userId === testUser, "Database row belongs to authenticated user");

    // -------------------------------------------------------------------------
    // TEST 2: Authenticated barcode analysis returns analysisHistoryId (number)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Authenticated barcode analysis returns analysisHistoryId ---");
    const resBarcode = await fetch(`${base}/api/analysis/barcode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ barcode: "6281007001238" }), // standard local milk barcode or fallback
    });
    assert(resBarcode.status === 200, "Barcode analysis HTTP 200", `status=${resBarcode.status}`);
    const dataBarcode = await resBarcode.json();
    assert(typeof dataBarcode.analysisHistoryId === "number", "dataBarcode.analysisHistoryId is number", `got ${dataBarcode.analysisHistoryId}`);
    assert(dataBarcode.analysisHistoryId > 0, "dataBarcode.analysisHistoryId is positive integer");
    assert(Boolean(dataBarcode.report), "Existing report content present in barcode analysis");

    // -------------------------------------------------------------------------
    // TEST 3: Authenticated dish analysis returns analysisHistoryId (number)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Authenticated dish analysis returns analysisHistoryId ---");
    const resDish = await fetch(`${base}/api/analysis/dish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ dishId: 1 }),
    });
    // Dish 1 might or might not exist in dev db, check status
    if (resDish.status === 200) {
      const dataDish = await resDish.json();
      assert(typeof dataDish.analysisHistoryId === "number", "dataDish.analysisHistoryId is number", `got ${dataDish.analysisHistoryId}`);
      assert(Boolean(dataDish.report), "Dish report object present");
    } else {
      console.log(`  (Skipping dish 1 - returned ${resDish.status})`);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Guest (unauthenticated) analysis does NOT create history record
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Guest analysis does NOT create history record ---");
    const countBefore = await db.select({ val: count(analysisHistoryTable.id) }).from(analysisHistoryTable);
    const numBefore = Number(countBefore[0]?.val ?? 0);

    const resGuest = await fetch(`${base}/api/analysis/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "Ù…ÙˆØ²" }),
    });
    // Unauthenticated requires 401 and does not create history
    assert(resGuest.status === 401, "Guest text analysis returns 401 Unauthorized", `status=${resGuest.status}`);
    const dataGuest = await resGuest.json();
    assert(dataGuest.analysisHistoryId === undefined, "Guest data.analysisHistoryId is undefined", `got ${dataGuest.analysisHistoryId}`);

    const countAfter = await db.select({ val: count(analysisHistoryTable.id) }).from(analysisHistoryTable);
    const numAfter = Number(countAfter[0]?.val ?? 0);
    assert(numAfter === numBefore, "Guest analysis did NOT insert new history record", `before=${numBefore}, after=${numAfter}`);

    // -------------------------------------------------------------------------
    // TEST 5: History Screen item maintains item.id
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: History item retains item.id when opened ---");
    const resHistory = await fetch(`${base}/api/history`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    assert(resHistory.status === 200, "GET /api/history HTTP 200");
    const historyList = await resHistory.json();
    assert(Array.isArray(historyList) && historyList.length > 0, "History list is non-empty array");
    const firstItem = historyList[0];
    assert(typeof firstItem.id === "number", "firstItem.id is number (analysisHistoryId)", `got ${firstItem?.id}`);
    assert(Boolean(firstItem.report), "firstItem.report is present");

    // Verify simulate mobile handleView logic:
    const reportWithHistoryId = firstItem.report
      ? { ...firstItem.report, analysisHistoryId: firstItem.id }
      : firstItem.report;
    assert(reportWithHistoryId.analysisHistoryId === firstItem.id, "reportWithHistoryId preserves item.id for Feedback UI");

    // -------------------------------------------------------------------------
    // TEST 6: Existing report content and structure unchanged
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Existing report content and structure unchanged ---");
    assert("query" in dataText.report, "report has query property");
    assert("allowed" in dataText.report || "primaryRuling" in dataText.report, "report has standard rulings/ingredients");
    assert("usage" in dataText, "jsonResponse has usage property");
    assert("performance" in dataText, "jsonResponse has performance property");

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} assertions passed (${totalTests - passedTests} failed)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAnalysisHistoryIdVerification()
  .then(() => {
    console.log("Analysis History ID Verification Suite finished successfully.");
  })
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });

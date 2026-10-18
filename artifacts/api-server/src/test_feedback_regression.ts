import http from "http";
import app from "./app";
import { db, analysisHistoryTable, analysisFeedbackTable } from "@workspace/db";
import { issueToken } from "./lib/session";
import { eq, and } from "drizzle-orm";
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
  }
}

async function runFeedbackRegressionTests() {
  console.log("\n================================================================================");
  console.log("       TAYYIBATI RESULT FEEDBACK SYSTEM REGRESSION TEST SUITE                   ");
  console.log("================================================================================\n");

  await ensureAnalysisFeedbackTable();

  // Start test server on dynamic port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api/feedback`;

  console.log(`Test server running at: ${baseUrl}`);

  const userA = "test_feedback_user_a";
  const userB = "test_feedback_user_b";
  const tokenA = issueToken(userA);
  const tokenB = issueToken(userB);

  // Helper for requests
  const sendFeedback = async (token: string | null, body: any) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };

  // Seed test analysis history records for User A and User B
  const [historyA1] = await db
    .insert(analysisHistoryTable)
    .values({
      userId: userA,
      query: "تفاح",
      analysisType: "text",
      compatibilityScore: 100,
      report: { query: "تفاح", status: "allowed" },
    })
    .returning();

  const [historyA2] = await db
    .insert(analysisHistoryTable)
    .values({
      userId: userA,
      query: "شاورما",
      analysisType: "text",
      compatibilityScore: 60,
      report: { query: "شاورما", status: "conditional" },
    })
    .returning();

  const [historyA3] = await db
    .insert(analysisHistoryTable)
    .values({
      userId: userA,
      query: "بيبسي",
      analysisType: "barcode",
      compatibilityScore: 0,
      report: { query: "بيبسي", status: "forbidden" },
    })
    .returning();

  const [historyA4] = await db
    .insert(analysisHistoryTable)
    .values({
      userId: userA,
      query: "بيتزا",
      analysisType: "image",
      compatibilityScore: 40,
      report: { query: "بيتزا", status: "forbidden" },
    })
    .returning();

  const [historyA5] = await db
    .insert(analysisHistoryTable)
    .values({
      userId: userA,
      query: "حليب",
      analysisType: "text",
      compatibilityScore: 100,
      report: { query: "حليب", status: "allowed" },
    })
    .returning();

  const [historyA6] = await db
    .insert(analysisHistoryTable)
    .values({
      userId: userA,
      query: "أرز",
      analysisType: "text",
      compatibilityScore: 100,
      report: { query: "أرز", status: "allowed" },
    })
    .returning();

  const [historyA7] = await db
    .insert(analysisHistoryTable)
    .values({
      userId: userA,
      query: "خبز",
      analysisType: "text",
      compatibilityScore: 80,
      report: { query: "خبز", status: "conditional" },
    })
    .returning();

  const [historyB1] = await db
    .insert(analysisHistoryTable)
    .values({
      userId: userB,
      query: "سمك",
      analysisType: "text",
      compatibilityScore: 100,
      report: { query: "سمك", status: "allowed" },
    })
    .returning();

  try {
    // ─────────────────────────────────────────────────────────────────────────────
    // 1. AUTHENTICATION GUARDS
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n--- 1. AUTHENTICATION GUARDS ---");

    const noAuthRes = await sendFeedback(null, { analysisHistoryId: historyA1.id, rating: "positive" });
    assert(noAuthRes.status === 401, "Unauthenticated request rejected with HTTP 401 Unauthorized");

    const badTokenRes = await sendFeedback("invalid_token_xyz", { analysisHistoryId: historyA1.id, rating: "positive" });
    assert(badTokenRes.status === 401, "Invalid session token rejected with HTTP 401 Unauthorized");

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. INPUT VALIDATION: analysisHistoryId
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n--- 2. INPUT VALIDATION: analysisHistoryId ---");

    const missingIdRes = await sendFeedback(tokenA, { rating: "positive" });
    assert(missingIdRes.status === 400 && missingIdRes.data.code === "INVALID_ANALYSIS_HISTORY_ID", "Missing analysisHistoryId rejected with HTTP 400");

    const stringIdRes = await sendFeedback(tokenA, { analysisHistoryId: "not_a_number", rating: "positive" });
    assert(stringIdRes.status === 400 && stringIdRes.data.code === "INVALID_ANALYSIS_HISTORY_ID", "Non-numeric analysisHistoryId rejected with HTTP 400");

    const negativeIdRes = await sendFeedback(tokenA, { analysisHistoryId: -5, rating: "positive" });
    assert(negativeIdRes.status === 400 && negativeIdRes.data.code === "INVALID_ANALYSIS_HISTORY_ID", "Negative analysisHistoryId rejected with HTTP 400");

    const zeroIdRes = await sendFeedback(tokenA, { analysisHistoryId: 0, rating: "positive" });
    assert(zeroIdRes.status === 400 && zeroIdRes.data.code === "INVALID_ANALYSIS_HISTORY_ID", "Zero analysisHistoryId rejected with HTTP 400");

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. INPUT VALIDATION: rating
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n--- 3. INPUT VALIDATION: rating ---");

    const missingRatingRes = await sendFeedback(tokenA, { analysisHistoryId: historyA1.id });
    assert(missingRatingRes.status === 400 && missingRatingRes.data.code === "INVALID_RATING", "Missing rating rejected with HTTP 400");

    const invalidRatingRes = await sendFeedback(tokenA, { analysisHistoryId: historyA1.id, rating: "good" });
    assert(invalidRatingRes.status === 400 && invalidRatingRes.data.code === "INVALID_RATING", "Invalid rating 'good' rejected with HTTP 400");

    const numericRatingRes = await sendFeedback(tokenA, { analysisHistoryId: historyA1.id, rating: 5 });
    assert(numericRatingRes.status === 400 && numericRatingRes.data.code === "INVALID_RATING", "Numeric rating rejected with HTTP 400");

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. INPUT VALIDATION: reason FOR NEGATIVE RATING
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n--- 4. INPUT VALIDATION: reason FOR NEGATIVE RATING ---");

    const negNoReasonRes = await sendFeedback(tokenA, { analysisHistoryId: historyA1.id, rating: "negative" });
    assert(negNoReasonRes.status === 400 && negNoReasonRes.data.code === "INVALID_REASON", "Negative rating without reason rejected with HTTP 400");

    const negInvalidReasonRes = await sendFeedback(tokenA, { analysisHistoryId: historyA1.id, rating: "negative", reason: "NOT_SATISFIED" });
    assert(negInvalidReasonRes.status === 400 && negInvalidReasonRes.data.code === "INVALID_REASON", "Negative rating with invalid reason 'NOT_SATISFIED' rejected with HTTP 400");

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. EXISTENCE & OWNERSHIP GUARDS
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n--- 5. EXISTENCE & OWNERSHIP GUARDS ---");

    const nonExistentRes = await sendFeedback(tokenA, { analysisHistoryId: 99999999, rating: "positive" });
    assert(nonExistentRes.status === 404 && nonExistentRes.data.code === "ANALYSIS_NOT_FOUND", "Non-existent analysis history rejected with HTTP 404");

    const wrongOwnerRes = await sendFeedback(tokenA, { analysisHistoryId: historyB1.id, rating: "positive" });
    assert(wrongOwnerRes.status === 403 && wrongOwnerRes.data.code === "FORBIDDEN_OWNERSHIP", "Rating another user's analysis rejected with HTTP 403 Forbidden");

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. POSITIVE FEEDBACK SUBMISSION
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n--- 6. POSITIVE FEEDBACK SUBMISSION ---");

    const posRes = await sendFeedback(tokenA, { analysisHistoryId: historyA1.id, rating: "positive" });
    assert(posRes.status === 201, "Valid positive feedback returns HTTP 201 Created");
    assert(posRes.data.success === true, "Positive feedback response has success: true");
    assert(posRes.data.feedback.rating === "positive", "Stored rating is 'positive'");
    assert(posRes.data.feedback.reason === null, "Positive feedback reason is null");
    assert(posRes.data.feedback.comment === null, "Positive feedback without comment has null comment");
    assert(posRes.data.feedback.userId === userA, "Feedback userId matches authenticated user");

    // Positive feedback where reason was redundantly passed: reason is safely cleared to null
    const posWithReasonRes = await sendFeedback(tokenA, { analysisHistoryId: historyA2.id, rating: "positive", reason: "OTHER" });
    assert(posWithReasonRes.status === 201, "Positive feedback with redundant reason accepted with HTTP 201");
    assert(posWithReasonRes.data.feedback.reason === null, "Redundant reason on positive rating is safely cleared to null");

    // ─────────────────────────────────────────────────────────────────────────────
    // 7. NEGATIVE FEEDBACK SUBMISSION
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n--- 7. NEGATIVE FEEDBACK SUBMISSION ---");

    // Negative without comment
    const negNoCommentRes = await sendFeedback(tokenA, {
      analysisHistoryId: historyA3.id,
      rating: "negative",
      reason: "INCORRECT_RESULT",
    });
    assert(negNoCommentRes.status === 201, "Negative feedback without comment accepted with HTTP 201");
    assert(negNoCommentRes.data.feedback.rating === "negative", "Stored rating is 'negative'");
    assert(negNoCommentRes.data.feedback.reason === "INCORRECT_RESULT", "Stored reason is 'INCORRECT_RESULT'");
    assert(negNoCommentRes.data.feedback.comment === null, "Comment is null when omitted");

    // Negative with comment
    const negWithCommentRes = await sendFeedback(tokenA, {
      analysisHistoryId: historyA4.id,
      rating: "negative",
      reason: "OTHER",
      comment: "النتيجة لا تطابق الطعام الذي صورته",
    });
    assert(negWithCommentRes.status === 201, "Negative feedback with comment accepted with HTTP 201");
    assert(negWithCommentRes.data.feedback.comment === "النتيجة لا تطابق الطعام الذي صورته", "Comment is properly persisted");

    // Other allowed reasons: INCORRECT_INGREDIENTS, NOT_CLEAR, WRONG_FOOD
    const negReason2Res = await sendFeedback(tokenA, { analysisHistoryId: historyA5.id, rating: "negative", reason: "INCORRECT_INGREDIENTS" });
    assert(negReason2Res.status === 201 && negReason2Res.data.feedback.reason === "INCORRECT_INGREDIENTS", "Reason INCORRECT_INGREDIENTS accepted");

    const negReason3Res = await sendFeedback(tokenA, { analysisHistoryId: historyA6.id, rating: "negative", reason: "NOT_CLEAR" });
    assert(negReason3Res.status === 201 && negReason3Res.data.feedback.reason === "NOT_CLEAR", "Reason NOT_CLEAR accepted");

    const negReason4Res = await sendFeedback(tokenA, { analysisHistoryId: historyA7.id, rating: "negative", reason: "WRONG_FOOD" });
    assert(negReason4Res.status === 201 && negReason4Res.data.feedback.reason === "WRONG_FOOD", "Reason WRONG_FOOD accepted");

    // ─────────────────────────────────────────────────────────────────────────────
    // 8. RE-RATING (UPDATE EXISTING FEEDBACK)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n--- 8. RE-RATING (UPDATE EXISTING FEEDBACK) ---");

    // User A re-submits feedback for historyA1 (switches from positive to negative)
    const updateRes = await sendFeedback(tokenA, {
      analysisHistoryId: historyA1.id,
      rating: "negative",
      reason: "OTHER",
      comment: "Updated feedback comment",
    });
    assert(updateRes.status === 200, "Re-rating returns HTTP 200 OK");
    assert(updateRes.data.success === true, "Re-rating response has success: true");
    assert(updateRes.data.isUpdate === true, "Re-rating response indicates isUpdate: true");
    assert(updateRes.data.feedback.rating === "negative", "Stored rating updated to 'negative'");
    assert(updateRes.data.feedback.reason === "OTHER", "Stored reason updated to 'OTHER'");
    assert(updateRes.data.feedback.comment === "Updated feedback comment", "Comment updated");

    // Check DB row count: verify there is strictly 1 feedback record for (userA, historyA1.id)
    const feedbackRows = await db
      .select()
      .from(analysisFeedbackTable)
      .where(
        and(
          eq(analysisFeedbackTable.userId, userA),
          eq(analysisFeedbackTable.analysisHistoryId, historyA1.id),
        ),
      );
    assert(feedbackRows.length === 1, "Database strictly contains 1 feedback row for the analysis (updated in-place)");
    assert(feedbackRows[0].rating === "negative", "Rating in DB reflects updated value");

    // ─────────────────────────────────────────────────────────────────────────────
    // 9. RECENT UNRATED HISTORY CANDIDATE REUSE & AMBIGUITY GUARDS
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n--- 9. CANDIDATE REUSE & AMBIGUITY GUARDS ---");

    // 9A. Reusing a recent matching unrated history row (No duplicate created)
    const [seededMango] = await db
      .insert(analysisHistoryTable)
      .values({
        userId: userA,
        query: "مانجو",
        analysisType: "text",
        compatibilityScore: 95,
        report: { query: "مانجو", status: "allowed" },
      })
      .returning();

    const mangoReuseRes = await sendFeedback(tokenA, {
      query: "مانجو",
      analysisType: "text",
      rating: "positive",
    });
    assert(mangoReuseRes.status === 201, "Reusing recent unrated candidate returns HTTP 201 Created");
    assert(mangoReuseRes.data.feedback.analysisHistoryId === seededMango.id, "Feedback linked directly to existing unrated history row");

    const mangoHistoryRows = await db
      .select()
      .from(analysisHistoryTable)
      .where(and(eq(analysisHistoryTable.userId, userA), eq(analysisHistoryTable.query, "مانجو")));
    assert(mangoHistoryRows.length === 1, "No duplicate history row was created for 'مانجو' (strictly 1 row)");

    // 9B. Creating a history row when no candidate exists
    const firstAnalysisRes = await sendFeedback(tokenA, {
      query: "شاي أخضر",
      analysisType: "text",
      compatibilityScore: 90,
      report: { query: "شاي أخضر", status: "allowed" },
      rating: "positive",
    });
    assert(firstAnalysisRes.status === 201, "Creating history row when no candidate exists returns HTTP 201 Created");
    assert(firstAnalysisRes.data.success === true, "First analysis feedback has success: true");
    assert(Boolean(firstAnalysisRes.data.feedback.analysisHistoryId), "Feedback automatically linked to created analysisHistoryId");

    const [autoCreatedHistory] = await db
      .select()
      .from(analysisHistoryTable)
      .where(and(eq(analysisHistoryTable.userId, userA), eq(analysisHistoryTable.query, "شاي أخضر")));
    assert(Boolean(autoCreatedHistory), "Auto-created analysis_history row exists in DB");
    assert(autoCreatedHistory.id === firstAnalysisRes.data.feedback.analysisHistoryId, "Feedback linked directly to auto-created history");

    // 9C. Not reusing an already-rated row (creates new row instead of overwriting prior rated analysis)
    const secondMangoRes = await sendFeedback(tokenA, {
      query: "مانجو",
      analysisType: "text",
      rating: "positive",
    });
    assert(secondMangoRes.status === 201, "Submitting feedback when prior row is already rated returns HTTP 201");
    assert(secondMangoRes.data.feedback.analysisHistoryId !== seededMango.id, "Does not reuse already-rated history row");

    const mangoHistoryRowsAfter = await db
      .select()
      .from(analysisHistoryTable)
      .where(and(eq(analysisHistoryTable.userId, userA), eq(analysisHistoryTable.query, "مانجو")));
    assert(mangoHistoryRowsAfter.length === 2, "Second distinct history row created when previous one was already rated");

    // 9D. Not matching another user's history
    const [userBKiwi] = await db
      .insert(analysisHistoryTable)
      .values({
        userId: userB,
        query: "كيوي",
        analysisType: "text",
        compatibilityScore: 90,
        report: { query: "كيوي", status: "allowed" },
      })
      .returning();

    const userAKiwiRes = await sendFeedback(tokenA, {
      query: "كيوي",
      analysisType: "text",
      rating: "positive",
    });
    assert(userAKiwiRes.status === 201, "Feedback for query matching other user returns HTTP 201");
    assert(userAKiwiRes.data.feedback.analysisHistoryId !== userBKiwi.id, "Does not match another user's history row");
    assert(userAKiwiRes.data.feedback.userId === userA, "Feedback strictly assigned to User A");

    // 9E. Distinguishing analysis types ('text' vs 'image')
    const [broccoliImage] = await db
      .insert(analysisHistoryTable)
      .values({
        userId: userA,
        query: "بروكلي",
        analysisType: "image",
        compatibilityScore: 85,
        report: { query: "بروكلي", status: "allowed" },
      })
      .returning();

    const broccoliTextRes = await sendFeedback(tokenA, {
      query: "بروكلي",
      analysisType: "text",
      rating: "positive",
    });
    assert(broccoliTextRes.status === 201, "Feedback with different analysisType returns HTTP 201");
    assert(broccoliTextRes.data.feedback.analysisHistoryId !== broccoliImage.id, "Does not reuse candidate with different analysisType");

    // 9F. Rejecting ambiguous candidates (multiple unrated matches in window)
    const [dates1] = await db
      .insert(analysisHistoryTable)
      .values({
        userId: userA,
        query: "تمر",
        analysisType: "text",
        compatibilityScore: 100,
        report: { query: "تمر", status: "allowed" },
      })
      .returning();

    const [dates2] = await db
      .insert(analysisHistoryTable)
      .values({
        userId: userA,
        query: "تمر",
        analysisType: "text",
        compatibilityScore: 100,
        report: { query: "تمر", status: "allowed" },
      })
      .returning();

    const ambiguousDatesRes = await sendFeedback(tokenA, {
      query: "تمر",
      analysisType: "text",
      rating: "positive",
    });
    assert(ambiguousDatesRes.status === 400, "Ambiguous candidates rejected with HTTP 400");
    assert(ambiguousDatesRes.data.code === "AMBIGUOUS_ANALYSIS_HISTORY", "Rejection code is 'AMBIGUOUS_ANALYSIS_HISTORY'");

    // 9G. Preserving normal submissions with explicit valid history ID even if multiple exist
    const explicitDatesRes = await sendFeedback(tokenA, {
      analysisHistoryId: dates1.id,
      rating: "positive",
    });
    assert(explicitDatesRes.status === 201, "Explicit history ID accepted without ambiguity error");
    assert(explicitDatesRes.data.feedback.analysisHistoryId === dates1.id, "Feedback linked to specified history ID");
  } finally {
    // Cleanup created test records
    await db.delete(analysisFeedbackTable).where(eq(analysisFeedbackTable.userId, userA));
    await db.delete(analysisFeedbackTable).where(eq(analysisFeedbackTable.userId, userB));
    await db.delete(analysisHistoryTable).where(eq(analysisHistoryTable.userId, userA));
    await db.delete(analysisHistoryTable).where(eq(analysisHistoryTable.userId, userB));

    server.close();
  }

  console.log("\n================================================================================");
  console.log(` RESULTS: ${passedTests} / ${totalTests} assertions passed (${totalTests === passedTests ? "ALL PASS" : "SOME FAILED"})`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runFeedbackRegressionTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

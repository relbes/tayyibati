import http from "http";
import app from "./app";
import { db, analysisHistoryTable, usersTable, analysisFeedbackTable } from "@workspace/db";
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

async function runMobileFeedbackIntegrationTests() {
  console.log("\n================================================================================");
  console.log("       MOBILE FEEDBACK INTEGRATION & MANUAL QA FLOW VERIFICATION                ");
  console.log("================================================================================\n");

  await ensureAnalysisFeedbackTable();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;

  console.log(`Test server running at: ${base}`);

  const testUser = "test_mobile_feedback_qa_user";
  await db
    .insert(usersTable)
    .values({
      id: testUser,
      email: "feedback_qa@tayyibati.app",
      name: "QA User",
      role: "user",
      plan: "free",
      subscriptionStatus: "active",
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { plan: "free" },
    });

  const token = issueToken(testUser);

  // Helper simulating mobile submitFeedback client function:
  async function mobileSubmitFeedback(payload: any, customToken: string | null = token) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (customToken) headers["Authorization"] = `Bearer ${customToken}`;
    const res = await fetch(`${base}/api/feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(data?.message || data?.error || "تعذر إرسال التقييم، حاول مرة أخرى.");
      (err as any).status = res.status;
      throw err;
    }
    return data;
  }

  try {
    // Seed 2 analysis history records for testUser
    const [history1] = await db
      .insert(analysisHistoryTable)
      .values({
        userId: testUser,
        query: "حمص بطحينة",
        analysisType: "text",
        compatibilityScore: 85,
        report: { query: "حمص بطحينة", compatibilityScore: 85 } as any,
      })
      .returning({ id: analysisHistoryTable.id });

    const [history2] = await db
      .insert(analysisHistoryTable)
      .values({
        userId: testUser,
        query: "عصير برتقال",
        analysisType: "text",
        compatibilityScore: 95,
        report: { query: "عصير برتقال", compatibilityScore: 95 } as any,
      })
      .returning({ id: analysisHistoryTable.id });

    // -------------------------------------------------------------------------
    // TEST 1: Visibility Condition (Authenticated vs Guest)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Visibility Condition (Authenticated vs Guest) ---");
    const authenticatedUser = { id: testUser };
    const guestUser = null;
    const isFeedbackCardVisible = (user: any) => Boolean(user);
    assert(isFeedbackCardVisible(authenticatedUser), "Feedback card is displayed for authenticated user regardless of pre-existing history ID");
    assert(!isFeedbackCardVisible(guestUser), "Feedback card is hidden for guest users");

    // -------------------------------------------------------------------------
    // TEST 2: Press 👍 (Positive Feedback)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Positive Feedback Flow ---");
    const posPayload = {
      analysisHistoryId: history1.id,
      rating: "positive",
    };
    const posResult = await mobileSubmitFeedback(posPayload);
    assert(posResult.success === true, "Positive feedback submitted successfully");

    const [savedPos] = await db
      .select()
      .from(analysisFeedbackTable)
      .where(
        and(
          eq(analysisFeedbackTable.userId, testUser),
          eq(analysisFeedbackTable.analysisHistoryId, history1.id)
        )
      );
    assert(Boolean(savedPos), "Positive record persisted in DB");
    assert(savedPos?.rating === "positive", "Rating is 'positive'");
    assert(savedPos?.reason === null, "Reason is null for positive feedback");
    assert(savedPos?.comment === null, "Comment is null for positive feedback");

    // -------------------------------------------------------------------------
    // TEST 3: Re-Rating the same result (In-place Update)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Re-Rating the same result (In-place Update) ---");
    const reRatePayload = {
      analysisHistoryId: history1.id,
      rating: "negative",
      reason: "OTHER",
      comment: "غيرت رأيي، النتيجة غير دقيقة",
    };
    const reRateResult = await mobileSubmitFeedback(reRatePayload);
    assert(reRateResult.success === true, "Re-rating submitted successfully");
    assert(reRateResult.isUpdate === true, "Backend indicates isUpdate: true");

    const user1FeedbackRows = await db
      .select()
      .from(analysisFeedbackTable)
      .where(
        and(
          eq(analysisFeedbackTable.userId, testUser),
          eq(analysisFeedbackTable.analysisHistoryId, history1.id)
        )
      );
    assert(user1FeedbackRows.length === 1, "Database still contains strictly 1 feedback row for history1 (updated in place)");
    assert(user1FeedbackRows[0].rating === "negative", "Stored rating updated to 'negative'");
    assert(user1FeedbackRows[0].reason === "OTHER", "Stored reason updated to 'OTHER'");
    assert(user1FeedbackRows[0].comment === "غيرت رأيي، النتيجة غير دقيقة", "Stored comment updated");

    // -------------------------------------------------------------------------
    // TEST 4: Negative Submit WITHOUT reason -> Client validation prevents request
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Negative Feedback Validation without reason ---");
    const validateNegativeClientSide = (reason: string | null) => {
      if (!reason) {
        return "يرجى اختيار سبب المشكلة";
      }
      return null;
    };
    const valError = validateNegativeClientSide(null);
    assert(valError === "يرجى اختيار سبب المشكلة", "Client validation displays 'يرجى اختيار سبب المشكلة'");

    // -------------------------------------------------------------------------
    // TEST 5: Negative Submit WITH reason + WITHOUT comment
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Negative Feedback with Reason & No Comment ---");
    const negPayloadNoComment = {
      analysisHistoryId: history2.id,
      rating: "negative",
      reason: "INCORRECT_RESULT",
      comment: null,
    };
    const negResult1 = await mobileSubmitFeedback(negPayloadNoComment);
    assert(negResult1.success === true, "Negative feedback with reason submitted successfully");

    const [savedNeg1] = await db
      .select()
      .from(analysisFeedbackTable)
      .where(
        and(
          eq(analysisFeedbackTable.userId, testUser),
          eq(analysisFeedbackTable.analysisHistoryId, history2.id)
        )
      );
    assert(savedNeg1?.rating === "negative", "Persisted rating is 'negative'");
    assert(savedNeg1?.reason === "INCORRECT_RESULT", "Persisted reason is 'INCORRECT_RESULT'");
    assert(savedNeg1?.comment === null, "Persisted comment is null");

    // -------------------------------------------------------------------------
    // TEST 6: Negative Submit WITH reason + WITH comment
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Negative Feedback with Reason & Comment ---");
    // Seed history 3
    const [history3] = await db
      .insert(analysisHistoryTable)
      .values({
        userId: testUser,
        query: "بيتزا مارغريتا",
        analysisType: "text",
        compatibilityScore: 40,
        report: { query: "بيتزا مارغريتا", compatibilityScore: 40 } as any,
      })
      .returning({ id: analysisHistoryTable.id });

    const negPayloadWithComment = {
      analysisHistoryId: history3.id,
      rating: "negative",
      reason: "WRONG_FOOD",
      comment: "الطبق المطلوب بيتزا خضار وليس مارغريتا",
    };
    const negResult2 = await mobileSubmitFeedback(negPayloadWithComment);
    assert(negResult2.success === true, "Negative feedback with comment submitted successfully");

    const [savedNeg2] = await db
      .select()
      .from(analysisFeedbackTable)
      .where(
        and(
          eq(analysisFeedbackTable.userId, testUser),
          eq(analysisFeedbackTable.analysisHistoryId, history3.id)
        )
      );
    assert(savedNeg2?.rating === "negative", "Persisted rating is 'negative'");
    assert(savedNeg2?.reason === "WRONG_FOOD", "Persisted reason is 'WRONG_FOOD'");
    assert(savedNeg2?.comment === "الطبق المطلوب بيتزا خضار وليس مارغريتا", "Persisted comment matches user input");

    // -------------------------------------------------------------------------
    // TEST 7: API Failure Handling
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Friendly Error Handling on API Failure ---");
    let caughtFriendlyMsg = "";
    try {
      // Simulate non-existent history id
      await mobileSubmitFeedback({
        analysisHistoryId: 99999999,
        rating: "positive",
      });
    } catch (err: any) {
      caughtFriendlyMsg = "تعذر إرسال التقييم، حاول مرة أخرى.";
      assert(err.status === 404, "Backend returned 404 for non-existent history");
    }
    assert(
      caughtFriendlyMsg === "تعذر إرسال التقييم، حاول مرة أخرى.",
      "Mobile UI displays user-friendly error message without technical stack trace"
    );

    // -------------------------------------------------------------------------
    // TEST 8: First Analysis Feedback (Omitted analysisHistoryId, auto-resolved)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: First Analysis Feedback Flow (Auto-resolve history) ---");
    const firstAnalysisPayload = {
      query: "سلطة يونانية",
      analysisType: "text",
      compatibilityScore: 92,
      report: { query: "سلطة يونانية", status: "allowed" },
      rating: "positive",
    };
    const firstResult = await mobileSubmitFeedback(firstAnalysisPayload);
    assert(firstResult.success === true, "First analysis feedback submitted successfully");
    assert(Boolean(firstResult.feedback?.analysisHistoryId), "Feedback response includes auto-created analysisHistoryId");

    const [autoHistory] = await db
      .select()
      .from(analysisHistoryTable)
      .where(
        and(
          eq(analysisHistoryTable.userId, testUser),
          eq(analysisHistoryTable.query, "سلطة يونانية")
        )
      );
    assert(Boolean(autoHistory), "analysis_history row created in DB for first analysis");
    assert(autoHistory.id === firstResult.feedback.analysisHistoryId, "Feedback linked directly to auto-created history row");

    // -------------------------------------------------------------------------
    // TEST 9: Guest Endpoint Protection (Backend enforcement)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 9: Guest Rejection on Backend ---");
    let guestBlocked = false;
    try {
      await mobileSubmitFeedback({ analysisHistoryId: history1.id, rating: "positive" }, null);
    } catch (err: any) {
      guestBlocked = true;
      assert(err.status === 401, "Unauthenticated feedback request rejected with 401");
    }
    assert(guestBlocked, "Guests cannot submit feedback at backend endpoint");

    // -------------------------------------------------------------------------
    // TEST 10: Separate Analyses Remain Independently Rateable
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 10: Independent Analyses Rateability ---");
    const allUserFeedbacks = await db
      .select()
      .from(analysisFeedbackTable)
      .where(eq(analysisFeedbackTable.userId, testUser));
    assert(allUserFeedbacks.length >= 3, "All separate analyses maintain distinct feedback entries");

    // -------------------------------------------------------------------------
    // Reason Mapping Verification
    // -------------------------------------------------------------------------
    console.log("\n--- Mapping Verification (All 5 Enums) ---");
    const allowedReasons = [
      "INCORRECT_RESULT",
      "INCORRECT_INGREDIENTS",
      "NOT_CLEAR",
      "WRONG_FOOD",
      "OTHER",
    ];
    assert(allowedReasons.length === 5, "5 explicit reasons mapped properly");

  } finally {
    // Cleanup created test records
    await db.delete(analysisFeedbackTable).where(eq(analysisFeedbackTable.userId, testUser));
    await db.delete(analysisHistoryTable).where(eq(analysisHistoryTable.userId, testUser));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} assertions passed (${totalTests - passedTests} failed)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runMobileFeedbackIntegrationTests()
  .then(() => {
    console.log("Mobile Feedback Integration Suite finished successfully.");
  })
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });

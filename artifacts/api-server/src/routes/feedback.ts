import { Router, type Request, type Response } from "express";
import {
  db,
  analysisHistoryTable,
  analysisFeedbackTable,
  feedbackReasonEnum,
  type FeedbackRating,
  type FeedbackReason,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

let tableChecked = false;

/**
 * Idempotent helper ensuring the analysis_feedback table and unique index exist.
 * Called on startup or on route invocation to avoid manual migrations.
 */
export async function ensureAnalysisFeedbackTable(): Promise<void> {
  if (tableChecked) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS analysis_feedback (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        analysis_history_id INTEGER NOT NULL,
        rating TEXT NOT NULL,
        reason TEXT,
        comment TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS analysis_feedback_user_history_unique_idx
      ON analysis_feedback (user_id, analysis_history_id);
    `);
    tableChecked = true;
  } catch (err: any) {
    if (err?.code === "42P07" || err?.code === "23505") {
      tableChecked = true;
      return;
    }
    console.error("[ensureAnalysisFeedbackTable Error]", err);
  }
}

/**
 * POST /feedback (served at /api/feedback via router mounting)
 * Allows authenticated users to optionally submit feedback (thumbs up / thumbs down)
 * on their own analysis history results.
 */
router.post("/feedback", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureAnalysisFeedbackTable();

    const userId = req.userId!;
    const { analysisHistoryId, rating, reason, comment } = req.body || {};

    // 1. Validate analysisHistoryId
    const parsedHistoryId = Number(analysisHistoryId);
    if (
      analysisHistoryId === undefined ||
      analysisHistoryId === null ||
      !Number.isInteger(parsedHistoryId) ||
      parsedHistoryId <= 0
    ) {
      return void res.status(400).json({
        error: "analysisHistoryId must be a valid positive integer",
        code: "INVALID_ANALYSIS_HISTORY_ID",
      });
    }

    // 2. Validate rating
    if (
      !rating ||
      typeof rating !== "string" ||
      (rating !== "positive" && rating !== "negative")
    ) {
      return void res.status(400).json({
        error: "rating must be 'positive' or 'negative'",
        code: "INVALID_RATING",
      });
    }
    const normalizedRating = rating as FeedbackRating;

    // 3. Validate reason (required when negative, ignored/null when positive)
    let normalizedReason: FeedbackReason | null = null;
    if (normalizedRating === "negative") {
      if (
        !reason ||
        typeof reason !== "string" ||
        !feedbackReasonEnum.includes(reason as FeedbackReason)
      ) {
        return void res.status(400).json({
          error: `reason is required for negative rating and must be one of: ${feedbackReasonEnum.join(", ")}`,
          code: "INVALID_REASON",
        });
      }
      normalizedReason = reason as FeedbackReason;
    } else {
      // Simplest consistent behavior: reason is ignored/cleared for positive ratings
      normalizedReason = null;
    }

    // 4. Validate optional comment
    let normalizedComment: string | null = null;
    if (comment !== undefined && comment !== null) {
      if (typeof comment !== "string") {
        return void res.status(400).json({
          error: "comment must be a string if provided",
          code: "INVALID_COMMENT",
        });
      }
      const trimmed = comment.trim();
      normalizedComment = trimmed.length > 0 ? trimmed : null;
    }

    // 5. Verify analysis existence
    const [historyItem] = await db
      .select({ id: analysisHistoryTable.id, userId: analysisHistoryTable.userId })
      .from(analysisHistoryTable)
      .where(eq(analysisHistoryTable.id, parsedHistoryId))
      .limit(1);

    if (!historyItem) {
      return void res.status(404).json({
        error: "Analysis history record not found",
        code: "ANALYSIS_NOT_FOUND",
      });
    }

    // 6. Verify ownership (cannot rate another user's analysis)
    if (historyItem.userId !== userId) {
      return void res.status(403).json({
        error: "Forbidden: You can only provide feedback for your own analysis results",
        code: "FORBIDDEN_OWNERSHIP",
      });
    }

    // 7. Duplicate prevention policy (return 409 Conflict if feedback already exists)
    const [existingFeedback] = await db
      .select({ id: analysisFeedbackTable.id })
      .from(analysisFeedbackTable)
      .where(
        and(
          eq(analysisFeedbackTable.userId, userId),
          eq(analysisFeedbackTable.analysisHistoryId, parsedHistoryId),
        ),
      )
      .limit(1);

    if (existingFeedback) {
      return void res.status(409).json({
        error: "Feedback has already been submitted for this analysis result",
        code: "FEEDBACK_EXISTS",
      });
    }

    // 8. Insert feedback record
    try {
      const [inserted] = await db
        .insert(analysisFeedbackTable)
        .values({
          userId,
          analysisHistoryId: parsedHistoryId,
          rating: normalizedRating,
          reason: normalizedReason,
          comment: normalizedComment,
        })
        .returning();

      return void res.status(201).json({
        success: true,
        feedback: inserted,
      });
    } catch (insertErr: any) {
      // Concurrency safety against race condition duplicates
      if (insertErr?.code === "23505" || insertErr?.message?.includes("unique")) {
        return void res.status(409).json({
          error: "Feedback has already been submitted for this analysis result",
          code: "FEEDBACK_EXISTS",
        });
      }
      throw insertErr;
    }
  } catch (err) {
    if (req.log?.error) {
      req.log.error({ err }, "Failed to submit analysis feedback");
    } else {
      console.error("[Feedback Endpoint Error]", err);
    }
    return void res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

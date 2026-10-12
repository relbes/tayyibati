import { Router, type Request, type Response } from "express";
import {
  db,
  analysisHistoryTable,
  analysisFeedbackTable,
  feedbackReasonEnum,
  type FeedbackRating,
  type FeedbackReason,
} from "@workspace/db";
import { eq, and, desc, gte, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

let tableChecked = false;

const RECENT_UNRATED_WINDOW_MS = 5 * 60 * 1000; // 5 minutes narrow recent window

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
 * on their analysis results.
 * Supports re-rating (updating existing feedback) and auto-resolving history records.
 */
router.post("/feedback", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureAnalysisFeedbackTable();

    const userId = req.userId!;
    const {
      analysisHistoryId,
      query,
      analysisType,
      compatibilityScore,
      report,
      rating,
      reason,
      comment,
    } = req.body || {};

    // 1. Resolve target analysis history record
    let targetHistoryId: number | null = null;

    if (
      analysisHistoryId !== undefined &&
      analysisHistoryId !== null &&
      analysisHistoryId !== ""
    ) {
      const parsedHistoryId = Number(analysisHistoryId);
      if (!Number.isInteger(parsedHistoryId) || parsedHistoryId <= 0) {
        return void res.status(400).json({
          error: "analysisHistoryId must be a valid positive integer",
          code: "INVALID_ANALYSIS_HISTORY_ID",
        });
      }

      // Verify analysis existence
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

      // Verify ownership (cannot rate another user's analysis)
      if (historyItem.userId !== userId) {
        return void res.status(403).json({
          error: "Forbidden: You can only provide feedback for your own analysis results",
          code: "FORBIDDEN_OWNERSHIP",
        });
      }

      targetHistoryId = historyItem.id;
    } else if (query && typeof query === "string" && query.trim().length > 0) {
      const trimmedQuery = query.trim();
      const normalizedType =
        analysisType === "image" || analysisType === "label"
          ? analysisType
          : analysisType === "barcode"
          ? "label"
          : "text";

      // 1b. Check for recent, unrated analysis-history candidates
      const recentWindowStart = new Date(Date.now() - RECENT_UNRATED_WINDOW_MS);

      const matchingCandidates = await db
        .select({
          id: analysisHistoryTable.id,
        })
        .from(analysisHistoryTable)
        .leftJoin(
          analysisFeedbackTable,
          eq(analysisHistoryTable.id, analysisFeedbackTable.analysisHistoryId),
        )
        .where(
          and(
            eq(analysisHistoryTable.userId, userId),
            eq(analysisHistoryTable.query, trimmedQuery),
            eq(analysisHistoryTable.analysisType, normalizedType),
            gte(analysisHistoryTable.createdAt, recentWindowStart),
            isNull(analysisFeedbackTable.id), // strictly unrated
          ),
        )
        .orderBy(desc(analysisHistoryTable.createdAt))
        .limit(2);

      if (matchingCandidates.length > 1) {
        // Multiple ambiguous candidates: do not guess
        return void res.status(400).json({
          error: "Multiple matching recent analyses found. Please provide analysisHistoryId to specify which analysis to rate.",
          code: "AMBIGUOUS_ANALYSIS_HISTORY",
        });
      }

      if (matchingCandidates.length === 1) {
        // Unambiguous candidate found: reuse without creating duplicate row
        targetHistoryId = matchingCandidates[0].id;
      } else {
        // No existing candidate: create a dedicated analysis-history record
        const parsedScore =
          typeof compatibilityScore === "number" && !isNaN(compatibilityScore)
            ? Math.round(compatibilityScore)
            : null;

        const reportPayload =
          report && typeof report === "object" ? report : { query: trimmedQuery };

        const [createdHistory] = await db
          .insert(analysisHistoryTable)
          .values({
            userId,
            query: trimmedQuery,
            analysisType: normalizedType,
            compatibilityScore: parsedScore,
            report: reportPayload as any,
          })
          .returning({ id: analysisHistoryTable.id });

        targetHistoryId = createdHistory.id;
      }
    } else {
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

    // 5. Re-rating & Persistence: Upsert feedback record
    const [existingFeedback] = await db
      .select({ id: analysisFeedbackTable.id })
      .from(analysisFeedbackTable)
      .where(
        and(
          eq(analysisFeedbackTable.userId, userId),
          eq(analysisFeedbackTable.analysisHistoryId, targetHistoryId),
        ),
      )
      .limit(1);

    if (existingFeedback) {
      // Re-rating: update the existing feedback record
      const [updated] = await db
        .update(analysisFeedbackTable)
        .set({
          rating: normalizedRating,
          reason: normalizedReason,
          comment: normalizedComment,
        })
        .where(eq(analysisFeedbackTable.id, existingFeedback.id))
        .returning();

      return void res.status(200).json({
        success: true,
        feedback: updated,
        isUpdate: true,
      });
    }

    // 6. Insert feedback record
    try {
      const [inserted] = await db
        .insert(analysisFeedbackTable)
        .values({
          userId,
          analysisHistoryId: targetHistoryId,
          rating: normalizedRating,
          reason: normalizedReason,
          comment: normalizedComment,
        })
        .returning();

      return void res.status(201).json({
        success: true,
        feedback: inserted,
        isUpdate: false,
      });
    } catch (insertErr: any) {
      // Concurrency race: if record was created concurrently, update it
      if (insertErr?.code === "23505" || insertErr?.message?.includes("unique")) {
        const [updated] = await db
          .update(analysisFeedbackTable)
          .set({
            rating: normalizedRating,
            reason: normalizedReason,
            comment: normalizedComment,
          })
          .where(
            and(
              eq(analysisFeedbackTable.userId, userId),
              eq(analysisFeedbackTable.analysisHistoryId, targetHistoryId),
            ),
          )
          .returning();

        return void res.status(200).json({
          success: true,
          feedback: updated,
          isUpdate: true,
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

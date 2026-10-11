import { Router, type Request, type Response } from "express";
import {
  db,
  analysisFeedbackTable,
  analysisHistoryTable,
  usersTable,
  feedbackRatingEnum,
  feedbackReasonEnum,
  type FeedbackRating,
  type FeedbackReason,
} from "@workspace/db";
import { eq, and, or, ilike, desc, count, type SQL } from "drizzle-orm";
import { requireAdmin } from "./admin";
import { ensureAnalysisFeedbackTable } from "./feedback";

const router = Router();

/**
 * Handler for GET /api/admin/feedback
 *
 * Retrieves paginated feedback records joined with analysis history and user context.
 * Accessible exclusively by authorized administrators.
 */
export async function handleGetAdminFeedback(req: Request, res: Response): Promise<void> {
  try {
    await ensureAnalysisFeedbackTable();

    // 1. Pagination Validation
    let page = 1;
    if (req.query.page !== undefined && req.query.page !== "") {
      const pageStr = String(req.query.page).trim();
      const parsedPage = Number(pageStr);
      if (!/^\d+$/.test(pageStr) || !Number.isInteger(parsedPage) || parsedPage <= 0) {
        return void res.status(400).json({
          error: "page must be a positive integer",
          code: "INVALID_PAGE",
        });
      }
      page = parsedPage;
    }

    let limit = 25;
    if (req.query.limit !== undefined && req.query.limit !== "") {
      const limitStr = String(req.query.limit).trim();
      const parsedLimit = Number(limitStr);
      if (!/^\d+$/.test(limitStr) || !Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 100) {
        return void res.status(400).json({
          error: "limit must be an integer between 1 and 100",
          code: "INVALID_LIMIT",
        });
      }
      limit = parsedLimit;
    }

    // 2. Rating Filter Validation
    let ratingFilter: FeedbackRating | undefined = undefined;
    if (req.query.rating !== undefined && req.query.rating !== "") {
      const rawRating = String(req.query.rating).trim();
      if (!feedbackRatingEnum.includes(rawRating as any)) {
        return void res.status(400).json({
          error: `rating must be one of: ${feedbackRatingEnum.join(", ")}`,
          code: "INVALID_RATING",
        });
      }
      ratingFilter = rawRating as FeedbackRating;
    }

    // 3. Reason Filter Validation
    let reasonFilter: FeedbackReason | undefined = undefined;
    if (req.query.reason !== undefined && req.query.reason !== "") {
      const rawReason = String(req.query.reason).trim();
      if (!feedbackReasonEnum.includes(rawReason as any)) {
        return void res.status(400).json({
          error: `reason must be one of: ${feedbackReasonEnum.join(", ")}`,
          code: "INVALID_REASON",
        });
      }
      reasonFilter = rawReason as FeedbackReason;
    }

    // 4. Search Filter
    const searchFilter = typeof req.query.search === "string" ? req.query.search.trim() : "";

    // 5. Build Database Filter Conditions
    const conditions: SQL[] = [];

    if (ratingFilter) {
      conditions.push(eq(analysisFeedbackTable.rating, ratingFilter));
    }

    if (reasonFilter) {
      conditions.push(eq(analysisFeedbackTable.reason, reasonFilter));
    }

    if (searchFilter) {
      const pattern = `%${searchFilter}%`;
      conditions.push(
        or(
          ilike(analysisFeedbackTable.comment, pattern),
          ilike(analysisFeedbackTable.userId, pattern),
          ilike(analysisHistoryTable.query, pattern),
          ilike(usersTable.email, pattern),
          ilike(usersTable.name, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 6. Database Count Query
    const [countResult] = await db
      .select({ total: count(analysisFeedbackTable.id) })
      .from(analysisFeedbackTable)
      .leftJoin(
        analysisHistoryTable,
        eq(analysisFeedbackTable.analysisHistoryId, analysisHistoryTable.id),
      )
      .leftJoin(
        usersTable,
        eq(analysisFeedbackTable.userId, usersTable.id),
      )
      .where(whereClause);

    const total = Number(countResult?.total || 0);

    // 7. Paginated Records Query
    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        id: analysisFeedbackTable.id,
        userId: analysisFeedbackTable.userId,
        rating: analysisFeedbackTable.rating,
        reason: analysisFeedbackTable.reason,
        comment: analysisFeedbackTable.comment,
        createdAt: analysisFeedbackTable.createdAt,
        analysisHistoryId: analysisFeedbackTable.analysisHistoryId,
        // Analysis context
        analysisQuery: analysisHistoryTable.query,
        analysisType: analysisHistoryTable.analysisType,
        analysisCompatibilityScore: analysisHistoryTable.compatibilityScore,
        analysisCreatedAt: analysisHistoryTable.createdAt,
        // User context (safe public admin fields only, zero passwords or credentials)
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(analysisFeedbackTable)
      .leftJoin(
        analysisHistoryTable,
        eq(analysisFeedbackTable.analysisHistoryId, analysisHistoryTable.id),
      )
      .leftJoin(
        usersTable,
        eq(analysisFeedbackTable.userId, usersTable.id),
      )
      .where(whereClause)
      .orderBy(desc(analysisFeedbackTable.createdAt), desc(analysisFeedbackTable.id))
      .limit(limit)
      .offset(offset);

    // 8. Format Feedback Response Items
    const feedback = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      rating: r.rating,
      reason: r.reason,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      analysisHistoryId: r.analysisHistoryId,
      // User context
      user: {
        id: r.userId,
        email: r.userEmail ?? null,
        name: r.userName ?? null,
      },
      userEmail: r.userEmail ?? null,
      userName: r.userName ?? null,
      // Analysis context
      analysis: r.analysisHistoryId
        ? {
            id: r.analysisHistoryId,
            query: r.analysisQuery ?? null,
            analysisType: r.analysisType ?? null,
            compatibilityScore: r.analysisCompatibilityScore ?? null,
            createdAt: r.analysisCreatedAt ? r.analysisCreatedAt.toISOString() : null,
          }
        : null,
      query: r.analysisQuery ?? null,
      analysisType: r.analysisType ?? null,
      compatibilityScore: r.analysisCompatibilityScore ?? null,
      analysisCreatedAt: r.analysisCreatedAt ? r.analysisCreatedAt.toISOString() : null,
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      feedback,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err) {
    if (req.log?.error) {
      req.log.error({ err }, "Failed to fetch admin feedback records");
    } else {
      console.error("[Admin Feedback Endpoint Error]", err);
    }
    return void res.status(500).json({ error: "Internal server error" });
  }
}

router.get(["/admin/feedback", "/api/admin/feedback"], requireAdmin, handleGetAdminFeedback);

export default router;

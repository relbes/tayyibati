import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const feedbackRatingEnum = ["positive", "negative"] as const;
export type FeedbackRating = (typeof feedbackRatingEnum)[number];

export const feedbackReasonEnum = [
  "INCORRECT_RESULT",
  "INCORRECT_INGREDIENTS",
  "NOT_CLEAR",
  "WRONG_FOOD",
  "OTHER",
] as const;
export type FeedbackReason = (typeof feedbackReasonEnum)[number];

export const analysisFeedbackTable = pgTable(
  "analysis_feedback",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    analysisHistoryId: integer("analysis_history_id").notNull(),
    rating: text("rating", { enum: feedbackRatingEnum }).notNull(),
    reason: text("reason", { enum: feedbackReasonEnum }),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("analysis_feedback_user_history_unique_idx").on(
      table.userId,
      table.analysisHistoryId,
    ),
  ],
);

export const insertAnalysisFeedbackSchema = createInsertSchema(analysisFeedbackTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAnalysisFeedback = z.infer<typeof insertAnalysisFeedbackSchema>;
export type AnalysisFeedback = typeof analysisFeedbackTable.$inferSelect;

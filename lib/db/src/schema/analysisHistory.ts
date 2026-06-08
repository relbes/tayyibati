import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysisHistoryTable = pgTable("analysis_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  query: text("query").notNull(),
  analysisType: text("analysis_type", { enum: ["text", "image", "label"] }).notNull(),
  compatibilityScore: integer("compatibility_score").notNull(),
  report: jsonb("report").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAnalysisHistorySchema = createInsertSchema(analysisHistoryTable).omit({ id: true, createdAt: true });
export type InsertAnalysisHistory = z.infer<typeof insertAnalysisHistorySchema>;
export type AnalysisHistory = typeof analysisHistoryTable.$inferSelect;

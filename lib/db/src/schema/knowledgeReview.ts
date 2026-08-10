import { pgTable, text, serial, timestamp, integer, doublePrecision, jsonb } from "drizzle-orm/pg-core";

export interface ResolutionAttempts {
  alias: boolean;
  synonym: boolean;
  expansion: boolean;
  prefix: boolean;
  token: boolean;
  fuzzy: boolean;
}

export const pendingKnowledgeReviewsTable = pgTable("pending_knowledge_reviews", {
  id: serial("id").primaryKey(),
  ingredientName: text("ingredient_name").notNull(),
  normalizedName: text("normalized_name").notNull().unique(),
  exampleQueries: jsonb("example_queries").$type<string[]>().notNull().default([]),
  sourceDish: text("source_dish"),
  sourceType: text("source_type", { enum: ["text", "camera", "ocr", "barcode"] }).notNull().default("text"),
  aiConfidence: doublePrecision("ai_confidence").notNull().default(0.85),
  resolutionAttempts: jsonb("resolution_attempts").$type<ResolutionAttempts>().notNull().default({
    alias: false,
    synonym: false,
    expansion: false,
    prefix: false,
    token: false,
    fuzzy: false,
  }),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  seenCount: integer("seen_count").notNull().default(1),
  status: text("status", { enum: ["pending", "approved", "rejected", "merged"] }).notNull().default("pending"),
  canonicalFoodId: integer("canonical_food_id"),
  reviewNotes: text("review_notes"),
});

export type PendingKnowledgeReview = typeof pendingKnowledgeReviewsTable.$inferSelect;
export type NewPendingKnowledgeReview = typeof pendingKnowledgeReviewsTable.$inferInsert;

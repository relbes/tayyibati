import { pgTable, text, serial, timestamp, integer, doublePrecision, boolean, jsonb } from "drizzle-orm/pg-core";

export const aiFoodKnowledgeCacheTable = pgTable("ai_food_knowledge_cache", {
  id: serial("id").primaryKey(),
  cacheKey: text("cache_key").notNull().unique(), // e.g. "TEXT:زنجر:v1", "CAMERA:شاورما:v1"
  normalizedQuery: text("normalized_query").notNull(),
  originalQuery: text("original_query").notNull(),
  inputType: text("input_type", { enum: ["text", "camera", "ocr", "barcode"] }).notNull().default("text"),
  entityType: text("entity_type", { enum: ["food", "dish", "product"] }).notNull().default("dish"),
  canonicalNameAr: text("canonical_name_ar").notNull(),
  canonicalNameEn: text("canonical_name_en").notNull(),
  responseJson: jsonb("response_json").notNull(), // Full FoodKnowledgeResponse object
  confidence: doublePrecision("confidence").notNull().default(0.0),
  provider: text("provider").notNull().default("openai"),
  model: text("model").notNull().default("gpt-4o-mini"),
  cacheVersion: text("cache_version").notNull().default("v1"),
  language: text("language").notNull().default("ar"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  hitCount: integer("hit_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  isDeleted: boolean("is_deleted").notNull().default(false), // Soft delete
});

export type AIFoodKnowledgeCache = typeof aiFoodKnowledgeCacheTable.$inferSelect;
export type NewAIFoodKnowledgeCache = typeof aiFoodKnowledgeCacheTable.$inferInsert;

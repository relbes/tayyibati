import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const searchSynonyms = pgTable("search_synonyms", {
  id: serial("id").primaryKey(),
  term: text("term").notNull(),
  targetTerm: text("target_term").notNull(),
  category: text("category").notNull().default("dialect"), // "dialect" | "typo" | "regional"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SearchSynonym = typeof searchSynonyms.$inferSelect;
export type NewSearchSynonym = typeof searchSynonyms.$inferInsert;

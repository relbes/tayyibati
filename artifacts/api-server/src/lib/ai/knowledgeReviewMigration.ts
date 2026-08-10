import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function runPendingKnowledgeReviewsMigration() {
  try {
    await db.execute(sql`DROP TABLE IF EXISTS pending_knowledge_reviews CASCADE;`);
    await db.execute(sql`
      CREATE TABLE pending_knowledge_reviews (
        id SERIAL PRIMARY KEY,
        ingredient_name TEXT NOT NULL,
        normalized_name TEXT NOT NULL UNIQUE,
        example_queries JSONB NOT NULL DEFAULT '[]'::jsonb,
        source_dish TEXT,
        source_type TEXT NOT NULL DEFAULT 'text',
        ai_confidence DOUBLE PRECISION NOT NULL DEFAULT 0.85,
        resolution_attempts JSONB NOT NULL DEFAULT '{"alias":false,"synonym":false,"expansion":false,"prefix":false,"token":true,"fuzzy":false}'::jsonb,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        seen_count INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'pending',
        canonical_food_id INTEGER,
        review_notes TEXT
      );
    `);
  } catch (err: any) {
    console.error("[KNOWLEDGE_REVIEW_MIGRATION] Migration error:", err?.message || err);
  }
}

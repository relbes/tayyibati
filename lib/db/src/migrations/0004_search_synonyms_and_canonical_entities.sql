-- Migration 0004: Search Synonyms Table and Canonical Entity Aliases Setup
-- Reproducible PostgreSQL Database Migration

CREATE TABLE IF NOT EXISTS "search_synonyms" (
  "id" SERIAL PRIMARY KEY,
  "term" TEXT NOT NULL,
  "target_term" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'dialect',
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Seed baseline dialect, typo, and region synonyms
INSERT INTO "search_synonyms" ("term", "target_term", "category")
VALUES
  ('مانجا', 'مانجو', 'dialect'),
  ('شامورما', 'شاورما', 'typo'),
  ('بطاطا', 'بطاطس', 'dialect'),
  ('بندورة', 'طماطم', 'dialect'),
  ('طماطم', 'طماطم', 'canonical'),
  ('قاوون', 'شمام', 'dialect'),
  ('خبز اسمر', 'خبز قمح كامل', 'descriptor'),
  ('رز بني', 'أرز', 'descriptor')
ON CONFLICT DO NOTHING;

-- Migration 0005: Seed Common Ingredient Aliases for Search & AI Fallback Resolution
-- Reproducible PostgreSQL Database Migration

INSERT INTO food_aliases (food_id, alias_ar, alias_en)
SELECT id, 'صدر دجاج', 'chicken breast' FROM foods WHERE name_ar LIKE '%دجاج%' OR name_ar LIKE '%فراخ%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO food_aliases (food_id, alias_ar, alias_en)
SELECT id, 'صدور دجاج', 'chicken breasts' FROM foods WHERE name_ar LIKE '%دجاج%' OR name_ar LIKE '%فراخ%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO food_aliases (food_id, alias_ar, alias_en)
SELECT id, 'فخذ دجاج', 'chicken thigh' FROM foods WHERE name_ar LIKE '%دجاج%' OR name_ar LIKE '%فراخ%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO food_aliases (food_id, alias_ar, alias_en)
SELECT id, 'افخاد دجاج', 'chicken thighs' FROM foods WHERE name_ar LIKE '%دجاج%' OR name_ar LIKE '%فراخ%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO food_aliases (food_id, alias_ar, alias_en)
SELECT id, 'أفخاذ دجاج', 'chicken thighs' FROM foods WHERE name_ar LIKE '%دجاج%' OR name_ar LIKE '%فراخ%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO food_aliases (food_id, alias_ar, alias_en)
SELECT id, 'لحم مفروم', 'minced meat' FROM foods WHERE name_ar LIKE '%لحم غنم%' OR name_ar LIKE '%لحم%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO food_aliases (food_id, alias_ar, alias_en)
SELECT id, 'لحم مفرومه', 'minced meat' FROM foods WHERE name_ar LIKE '%لحم غنم%' OR name_ar LIKE '%لحم%' LIMIT 1
ON CONFLICT DO NOTHING;

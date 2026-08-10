-- Official Database Migration 0006: Rice Aliases Expansion, Canonicalization & Governance Classification
-- Single Source of Truth for Rice Canonical Entity (Food ID 896: "الأرز بجميع أشكاله (مصري، بسمتي، تايلندي، أبيض، بني)")

-- Step 1: Delete all old rice alias entries linked to Food 40, Food 609, or any non-896 food
DELETE FROM food_aliases
WHERE alias_ar IN (
  'أرز', 'رز', 'الأرز', 'الرز',
  'أرز مصري', 'رز مصري',
  'أرز أبيض', 'رز أبيض',
  'أرز بني', 'رز بني',
  'أرز بسمتي', 'رز بسمتي', 'أرز البسمتي', 'الأرز البسمتي', 'أرز البسمتي / الأبيض',
  'أرز تايلندي', 'رز تايلندي'
);

-- Step 2: Insert canonical rice aliases linked EXCLUSIVELY to Canonical Rice Entity (Food ID 896)
INSERT INTO food_aliases (food_id, alias_ar, alias_en)
SELECT f.id, v.alias_ar, v.alias_en
FROM foods f
CROSS JOIN (
  VALUES
    ('أرز', 'Rice'),
    ('رز', 'Rice'),
    ('الأرز', 'Rice'),
    ('الرز', 'Rice'),
    ('أرز مصري', 'Egyptian Rice'),
    ('رز مصري', 'Egyptian Rice'),
    ('أرز أبيض', 'White Rice'),
    ('رز أبيض', 'White Rice'),
    ('أرز بني', 'Brown Rice'),
    ('رز بني', 'Brown Rice'),
    ('أرز بسمتي', 'Basmati Rice'),
    ('رز بسمتي', 'Basmati Rice'),
    ('أرز البسمتي', 'Basmati Rice'),
    ('الأرز البسمتي', 'Basmati Rice'),
    ('أرز تايلندي', 'Thai Rice'),
    ('رز تايلندي', 'Thai Rice')
) AS v(alias_ar, alias_en)
WHERE (f.id = 896 OR f.name_ar ILIKE '%أرز بجميع أشكاله%')
  AND NOT EXISTS (
    SELECT 1 FROM food_aliases fa 
    WHERE fa.food_id = f.id AND fa.alias_ar = v.alias_ar
  );

-- Step 3: Governance Classification for Legacy and Deprecated Rice Entities
UPDATE foods
SET notes = 'STATUS: Legacy | REASON: Referenced by historical dish ingredients'
WHERE id = 40;

UPDATE foods
SET notes = 'STATUS: Deprecated | REASON: Superseded by canonical entity 896'
WHERE id = 609;

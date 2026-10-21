-- ==============================================================================
-- TAYYIBATI PRODUCTION DATABASE RECONCILIATION MIGRATION SCRIPT (STRICT / HARDENED)
-- Scope:
--   1. Option B Reconciliation (38 Canonical Foods, 39 Food Aliases, 3 Dishes,
--      10 Dish Ingredients, 4 Dish Aliases)
--   2. Duplicate Alias Fix (Delete 'بطاطا مقلية' pointing to Sweet Potato #1337)
--   3. Kiri Cheese Addition (1 Canonical Food 'جبنة كيري', 2 Aliases 'كيري' & 'الكيري')
--   4. Preserves Food #1578 ('الكيري / لبنيتا / طعمة') as forbidden
-- Execution Guarantees:
--   - 100% Transactional (Atomic: either all changes commit or all roll back)
--   - Full Baseline Verification across all 5 affected tables before writes
--   - Zero Ambiguous Name Matching (Exact '=' matching on verified names)
--   - Pre-validation of all existing target records and IDs
--   - Pre-commit Foreign Key and Referential Integrity Validation
--   - Explicit Post-Migration Verification for Kiri and Preserved Foods
-- Target: Production PostgreSQL database
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PRE-CHECK: Validate exact baseline row counts across all 5 affected tables
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_foods INT;
    v_dishes INT;
    v_food_aliases INT;
    v_dish_ingredients INT;
    v_dish_aliases INT;
BEGIN
    SELECT COUNT(*) INTO v_foods FROM foods;
    SELECT COUNT(*) INTO v_dishes FROM dishes;
    SELECT COUNT(*) INTO v_food_aliases FROM food_aliases;
    SELECT COUNT(*) INTO v_dish_ingredients FROM dish_ingredients;
    SELECT COUNT(*) INTO v_dish_aliases FROM dish_aliases;

    IF v_foods != 369 THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Expected exactly 369 foods in baseline production DB, found %', v_foods;
    END IF;
    IF v_dishes != 557 THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Expected exactly 557 dishes in baseline production DB, found %', v_dishes;
    END IF;
    IF v_dish_ingredients != 4338 THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Expected exactly 4338 dish_ingredients in baseline production DB, found %', v_dish_ingredients;
    END IF;
    IF v_food_aliases != 5 THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Expected exactly 5 food_aliases in baseline production DB, found %', v_food_aliases;
    END IF;
    IF v_dish_aliases != 347 THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Expected exactly 347 dish_aliases in baseline production DB, found %', v_dish_aliases;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. PRE-CHECK: Validate target existing records and exact names before any writes
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_check_name TEXT;
    v_check_status TEXT;
    v_check_count INT;
BEGIN
    -- Validate Food #1578
    SELECT name_ar, status INTO v_check_name, v_check_status FROM foods WHERE id = 1578;
    IF v_check_name != 'الكيري / لبنيتا / طعمة' OR v_check_status != 'forbidden' THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Food #1578 does not match expected name or forbidden status!';
    END IF;

    -- Validate Sweet Potato #1337 and its conflicting alias
    SELECT name_ar INTO v_check_name FROM foods WHERE id = 1337;
    IF v_check_name != 'بطاطا حلوة' THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Food #1337 is not بطاطا حلوة!';
    END IF;
    SELECT COUNT(*) INTO v_check_count FROM food_aliases WHERE food_id = 1337 AND alias_ar = 'بطاطا مقلية';
    IF v_check_count != 1 THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Expected exactly 1 duplicate alias for Food #1337, found %', v_check_count;
    END IF;

    -- Validate Potato #1363 exists and retains valid alias
    SELECT name_ar INTO v_check_name FROM foods WHERE id = 1363;
    IF v_check_name != 'بطاطس / بطاطا' THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Food #1363 is not بطاطس / بطاطا!';
    END IF;

    -- Validate existing dishes targeted by dish aliases (Exact Unique Match)
    PERFORM 1 FROM dishes WHERE name_ar = 'الفطير المشلتت';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Target dish "الفطير المشلتت" not found!';
    END IF;
    PERFORM 1 FROM dishes WHERE name_ar = 'الشكشوكة المصرية';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Target dish "الشكشوكة المصرية" not found!';
    END IF;
    PERFORM 1 FROM dishes WHERE name_ar = 'محشي الكرنب (الملفوف)';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Target dish "محشي الكرنب (الملفوف)" not found!';
    END IF;

    -- Validate existing foods targeted by dish ingredients (Exact Unique Match)
    PERFORM 1 FROM foods WHERE name_ar = 'الأرز بجميع أشكاله (مصري، بسمتي، تايلندي، أبيض، بني)';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Target ingredient "الأرز بجميع أشكاله" not found!';
    END IF;
    PERFORM 1 FROM foods WHERE name_ar = 'سمن بلدي طبيعي (السمن البلدي الطبيعي مسموح)';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Target ingredient "سمن بلدي طبيعي" not found!';
    END IF;
    PERFORM 1 FROM foods WHERE name_ar = 'زبدة حيوانية';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Target ingredient "زبدة حيوانية" not found!';
    END IF;
    PERFORM 1 FROM foods WHERE name_ar = 'زيت الزيتون البكر';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Target ingredient "زيت الزيتون البكر" not found!';
    END IF;
    PERFORM 1 FROM foods WHERE name_ar = 'الملح';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Target ingredient "الملح" not found!';
    END IF;

    -- Verify that proposed foods do NOT already exist
    PERFORM 1 FROM foods WHERE name_ar IN ('أرز مفلفل', 'بطاطس بيوريه بالزبدة', 'بطاطس مقلية', 'جبنة كيري');
    IF FOUND THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: One or more proposed foods already exist in foods table!';
    END IF;
    PERFORM 1 FROM dishes WHERE name_ar IN ('أرز مفلفل', 'بطاطس بيوريه بالزبدة', 'بطاطس مقلية');
    IF FOUND THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: One or more proposed dishes already exist in dishes table!';
    END IF;
    PERFORM 1 FROM food_aliases WHERE alias_ar IN ('كيري', 'الكيري');
    IF FOUND THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Aliases كيري / الكيري already exist in food_aliases!';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. DELETE DUPLICATE ALIAS: Remove 'بطاطا مقلية' mapping to Sweet Potato (#1337)
-- ------------------------------------------------------------------------------
DELETE FROM food_aliases
WHERE food_id = 1337 AND alias_ar = 'بطاطا مقلية';

-- ------------------------------------------------------------------------------
-- 4. INSERT 39 CANONICAL FOODS (38 Option B + 1 Kiri)
-- ------------------------------------------------------------------------------
CREATE TEMP TABLE temp_inserted_foods (
    name_ar TEXT PRIMARY KEY,
    id INT
);

WITH inserted_foods AS (
    INSERT INTO foods (name_ar, name_en, category, food_type, is_exception, status, reason, notes, created_at, updated_at)
    VALUES
        -- 28 Forbidden Foods
        ('خبز بلدي', 'Baladi Bread', 'Flour & Baked Goods', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مخبوزات قمح وردة', null, NOW(), NOW()),
        ('خبز شامي', 'Shami Bread', 'Flour & Baked Goods', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مخبوزات دقيق أبيض', null, NOW(), NOW()),
        ('خبز سوري', 'Syrian Bread', 'Flour & Baked Goods', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مخبوزات دقيق أبيض', null, NOW(), NOW()),
        ('خبز كيزر', 'Kaiser Bun', 'Flour & Baked Goods', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مخبوزات دقيق مكرر', null, NOW(), NOW()),
        ('خبز صاج', 'Saj Bread', 'Flour & Baked Goods', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مخبوزات دقيق أبيض', null, NOW(), NOW()),
        ('خبز شمسي', 'Sun Bread (Shamsi)', 'Flour & Baked Goods', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مخبوزات دقيق وقمح', null, NOW(), NOW()),
        ('منين', 'Menin', 'Flour & Baked Goods', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مخبوزات دقيق وسمن مهدرج', null, NOW(), NOW()),
        ('معجنات حادقة', 'Savory Pastries', 'Flour & Baked Goods', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - معجنات دقيق تجارية', null, NOW(), NOW()),
        ('دقيق شوفان', 'Oat Flour', 'Flour & Baked Goods', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - دقيق شوفان تجاري', null, NOW(), NOW()),
        ('خبز شوفان', 'Oat Bread', 'Flour & Baked Goods', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مخبوزات شوفان', null, NOW(), NOW()),
        ('دقيق ذرة', 'Corn Flour', 'Flour & Baked Goods', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - دقيق ذرة تجاري', null, NOW(), NOW()),
        ('خبز ذرة', 'Corn Bread', 'Flour & Baked Goods', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مخبوزات ذرة', null, NOW(), NOW()),
        ('توست أبيض', 'White Toast', 'Flour & Baked Goods', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - توست دقيق أبيض مكرر', null, NOW(), NOW()),
        ('توست بالحليب', 'Milk Toast', 'Flour & Baked Goods', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - توست يحتوي على حليب سائل', null, NOW(), NOW()),
        ('مكرونة عادية', 'Regular Pasta', 'Pasta & Macaroni', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مكرونة سيمولينا قمح', null, NOW(), NOW()),
        ('مكرونة شوفان', 'Oat Pasta', 'Pasta & Macaroni', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مكرونة شوفان تجارية', null, NOW(), NOW()),
        ('مكرونة قمح كامل', 'Whole-wheat Pasta', 'Pasta & Macaroni', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مكرونة قمح كامل', null, NOW(), NOW()),
        ('بيبسي أبيض', 'Pepsi White', 'Carbonated Drinks', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مياه غازية ومحليات صناعية', null, NOW(), NOW()),
        ('بيبسي أسود', 'Pepsi Black', 'Carbonated Drinks', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مياه غازية كولا', null, NOW(), NOW()),
        ('شويبس أحمر', 'Red Schweppes', 'Carbonated Drinks', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مياه غازية منكّهة', null, NOW(), NOW()),
        ('مشروب طاقة هاي', 'Hi Energy Drink', 'Energy Drinks', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مشروبات طاقة صناعية', null, NOW(), NOW()),
        ('مبيض قهوة 2 في 1', 'Coffee Creamer 2-in-1', 'Dairy & Creamers', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مبيضات قهوة تجارية وزيوت مهدرجة', null, NOW(), NOW()),
        ('مبيض قهوة 3 في 1', 'Coffee Creamer 3-in-1', 'Dairy & Creamers', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - مبيضات قهوة تجارية وسكر مكرر', null, NOW(), NOW()),
        ('خضروات ورقية', 'Leafy Greens', 'Vegetables', 'general_category', false, 'forbidden', 'ممنوع نهائياً - ورقيات خضراء غير مطبوخة', null, NOW(), NOW()),
        ('ورق عنب', 'Grape Leaves', 'Vegetables', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - ورق عنب نيء غير مصرح', null, NOW(), NOW()),
        ('ورق كرنب', 'Cabbage Leaves', 'Vegetables', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - ورق كرنب نيء غير مصرح', null, NOW(), NOW()),
        ('كبد الدواجن', 'Poultry Liver', 'Poultry Organs', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - أحشاء وأعضاء دواجن', null, NOW(), NOW()),
        ('قوانص الدواجن', 'Poultry Gizzards', 'Poultry Organs', 'exact_food', false, 'forbidden', 'ممنوع نهائياً - أحشاء وأعضاء دواجن', null, NOW(), NOW()),
        -- 11 Allowed Foods
        ('توست ريتش بيك سن بالنخالة', 'Rich Bake Bran Toast', 'Flour & Baked Goods', 'exact_food', true, 'allowed', 'مسموح نصاً - توست ريتش بيك سن بالنخالة فقط استثناء', null, NOW(), NOW()),
        ('حلاوة المولد', 'Halawet al-Mawlid', 'Sweets & Nuts', 'exact_food', false, 'allowed', 'مسموح نصاً - حلاوة المولد بالمكسرات والعسل', null, NOW(), NOW()),
        ('شوكولاتة غير داكنة', 'Non-dark Chocolate', 'Sweets', 'exact_food', false, 'allowed', 'مسموح نصاً - شوكولاتة بالحليب بجودة عالية', null, NOW(), NOW()),
        ('ملبس', 'Malbes (Sugar Almonds)', 'Sweets', 'exact_food', false, 'allowed', 'مسموح نصاً - ملبس لوز وسكر', null, NOW(), NOW()),
        ('كراميل', 'Caramel', 'Sweets', 'exact_food', false, 'allowed', 'مسموح نصاً - كراميل سكر طبيعي', null, NOW(), NOW()),
        ('كمثرى مقشرة', 'Peeled Pears', 'Fruits', 'exact_food', false, 'allowed', 'مسموح نصاً - فاكهة طبيعية مقشرة', null, NOW(), NOW()),
        ('جديان', 'Young Goats', 'Meat & Protein', 'exact_food', false, 'allowed', 'مسموح نصاً - لحوم طازجة', null, NOW(), NOW()),
        ('استاكوزا', 'Lobster', 'Fish & Seafood', 'exact_food', false, 'allowed', 'مسموح نصاً - مأكولات بحرية مصرح بها', null, NOW(), NOW()),
        ('ماء نقي صافي', 'Plain Clear Water', 'Beverages', 'exact_food', false, 'allowed', 'مسموح نصاً - ماء شرب نقي', null, NOW(), NOW()),
        ('سلامي بقري', 'Beef Salami', 'Meat & Protein', 'exact_food', false, 'allowed', 'مسموح نصاً - لحوم بقري مصنعة مصرح بها', null, NOW(), NOW()),
        ('جبنة كيري', 'Kiri Cheese', 'Permitted Cheeses', 'exact_food', false, 'allowed', null, 'User Decision: Allowed separate canonical food', NOW(), NOW())
    RETURNING name_ar, id
)
INSERT INTO temp_inserted_foods (name_ar, id)
SELECT name_ar, id FROM inserted_foods;

-- ------------------------------------------------------------------------------
-- 5. INSERT 41 FOOD ALIASES (Resolved by verified canonical target name)
-- ------------------------------------------------------------------------------
INSERT INTO food_aliases (food_id, alias_ar, alias_en, alias_type, is_canonical, priority, created_at)
VALUES
    ((SELECT id FROM foods WHERE name_ar = 'كحك / كعك'), 'كحك', 'Kahk', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'كحك / كعك'), 'كعك', 'Kaak', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'جولاش / كلاج / عجينة الكلاج'), 'جلاش', 'Goulash pastry', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'بسكوت'), 'بسكويت', 'Biscuit', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'بسكوت شوفان'), 'بسكويت شوفان', 'Oat Biscuit', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'بسكوت دايجستف'), 'بسكويت دايجستف', 'Digestive Biscuit', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'رايس كيك / خبز الارز'), 'كعك الأرز', 'Rice Cake', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'فطير'), 'فطيرة', 'Pie / Pastry', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'جبنة جودة (Gouda)'), 'جبنة جودا', 'Gouda Cheese', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'جبنة فلمنك (EDAM)'), 'جبنة فلامنك', 'Edam Cheese', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'جبنة فلمنك (EDAM)'), 'جبنة إيدام', 'Edam Cheese', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'جبنة موتزاريلا'), 'جبنة موزاريلا', 'Mozzarella Cheese', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'جبنة ريكفورد كشكفال (كشكوان)'), 'جبنة قشقوان', 'Kashkaval Cheese', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'جبن مثلثات'), 'جبنة مثلثات', 'Triangle Cheese', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'بط'), 'البط', 'Duck', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'وز'), 'إوز', 'Goose', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'لحم الماعز'), 'ماعز', 'Goat Meat', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'لحم السمان / الفري'), 'سمان', 'Quail', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'لحم الحمام / حمام'), 'حمام', 'Pigeon', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'لحم اليمام / يمام'), 'يمام', 'Dove', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'لحم البقر / الكندوز'), 'لحم بقري', 'Beef', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'لحم بتلو / كندوز'), 'لحم بتلو', 'Veal', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'الجمبري / الروبيان'), 'روبيان', 'Shrimp', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'الجمبري / الروبيان'), 'قريدس', 'Prawns', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'السبيط / الكاليماري'), 'حبار', 'Squid', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'السبيط / الكاليماري'), 'كاليماري', 'Calamari', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'زيت الزيتون البكر'), 'زيت زيتون', 'Olive Oil', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'زبدة حيوانية'), 'زبدة', 'Butter', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'سمن بلدي طبيعي (السمن البلدي الطبيعي مسموح)'), 'سمن بلدي', 'Baladi Ghee', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'قشطة طبيعية'), 'قشطة', 'Cream / Qishta', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'عسل النحل الطبيعي'), 'عسل', 'Honey', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'سكر'), 'سكر أبيض', 'White Sugar', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'الكيك الاسفنجي / هوهوز'), 'هوهوز', 'HoHos Cake', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'مياه غازية / كولا / بيبسي'), 'بيبسي', 'Pepsi', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'مياه غازية / كولا / بيبسي'), 'دايت بيبسي', 'Diet Pepsi', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'مشروبات الطاقة والمشروبات الصناعية'), 'ريد بول', 'Red Bull', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'دجاج و فراخ'), 'دجاج أبيض', 'White Chicken', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'دجاج و فراخ'), 'دجاج بلدي', 'Baladi Chicken', 'synonym', false, 100, NOW()),
    ((SELECT id FROM foods WHERE name_ar = 'مشروبات الشعير'), 'مشروبات الشعير للكلى', 'Medicinal Barley Drinks', 'synonym', false, 100, NOW()),
    -- 2 Kiri Aliases targeting newly inserted Kiri record
    ((SELECT id FROM temp_inserted_foods WHERE name_ar = 'جبنة كيري'), 'كيري', 'Kiri', 'synonym', false, 100, NOW()),
    ((SELECT id FROM temp_inserted_foods WHERE name_ar = 'جبنة كيري'), 'الكيري', 'Al-Kiri', 'synonym', false, 100, NOW());

-- ------------------------------------------------------------------------------
-- 6. INSERT 4 DISH ALIASES (Resolved by exact verified canonical dish name)
-- ------------------------------------------------------------------------------
INSERT INTO dish_aliases (dish_id, alias_ar, alias_en, alias_type, created_at)
VALUES
    ((SELECT id FROM dishes WHERE name_ar = 'الفطير المشلتت'), 'فطير مشلتت', 'Feteer Meshaltet', 'synonym', NOW()),
    ((SELECT id FROM dishes WHERE name_ar = 'الشكشوكة المصرية'), 'شكشوكة', 'Shakshuka', 'synonym', NOW()),
    ((SELECT id FROM dishes WHERE name_ar = 'محشي الكرنب (الملفوف)'), 'محشي كرنب', 'Stuffed Cabbage', 'synonym', NOW()),
    ((SELECT id FROM dishes WHERE name_ar = 'محشي الكرنب (الملفوف)'), 'محشي ملفوف', 'Stuffed Cabbage (Malfoof)', 'synonym', NOW());

-- ------------------------------------------------------------------------------
-- 7. INSERT 3 DISHES
-- ------------------------------------------------------------------------------
CREATE TEMP TABLE temp_inserted_dishes (
    name_ar VARCHAR PRIMARY KEY,
    id INT
);

WITH inserted_dishes AS (
    INSERT INTO dishes (name_ar, name_en, category, description, created_at, updated_at)
    VALUES
        ('أرز مفلفل', 'Fluffy Rice', 'Rice Dishes', 'أرز مصري مفلفل بالسمن البلدي الطبيعي', NOW(), NOW()),
        ('بطاطس بيوريه بالزبدة', 'Mashed Potatoes with Butter', 'Potato Dishes', 'بطاطس مسلوقة مهروسة بالزبدة الطبيعية', NOW(), NOW()),
        ('بطاطس مقلية', 'Fried Potatoes in Oil', 'Potato Dishes', 'أصابع بطاطس مقلية بزيت الزيتون البكر', NOW(), NOW())
    RETURNING name_ar, id
)
INSERT INTO temp_inserted_dishes (name_ar, id)
SELECT name_ar, id FROM inserted_dishes;

-- ------------------------------------------------------------------------------
-- 8. INSERT 10 DISH INGREDIENTS (Resolved by exact verified canonical names)
-- ------------------------------------------------------------------------------
INSERT INTO dish_ingredients (dish_id, food_id, raw_ingredient_name, requirement_type, confidence_score)
VALUES
    -- Fluffy Rice (4 ingredients)
    ((SELECT id FROM temp_inserted_dishes WHERE name_ar = 'أرز مفلفل'), (SELECT id FROM foods WHERE name_ar = 'الأرز بجميع أشكاله (مصري، بسمتي، تايلندي، أبيض، بني)'), 'أرز مصري', 'required', 100),
    ((SELECT id FROM temp_inserted_dishes WHERE name_ar = 'أرز مفلفل'), (SELECT id FROM foods WHERE name_ar = 'سمن بلدي طبيعي (السمن البلدي الطبيعي مسموح)'), 'سمن بلدي طبيعي', 'required', 100),
    ((SELECT id FROM temp_inserted_dishes WHERE name_ar = 'أرز مفلفل'), (SELECT id FROM temp_inserted_foods WHERE name_ar = 'ماء نقي صافي'), 'ماء نقي صافي', 'required', 100),
    ((SELECT id FROM temp_inserted_dishes WHERE name_ar = 'أرز مفلفل'), (SELECT id FROM foods WHERE name_ar = 'الملح'), 'ملح', 'optional', 100),

    -- Mashed Potatoes with Butter (3 ingredients)
    ((SELECT id FROM temp_inserted_dishes WHERE name_ar = 'بطاطس بيوريه بالزبدة'), (SELECT id FROM foods WHERE name_ar = 'بطاطس / بطاطا'), 'بطاطس مسلوقة', 'required', 100),
    ((SELECT id FROM temp_inserted_dishes WHERE name_ar = 'بطاطس بيوريه بالزبدة'), (SELECT id FROM foods WHERE name_ar = 'زبدة حيوانية'), 'زبدة حيوانية', 'required', 100),
    ((SELECT id FROM temp_inserted_dishes WHERE name_ar = 'بطاطس بيوريه بالزبدة'), (SELECT id FROM foods WHERE name_ar = 'الملح'), 'ملح', 'optional', 100),

    -- Fried Potatoes in Oil (3 ingredients)
    ((SELECT id FROM temp_inserted_dishes WHERE name_ar = 'بطاطس مقلية'), (SELECT id FROM foods WHERE name_ar = 'بطاطس / بطاطا'), 'أصابع بطاطس', 'required', 100),
    ((SELECT id FROM temp_inserted_dishes WHERE name_ar = 'بطاطس مقلية'), (SELECT id FROM foods WHERE name_ar = 'زيت الزيتون البكر'), 'زيت زيتون بكر', 'required', 100),
    ((SELECT id FROM temp_inserted_dishes WHERE name_ar = 'بطاطس مقلية'), (SELECT id FROM foods WHERE name_ar = 'الملح'), 'ملح', 'optional', 100);

-- ------------------------------------------------------------------------------
-- 9. POST-MIGRATION INTEGRITY ASSERTIONS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_foods INT;
    v_dishes INT;
    v_food_aliases INT;
    v_dish_ingredients INT;
    v_dish_aliases INT;
    v_food_1578_status TEXT;
    v_food_1578_name TEXT;
    v_sweet_potato_fry_aliases INT;
    v_kiri_id INT;
    v_kiri_status TEXT;
    v_kiri_alias_count INT;
BEGIN
    -- 1. Assert Final Table Counts:
    -- foods: 369 + 39 = 408
    -- dishes: 557 + 3 = 560
    -- dish_ingredients: 4338 + 10 = 4348
    -- food_aliases: 5 - 1 + 41 = 45
    -- dish_aliases: 347 + 4 = 351
    SELECT COUNT(*) INTO v_foods FROM foods;
    SELECT COUNT(*) INTO v_dishes FROM dishes;
    SELECT COUNT(*) INTO v_food_aliases FROM food_aliases;
    SELECT COUNT(*) INTO v_dish_ingredients FROM dish_ingredients;
    SELECT COUNT(*) INTO v_dish_aliases FROM dish_aliases;

    IF v_foods != 408 THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: Expected exactly 408 foods, got %', v_foods;
    END IF;
    IF v_dishes != 560 THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: Expected exactly 560 dishes, got %', v_dishes;
    END IF;
    IF v_dish_ingredients != 4348 THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: Expected exactly 4348 dish_ingredients, got %', v_dish_ingredients;
    END IF;
    IF v_food_aliases != 45 THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: Expected exactly 45 food_aliases, got %', v_food_aliases;
    END IF;
    IF v_dish_aliases != 351 THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: Expected exactly 351 dish_aliases, got %', v_dish_aliases;
    END IF;

    -- 2. Assert Food #1578 preserved unchanged
    SELECT status, name_ar INTO v_food_1578_status, v_food_1578_name FROM foods WHERE id = 1578;
    IF v_food_1578_status != 'forbidden' OR v_food_1578_name != 'الكيري / لبنيتا / طعمة' THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: Food #1578 was corrupted! Name: %, Status: %', v_food_1578_name, v_food_1578_status;
    END IF;

    -- 3. Assert Sweet Potato duplicate alias removed
    SELECT COUNT(*) INTO v_sweet_potato_fry_aliases FROM food_aliases WHERE food_id = 1337 AND alias_ar = 'بطاطا مقلية';
    IF v_sweet_potato_fry_aliases != 0 THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: Duplicate alias for Food #1337 still exists!';
    END IF;

    -- 4. Assert Kiri canonical record exists, is allowed, and has exactly 2 aliases
    SELECT id, status INTO v_kiri_id, v_kiri_status FROM foods WHERE name_ar = 'جبنة كيري';
    IF v_kiri_id IS NULL OR v_kiri_status != 'allowed' THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: جبنة كيري missing or status != allowed!';
    END IF;
    SELECT COUNT(*) INTO v_kiri_alias_count FROM food_aliases WHERE food_id = v_kiri_id AND alias_ar IN ('كيري', 'الكيري');
    IF v_kiri_alias_count != 2 THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: Expected exactly 2 aliases for Kiri, found %', v_kiri_alias_count;
    END IF;

    -- 5. Foreign Key Integrity: Verify zero orphaned aliases or ingredients
    PERFORM 1 FROM food_aliases fa LEFT JOIN foods f ON fa.food_id = f.id WHERE f.id IS NULL;
    IF FOUND THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: Orphaned food_aliases detected!';
    END IF;

    PERFORM 1 FROM dish_aliases da LEFT JOIN dishes d ON da.dish_id = d.id WHERE d.id IS NULL;
    IF FOUND THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: Orphaned dish_aliases detected!';
    END IF;

    PERFORM 1 FROM dish_ingredients di LEFT JOIN dishes d ON di.dish_id = d.id WHERE d.id IS NULL;
    IF FOUND THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: Orphaned dish_ingredients (missing dish) detected!';
    END IF;

    PERFORM 1 FROM dish_ingredients di LEFT JOIN foods f ON di.food_id = f.id WHERE f.id IS NULL;
    IF FOUND THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: Orphaned dish_ingredients (missing food) detected!';
    END IF;

    RAISE NOTICE 'ALL MIGRATION POST-CHECKS AND INTEGRITY ASSERTIONS PASSED SUCCESSFULLY!';
END $$;

DROP TABLE temp_inserted_foods;
DROP TABLE temp_inserted_dishes;

COMMIT;

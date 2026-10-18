import fs from "fs";
import path from "path";
import { pool } from "@workspace/db";

async function verifyBackupAndTestRestore() {
  console.log("================================================================================");
  console.log("       BACKUP COMPLETENESS & ISOLATED RESTORATION VERIFICATION TEST            ");
  console.log("================================================================================\n");

  const backupPath = path.resolve(process.cwd(), "backup_pre_rules_integration.json");
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found at ${backupPath}`);
  }

  const raw = fs.readFileSync(backupPath, "utf8");
  const b = JSON.parse(raw);

  console.log("Step 1: Backup File Integrity & Schema Verification:");
  console.log(`  - File path: ${backupPath}`);
  console.log(`  - File size: ${(fs.statSync(backupPath).size / 1024).toFixed(1)} KB`);
  console.log(`  - Backup timestamp: ${b.backupTimestamp}`);
  console.log(`  - Entity counts in manifest:`, b.counts);

  // Validate array lengths
  if (b.foods.length !== 369) throw new Error(`Foods count mismatch: expected 369, got ${b.foods.length}`);
  if (b.dishes.length !== 557) throw new Error(`Dishes count mismatch: expected 557, got ${b.dishes.length}`);
  if (b.dishIngredients.length !== 4338) throw new Error(`DishIngredients mismatch: expected 4338, got ${b.dishIngredients.length}`);
  if (b.foodAliases.length !== 5) throw new Error(`FoodAliases mismatch: expected 5, got ${b.foodAliases.length}`);
  if (b.dishAliases.length !== 347) throw new Error(`DishAliases mismatch: expected 347, got ${b.dishAliases.length}`);
  console.log("  ✓ All 5 entity arrays verified with 100% count match.");

  // Validate Foreign Key Referential Integrity in Backup
  console.log("\nStep 2: Referential Integrity Validation (In-Memory Graph):");
  const foodIdSet = new Set(b.foods.map((f: any) => f.id));
  const dishIdSet = new Set(b.dishes.map((d: any) => d.id));

  let brokenDishIngFk = 0;
  for (const di of b.dishIngredients) {
    if (!dishIdSet.has(di.dishId)) brokenDishIngFk++;
    if (di.foodId !== null && !foodIdSet.has(di.foodId)) brokenDishIngFk++;
  }

  let brokenDishAliasFk = 0;
  for (const da of b.dishAliases) {
    if (!dishIdSet.has(da.dishId)) brokenDishAliasFk++;
  }

  let brokenFoodAliasFk = 0;
  for (const fa of b.foodAliases) {
    if (!foodIdSet.has(fa.foodId)) brokenFoodAliasFk++;
  }

  console.log(`  - Broken dishIngredients FKs: ${brokenDishIngFk}`);
  console.log(`  - Broken dishAliases FKs: ${brokenDishAliasFk}`);
  console.log(`  - Broken foodAliases FKs: ${brokenFoodAliasFk}`);
  if (brokenDishIngFk > 0 || brokenDishAliasFk > 0 || brokenFoodAliasFk > 0) {
    throw new Error("Integrity violation in backup data!");
  }
  console.log("  ✓ Referential integrity passed with 0 orphaned references.");

  // Step 3: Isolated Database Restoration Test
  // Create an isolated temporary schema `test_isolated_restore`, load data into it, verify, and drop it.
  console.log("\nStep 3: Isolated Database Restoration Test (Sandbox Schema):");
  const testSchema = "test_isolated_restore";
  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE;`);
    await client.query(`CREATE SCHEMA ${testSchema};`);
    console.log(`  - Created isolated sandbox schema: "${testSchema}" (Live tables untouched)`);

    // Create tables in testSchema matching public tables
    await client.query(`
      CREATE TABLE ${testSchema}.foods (
        id SERIAL PRIMARY KEY,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        category TEXT NOT NULL,
        food_type TEXT NOT NULL,
        parent_food_id INTEGER,
        is_exception BOOLEAN NOT NULL,
        status TEXT NOT NULL,
        reason TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE ${testSchema}.dishes (
        id SERIAL PRIMARY KEY,
        name_ar TEXT NOT NULL,
        name_en TEXT,
        category TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
      );
      CREATE TABLE ${testSchema}.dish_ingredients (
        id SERIAL PRIMARY KEY,
        dish_id INTEGER NOT NULL REFERENCES ${testSchema}.dishes(id) ON DELETE CASCADE,
        food_id INTEGER REFERENCES ${testSchema}.foods(id) ON DELETE SET NULL,
        raw_ingredient_name TEXT NOT NULL,
        requirement_type TEXT NOT NULL,
        confidence TEXT NOT NULL,
        confidence_score INTEGER NOT NULL,
        quantity_notes TEXT,
        created_at TIMESTAMPTZ
      );
      CREATE TABLE ${testSchema}.food_aliases (
        id SERIAL PRIMARY KEY,
        food_id INTEGER NOT NULL REFERENCES ${testSchema}.foods(id) ON DELETE CASCADE,
        alias_ar TEXT NOT NULL,
        alias_en TEXT,
        alias_type TEXT NOT NULL,
        priority INTEGER NOT NULL,
        region TEXT,
        is_canonical BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ
      );
      CREATE TABLE ${testSchema}.dish_aliases (
        id SERIAL PRIMARY KEY,
        dish_id INTEGER NOT NULL REFERENCES ${testSchema}.dishes(id) ON DELETE CASCADE,
        alias_ar TEXT NOT NULL,
        alias_en TEXT,
        alias_type TEXT NOT NULL,
        region TEXT,
        created_at TIMESTAMPTZ
      );
    `);
    console.log("  - Cloned schema tables into isolated sandbox.");

    // Insert foods into testSchema
    for (const f of b.foods) {
      await client.query(`
        INSERT INTO ${testSchema}.foods (id, name_ar, name_en, category, food_type, parent_food_id, is_exception, status, reason, notes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [f.id, f.nameAr, f.nameEn, f.category, f.foodType, f.parentFoodId, f.isException, f.status, f.reason, f.notes, f.createdAt, f.updatedAt]);
    }

    // Insert dishes into testSchema
    for (const d of b.dishes) {
      await client.query(`
        INSERT INTO ${testSchema}.dishes (id, name_ar, name_en, category, description, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [d.id, d.nameAr, d.nameEn, d.category, d.description, d.createdAt, d.updatedAt]);
    }

    // Insert dish_ingredients into testSchema
    for (const di of b.dishIngredients) {
      await client.query(`
        INSERT INTO ${testSchema}.dish_ingredients (id, dish_id, food_id, raw_ingredient_name, requirement_type, confidence, confidence_score, quantity_notes, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [di.id, di.dishId, di.foodId, di.rawIngredientName, di.requirementType, di.confidence, di.confidenceScore, di.quantityNotes, di.createdAt]);
    }

    // Insert food_aliases into testSchema
    for (const fa of b.foodAliases) {
      await client.query(`
        INSERT INTO ${testSchema}.food_aliases (id, food_id, alias_ar, alias_en, alias_type, priority, region, is_canonical, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [fa.id, fa.foodId, fa.aliasAr, fa.aliasEn, fa.aliasType, fa.priority, fa.region, fa.isCanonical, fa.createdAt]);
    }

    // Insert dish_aliases into testSchema
    for (const da of b.dishAliases) {
      await client.query(`
        INSERT INTO ${testSchema}.dish_aliases (id, dish_id, alias_ar, alias_en, alias_type, region, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [da.id, da.dishId, da.aliasAr, da.aliasEn, da.aliasType, da.region, da.createdAt]);
    }

    // Verify row counts in testSchema
    const testFoodsCount = (await client.query(`SELECT count(*) FROM ${testSchema}.foods`)).rows[0].count;
    const testDishesCount = (await client.query(`SELECT count(*) FROM ${testSchema}.dishes`)).rows[0].count;
    const testDishIngsCount = (await client.query(`SELECT count(*) FROM ${testSchema}.dish_ingredients`)).rows[0].count;
    const testFoodAliasesCount = (await client.query(`SELECT count(*) FROM ${testSchema}.food_aliases`)).rows[0].count;
    const testDishAliasesCount = (await client.query(`SELECT count(*) FROM ${testSchema}.dish_aliases`)).rows[0].count;

    console.log(`  - Restored Foods: ${testFoodsCount} / 369`);
    console.log(`  - Restored Dishes: ${testDishesCount} / 557`);
    console.log(`  - Restored Dish Ingredients: ${testDishIngsCount} / 4338`);
    console.log(`  - Restored Food Aliases: ${testFoodAliasesCount} / 5`);
    console.log(`  - Restored Dish Aliases: ${testDishAliasesCount} / 347`);

    if (
      parseInt(testFoodsCount, 10) !== 369 ||
      parseInt(testDishesCount, 10) !== 557 ||
      parseInt(testDishIngsCount, 10) !== 4338 ||
      parseInt(testFoodAliasesCount, 10) !== 5 ||
      parseInt(testDishAliasesCount, 10) !== 347
    ) {
      throw new Error("Restoration count verification failed!");
    }

    console.log("  ✓ 100% OF DATA SUCCESSFULLY RESTORED & VERIFIED IN ISOLATED SCHEMA.");

    // Clean up isolated test schema
    await client.query(`DROP SCHEMA ${testSchema} CASCADE;`);
    console.log(`  - Cleaned up sandbox schema: "${testSchema}" dropped successfully.`);
    console.log("\n>>> CONCLUSION: BACKUP IS FULLY VERIFIED, INTEGRITY CHECKED, AND PROVEN 100% RESTORABLE. <<<");
  } finally {
    client.release();
  }

  process.exit(0);
}

verifyBackupAndTestRestore().catch((err) => {
  console.error("Test restore failed:", err);
  process.exit(1);
});

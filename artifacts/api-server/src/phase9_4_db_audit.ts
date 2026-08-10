import { db, foodsTable, foodAliases } from "@workspace/db";
import { like, or } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function runPhase94Audit() {
  console.log("=========================================================================");
  console.log("PHASE 9.4 DATABASE AUDIT: RICE ENTITIES & ALIAS CANONICALIZATION");
  console.log("=========================================================================\n");

  // PART 1: VERIFY MIGRATION FILE
  const projectRoot = path.resolve(process.cwd());
  const migrationPath = path.resolve(projectRoot, "src/migrations/0004_rice_aliases_migration.sql");
  const fileExists = fs.existsSync(migrationPath);

  console.log("--- PART 1: MIGRATION FILE AUDIT ---");
  console.log(`Migration Filename: 0004_rice_aliases_migration.sql`);
  console.log(`Migration Location: ${migrationPath}`);
  console.log(`File Exists: ${fileExists ? "YES ✅" : "NO ❌"}`);
  console.log(`Execution Method: Executed via src/runRiceAliasesMigration.ts against PostgreSQL db`);

  // PART 2: ACTIVE DATABASE RICE ALIASES
  console.log("\n--- PART 2: ACTIVE DATABASE RICE ALIASES (food_aliases) ---");
  const riceAliases = await db
    .select({
      foodId: foodAliases.foodId,
      aliasAr: foodAliases.aliasAr,
      aliasEn: foodAliases.aliasEn,
    })
    .from(foodAliases)
    .where(
      or(
        like(foodAliases.aliasAr, "%رز%"),
        like(foodAliases.aliasAr, "%أرز%")
      )
    );

  console.log(`Total Rice Aliases in DB: ${riceAliases.length}`);
  console.table(riceAliases);

  // PART 3: CANONICAL FOODS TABLE
  console.log("\n--- PART 3: CANONICAL FOODS TABLE (foods) ---");
  const riceFoods = await db
    .select({
      id: foodsTable.id,
      nameAr: foodsTable.nameAr,
      nameEn: foodsTable.nameEn,
      status: foodsTable.status,
    })
    .from(foodsTable)
    .where(
      or(
        like(foodsTable.nameAr, "%رز%"),
        like(foodsTable.nameAr, "%أرز%")
      )
    );

  console.log(`Total Rice Foods in DB: ${riceFoods.length}`);
  console.table(riceFoods);

  // PART 4: DETECT DUPLICATE CANONICAL ENTITIES
  console.log("\n--- PART 4: DUPLICATE CANONICAL ENTITY ANALYSIS ---");
  const primaryRiceEntities = riceFoods.filter(f => f.nameAr.includes("أرز") || f.nameAr.includes("الأرز"));
  console.log(`Found ${primaryRiceEntities.length} Rice Canonical Entities in Foods table:`);
  primaryRiceEntities.forEach(f => {
    console.log(` - ID: ${f.id} | Name (Ar): ${f.nameAr} | Name (En): ${f.nameEn}`);
  });

  // PART 5: ALIAS MAPPER BY CANONICAL FOOD ID
  console.log("\n--- PART 5: ALIAS MAPPING BY CANONICAL FOOD ID ---");
  const targetAliases = [
    "رز مصري", "أرز مصري",
    "رز أبيض", "أرز أبيض",
    "رز بني", "أرز بني",
    "رز بسمتي", "أرز بسمتي",
    "رز تايلندي", "أرز تايلندي"
  ];

  const aliasMappings = [];
  for (const alias of targetAliases) {
    const matched = riceAliases.filter(a => a.aliasAr === alias);
    if (matched.length > 0) {
      for (const m of matched) {
        const canonical = riceFoods.find(f => f.id === m.foodId);
        aliasMappings.push({
          alias: m.aliasAr,
          foodId: m.foodId,
          canonicalName: canonical ? canonical.nameAr : "UNKNOWN",
        });
      }
    } else {
      aliasMappings.push({
        alias,
        foodId: "MISSING",
        canonicalName: "NONE",
      });
    }
  }
  console.table(aliasMappings);

  // PART 6: INCONSISTENCY CHECK
  console.log("\n--- PART 6: CANONICAL CONSISTENCY VALIDATION ---");
  const uniqueFoodIds = Array.from(new Set(aliasMappings.map(a => a.foodId)));
  console.log(`Unique Food IDs linked to Rice Aliases: [${uniqueFoodIds.join(", ")}]`);

  if (uniqueFoodIds.length > 1) {
    console.log("⚠️ INCONSISTENCY DETECTED: Rice aliases are split across multiple Food IDs:", uniqueFoodIds);
  } else {
    console.log("✅ CONSISTENCY CONFIRMED: All rice aliases point to single Food ID:", uniqueFoodIds[0]);
  }
}

runPhase94Audit().catch(console.error);

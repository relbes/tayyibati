import { db, foodsTable, foodAliases } from "@workspace/db";
import { like, or } from "drizzle-orm";

async function inspectRiceDatabase() {
  console.log("=========================================================");
  console.log("INSPECTING RICE ENTRIES IN FOODS AND FOOD_ALIASES TABLES");
  console.log("=========================================================\n");

  // 1. Find all foods matching 'أرز', 'ارز', 'رز'
  const riceFoods = await db
    .select()
    .from(foodsTable)
    .where(
      or(
        like(foodsTable.nameAr, "%أرز%"),
        like(foodsTable.nameAr, "%ارز%"),
        like(foodsTable.nameAr, "%رز%")
      )
    );

  console.log(`Found ${riceFoods.length} rice canonical food entries in 'foods' table:`);
  console.table(
    riceFoods.map((f) => ({
      id: f.id,
      nameAr: f.nameAr,
      nameEn: f.nameEn,
      category: f.category,
      status: f.status,
    }))
  );

  // 2. Find all aliases matching rice or linked to those foods
  const foodIds = riceFoods.map((f) => f.id);
  const riceAliases = await db
    .select()
    .from(foodAliases)
    .where(
      or(
        like(foodAliases.aliasAr, "%أرز%"),
        like(foodAliases.aliasAr, "%ارز%"),
        like(foodAliases.aliasAr, "%رز%"),
        like(foodAliases.aliasAr, "%مصري%"),
        like(foodAliases.aliasAr, "%بسمتي%")
      )
    );

  console.log(`\nFound ${riceAliases.length} rice-related entries in 'food_aliases' table:`);
  console.table(
    riceAliases.map((a) => ({
      id: a.id,
      foodId: a.foodId,
      aliasAr: a.aliasAr,
      aliasEn: a.aliasEn,
      isPrimary: a.isPrimary,
    }))
  );
}

inspectRiceDatabase().catch(console.error);

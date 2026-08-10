import { db, foodsTable, foodAliases } from "@workspace/db";
import { like, or } from "drizzle-orm";

async function findJamidSpices() {
  console.log("=== FOODS TABLE SEARCH FOR جميد ===");
  const jamidFoods = await db.select().from(foodsTable).where(like(foodsTable.nameAr, "%جميد%"));
  console.log(jamidFoods);

  console.log("=== FOOD ALIASES SEARCH FOR جميد ===");
  const jamidAliases = await db.select().from(foodAliases).where(like(foodAliases.aliasAr, "%جميد%"));
  console.log(jamidAliases);

  console.log("=== FOODS TABLE SEARCH FOR بهار ===");
  const spiceFoods = await db.select().from(foodsTable).where(or(like(foodsTable.nameAr, "%بهار%"), like(foodsTable.nameAr, "%توابل%")));
  console.log(spiceFoods);

  console.log("=== FOOD ALIASES SEARCH FOR بهار ===");
  const spiceAliases = await db.select().from(foodAliases).where(or(like(foodAliases.aliasAr, "%بهار%"), like(foodAliases.aliasAr, "%توابل%")));
  console.log(spiceAliases);
}

findJamidSpices().catch(console.error);

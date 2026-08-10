import { db, foodsTable, foodAliases } from "@workspace/db";
import { eq, like, or } from "drizzle-orm";
import { normalize } from "./lib/arabicNormalization";

async function seedRealDatabaseEntities() {
  console.log("=========================================================");
  console.log("CHECKING & SEEDING REAL DB RECORDS IN POSTGRESQL");
  console.log("=========================================================");

  // 1. Check Jamid
  const jamidRows = await db.select().from(foodsTable).where(like(foodsTable.nameAr, "%جميد%"));
  let jamidFoodId: number;

  if (jamidRows.length === 0) {
    console.log("[DB SEED] Inserting real food entry for 'الجميد'...");
    const [inserted] = await db.insert(foodsTable).values({
      nameAr: "الجميد السائل والجاف",
      nameEn: "Jameed",
      category: "ألبان وأجبان تقليدية",
      status: "allowed",
      reason: "مكون مسموح وطبيعي",
    }).returning();
    jamidFoodId = inserted.id;
    console.log(`[DB SEED] Inserted food ID: ${jamidFoodId}`);

    // Insert Aliases
    await db.insert(foodAliases).values([
      { foodId: jamidFoodId, aliasAr: "جميد", aliasEn: "Jameed", isPrimary: true },
      { foodId: jamidFoodId, aliasAr: "الجميد", aliasEn: "Al-Jameed", isPrimary: false },
      { foodId: jamidFoodId, aliasAr: "جميد كركي", aliasEn: "Karaki Jameed", isPrimary: false },
    ]);
    console.log("[DB SEED] Inserted aliases for الجميد.");
  } else {
    jamidFoodId = jamidRows[0].id;
    console.log(`[DB SEED] 'الجميد' already exists in DB with food ID ${jamidFoodId}`);
  }

  // 2. Check Spices
  const spiceRows = await db.select().from(foodsTable).where(or(like(foodsTable.nameAr, "%بهارات%"), like(foodsTable.nameAr, "%توابل%")));
  let spiceFoodId: number;

  if (spiceRows.length === 0) {
    console.log("[DB SEED] Inserting real food entry for 'البهارات والتوابل'...");
    const [inserted] = await db.insert(foodsTable).values({
      nameAr: "البهارات والتوابل المشكلة",
      nameEn: "Spices & Seasoning",
      category: "توابل وبهارات",
      status: "allowed",
      reason: "مكون مسموح وطبيعي",
    }).returning();
    spiceFoodId = inserted.id;
    console.log(`[DB SEED] Inserted food ID: ${spiceFoodId}`);

    // Insert Aliases
    await db.insert(foodAliases).values([
      { foodId: spiceFoodId, aliasAr: "بهارات", aliasEn: "Spices", isPrimary: true },
      { foodId: spiceFoodId, aliasAr: "البهارات", aliasEn: "Al-Spices", isPrimary: false },
      { foodId: spiceFoodId, aliasAr: "توابل", aliasEn: "Seasoning", isPrimary: false },
    ]);
    console.log("[DB SEED] Inserted aliases for البهارات والتوابل.");
  } else {
    spiceFoodId = spiceRows[0].id;
    console.log(`[DB SEED] 'البهارات' already exists in DB with food ID ${spiceFoodId}`);
  }

  // 3. Ensure base alias "خبز" exists for Bread (Food ID 117 or similar)
  const khubzFoods = await db.select().from(foodsTable).where(like(foodsTable.nameAr, "%الخبز العادي%"));
  if (khubzFoods.length > 0) {
    const kId = khubzFoods[0].id;
    const khubzAlias = await db.select().from(foodAliases).where(eq(foodAliases.aliasAr, "خبز"));
    if (khubzAlias.length === 0) {
      await db.insert(foodAliases).values({ foodId: kId, aliasAr: "خبز", aliasEn: "Bread", isPrimary: true });
      console.log(`[DB SEED] Inserted real DB alias 'خبز' -> foodId ${kId}`);
    }
  }

  // 4. Ensure base alias "أرز" / "ارز" exists for Rice (Food ID 40 or similar)
  const riceFoods = await db.select().from(foodsTable).where(like(foodsTable.nameAr, "%الأرز%"));
  if (riceFoods.length > 0) {
    const rId = riceFoods[0].id;
    const riceAlias = await db.select().from(foodAliases).where(eq(foodAliases.aliasAr, "ارز"));
    if (riceAlias.length === 0) {
      await db.insert(foodAliases).values({ foodId: rId, aliasAr: "أرز", aliasEn: "Rice", isPrimary: true });
      console.log(`[DB SEED] Inserted real DB alias 'أرز' -> foodId ${rId}`);
    }
  }

  console.log("=========================================================");
  console.log("DB SEED COMPLETE. All records exist in PostgreSQL DB.");
  console.log("=========================================================");
}

seedRealDatabaseEntities().catch(console.error);

import { db, dishes, dishAliases } from "@workspace/db";
import { eq, like } from "drizzle-orm";
import { normalize } from "./lib/arabicNormalization";

async function seedShawarmaAlias() {
  console.log("[DB SEED] Checking dish alias 'شاورما عربي' in PostgreSQL...");

  // Find Shawarma dish
  let shawarmaRows = await db.select().from(dishes).where(like(dishes.nameAr, "%شاورما%"));
  let shawarmaDishId: number;

  if (shawarmaRows.length === 0) {
    console.log("[DB SEED] Inserting dish entry for 'شاورما'...");
    const [inserted] = await db.insert(dishes).values({
      nameAr: "شاورما",
      nameEn: "Shawarma",
      category: "أطباق رئيسية",
    }).returning();
    shawarmaDishId = inserted.id;
  } else {
    shawarmaDishId = shawarmaRows[0].id;
  }

  // Check alias
  const existingAlias = await db.select().from(dishAliases).where(eq(dishAliases.aliasAr, "شاورما عربي"));
  if (existingAlias.length === 0) {
    await db.insert(dishAliases).values({
      dishId: shawarmaDishId,
      aliasAr: "شاورما عربي",
      aliasEn: "Arabic Shawarma",
    });
    console.log(`[DB SEED] Inserted alias 'شاورما عربي' -> dishId ${shawarmaDishId}`);
  } else {
    console.log(`[DB SEED] Alias 'شاورما عربي' already exists for dishId ${shawarmaDishId}`);
  }
}

seedShawarmaAlias().catch(console.error);

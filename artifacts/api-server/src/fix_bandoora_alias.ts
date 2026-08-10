import { db, foodsTable, foodAliases } from "@workspace/db";
import { eq } from "drizzle-orm";

async function fixBandooraAlias() {
  console.log("[DB FIX] Creating/verifying generic 'الطماطم' food entity...");
  const tomatoFoods = await db.select().from(foodsTable).where(eq(foodsTable.nameAr, "الطماطم"));
  let genericTomatoId: number;

  if (tomatoFoods.length > 0) {
    genericTomatoId = tomatoFoods[0].id;
  } else {
    const [ins] = await db.insert(foodsTable).values({
      nameAr: "الطماطم",
      nameEn: "Tomato",
      category: "خضار طازجة",
      status: "allowed",
      reason: "خضار مسموحة وطازجة",
    }).returning();
    genericTomatoId = ins.id;
  }

  console.log(`[DB FIX] Generic Tomato Food ID: ${genericTomatoId}`);

  // Set foodAlias 'بندورة' -> genericTomatoId
  await db.delete(foodAliases).where(eq(foodAliases.aliasAr, "بندورة"));
  await db.insert(foodAliases).values({
    foodId: genericTomatoId,
    aliasAr: "بندورة",
    aliasEn: "Tomato",
    isPrimary: false,
  });

  console.log(`[DB FIX] Successfully set foodAlias 'بندورة' -> generic food 'الطماطم' (foodId ${genericTomatoId})`);
}

fixBandooraAlias().catch(console.error);

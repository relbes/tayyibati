import { db, dishes, dishAliases } from "@workspace/db";
import { eq, like } from "drizzle-orm";

async function fixShawarmaAliasDishId() {
  console.log("[DB FIX] Finding standalone Shawarma dish...");
  const shawarmaDishes = await db.select().from(dishes).where(eq(dishes.nameAr, "شاورما"));
  
  let targetDishId: number;
  if (shawarmaDishes.length > 0) {
    targetDishId = shawarmaDishes[0].id;
    console.log(`[DB FIX] Found standalone Shawarma dish ID: ${targetDishId}`);
  } else {
    const [ins] = await db.insert(dishes).values({
      nameAr: "شاورما",
      nameEn: "Shawarma",
      category: "أطباق رئيسية",
    }).returning();
    targetDishId = ins.id;
    console.log(`[DB FIX] Created standalone Shawarma dish ID: ${targetDishId}`);
  }

  // Update alias 'شاورما عربي' to point to standalone Shawarma dish ID
  await db.update(dishAliases)
    .set({ dishId: targetDishId })
    .where(eq(dishAliases.aliasAr, "شاورما عربي"));

  console.log(`[DB FIX] Updated alias 'شاورما عربي' -> dishId ${targetDishId}`);
}

fixShawarmaAliasDishId().catch(console.error);

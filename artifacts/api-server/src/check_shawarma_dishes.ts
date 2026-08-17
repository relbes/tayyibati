import { db, dishIngredients } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  console.log("=== RUNNING SHAWARMA INGREDIENTS DATABASE UPDATE ===");
  
  // Print current ingredients
  const currentBefore = await db.select().from(dishIngredients).where(eq(dishIngredients.dishId, 1111));
  console.log("Current ingredients before update for dish 1111:", currentBefore.map(c => c.rawIngredientName));

  console.log("Deleting old ingredients for dish 1111 (شاورما)...");
  await db.delete(dishIngredients).where(eq(dishIngredients.dishId, 1111));

  console.log("Inserting new ingredients for dish 1111 (شاورما)...");
  await db.insert(dishIngredients).values([
    { dishId: 1111, rawIngredientName: "دجاج", requirementType: "required", foodId: null },
    { dishId: 1111, rawIngredientName: "لحم", requirementType: "required", foodId: null },
    { dishId: 1111, rawIngredientName: "ثوم", requirementType: "typical", foodId: null },
    { dishId: 1111, rawIngredientName: "طحينة", requirementType: "typical", foodId: null },
    { dishId: 1111, rawIngredientName: "مخلل", requirementType: "typical", foodId: null },
    { dishId: 1111, rawIngredientName: "خبز", requirementType: "required", foodId: null },
  ]);
  
  const currentAfter = await db.select().from(dishIngredients).where(eq(dishIngredients.dishId, 1111));
  console.log("Current ingredients after update for dish 1111:", currentAfter.map(c => c.rawIngredientName));
  console.log("Database update completed successfully!");
}

main().catch(console.error);

import { db, foodsTable, foodAliases } from "@workspace/db";
import { ilike } from "drizzle-orm";

async function main() {
  console.log("=== INSPECTING ALL BREAD FOODS IN DATABASE ===");
  const foods = await db.select().from(foodsTable).where(ilike(foodsTable.nameAr, "%خبز%"));
  console.log("Foods containing 'خبز':");
  foods.forEach(f => console.log(`ID: ${f.id} | nameAr: "${f.nameAr}" | status: "${f.status}" | reason: "${f.reason}"`));

  const aliases = await db.select().from(foodAliases).where(ilike(foodAliases.aliasAr, "%خبز%"));
  console.log("\nAliases containing 'خبز':");
  aliases.forEach(a => console.log(`ID: ${a.id} | foodId: ${a.foodId} | aliasAr: "${a.aliasAr}"`));
}

main().catch(console.error);

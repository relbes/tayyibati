import { db, foodsTable, foodAliasesTable } from "@workspace/db";
import { ilike } from "drizzle-orm";

async function main() {
  console.log("=== FOODS CONTAINING 'خبز' ===");
  const foods = await db.select().from(foodsTable).where(
    ilike(foodsTable.nameAr, "%خبز%")
  );
  for (const f of foods) {
    console.log(`Food ID: ${f.id} | nameAr: "${f.nameAr}" | nameEn: "${f.nameEn}" | status: "${f.status}"`);
  }

  console.log("\n=== ALIASES CONTAINING 'خبز' ===");
  const aliases = await db.select().from(foodAliasesTable).where(
    ilike(foodAliasesTable.aliasAr, "%خبز%")
  );
  for (const a of aliases) {
    console.log(`Alias ID: ${a.id} | aliasAr: "${a.aliasAr}" | aliasEn: "${a.aliasEn}" | foodId: ${a.foodId}`);
  }
}

main().catch(console.error);

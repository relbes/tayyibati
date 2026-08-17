import { db, foodsTable } from "@workspace/db";
import { ilike, or } from "drizzle-orm";

async function main() {
  const terms = ["خبز", "جبن", "زيت", "لحم", "أرز"];
  for (const term of terms) {
    const matches = await db.select().from(foodsTable).where(ilike(foodsTable.nameAr, `%${term}%`));
    console.log(`\n=== Term: ${term} ===`);
    console.log(matches.map(m => `ID: ${m.id} | Name: ${m.nameAr} | Status: ${m.status} | Parent: ${m.parentFoodId}`));
  }
}

main().catch(console.error);

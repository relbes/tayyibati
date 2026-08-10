import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Running Phase 7b: Linking exceptions to parent categories...");

  // Bread parent ID: 117
  // Breads: 1, 2, 8, 118 (Rich Bake)
  await db.execute(sql`
    UPDATE foods 
    SET parent_food_id = 117,
        is_exception = CASE WHEN id = 118 THEN true ELSE false END
    WHERE id IN (1, 2, 8, 118);
  `);

  // Milk parent ID: 119
  // Milk: 32
  await db.execute(sql`
    UPDATE foods 
    SET parent_food_id = 119
    WHERE id IN (32);
  `);

  console.log("Linkages completed.");
}

main().catch(console.error);

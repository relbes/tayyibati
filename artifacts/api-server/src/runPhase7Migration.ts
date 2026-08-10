import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Running Phase 7: Marking general_category foods...");

  // Update foods that contain "بجميع أنواعه" or "all types"
  const result = await db.execute(sql`
    UPDATE foods 
    SET food_type = 'general_category'
    WHERE name_ar ILIKE '%بجميع أنواعه%' 
       OR name_en ILIKE '%all types%'
       OR name_ar ILIKE '%العادي%'
    RETURNING id, name_ar, name_en, food_type;
  `);

  console.log(`Updated ${result.rowCount} records:`);
  console.table(result.rows);
}

main().catch(console.error);

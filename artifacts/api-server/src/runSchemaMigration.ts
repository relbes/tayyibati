import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Running manual schema migration...");
  
  // 1. Add parent_entity_id to food_entities
  await db.execute(sql`ALTER TABLE food_entities ADD COLUMN IF NOT EXISTS parent_entity_id integer REFERENCES food_entities(id) ON DELETE SET NULL;`);
  
  // 2. Add columns to foods table
  // We need to temporarily disable the check or just add them
  await db.execute(sql`
    ALTER TABLE foods ADD COLUMN IF NOT EXISTS food_type text DEFAULT 'exact_food' NOT NULL;
    ALTER TABLE foods ADD COLUMN IF NOT EXISTS parent_food_id integer REFERENCES foods(id) ON DELETE SET NULL;
    ALTER TABLE foods ADD COLUMN IF NOT EXISTS is_exception boolean NOT NULL DEFAULT false;
  `);

  console.log("Migration applied successfully.");
}

main().catch(err => {
  console.error("MIGRATION_ERROR", err);
  process.exit(1);
});

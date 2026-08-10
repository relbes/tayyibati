import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adding Milk Entity and Aliases...");

  // Get food_id = 117 (Milk general) and 32 (Specific forbidden milk)
  const result = await db.execute(sql`
    SELECT id, name_en FROM foods WHERE name_en ILIKE '%Milk%';
  `);
  console.log("Milk foods:", result.rows);

  // Insert Milk entity (id=32)
  const insertEntity = await db.execute(sql`
    INSERT INTO food_entities (name_ar, name_en, type, attributes, food_id)
    VALUES ('حليب', 'Milk', 'ingredient', '{"liquid": true, "dairy": true}', 32)
    RETURNING id;
  `);
  
  const milkEntityId = insertEntity.rows[0].id;
  console.log("Created Milk Entity with ID:", milkEntityId);

  // Insert aliases
  await db.execute(sql`
    INSERT INTO food_aliases (entity_id, alias_ar, alias_en)
    VALUES 
      (${milkEntityId}, 'لبن', 'Laban'),
      (${milkEntityId}, 'حليب البقر', 'Cow Milk'),
      (${milkEntityId}, 'لبن جاموسي', 'Buffalo Milk');
  `);

  console.log("Milk entity and aliases added.");
}

main().catch(console.error);

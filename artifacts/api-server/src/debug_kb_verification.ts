import { db, foodsTable } from "@workspace/db";
import { or, eq } from "drizzle-orm";

async function inspectKnowledgeBaseRecords() {
  console.log("=========================================================================");
  console.log("KNOWLEDGE BASE DIRECT DATABASE INSPECTION (FOOD IDs 52, 57, 117, 663)");
  console.log("=========================================================================\n");

  const records = await db.select().from(foodsTable).where(or(
    eq(foodsTable.id, 52),
    eq(foodsTable.id, 57),
    eq(foodsTable.id, 117),
    eq(foodsTable.id, 663)
  ));

  console.log("ACTUAL DATABASE RECORDS FROM 'foods' TABLE:");
  console.log(JSON.stringify(records, null, 2));

  console.log("\n-------------------------------------------------------------------------");
  console.log("TABLE COLUMNS ON 'foods':");
  if (records.length > 0) {
    console.log(Object.keys(records[0]));
  }
}

inspectKnowledgeBaseRecords().catch(console.error);

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function main() {
  const sqlPath = path.resolve(import.meta.dirname, "../../../scratch/bread_and_milk_migration.sql");
  const sqlContent = fs.readFileSync(sqlPath, "utf-8");
  
  console.log("Running migration...");
  await db.execute(sql.raw(sqlContent));
  console.log("Migration applied successfully.");
}

main().catch(err => {
  console.error("MIGRATION_ERROR", err);
  process.exit(1);
});

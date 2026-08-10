import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function main() {
  console.log("=========================================================");
  console.log("EXECUTING RICE ALIAS CANONICALIZATION MIGRATION");
  console.log("=========================================================\n");

  const projectRoot = path.resolve(process.cwd());
  const sqlPath = path.resolve(projectRoot, "src/migrations/0005_rice_canonicalization_migration.sql");
  console.log(`Applying SQL migration from: ${sqlPath}`);
  
  const sqlContent = fs.readFileSync(sqlPath, "utf-8");

  await db.execute(sql.raw(sqlContent));
  console.log("✅ Rice canonicalization migration applied successfully.");
}

main().catch((err) => {
  console.error("❌ MIGRATION_ERROR", err);
  process.exit(1);
});

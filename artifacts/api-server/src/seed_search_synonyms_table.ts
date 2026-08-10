import { db, searchSynonyms } from "@workspace/db";
import { sql } from "drizzle-orm";

async function seedSearchSynonymsTable() {
  console.log("=========================================================");
  console.log("MIGRATING & SEEDING DB-DRIVEN 'search_synonyms' TABLE");
  console.log("=========================================================");

  // Create table if not exists
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS search_synonyms (
      id SERIAL PRIMARY KEY,
      term TEXT NOT NULL,
      target_term TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'dialect',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  console.log("[DB SEED] Table 'search_synonyms' created or verified in PostgreSQL.");

  const defaultSynonyms = [
    { term: "مانجا", targetTerm: "مانجو", category: "dialect" },
    { term: "شامورما", targetTerm: "شاورما", category: "typo" },
    { term: "بطاطا", targetTerm: "بطاطس", category: "dialect" },
    { term: "بندورة", targetTerm: "طماطم", category: "dialect" },
    { term: "طماطم", targetTerm: "بندورة", category: "dialect" },
    { term: "قاوون", targetTerm: "شمام", category: "dialect" },
    { term: "خبز اسمر", targetTerm: "خبز قمح كامل", category: "descriptor" },
    { term: "رز بني", targetTerm: "أرز", category: "descriptor" },
  ];

  for (const syn of defaultSynonyms) {
    const check = await db.execute(sql`SELECT id FROM search_synonyms WHERE term = ${syn.term}`);
    if (check.rows.length === 0) {
      await db.insert(searchSynonyms).values({
        term: syn.term,
        targetTerm: syn.targetTerm,
        category: syn.category,
      });
      console.log(`[DB SEED] Inserted synonym '${syn.term}' -> '${syn.targetTerm}' (${syn.category})`);
    }
  }

  console.log("=========================================================");
  console.log("DB 'search_synonyms' SEEDING COMPLETE.");
  console.log("=========================================================");
}

seedSearchSynonymsTable().catch(console.error);

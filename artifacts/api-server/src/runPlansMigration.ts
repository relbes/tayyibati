import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Running subscription plans manual column migration...");

  await db.execute(sql`
    ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS description_ar text;
    ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS description_en text;
    ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features_ar text NOT NULL DEFAULT '[]';
    ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features_en text NOT NULL DEFAULT '[]';
    ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_popular boolean NOT NULL DEFAULT false;
    ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS revenuecat_product_id text;
    ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS revenuecat_entitlement_id text;
  `);

  console.log("Subscription plans migration completed successfully.");
}

main().catch((err) => {
  console.error("MIGRATION_ERROR", err);
  process.exit(1);
});

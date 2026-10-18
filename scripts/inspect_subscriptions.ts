import { pool } from "@workspace/db";

async function main() {
  const res = await pool.query("SELECT * FROM subscription_plans ORDER BY id");
  console.log("=== SUBSCRIPTION PLANS IN DB ===");
  console.table(res.rows);
  process.exit(0);
}
main().catch(console.error);

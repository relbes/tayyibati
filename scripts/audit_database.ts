import fs from "fs";
import path from "path";
import { pool, db } from "@workspace/db";
import { foodsTable, dishes, dishIngredients, foodAliases, dishAliases } from "@workspace/db";
import { count } from "drizzle-orm";

async function main() {
  console.log("================================================================================");
  console.log("             PHASE 1: TAYYIBATI DATABASE & POLICY AUDIT                         ");
  console.log("================================================================================\n");

  // 1. Table inventory and row counts
  console.log("--- 1. TABLE INVENTORY & ROW COUNTS ---");
  const tableListRes = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  const counts: Record<string, number> = {};
  for (const row of tableListRes.rows) {
    const tName = row.table_name;
    const cRes = await pool.query(`SELECT count(*) FROM "${tName}"`);
    const c = parseInt(cRes.rows[0].count, 10);
    counts[tName] = c;
    console.log(`  Table: ${tName.padEnd(25)} | Rows: ${c}`);
  }

  // 2. Dump complete backup before ANY modifications
  console.log("\n--- 2. CREATING SAFE LOCAL BACKUP ---");
  const allFoods = await db.select().from(foodsTable);
  const allDishes = await db.select().from(dishes);
  const allDishIngredients = await db.select().from(dishIngredients);
  const allFoodAliases = await db.select().from(foodAliases);
  const allDishAliases = await db.select().from(dishAliases);

  const backupData = {
    backupTimestamp: new Date().toISOString(),
    counts: {
      foods: allFoods.length,
      dishes: allDishes.length,
      dishIngredients: allDishIngredients.length,
      foodAliases: allFoodAliases.length,
      dishAliases: allDishAliases.length,
    },
    foods: allFoods,
    dishes: allDishes,
    dishIngredients: allDishIngredients,
    foodAliases: allFoodAliases,
    dishAliases: allDishAliases,
  };

  const backupPath = path.resolve(process.cwd(), "backup_pre_rules_integration.json");
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf8");
  console.log(`  âœ“ Complete backup written to: ${backupPath} (${(fs.statSync(backupPath).size / 1024).toFixed(1)} KB)`);

  // 3. Status Breakdown in foodsTable
  console.log("\n--- 3. FOODS TABLE STATUS BREAKDOWN ---");
  const statusCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  for (const f of allFoods) {
    statusCounts[f.status] = (statusCounts[f.status] || 0) + 1;
    categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
  }
  console.log("  Status Counts:", statusCounts);
  console.log("  Category Counts (Top 15):");
  const sortedCats = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  for (const [cat, num] of sortedCats.slice(0, 15)) {
    console.log(`    - ${cat}: ${num}`);
  }

  // 4. Sample checking key policy items in existing foods & dishes
  console.log("\n--- 4. POLICY KEY ITEM RECONCILIATION ---");

  const policyChecks = [
    { title: "Breads & Baked Goods (Baladi, Shami, Fino, Toast)", pattern: /Ø®Ø¨Ø²|Ø¨Ù„Ø¯ÙŠ|Ø´Ø§Ù…ÙŠ|ÙÙŠÙ†Ùˆ|ØªÙˆØ³Øª/i },
    { title: "Rich Bake Toast specifically", pattern: /Ø±ÙŠØªØ´\s*Ø¨ÙŠÙƒ/i },
    { title: "Rice (White, Basmati, Biryani, Vermicelli)", pattern: /Ø£Ø±Ø²|Ø§Ø±Ø²|Ø±Ø²|Ø¨Ø³Ù…ØªÙŠ|Ø¨Ø±ÙŠØ§Ù†ÙŠ/i },
    { title: "Poultry (Chicken, Duck, Turkey, Goose)", pattern: /Ø¯Ø¬Ø§Ø¬|ÙØ±Ø§Ø®|Ø¨Ø·|ÙˆØ²|Ø¯ÙŠÙƒ\s*Ø±ÙˆÙ…ÙŠ/i },
    { title: "Separate Permitted Birds (Pigeon, Dove, Quail)", pattern: /Ø­Ù…Ø§Ù…|ÙŠÙ…Ø§Ù…|Ø³Ù…Ø§Ù†/i },
    { title: "Seafood (Fish, Shrimp, Squid, Crab, Lobster)", pattern: /Ø³Ù…Ùƒ|Ø¬Ù…Ø¨Ø±ÙŠ|Ø­Ø¨Ø§Ø±|Ø³Ø¨ÙŠØ·|ÙƒØ§Ø¨ÙˆØ±ÙŠØ§|Ø§Ø³ØªØ§ÙƒÙˆØ²Ø§/i },
    { title: "Dairy (Milk, White cheese, Yogurt, Processed cheese)", pattern: /Ø­Ù„ÙŠØ¨|Ù„Ø¨Ù†|Ø²Ø¨Ø§Ø¯ÙŠ|Ø¬Ø¨Ù†|Ù‚Ø±ÙŠØ´|Ø±ÙˆÙ…ÙŠ|Ø´ÙŠØ¯Ø±/i },
    { title: "Eggs (Boiled, Fried, Shakshuka)", pattern: /Ø¨ÙŠØ¶/i },
    { title: "Citrus & Fruits (Orange, Lemon, Tangerine, Watermelon)", pattern: /Ø¨Ø±ØªÙ‚Ø§Ù„|Ù„ÙŠÙ…ÙˆÙ†|ÙŠÙˆØ³ÙÙŠ|Ø¨Ø·ÙŠØ®/i },
    { title: "Legumes (Lentils, Beans)", pattern: /Ø¹Ø¯Ø³|ÙÙˆÙ„|ÙØ§ØµÙˆÙ„ÙŠØ§/i },
    { title: "Pasta & Macaroni", pattern: /Ù…Ø¹ÙƒØ±ÙˆÙ†|Ù…ÙƒØ±ÙˆÙ†|Ø¨Ø§Ø³ØªØ§|Ù„Ø§Ø²Ø§Ù†ÙŠØ§|ÙƒØ§Ù†ÙŠÙ„ÙˆÙ†ÙŠ/i },
    { title: "Beverages & Sodas (Pepsi, Sprite, Fayrouz, Red Bull)", pattern: /Ø¨ÙŠØ¨Ø³ÙŠ|Ø³ÙÙ†|Ø³Ø¨Ø±Ø§ÙŠØª|ÙÙŠØ±ÙˆØ²|Ø´ÙˆÙŠØ¨Ø³|Ø±ÙŠØ¯\s*Ø¨ÙˆÙ„|Ø³ØªÙŠÙ†Ø¬/i },
  ];

  for (const check of policyChecks) {
    console.log(`\n  [${check.title}]`);
    const matchedFoods = allFoods.filter(f => check.pattern.test(f.nameAr) || check.pattern.test(f.nameEn));
    console.log(`    -> Matched ${matchedFoods.length} foods:`);
    for (const f of matchedFoods.slice(0, 6)) {
      console.log(`       * [#${f.id}] "${f.nameAr}" | Status: ${f.status} | Reason: ${f.reason || 'None'}`);
    }
    if (matchedFoods.length > 6) {
      console.log(`       ... and ${matchedFoods.length - 6} more`);
    }

    const matchedDishes = allDishes.filter(d => check.pattern.test(d.nameAr) || (d.nameEn && check.pattern.test(d.nameEn)));
    if (matchedDishes.length > 0) {
      console.log(`    -> Matched ${matchedDishes.length} dishes:`);
      for (const d of matchedDishes.slice(0, 3)) {
        console.log(`       * [Dish #${d.id}] "${d.nameAr}"`);
      }
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error in audit:", err);
  process.exit(1);
});

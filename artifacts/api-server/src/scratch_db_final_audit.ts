import { db, foodsTable, foodAliases } from "@workspace/db";

async function main() {
  const foods = await db.select().from(foodsTable);
  const aliases = await db.select().from(foodAliases);

  console.log("=== DATABASE AUDIT ===");
  console.log("Foods:", foods.length);
  console.log("Food aliases:", aliases.length);

  console.log("\n=== RELEVANT FOODS ===");

  for (const f of foods) {
    const text = `${f.nameAr ?? ""} ${f.nameEn ?? ""}`.toLowerCase();

    if (
      text.includes("هيل") ||
      text.includes("جميد") ||
      text.includes("شراك") ||
      text.includes("بهارات") ||
      text.includes("ضأن") ||
      text.includes("ضاني") ||
      text.includes("لحم") ||
      text.includes("أرز") ||
      text.includes("ارز") ||
      text.includes("rice") ||
      text.includes("cardamom") ||
      text.includes("jameed") ||
      text.includes("shrak")
    ) {
      console.log(
        `ID=${f.id} | AR=${f.nameAr} | EN=${f.nameEn} | STATUS=${f.status} | CATEGORY=${f.category}`
      );
    }
  }

  console.log("\n=== ALL ALIASES ===");

  for (const a of aliases) {
    console.log(
      `ID=${a.id} | ALIAS=${a.aliasAr} | FOOD_ID=${a.foodId}`
    );
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

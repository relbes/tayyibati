import fs from "fs";
import path from "path";

const backupPath = path.resolve(process.cwd(), "backup_pre_rules_integration.json");
const b = JSON.parse(fs.readFileSync(backupPath, "utf8"));

console.log("================================================================================");
console.log("            DEEP READ-ONLY AUDIT: CATEGORIES, MIXED RECORDS & DISHES            ");
console.log("================================================================================\n");

// 1. Categories in foods
console.log("--- 1. CATEGORIES IN FOODS TABLE ---");
const catMap: Record<string, { total: number; allowed: number; forbidden: number; conditional: number }> = {};
b.foods.forEach((f: any) => {
  const cat = f.category || "UNCATEGORIZED";
  if (!catMap[cat]) catMap[cat] = { total: 0, allowed: 0, forbidden: 0, conditional: 0 };
  catMap[cat].total++;
  if (f.status === "allowed") catMap[cat].allowed++;
  else if (f.status === "forbidden") catMap[cat].forbidden++;
  else if (f.status === "conditional") catMap[cat].conditional++;
});

console.table(catMap);

// Check if any category is 100% forbidden
console.log("\n--- CATEGORIES WHERE ALL VERIFIED ITEMS ARE FORBIDDEN ---");
for (const [cat, counts] of Object.entries(catMap)) {
  if (counts.total > 0 && counts.forbidden === counts.total) {
    console.log(`  ★ 100% FORBIDDEN: "${cat}" (${counts.forbidden}/${counts.total} items)`);
  }
}

// 2. Specific Mixed Food Records (e.g. Crab/Oyster #1573, Citrus #1677)
console.log("\n--- 2. DETAILED AUDIT OF MIXED FOOD RECORDS ---");
const specificMixedIds = [1573, 1677, 1334, 1364, 1408, 1450, 1469, 1580, 1584, 1636];
for (const id of specificMixedIds) {
  const food = b.foods.find((f: any) => f.id === id);
  if (food) {
    console.log(`  [Food #${food.id}] "${food.nameAr}" | En: "${food.nameEn}" | Cat: "${food.category}" | Status: "${food.status}" | Reason: "${food.reason}"`);
  }
}

// 3. Composite Dishes Audit
console.log("\n--- 3. COMPOSITE DISHES AUDIT (ALL 557 DISHES) ---");
const dishIngsByDish: Record<number, Array<{ raw: string; foodId: number | null }>> = {};
b.dishIngredients.forEach((i: any) => {
  if (!dishIngsByDish[i.dishId]) dishIngsByDish[i.dishId] = [];
  dishIngsByDish[i.dishId].push({ raw: i.rawIngredientName, foodId: i.foodId });
});

let dishesWithNoIngredients = 0;
let dishesWithChickenAndMeat = 0;
let vegDishesWithMeat = 0;
const problemDishes: Array<{ id: number; name: string; issue: string; details: string }> = [];

b.dishes.forEach((d: any) => {
  const ings = dishIngsByDish[d.id] || [];
  if (ings.length === 0) {
    dishesWithNoIngredients++;
    problemDishes.push({ id: d.id, name: d.nameAr, issue: "NO_INGREDIENTS", details: "Zero ingredients recorded in dish_ingredients" });
    return;
  }

  const ingText = ings.map(i => i.raw).join(" | ");
  const hasChicken = /دجاج|فراخ/.test(ingText);
  const hasMeat = /لحم|بقر|غنم|ضأن|عجل/.test(ingText);
  const isVegTitle = /خضار|خضروات|نباتي/.test(d.nameAr);
  const isSpecificChicken = /دجاج|فراخ/.test(d.nameAr);
  const isSpecificMeat = /لحم|بقر|غنم|ضأن/.test(d.nameAr);

  if (isVegTitle && (hasChicken || hasMeat)) {
    vegDishesWithMeat++;
    problemDishes.push({
      id: d.id,
      name: d.nameAr,
      issue: "VEG_WITH_MEAT",
      details: `Title is vegetarian but ingredients contain: ${ings.filter(i => /دجاج|لحم/.test(i.raw)).map(i => i.raw).join(", ")}`
    });
  } else if (hasChicken && hasMeat && !isSpecificChicken && !isSpecificMeat) {
    dishesWithChickenAndMeat++;
    problemDishes.push({
      id: d.id,
      name: d.nameAr,
      issue: "MIXED_PROTEIN_BASE",
      details: `Lists both chicken and meat without variant distinction: ${ings.filter(i => /دجاج|لحم/.test(i.raw)).map(i => i.raw).join(", ")}`
    });
  }
});

console.log(`Summary of 557 dishes:`);
console.log(`  - Dishes with NO ingredients: ${dishesWithNoIngredients}`);
console.log(`  - Dishes mixing Chicken and Meat in single recipe: ${dishesWithChickenAndMeat}`);
console.log(`  - Dishes named 'Vegetable' but containing meat/chicken: ${vegDishesWithMeat}`);
console.log(`Sample problematic dish records (first 10):`);
console.table(problemDishes.slice(0, 10));

// 4. Subscription Plans & Entitlements Audit
console.log("\n--- 4. SUBSCRIPTION PLANS & ENTITLEMENTS ---");
console.log("Inspecting subscriptionPlansTable and userUsageTable in DB schema...");

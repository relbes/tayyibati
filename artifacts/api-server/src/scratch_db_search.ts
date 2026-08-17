import { db } from "@workspace/db";
import { foodsTable, foodAliases } from "@workspace/db";
import { like, or } from "drizzle-orm";
import { norm, stripAlefLam } from "./lib/dishCompatibilityEngine";

const testIngredients = [
  "صنوبر",
  "لحم ضأن بلدي",
  "جميد كركي",
  "أرز مصري",
  "خبز شراك",
  "سمن بلدي",
  "بهارات منسف",
  "لوز",
  "هيل"
];

async function main() {
  console.log("=== Tayyibati Database Ingredient Verification ===");

  for (const rawName of testIngredients) {
    const n = norm(rawName);
    const b = stripAlefLam(rawName);
    console.log(`\n--------------------------------------------`);
    console.log(`Analyzing raw ingredient: "${rawName}" (normalized: "${n}", stripped: "${b}")`);

    // 1. Exact or Substring Matches in Foods
    const matchedFoods = await db
      .select()
      .from(foodsTable);

    const foodsExact = matchedFoods.filter(f => norm(f.nameAr) === n || stripAlefLam(f.nameAr) === b);
    const foodsRelated = matchedFoods.filter(f => {
      const fn = norm(f.nameAr);
      return fn.length >= 3 && (n.includes(fn) || fn.includes(n));
    });

    console.log(`  Foods Exact/Normalized Matches (${foodsExact.length}):`);
    foodsExact.forEach(f => {
      console.log(`    - ID: ${f.id} | ${f.nameAr} (${f.nameEn}) | Status: ${f.status} | Cat: ${f.category}`);
    });

    console.log(`  Foods Related/Substring Matches (${foodsRelated.length}):`);
    foodsRelated.forEach(f => {
      if (!foodsExact.some(fe => fe.id === f.id)) {
        console.log(`    - ID: ${f.id} | ${f.nameAr} (${f.nameEn}) | Status: ${f.status} | Cat: ${f.category}`);
      }
    });

    // 2. Exact or Substring Matches in Food Aliases
    const matchedAliases = await db
      .select()
      .from(foodAliases);

    const aliasesExact = matchedAliases.filter(a => norm(a.aliasAr) === n || stripAlefLam(a.aliasAr) === b);
    const aliasesRelated = matchedAliases.filter(a => {
      const an = norm(a.aliasAr);
      return an.length >= 3 && (n.includes(an) || an.includes(n));
    });

    console.log(`  Aliases Exact/Normalized Matches (${aliasesExact.length}):`);
    for (const a of aliasesExact) {
      const [f] = matchedFoods.filter(food => food.id === a.foodId);
      console.log(`    - Alias: "${a.aliasAr}" -> Canonical Food: ${f?.nameAr} (ID: ${a.foodId}) | Status: ${f?.status}`);
    }

    console.log(`  Aliases Related/Substring Matches (${aliasesRelated.length}):`);
    for (const a of aliasesRelated) {
      if (!aliasesExact.some(ae => ae.id === a.id)) {
        const [f] = matchedFoods.filter(food => food.id === a.foodId);
        console.log(`    - Alias: "${a.aliasAr}" -> Canonical Food: ${f?.nameAr} (ID: ${a.foodId}) | Status: ${f?.status}`);
      }
    }
  }
}

main().catch(console.error);

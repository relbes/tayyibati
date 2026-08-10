/**
 * DB audit for milk resolution and all broad-ruling food records.
 * Must run from artifacts/api-server/ context to resolve @workspace/db.
 */
import { db } from "@workspace/db";
import {
  foodsTable,
  foodEntitiesTable,
  foodAliasesTable,
  dishVariantsTable,
  foodRelationshipsTable,
} from "@workspace/db";

async function main() {
  const allFoods = await db.select().from(foodsTable);
  const allEntities = await db.select().from(foodEntitiesTable);
  const allAliases = await db.select().from(foodAliasesTable);
  const allVariants = await db.select().from(dishVariantsTable);
  const allRelationships = await db.select().from(foodRelationshipsTable);

  // ── Milk-related ────────────────────────────────────────────────────────────
  const milkFoods = allFoods.filter(f =>
    (f.nameAr && (f.nameAr.includes("حليب") || f.nameAr.includes("لبن") || f.nameAr.includes("الحليب"))) ||
    (f.nameEn && f.nameEn.toLowerCase().includes("milk"))
  );
  console.log("MILK_FOODS=" + JSON.stringify(milkFoods));

  const milkEntities = allEntities.filter(e =>
    (e.nameAr && (e.nameAr.includes("حليب") || e.nameAr.includes("لبن"))) ||
    (e.nameEn && e.nameEn.toLowerCase().includes("milk"))
  );
  console.log("MILK_ENTITIES=" + JSON.stringify(milkEntities));

  const milkAliases = allAliases.filter(a =>
    (a.aliasAr && (a.aliasAr.includes("حليب") || a.aliasAr.includes("لبن"))) ||
    (a.aliasEn && a.aliasEn.toLowerCase().includes("milk"))
  );
  console.log("MILK_ALIASES=" + JSON.stringify(milkAliases));

  const milkVariants = allVariants.filter(v =>
    (v.nameAr && (v.nameAr.includes("حليب") || v.nameAr.includes("لبن"))) ||
    (v.nameEn && v.nameEn.toLowerCase().includes("milk"))
  );
  console.log("MILK_VARIANTS=" + JSON.stringify(milkVariants));

  // ── Broad-ruling foods ──────────────────────────────────────────────────────
  const broadFoods = allFoods.filter(f =>
    (f.nameAr && (f.nameAr.includes("جميع") || f.nameAr.includes("بجميع") || f.nameAr.includes("كل ") || f.nameAr.includes("عدا") || f.nameAr.includes("باستثناء"))) ||
    (f.nameEn && (f.nameEn.toLowerCase().includes("all types") || f.nameEn.toLowerCase().includes("except") || f.nameEn.toLowerCase().includes("any type")))
  );
  console.log("BROAD_FOODS=" + JSON.stringify(broadFoods));

  // ── All relationships ────────────────────────────────────────────────────────
  console.log("ALL_RELATIONSHIPS=" + JSON.stringify(allRelationships));

  // ── Summary stats ────────────────────────────────────────────────────────────
  console.log("STATS=" + JSON.stringify({
    totalFoods: allFoods.length,
    totalEntities: allEntities.length,
    totalAliases: allAliases.length,
    totalVariants: allVariants.length,
    totalRelationships: allRelationships.length,
    milkFoods: milkFoods.length,
    milkEntities: milkEntities.length,
    milkAliases: milkAliases.length,
    broadFoods: broadFoods.length,
  }));

  // ── Full food list ───────────────────────────────────────────────────────────
  console.log("ALL_FOODS=" + JSON.stringify(allFoods));
  console.log("ALL_ENTITIES=" + JSON.stringify(allEntities));
}

main().catch(err => {
  console.error("AUDIT_ERROR=" + String(err));
  process.exit(1);
});

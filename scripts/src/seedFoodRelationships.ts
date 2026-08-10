import { db } from "@workspace/db";
import {
  foodEntitiesTable,
  foodAliasesTable,
  dishVariantsTable,
  dishIngredientsTable,
  foodRelationshipsTable,
  foodsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

async function seed() {
  console.log("Starting Food Relationship Knowledge Layer seeding...");

  // Do NOT do global cleanup of tables to preserve existing/admin-curated data.
  // Instead, use SQL upserts (ON CONFLICT DO UPDATE).

  // Helper to find foodId from foodsTable by nameEn
  async function findFoodId(nameEn: string): Promise<number | null> {
    const results = await db
      .select({ id: foodsTable.id })
      .from(foodsTable)
      .where(eq(foodsTable.nameEn, nameEn))
      .limit(1);
    return results.length > 0 ? results[0].id : null;
  }

  // Fetch some foodIds from the existing foodsTable (if seeded)
  const cheeseFoodId = await findFoodId("cheese");
  const riceFoodId = await findFoodId("rice");
  const chickenFoodId = await findFoodId("chicken");
  const beefFoodId = await findFoodId("beef");
  const lambFoodId = await findFoodId("lamb");
  const wheatFoodId = await findFoodId("wheat");

  console.log("Mapping entity references to existing foodsTable IDs:", {
    cheeseFoodId,
    riceFoodId,
    chickenFoodId,
    beefFoodId,
    lambFoodId,
    wheatFoodId,
  });

  // 1. Upsert Food Entities (Target: nameEn)
  console.log("Upserting food entities...");
  const entities = await db
    .insert(foodEntitiesTable)
    .values([
      // --- Dishes ---
      { nameAr: "منسف", nameEn: "Mansaf", type: "dish", attributes: { sweet: false, savory: true } }, // 1
      { nameAr: "كفتة بالطحينة", nameEn: "Kofta with Tahini", type: "dish", attributes: { sweet: false, savory: true } }, // 2
      { nameAr: "مقلوبة", nameEn: "Maqluba", type: "dish", attributes: { sweet: false, savory: true } }, // 3
      { nameAr: "كبسة", nameEn: "Kabsa", type: "dish", attributes: { sweet: false, savory: true } }, // 4
      { nameAr: "شاورما", nameEn: "Shawarma", type: "dish", attributes: { sweet: false, savory: true } }, // 5
      { nameAr: "حمص", nameEn: "Hummus", type: "dish", attributes: { sweet: false, savory: true } }, // 6
      { nameAr: "كنافة", nameEn: "Kunafa", type: "dessert", attributes: { sweet: true, savory: false } }, // 7 - Fixed: sweet only, savory false

      // --- Breads ---
      { nameAr: "خبز", nameEn: "Bread", type: "bread", attributes: { sweet: false, savory: true }, foodId: wheatFoodId || undefined }, // 8

      // --- Ingredients / Components ---
      { nameAr: "جبنة", nameEn: "Cheese", type: "ingredient", attributes: { sweet: false, savory: true }, foodId: cheeseFoodId || undefined }, // 9
      { nameAr: "أرز", nameEn: "Rice", type: "ingredient", attributes: { sweet: false, savory: true }, foodId: riceFoodId || undefined }, // 10

      // Additional entities needed for recipes and relationships
      { nameAr: "جميد", nameEn: "Jameed", type: "ingredient", attributes: { sweet: false, savory: true } },
      { nameAr: "لحم غنم", nameEn: "Lamb", type: "ingredient", attributes: { sweet: false, savory: true }, foodId: lambFoodId || undefined },
      { nameAr: "لحم دجاج", nameEn: "Chicken", type: "ingredient", attributes: { sweet: false, savory: true }, foodId: chickenFoodId || undefined },
      { nameAr: "لحم بقر", nameEn: "Beef", type: "ingredient", attributes: { sweet: false, savory: true }, foodId: beefFoodId || undefined },
      { nameAr: "طحينة", nameEn: "Tahini", type: "ingredient", attributes: { sweet: false, savory: true } },
      { nameAr: "صلصة الطحينة", nameEn: "Tahini Sauce", type: "sauce", attributes: { sweet: false, savory: true } },
      { nameAr: "باذنجان", nameEn: "Eggplant", type: "ingredient", attributes: { sweet: false, savory: true } },
      { nameAr: "زهرة", nameEn: "Cauliflower", type: "ingredient", attributes: { sweet: false, savory: true } },
      { nameAr: "بطاطس", nameEn: "Potato", type: "ingredient", attributes: { sweet: false, savory: true } },
      { nameAr: "خبز شراك", nameEn: "Shrak Bread", type: "bread", attributes: { sweet: false, savory: true } },
      { nameAr: "فستق حلبي", nameEn: "Pistachio", type: "ingredient", attributes: { sweet: false, savory: true } },
      { nameAr: "مخلل", nameEn: "Pickles", type: "ingredient", attributes: { sweet: false, savory: true } },
      { nameAr: "ثومية", nameEn: "Toum/Garlic Sauce", type: "sauce", attributes: { sweet: false, savory: true } },
    ])
    .onConflictDoUpdate({
      target: foodEntitiesTable.nameEn,
      set: {
        nameAr: sql`EXCLUDED.name_ar`,
        type: sql`EXCLUDED.type`,
        attributes: sql`EXCLUDED.attributes`,
        foodId: sql`EXCLUDED.food_id`,
      },
    })
    .returning();

  // Map names to inserted entity records for easy lookup
  const entityMap = new Map<string, typeof foodEntitiesTable.$inferSelect>();
  entities.forEach((entity) => {
    entityMap.set(entity.nameEn, entity);
  });

  console.log(`Upserted ${entities.length} food entities.`);

  // 2. Upsert Food Aliases (Target: entityId, aliasAr)
  console.log("Upserting food aliases...");
  const mansaf = entityMap.get("Mansaf")!;
  const hummus = entityMap.get("Hummus")!;
  const kunafa = entityMap.get("Kunafa")!;
  const bread = entityMap.get("Bread")!;
  const tahini = entityMap.get("Tahini")!;

  await db
    .insert(foodAliasesTable)
    .values([
      { entityId: mansaf.id, aliasAr: "المنسف", aliasEn: "Al-Mansaf", region: "JO" },
      { entityId: mansaf.id, aliasAr: "منسف أردني", aliasEn: "Jordanian Mansaf", region: "JO" },
      { entityId: hummus.id, aliasAr: "حمص بطحينة", aliasEn: "Hummus bi Tahini", region: "Levant" },
      { entityId: hummus.id, aliasAr: "مسبحة", aliasEn: "Msabbaha", region: "Levant" },
      { entityId: kunafa.id, aliasAr: "كنافة نابلسية", aliasEn: "Nabulsi Kunafa", region: "PS" },
      { entityId: kunafa.id, aliasAr: "كنافة ناعمة", aliasEn: "Soft Kunafa", region: "JO" },
      { entityId: kunafa.id, aliasAr: "كنافة خشنة", aliasEn: "Rough Kunafa", region: "JO" },
      { entityId: bread.id, aliasAr: "خبز عربي", aliasEn: "Arabic Bread", region: "Middle East" },
      { entityId: bread.id, aliasAr: "كماج", aliasEn: "Kemaj Bread", region: "JO" },
      { entityId: tahini.id, aliasAr: "راشي", aliasEn: "Rashi", region: "IQ" },
      { entityId: tahini.id, aliasAr: "هردة", aliasEn: "Harda", region: "Gulf" },
    ])
    .onConflictDoUpdate({
      target: [foodAliasesTable.entityId, foodAliasesTable.aliasAr],
      set: {
        aliasEn: sql`EXCLUDED.alias_en`,
        region: sql`EXCLUDED.region`,
      },
    });
  console.log("Food aliases upserted.");

  // 3. Upsert Dish Variants (Target: variantKey)
  console.log("Upserting dish variants...");
  const maqluba = entityMap.get("Maqluba")!;
  const shawarma = entityMap.get("Shawarma")!;

  const variants = await db
    .insert(dishVariantsTable)
    .values([
      // Mansaf variants
      { dishId: mansaf.id, variantKey: "lamb_mansaf", nameAr: "منسف لحم بلدّي", nameEn: "Traditional Lamb Mansaf", region: "JO" },
      { dishId: mansaf.id, variantKey: "chicken_mansaf", nameAr: "منسف دجاج", nameEn: "Chicken Mansaf", region: "JO" },

      // Maqluba variants
      { dishId: maqluba.id, variantKey: "eggplant_maqluba", nameAr: "مقلوبة باذنجان", nameEn: "Eggplant Maqluba", region: "Levant" },
      { dishId: maqluba.id, variantKey: "cauliflower_maqluba", nameAr: "مقلوبة زهرة", nameEn: "Cauliflower Maqluba", region: "Levant" },

      // Shawarma variants
      { dishId: shawarma.id, variantKey: "chicken_shawarma", nameAr: "شاورما دجاج", nameEn: "Chicken Shawarma", region: "Levant" },
      { dishId: shawarma.id, variantKey: "meat_shawarma", nameAr: "شاورما لحمة", nameEn: "Meat Shawarma", region: "Levant" },
    ])
    .onConflictDoUpdate({
      target: dishVariantsTable.variantKey,
      set: {
        dishId: sql`EXCLUDED.dish_id`,
        nameAr: sql`EXCLUDED.name_ar`,
        nameEn: sql`EXCLUDED.name_en`,
        region: sql`EXCLUDED.region`,
      },
    })
    .returning();

  const variantMap = new Map<string, typeof dishVariantsTable.$inferSelect>();
  variants.forEach((v) => {
    variantMap.set(v.variantKey, v);
  });

  console.log(`Upserted ${variants.length} dish variants.`);

  // 4. Upsert Dish Ingredients (Recipe Knowledge)
  console.log("Upserting dish ingredients...");

  // Ingredients lookups
  const jameed = entityMap.get("Jameed")!;
  const lamb = entityMap.get("Lamb")!;
  const chicken = entityMap.get("Chicken")!;
  const beef = entityMap.get("Beef")!;
  const rice = entityMap.get("Rice")!;
  const shrak = entityMap.get("Shrak Bread")!;
  const pistachio = entityMap.get("Pistachio")!;
  const tahiniSauce = entityMap.get("Tahini Sauce")!;
  const eggplant = entityMap.get("Eggplant")!;
  const cauliflower = entityMap.get("Cauliflower")!;
  const potato = entityMap.get("Potato")!;
  const cheese = entityMap.get("Cheese")!;
  const pickle = entityMap.get("Pickles")!;
  const toum = entityMap.get("Toum/Garlic Sauce")!;

  const lambMansafVariant = variantMap.get("lamb_mansaf")!;
  const chickenMansafVariant = variantMap.get("chicken_mansaf")!;
  const eggplantMaqluba = variantMap.get("eggplant_maqluba")!;
  const cauliflowerMaqluba = variantMap.get("cauliflower_maqluba")!;
  const chickenShawarma = variantMap.get("chicken_shawarma")!;
  const meatShawarma = variantMap.get("meat_shawarma")!;
  const kofta = entityMap.get("Kofta with Tahini")!;

  // Generic ingredients (dishId set, dishVariantId is NULL)
  const genericIngredients = [
    // --- MANSAF ---
    { dishId: mansaf.id, entityId: jameed.id, ingredientType: "REQUIRED" as const },
    { dishId: mansaf.id, entityId: rice.id, ingredientType: "REQUIRED" as const },
    { dishId: mansaf.id, entityId: shrak.id, ingredientType: "REQUIRED" as const },
    { dishId: mansaf.id, entityId: pistachio.id, ingredientType: "TYPICAL" as const },

    // --- KOFTA WITH TAHINI (Beef and Lamb are TYPICAL, not REQUIRED) ---
    { dishId: kofta.id, entityId: beef.id, ingredientType: "TYPICAL" as const },
    { dishId: kofta.id, entityId: lamb.id, ingredientType: "TYPICAL" as const },
    { dishId: kofta.id, entityId: tahiniSauce.id, ingredientType: "REQUIRED" as const },
    { dishId: kofta.id, entityId: potato.id, ingredientType: "TYPICAL" as const },

    // --- MAQLUBA ---
    { dishId: maqluba.id, entityId: rice.id, ingredientType: "REQUIRED" as const },

    // --- KUNAFAH ---
    { dishId: kunafa.id, entityId: cheese.id, ingredientType: "REQUIRED" as const },
    { dishId: kunafa.id, entityId: pistachio.id, ingredientType: "TYPICAL" as const },
  ];

  // Variant ingredients (dishVariantId set, dishId is NULL)
  const variantIngredients = [
    // --- Traditional Lamb Mansaf Variant ---
    { dishVariantId: lambMansafVariant.id, entityId: lamb.id, ingredientType: "REQUIRED" as const },

    // --- Chicken Mansaf Variant ---
    { dishVariantId: chickenMansafVariant.id, entityId: chicken.id, ingredientType: "REQUIRED" as const },

    // --- Eggplant Maqluba ---
    { dishVariantId: eggplantMaqluba.id, entityId: eggplant.id, ingredientType: "REQUIRED" as const },
    { dishVariantId: eggplantMaqluba.id, entityId: chicken.id, ingredientType: "TYPICAL" as const },

    // --- Cauliflower Maqluba ---
    { dishVariantId: cauliflowerMaqluba.id, entityId: cauliflower.id, ingredientType: "REQUIRED" as const },
    { dishVariantId: cauliflowerMaqluba.id, entityId: chicken.id, ingredientType: "TYPICAL" as const },

    // --- CHICKEN SHAWARMA (Toum is TYPICAL, not REQUIRED) ---
    { dishVariantId: chickenShawarma.id, entityId: chicken.id, ingredientType: "REQUIRED" as const },
    { dishVariantId: chickenShawarma.id, entityId: toum.id, ingredientType: "TYPICAL" as const },
    { dishVariantId: chickenShawarma.id, entityId: pickle.id, ingredientType: "TYPICAL" as const },
    { dishVariantId: chickenShawarma.id, entityId: bread.id, ingredientType: "REQUIRED" as const },

    // --- MEAT SHAWARMA (Tahini Sauce is TYPICAL, not REQUIRED) ---
    { dishVariantId: meatShawarma.id, entityId: lamb.id, ingredientType: "REQUIRED" as const },
    { dishVariantId: meatShawarma.id, entityId: tahiniSauce.id, ingredientType: "TYPICAL" as const },
    { dishVariantId: meatShawarma.id, entityId: pickle.id, ingredientType: "TYPICAL" as const },
    { dishVariantId: meatShawarma.id, entityId: bread.id, ingredientType: "REQUIRED" as const },
  ];

  // Upsert generic ingredients targeting (dishId, entityId) where dishVariantId is null
  await db
    .insert(dishIngredientsTable)
    .values(genericIngredients)
    .onConflictDoUpdate({
      target: [dishIngredientsTable.dishId, dishIngredientsTable.entityId],
      targetWhere: sql`dish_variant_id IS NULL`,
      set: {
        ingredientType: sql`EXCLUDED.ingredient_type`,
      },
    });

  // Upsert variant-specific ingredients targeting (dishVariantId, entityId) where dishId is null
  await db
    .insert(dishIngredientsTable)
    .values(variantIngredients)
    .onConflictDoUpdate({
      target: [dishIngredientsTable.dishVariantId, dishIngredientsTable.entityId],
      targetWhere: sql`dish_id IS NULL`,
      set: {
        ingredientType: sql`EXCLUDED.ingredient_type`,
      },
    });

  console.log("Dish ingredients upserted.");

  // 5. Upsert Food Relationships (Graph Edges)
  console.log("Upserting food relationships...");
  const rawTahini = entityMap.get("Tahini")!;

  await db
    .insert(foodRelationshipsTable)
    .values([
      // Sauce / condiment mappings
      { sourceEntityId: jameed.id, targetEntityId: mansaf.id, relationshipType: "SAUCE_FOR" as const, evidenceLevel: "CURATED" as const },
      { sourceEntityId: tahiniSauce.id, targetEntityId: kofta.id, relationshipType: "SAUCE_FOR" as const, evidenceLevel: "CURATED" as const },
      { sourceEntityId: toum.id, targetEntityId: chickenShawarma.id, relationshipType: "SAUCE_FOR" as const, evidenceLevel: "CURATED" as const },

      // Toppings / garnishes
      { sourceEntityId: pistachio.id, targetEntityId: kunafa.id, relationshipType: "TOPPED_WITH" as const, evidenceLevel: "CURATED" as const },
      { sourceEntityId: pistachio.id, targetEntityId: mansaf.id, relationshipType: "TOPPED_WITH" as const, evidenceLevel: "COMMON" as const },

      // Substitutes
      { sourceEntityId: chicken.id, targetEntityId: lamb.id, relationshipType: "SUBSTITUTE_FOR" as const, evidenceLevel: "COMMON" as const },

      // Commonly confused or visually similar
      { sourceEntityId: rawTahini.id, targetEntityId: hummus.id, relationshipType: "VISUALLY_SIMILAR_TO" as const, evidenceLevel: "COMMON" as const },
    ])
    .onConflictDoUpdate({
      target: [
        foodRelationshipsTable.sourceEntityId,
        foodRelationshipsTable.targetEntityId,
        foodRelationshipsTable.relationshipType,
      ],
      set: {
        evidenceLevel: sql`EXCLUDED.evidence_level`,
      },
    });
  console.log("Food relationships upserted.");

  console.log("Food Relationship Knowledge Layer seeding successfully finished!");
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });

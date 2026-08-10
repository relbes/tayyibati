import { pgTable, text, serial, integer, jsonb, unique, check, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { foodsTable } from "./foods";

// 1. Food Entities (Common node base for ingredients, dishes, and variants)
export const foodEntitiesTable = pgTable("food_entities", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull().unique(), // Canonical unique identifier
  type: text("type", { enum: ["ingredient", "dish", "sauce", "beverage", "bread", "dessert"] }).notNull(),
  attributes: jsonb("attributes").notNull().default({}), // e.g. { "sweet": false, "savory": true }
  foodId: integer("food_id").references(() => foodsTable.id, { onDelete: "set null" }), // Optional compatibility mapping
  parentEntityId: integer("parent_entity_id").references((): any => foodEntitiesTable.id, { onDelete: "set null" }), // Subtype/variant hierarchy
});

// 2. Food Entity Aliases (Dialect variants, typos, regional synonyms)
export const foodAliasesTable = pgTable("food_aliases", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => foodEntitiesTable.id, { onDelete: "cascade" }).notNull(),
  aliasAr: text("alias_ar").notNull(),
  aliasEn: text("alias_en").notNull(),
  region: text("region"), // e.g., "JO", "EG", "SA"
}, (t) => [
  unique("food_aliases_entity_alias_ar_key").on(t.entityId, t.aliasAr),
]);

// 3. Dish Variants (Specific regional/country variations of a dish)
export const dishVariantsTable = pgTable("dish_variants", {
  id: serial("id").primaryKey(),
  dishId: integer("dish_id").references(() => foodEntitiesTable.id, { onDelete: "cascade" }).notNull(),
  variantKey: text("variant_key").notNull().unique(), // Unique identifier key for the variant
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  region: text("region"), // e.g., "JO", "PS", "EG"
});

// 4. Dish Ingredients (Map ingredients to dishes or variants)
export const dishIngredientsTable = pgTable("dish_ingredients", {
  id: serial("id").primaryKey(),
  dishId: integer("dish_id").references(() => foodEntitiesTable.id, { onDelete: "cascade" }),
  dishVariantId: integer("dish_variant_id").references(() => dishVariantsTable.id, { onDelete: "cascade" }),
  entityId: integer("entity_id").references(() => foodEntitiesTable.id, { onDelete: "cascade" }).notNull(), // Target food entity
  ingredientType: text("ingredient_type", { enum: ["REQUIRED", "TYPICAL", "OPTIONAL", "VARIANT_DEPENDENT"] }).notNull(),
}, (t) => [
  // Check that exactly one of dishId or dishVariantId is set (not both, not neither)
  check(
    "dish_ingredients_ref_check",
    sql`(dish_id IS NOT NULL AND dish_variant_id IS NULL) OR (dish_id IS NULL AND dish_variant_id IS NOT NULL)`
  ),
  // Partial unique indexes to prevent duplicates since NULL is distinct in standard composite unique constraints
  uniqueIndex("dish_ingredients_dish_idx").on(t.dishId, t.entityId).where(sql`dish_variant_id IS NULL`),
  uniqueIndex("dish_ingredients_variant_idx").on(t.dishVariantId, t.entityId).where(sql`dish_id IS NULL`),
]);

// 5. Food Relationships (Directional graph edges representing culinary associations)
export const foodRelationshipsTable = pgTable("food_relationships", {
  id: serial("id").primaryKey(),
  sourceEntityId: integer("source_entity_id").references(() => foodEntitiesTable.id, { onDelete: "cascade" }).notNull(),
  targetEntityId: integer("target_entity_id").references(() => foodEntitiesTable.id, { onDelete: "cascade" }).notNull(),
  relationshipType: text("relationship_type", {
    enum: [
      "SAUCE_FOR",
      "TOPPED_WITH",
      "UNLIKELY_WITH",
      "VISUALLY_SIMILAR_TO",
      "COMMONLY_CONFUSED_WITH",
      "SUBSTITUTE_FOR",
      "CONTAINS",
      "IS_EXCEPTION_TO"
    ]
  }).notNull(),
  evidenceLevel: text("evidence_level", {
    enum: ["CURATED", "VERIFIED", "COMMON", "AI_PROPOSED"]
  }).notNull().default("AI_PROPOSED"),
}, (t) => [
  unique("food_relationships_source_target_type_key").on(t.sourceEntityId, t.targetEntityId, t.relationshipType),
]);




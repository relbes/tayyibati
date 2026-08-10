import { pgTable, text, serial, integer, timestamp, boolean, jsonb, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { foodsTable } from "./foods";

// 1. Food Aliases (Arabic dialects, definite articles, English variants, OCR, brand)
export const foodAliases = pgTable(
  "food_aliases",
  {
    id: serial("id").primaryKey(),
    foodId: integer("food_id").references(() => foodsTable.id, { onDelete: "cascade" }).notNull(),
    aliasAr: text("alias_ar").notNull(),
    aliasEn: text("alias_en"),
    aliasType: text("alias_type").notNull().default("synonym"), // 'canonical', 'synonym', 'dialect', 'english', 'phonetic', 'ocr', 'misspelling', 'regional', 'brand'
    priority: integer("priority").notNull().default(100), // 0 to 100 (higher priority wins)
    region: text("region"), // e.g., 'egypt', 'levant', 'gulf', 'maghreb', 'global'
    isCanonical: boolean("is_canonical").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_food_aliases_food_id").on(t.foodId),
    index("idx_food_aliases_alias_ar").on(t.aliasAr),
    index("idx_food_aliases_alias_en").on(t.aliasEn),
    index("idx_food_aliases_food_priority").on(t.foodId, t.priority.desc()),
    index("idx_food_aliases_alias_ar_priority").on(t.aliasAr, t.priority.desc()),
    check("food_aliases_priority_check", sql`priority >= 0 AND priority <= 100`),
    check(
      "food_aliases_type_check",
      sql`alias_type IN ('canonical', 'synonym', 'dialect', 'english', 'phonetic', 'ocr', 'misspelling', 'regional', 'brand')`
    ),
  ]
);

// 2. Dishes (Canonical traditional dishes & recipes - NO static compatibility status)
export const dishes = pgTable(
  "dishes",
  {
    id: serial("id").primaryKey(),
    nameAr: text("name_ar").notNull().unique(),
    nameEn: text("name_en"),
    category: text("category").notNull().default("main_dish"), // 'main_dish', 'appetizer', 'soup', 'salad', 'dessert'
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_dishes_name_ar").on(t.nameAr),
    index("idx_dishes_name_en").on(t.nameEn),
  ]
);

// 3. Dish Aliases (Regional dish dialect names & variants + aliasType)
export const dishAliases = pgTable(
  "dish_aliases",
  {
    id: serial("id").primaryKey(),
    dishId: integer("dish_id").references(() => dishes.id, { onDelete: "cascade" }).notNull(),
    aliasAr: text("alias_ar").notNull(),
    aliasEn: text("alias_en"),
    aliasType: text("alias_type").notNull().default("synonym"), // 'synonym', 'dialect', 'regional_variant', 'spelling'
    region: text("region"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_dish_aliases_dish_id").on(t.dishId),
    index("idx_dish_aliases_alias_ar").on(t.aliasAr),
  ]
);

// 4. Countries (Arab & regional culinary origin metadata)
export const countries = pgTable(
  "countries",
  {
    id: serial("id").primaryKey(),
    nameAr: text("name_ar").notNull().unique(),
    nameEn: text("name_en"),
    code: text("code").unique(), // 'SY', 'EG', 'SA', 'LB', etc.
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_countries_code").on(t.code),
    index("idx_countries_name_ar").on(t.nameAr),
  ]
);

// 5. Dish Countries (Join table mapping dishes to Arab countries)
export const dishCountries = pgTable(
  "dish_countries",
  {
    id: serial("id").primaryKey(),
    dishId: integer("dish_id").references(() => dishes.id, { onDelete: "cascade" }).notNull(),
    countryName: text("country_name").notNull(),
    countryId: integer("country_id").references(() => countries.id, { onDelete: "set null" }),
    region: text("region"),
    isOrigin: boolean("is_origin").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_dish_countries_dish_id").on(t.dishId),
    index("idx_dish_countries_country_id").on(t.countryId),
    index("idx_dish_countries_country_name").on(t.countryName),
  ]
);

// 6. Dish Ingredients (Stores food_id FK, raw_ingredient_name, requirement_type, confidence string & confidence_score numeric)
export const dishIngredients = pgTable(
  "dish_ingredients",
  {
    id: serial("id").primaryKey(),
    dishId: integer("dish_id").references(() => dishes.id, { onDelete: "cascade" }).notNull(),
    foodId: integer("food_id").references(() => foodsTable.id, { onDelete: "set null" }),
    rawIngredientName: text("raw_ingredient_name").notNull(),
    requirementType: text("requirement_type").notNull().default("required"), // 'required', 'preferred', 'optional'
    confidence: text("confidence").notNull().default("HIGH"), // 'HIGH', 'MEDIUM', 'LOW'
    confidenceScore: integer("confidence_score").notNull().default(100), // 0 to 100
    quantityNotes: text("quantity_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_dish_ingredients_dish_id").on(t.dishId),
    index("idx_dish_ingredients_food_id").on(t.foodId),
    index("idx_dish_ingredients_raw_name").on(t.rawIngredientName),
  ]
);

// 7. Knowledge Events (Audit & Sync Event Logging + source)
export const knowledgeEvents = pgTable(
  "knowledge_events",
  {
    id: serial("id").primaryKey(),
    eventType: text("event_type").notNull(), // 'IMPORT', 'RECONCILIATION', 'CACHE_WARMUP', 'ALIAS_ADDED'
    source: text("source").notNull().default("System"), // 'Foods.xlsx', 'Dishes.xlsx', 'AI', 'Admin', 'Migration', 'System'
    description: text("description").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_knowledge_events_event_type").on(t.eventType),
    index("idx_knowledge_events_source").on(t.source),
  ]
);

// 8. Search Analytics (Cache hit metrics, query frequencies, resolved_by)
export const searchAnalytics = pgTable(
  "search_analytics",
  {
    id: serial("id").primaryKey(),
    query: text("query").notNull(),
    searchType: text("search_type").notNull().default("text"), // 'text', 'camera', 'voice', 'autocomplete'
    resolvedBy: text("resolved_by").notNull().default("unknown"), // 'cache', 'food', 'alias', 'dish', 'AI', 'unknown'
    matchedEntityType: text("matched_entity_type"), // 'food', 'alias', 'dish', 'unknown'
    matchedEntityId: integer("matched_entity_id"),
    cacheHit: boolean("cache_hit").notNull().default(true),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_search_analytics_query").on(t.query),
    index("idx_search_analytics_resolved_by").on(t.resolvedBy),
    index("idx_search_analytics_search_type").on(t.searchType),
  ]
);

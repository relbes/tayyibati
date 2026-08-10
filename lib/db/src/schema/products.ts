import { pgTable, serial, text, varchar, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  barcode: varchar("barcode", { length: 64 }).unique(),
  brand: varchar("brand", { length: 255 }),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  manufacturer: varchar("manufacturer", { length: 255 }),
  country: varchar("country", { length: 128 }),
  category: varchar("category", { length: 128 }),
  ingredientText: text("ingredient_text").notNull(),
  ingredientTextNormalized: text("ingredient_text_normalized"),
  nutritionJson: jsonb("nutrition_json"),
  language: varchar("language", { length: 8 }).default("ar").notNull(),
  status: varchar("status", { length: 32 }).default("active").notNull(), // active, draft, archived
  knowledgeVersion: varchar("knowledge_version", { length: 32 }).default("2.1").notNull(),
  sourceProvider: varchar("source_provider", { length: 64 }).default("local_db").notNull(),
  lastVerified: timestamp("last_verified").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productAliases = pgTable("product_aliases", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  alias: text("alias").notNull(),
  language: varchar("language", { length: 8 }).default("ar").notNull(),
  aliasType: varchar("alias_type", { length: 32 }).default("alternate_name").notNull(),
});

export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  frontImage: text("front_image"),
  ingredientsImage: text("ingredients_image"),
  nutritionImage: text("nutrition_image"),
});

export const productSources = pgTable("product_sources", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  providerReference: varchar("provider_reference", { length: 255 }),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
  confidence: integer("confidence").default(100).notNull(),
});

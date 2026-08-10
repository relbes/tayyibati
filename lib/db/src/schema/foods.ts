import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const foodsTable = pgTable("foods", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  category: text("category").notNull().default("general"),
  foodType: text("food_type", { enum: ["exact_food", "general_category"] }).notNull().default("exact_food"),
  parentFoodId: integer("parent_food_id").references((): any => foodsTable.id, { onDelete: "set null" }),
  isException: boolean("is_exception").notNull().default(false),
  status: text("status", { enum: ["allowed", "forbidden", "conditional"] }).notNull(),
  reason: text("reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFoodSchema = createInsertSchema(foodsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFood = z.infer<typeof insertFoodSchema>;
export type Food = typeof foodsTable.$inferSelect;

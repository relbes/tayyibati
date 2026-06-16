import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
  dailyLimit: integer("daily_limit").notNull().default(10),
  dailyTextLimit: integer("daily_text_limit").notNull().default(10),
  dailyImageLimit: integer("daily_image_limit").notNull().default(5),
  price: text("price").notNull().default("0"),
  currency: text("currency").notNull().default("SAR"),
  billingCycle: text("billing_cycle", { enum: ["monthly", "yearly", "free"] }).notNull().default("free"),
  features: text("features").notNull().default("[]"),
  isActive: text("is_active").notNull().default("true"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;

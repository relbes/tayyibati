import { pgTable, text, serial, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userActivityHistoryTable = pgTable(
  "user_activity_history",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    category: text("category", {
      enum: [
        "AUTH",
        "SEARCH",
        "IMAGE_ANALYSIS",
        "INGREDIENT_ANALYSIS",
        "SUBSCRIPTION",
        "PAYMENT",
        "NOTIFICATION",
        "ADMIN_ACTION",
        "PROFILE",
        "ERROR",
        "SYSTEM",
      ],
    }).notNull(),
    eventType: text("event_type").notNull(),
    eventName: text("event_name").notNull(),
    description: text("description").notNull().default(""),
    actorType: text("actor_type", { enum: ["USER", "ADMIN", "SYSTEM"] }).notNull().default("USER"),
    actorId: text("actor_id"),
    actorName: text("actor_name"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("user_activity_history_user_id_idx").on(table.userId),
    index("user_activity_history_category_idx").on(table.category),
    index("user_activity_history_created_at_idx").on(table.createdAt),
    index("user_activity_history_user_created_idx").on(table.userId, table.createdAt),
  ]
);

export const insertUserActivityHistorySchema = createInsertSchema(userActivityHistoryTable).omit({
  id: true,
  createdAt: true,
});

export type InsertUserActivityHistory = z.infer<typeof insertUserActivityHistorySchema>;
export type UserActivityHistoryItem = typeof userActivityHistoryTable.$inferSelect;

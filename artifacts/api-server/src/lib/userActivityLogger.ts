/**
 * User Activity History Logging Service
 *
 * Dedicated helper to record auditable user and administrative events.
 * Safe, asynchronous, non-blocking, and strictly sanitizes sensitive metadata.
 */

import { db, userActivityHistoryTable } from "@workspace/db";
import { logger } from "./logger";

export type ActivityCategory =
  | "AUTH"
  | "SEARCH"
  | "IMAGE_ANALYSIS"
  | "INGREDIENT_ANALYSIS"
  | "SUBSCRIPTION"
  | "PAYMENT"
  | "NOTIFICATION"
  | "ADMIN_ACTION"
  | "PROFILE"
  | "ERROR"
  | "SYSTEM";

export type ActivityActorType = "USER" | "ADMIN" | "SYSTEM";

export interface RecordActivityOptions {
  userId: string;
  category: ActivityCategory;
  eventType: string;
  eventName: string;
  description: string;
  actorType?: ActivityActorType;
  actorId?: string | null;
  actorName?: string | null;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "newpassword",
  "oldpassword",
  "token",
  "refreshtoken",
  "accesstoken",
  "secret",
  "secretkey",
  "authorization",
  "cookie",
  "sessionid",
  "apikey",
  "credentials",
  "cardnumber",
  "cvv",
]);

function sanitizeMetadata(data: any): any {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeMetadata(item));
  }

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes("password") || lowerKey.includes("secret")) {
      clean[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      clean[key] = sanitizeMetadata(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export async function recordUserActivity(opts: RecordActivityOptions): Promise<void> {
  try {
    if (!opts.userId) return;

    const safeMetadata = opts.metadata ? sanitizeMetadata(opts.metadata) : null;

    await db.insert(userActivityHistoryTable).values({
      userId: opts.userId,
      category: opts.category,
      eventType: opts.eventType,
      eventName: opts.eventName,
      description: opts.description || "",
      actorType: opts.actorType || "USER",
      actorId: opts.actorId ?? null,
      actorName: opts.actorName ?? null,
      metadata: safeMetadata,
      createdAt: opts.createdAt || new Date(),
    });
  } catch (err) {
    logger.warn(
      { err, userId: opts.userId, category: opts.category, eventType: opts.eventType },
      "Failed to record user activity history"
    );
  }
}

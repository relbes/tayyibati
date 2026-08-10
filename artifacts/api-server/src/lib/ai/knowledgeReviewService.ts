/**
 * Tayyibati Knowledge Review Queue Service (Phase 6 - Step 4 Final Refinement)
 *
 * Captures unknown AI ingredients into pending_knowledge_reviews table.
 * NO DDL / runtime CREATE TABLE logic (managed by Drizzle migrations).
 * Manages exampleQueries (up to 10 unique items), resolutionAttempts, pagination, and statistics.
 */

import { db, pendingKnowledgeReviewsTable, ResolutionAttempts } from "@workspace/db";
import { eq } from "drizzle-orm";
import { norm } from "../arabicNormalization";

export interface CaptureUnknownInput {
  ingredientName: string;
  sourceQuery: string;
  sourceDish?: string;
  sourceType: "text" | "camera" | "ocr" | "barcode";
  aiConfidence?: number;
  resolutionAttempts?: ResolutionAttempts;
}

export async function captureUnknownIngredient(input: CaptureUnknownInput): Promise<void> {
  const ingName = input.ingredientName.trim();
  if (!ingName) return;

  const normalized = norm(ingName);
  if (!normalized) return;

  const defaultAttempts: ResolutionAttempts = {
    alias: false,
    synonym: false,
    expansion: false,
    prefix: false,
    token: true,
    fuzzy: false,
  };

  const attemptsToSave = input.resolutionAttempts || defaultAttempts;
  const queryStr = (input.sourceQuery || ingName).trim();

  try {
    const existing = await db
      .select()
      .from(pendingKnowledgeReviewsTable)
      .where(eq(pendingKnowledgeReviewsTable.normalizedName, normalized))
      .limit(1);

    if (existing && existing.length > 0) {
      const rec = existing[0];
      const existingQueries: string[] = Array.isArray(rec.exampleQueries) ? [...rec.exampleQueries] : [];
      
      if (queryStr && !existingQueries.includes(queryStr) && existingQueries.length < 10) {
        existingQueries.push(queryStr);
      }

      await db
        .update(pendingKnowledgeReviewsTable)
        .set({
          seenCount: rec.seenCount + 1,
          lastSeenAt: new Date(),
          exampleQueries: existingQueries,
          sourceDish: input.sourceDish || rec.sourceDish,
          resolutionAttempts: attemptsToSave,
        })
        .where(eq(pendingKnowledgeReviewsTable.id, rec.id));
    } else {
      const initialQueries = queryStr ? [queryStr] : [ingName];
      await db.insert(pendingKnowledgeReviewsTable).values({
        ingredientName: ingName,
        normalizedName: normalized,
        exampleQueries: initialQueries,
        sourceDish: input.sourceDish || null,
        sourceType: input.sourceType || "text",
        aiConfidence: input.aiConfidence || 0.85,
        resolutionAttempts: attemptsToSave,
        status: "pending",
        seenCount: 1,
      });
    }
  } catch (err: any) {
    console.error("[KNOWLEDGE_REVIEW_QUEUE] Error capturing unknown ingredient:", err?.message || err);
  }
}

export async function getReviewStatistics() {
  const allRecords = await db.select().from(pendingKnowledgeReviewsTable);

  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let merged = 0;
  let totalConfidence = 0;

  for (const r of allRecords) {
    if (r.status === "pending") pending++;
    else if (r.status === "approved") approved++;
    else if (r.status === "rejected") rejected++;
    else if (r.status === "merged") merged++;

    totalConfidence += r.aiConfidence || 0;
  }

  const averageAiConfidence = allRecords.length > 0
    ? Number((totalConfidence / allRecords.length).toFixed(2))
    : 0;

  const topRepeatedIngredients = [...allRecords]
    .sort((a, b) => b.seenCount - a.seenCount)
    .slice(0, 5)
    .map((r) => ({
      ingredientName: r.ingredientName,
      seenCount: r.seenCount,
      status: r.status,
    }));

  const dishCounts: Record<string, number> = {};
  for (const r of allRecords) {
    if (r.sourceDish) {
      dishCounts[r.sourceDish] = (dishCounts[r.sourceDish] || 0) + r.seenCount;
    }
  }

  const topRepeatedDishes = Object.entries(dishCounts)
    .map(([dish, seenCount]) => ({ dish, seenCount }))
    .sort((a, b) => b.seenCount - a.seenCount)
    .slice(0, 5);

  return {
    pending,
    approved,
    rejected,
    merged,
    averageAiConfidence,
    topRepeatedIngredients,
    topRepeatedDishes,
    queueSize: allRecords.length,
  };
}

export async function getReviewQueuePaginated(page: number = 1, pageSize: number = 50, statusFilter?: string) {
  const allRecords = await db.select().from(pendingKnowledgeReviewsTable);

  const filtered = statusFilter
    ? allRecords.filter((i) => i.status === statusFilter)
    : allRecords;

  const sorted = filtered.sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());

  const totalItems = sorted.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIndex = (currentPage - 1) * pageSize;
  const items = sorted.slice(startIndex, startIndex + pageSize);

  return {
    page: currentPage,
    pageSize,
    totalItems,
    totalPages,
    items,
  };
}

export async function getReviewItemById(id: number) {
  const [item] = await db
    .select()
    .from(pendingKnowledgeReviewsTable)
    .where(eq(pendingKnowledgeReviewsTable.id, id))
    .limit(1);
  return item || null;
}

export async function approveReviewItem(id: number, notes?: string) {
  const [updated] = await db
    .update(pendingKnowledgeReviewsTable)
    .set({
      status: "approved",
      reviewNotes: notes || "Approved by admin",
      lastSeenAt: new Date(),
    })
    .where(eq(pendingKnowledgeReviewsTable.id, id))
    .returning();
  return updated;
}

export async function rejectReviewItem(id: number, notes?: string) {
  const [updated] = await db
    .update(pendingKnowledgeReviewsTable)
    .set({
      status: "rejected",
      reviewNotes: notes || "Rejected by admin",
      lastSeenAt: new Date(),
    })
    .where(eq(pendingKnowledgeReviewsTable.id, id))
    .returning();
  return updated;
}

export async function mergeReviewItem(id: number, canonicalFoodId: number, notes?: string) {
  const [updated] = await db
    .update(pendingKnowledgeReviewsTable)
    .set({
      status: "merged",
      canonicalFoodId,
      reviewNotes: notes || `Merged into Canonical Food ID #${canonicalFoodId}`,
      lastSeenAt: new Date(),
    })
    .where(eq(pendingKnowledgeReviewsTable.id, id))
    .returning();
  return updated;
}

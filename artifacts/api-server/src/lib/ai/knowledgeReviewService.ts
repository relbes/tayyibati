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

import { foodsTable, dishes } from "@workspace/db";

export async function getReviewQueuePaginated(
  page: number = 1,
  pageSize: number = 50,
  statusFilter?: string,
  searchQuery?: string
) {
  const allRecords = await db.select().from(pendingKnowledgeReviewsTable);
  const allFoods = await db.select().from(foodsTable);
  const allDishes = await db.select().from(dishes);

  // Map foods and dishes for fast lookup
  const foodByIdMap = new Map(allFoods.map((f) => [f.id, f]));
  const foodByNameNormMap = new Map(allFoods.map((f) => [norm(f.nameAr), f]));
  const dishByNameNormMap = new Map(allDishes.map((d) => [norm(d.nameAr), d]));

  // Map raw DB records to rich UI objects
  const mappedRecords = allRecords.map((rec) => {
    let resolvedFood = rec.canonicalFoodId ? foodByIdMap.get(rec.canonicalFoodId) : undefined;
    if (!resolvedFood) {
      resolvedFood = foodByNameNormMap.get(rec.normalizedName);
    }

    let resolvedDish = rec.sourceDish ? dishByNameNormMap.get(norm(rec.sourceDish)) : undefined;

    const itemType = resolvedFood ? "food" : resolvedDish ? "dish" : "ingredient";
    const suggestedNameAr = rec.ingredientName || resolvedFood?.nameAr || resolvedDish?.nameAr || "كيان غير مرتبط";
    const suggestedNameEn = resolvedFood?.nameEn || resolvedDish?.nameEn || null;

    const confidenceVal = rec.aiConfidence ?? 0.85;
    const confidenceScore = Math.round(confidenceVal > 1 ? confidenceVal : confidenceVal * 100);

    const sourceLabel = rec.sourceDish
      ? `${rec.sourceType === "camera" ? "كاميرا" : "بحث"} (${rec.sourceDish})`
      : rec.sourceType === "camera"
      ? "كاميرا"
      : rec.sourceType === "ocr"
      ? "مسح ضوئي"
      : rec.sourceType === "barcode"
      ? "باركود"
      : "محرك الذكاء الاصطناعي (AI)";

    return {
      id: rec.id,
      itemType,
      suggestedNameAr,
      suggestedNameEn,
      status: rec.status,
      source: sourceLabel,
      confidenceScore,
      createdAt: rec.firstSeenAt ? rec.firstSeenAt.toISOString() : rec.lastSeenAt.toISOString(),
      notes: rec.reviewNotes,
      ingredientName: rec.ingredientName,
      normalizedName: rec.normalizedName,
      sourceDish: rec.sourceDish,
      sourceType: rec.sourceType,
      seenCount: rec.seenCount,
      canonicalFoodId: rec.canonicalFoodId || resolvedFood?.id || null,
      resolvedFoodId: resolvedFood?.id || null,
      resolvedDishId: resolvedDish?.id || null,
      exampleQueries: rec.exampleQueries,
    };
  });

  // Filter by status
  let filtered = statusFilter && statusFilter !== "all"
    ? mappedRecords.filter((i) => i.status === statusFilter)
    : mappedRecords;

  // Filter by search query
  if (searchQuery && searchQuery.trim()) {
    const q = norm(searchQuery.trim());
    filtered = filtered.filter((i) =>
      norm(i.suggestedNameAr).includes(q) ||
      (i.suggestedNameEn && norm(i.suggestedNameEn).includes(q)) ||
      norm(i.source).includes(q)
    );
  }

  // Sort newest first
  const sorted = filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
  const [rec] = await db
    .select()
    .from(pendingKnowledgeReviewsTable)
    .where(eq(pendingKnowledgeReviewsTable.id, id))
    .limit(1);
  if (!rec) return null;

  const allFoods = await db.select().from(foodsTable);
  const foodByIdMap = new Map(allFoods.map((f) => [f.id, f]));
  const foodByNameNormMap = new Map(allFoods.map((f) => [norm(f.nameAr), f]));

  let resolvedFood = rec.canonicalFoodId ? foodByIdMap.get(rec.canonicalFoodId) : undefined;
  if (!resolvedFood) {
    resolvedFood = foodByNameNormMap.get(rec.normalizedName);
  }

  const confidenceVal = rec.aiConfidence ?? 0.85;
  const confidenceScore = Math.round(confidenceVal > 1 ? confidenceVal : confidenceVal * 100);

  return {
    id: rec.id,
    itemType: resolvedFood ? "food" : rec.sourceDish ? "dish" : "ingredient",
    suggestedNameAr: rec.ingredientName || resolvedFood?.nameAr || "كيان غير مرتبط",
    suggestedNameEn: resolvedFood?.nameEn || null,
    status: rec.status,
    source: rec.sourceType,
    confidenceScore,
    createdAt: rec.firstSeenAt ? rec.firstSeenAt.toISOString() : rec.lastSeenAt.toISOString(),
    notes: rec.reviewNotes,
    ingredientName: rec.ingredientName,
    normalizedName: rec.normalizedName,
    sourceDish: rec.sourceDish,
    sourceType: rec.sourceType,
    seenCount: rec.seenCount,
    canonicalFoodId: rec.canonicalFoodId || resolvedFood?.id || null,
    exampleQueries: rec.exampleQueries || [],
    resolutionAttempts: rec.resolutionAttempts,
  };
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

export async function updateReviewItem(id: number, fields: { ingredientName?: string; reviewNotes?: string; status?: "pending" | "approved" | "rejected" | "merged"; aiConfidence?: number; canonicalFoodId?: number | null }) {
  const patch: any = { lastSeenAt: new Date() };
  if (fields.ingredientName !== undefined) patch.ingredientName = fields.ingredientName;
  if (fields.reviewNotes !== undefined) patch.reviewNotes = fields.reviewNotes;
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.aiConfidence !== undefined) patch.aiConfidence = fields.aiConfidence;
  if (fields.canonicalFoodId !== undefined) patch.canonicalFoodId = fields.canonicalFoodId;

  const [updated] = await db
    .update(pendingKnowledgeReviewsTable)
    .set(patch)
    .where(eq(pendingKnowledgeReviewsTable.id, id))
    .returning();
  return updated;
}

export async function deleteReviewItem(id: number) {
  const [deleted] = await db
    .delete(pendingKnowledgeReviewsTable)
    .where(eq(pendingKnowledgeReviewsTable.id, id))
    .returning();
  return deleted;
}

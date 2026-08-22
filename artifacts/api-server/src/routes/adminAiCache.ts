/**
 * Tayyibati Admin AI Cache API Endpoints (Phase 6 - Step 4.5)
 *
 * Backend endpoints for managing ai_food_knowledge_cache table:
 * GET /api/admin/ai-cache/statistics
 * GET /api/admin/ai-cache?page=1&pageSize=50
 * GET /api/admin/ai-cache/:id
 * POST /api/admin/ai-cache/:id/delete (Soft delete)
 */

import { Router } from "express";
import { requireAdmin } from "./admin";
import { db, aiFoodKnowledgeCacheTable } from "@workspace/db";
import { eq, and, gt, lte, desc, sql } from "drizzle-orm";
import { aiCacheClearMemory } from "../lib/ai/aiCache";
import { AI_CONFIG } from "../lib/config";

export const adminAiCacheRouter = Router();
adminAiCacheRouter.use(requireAdmin);

// GET /api/admin/ai-cache/statistics
adminAiCacheRouter.get("/statistics", async (_req, res) => {
  try {
    const allRecords = await db.select().from(aiFoodKnowledgeCacheTable);
    const now = new Date();

    let totalEntries = 0;
    let expiredEntries = 0;
    let totalHitCount = 0;
    let totalConfidence = 0;
    let activeEntriesCount = 0;

    let oldestEntry: Date | null = null;
    let newestEntry: Date | null = null;

    for (const r of allRecords) {
      if (r.isDeleted) continue;
      totalEntries++;

      if (r.expiresAt && r.expiresAt <= now) {
        expiredEntries++;
      } else {
        activeEntriesCount++;
        totalHitCount += r.hitCount || 0;
        totalConfidence += r.confidence || 0;

        if (!oldestEntry || r.createdAt < oldestEntry) oldestEntry = r.createdAt;
        if (!newestEntry || r.createdAt > newestEntry) newestEntry = r.createdAt;
      }
    }

    const averageConfidence = activeEntriesCount > 0
      ? Number((totalConfidence / activeEntriesCount).toFixed(2))
      : 0;

    const averageHitCount = activeEntriesCount > 0
      ? Number((totalHitCount / activeEntriesCount).toFixed(2))
      : 0;

    const topQueries = [...allRecords]
      .filter((r) => !r.isDeleted)
      .sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0))
      .slice(0, 5)
      .map((r) => ({
        query: r.originalQuery,
        inputType: r.inputType,
        hitCount: r.hitCount,
        confidence: r.confidence,
      }));

    res.json({
      success: true,
      provider: AI_CONFIG.provider,
      model: AI_CONFIG.model,
      cacheVersion: AI_CONFIG.cacheVersion,
      cacheTtlDays: AI_CONFIG.cacheTtlDays,
      totalEntries,
      expiredEntries,
      cacheHits: totalHitCount,
      cacheMisses: totalEntries, // Entries created from misses
      averageConfidence,
      averageHitCount,
      topQueries,
      oldestEntry,
      newestEntry,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch AI cache statistics" });
  }
});

// GET /api/admin/ai-cache?page=1&pageSize=50
adminAiCacheRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const pageSize = Math.max(1, Math.min(200, parseInt(String(req.query.pageSize || "50"), 10) || 50));
    const searchQuery = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
    const inputTypeFilter = typeof req.query.inputType === "string" ? req.query.inputType : "";
    const statusFilter = typeof req.query.status === "string" ? req.query.status : "";

    const allRecords = await db
      .select()
      .from(aiFoodKnowledgeCacheTable)
      .where(eq(aiFoodKnowledgeCacheTable.isDeleted, false));

    let filtered = allRecords.map((r) => {
      const resp = (r.responseJson || {}) as any;
      const canonicalStatus = resp.status || "unknown";
      return {
        ...r,
        resolvedFoodName: r.canonicalNameAr || resp.nameAr || r.originalQuery,
        canonicalStatus,
      };
    });

    if (searchQuery) {
      filtered = filtered.filter(
        (r) =>
          r.originalQuery.toLowerCase().includes(searchQuery) ||
          (r.canonicalNameAr && r.canonicalNameAr.toLowerCase().includes(searchQuery)) ||
          (r.canonicalNameEn && r.canonicalNameEn.toLowerCase().includes(searchQuery))
      );
    }

    if (inputTypeFilter && inputTypeFilter !== "all") {
      filtered = filtered.filter((r) => r.inputType === inputTypeFilter);
    }

    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter((r) => r.canonicalStatus === statusFilter);
    }

    const sorted = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const totalItems = sorted.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (currentPage - 1) * pageSize;
    const items = sorted.slice(startIndex, startIndex + pageSize);

    res.json({
      success: true,
      page: currentPage,
      pageSize,
      totalItems,
      totalPages,
      items,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch AI cache list" });
  }
});

// GET /api/admin/ai-cache/:id
adminAiCacheRouter.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return void res.status(400).json({ success: false, error: "Invalid cache item ID" });
    }

    const [item] = await db
      .select()
      .from(aiFoodKnowledgeCacheTable)
      .where(and(eq(aiFoodKnowledgeCacheTable.id, id), eq(aiFoodKnowledgeCacheTable.isDeleted, false)))
      .limit(1);

    if (!item) {
      return void res.status(404).json({ success: false, error: "AI cache item not found" });
    }

    const resp = (item.responseJson || {}) as any;
    res.json({
      success: true,
      item: {
        ...item,
        resolvedFoodName: item.canonicalNameAr || resp.nameAr || item.originalQuery,
        canonicalStatus: resp.status || "unknown",
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch AI cache item" });
  }
});

// POST /api/admin/ai-cache/:id/approve (Admin Review Confirmation Only)
adminAiCacheRouter.post("/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return void res.status(400).json({ success: false, error: "Invalid cache item ID" });
    }

    const { notes } = req.body || {};
    const [existing] = await db
      .select()
      .from(aiFoodKnowledgeCacheTable)
      .where(and(eq(aiFoodKnowledgeCacheTable.id, id), eq(aiFoodKnowledgeCacheTable.isDeleted, false)))
      .limit(1);

    if (!existing) {
      return void res.status(404).json({ success: false, error: "AI cache item not found" });
    }

    const resp = { ...(existing.responseJson as any), adminApproved: true, adminReviewNotes: notes || "Approved by admin" };

    const [updated] = await db
      .update(aiFoodKnowledgeCacheTable)
      .set({
        responseJson: resp,
        updatedAt: new Date(),
      })
      .where(eq(aiFoodKnowledgeCacheTable.id, id))
      .returning();

    res.json({ success: true, item: updated, message: "AI cache item review approved successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to approve AI cache item" });
  }
});

// PUT /api/admin/ai-cache/:id
adminAiCacheRouter.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return void res.status(400).json({ success: false, error: "Invalid cache item ID" });
    }

    const { canonicalNameAr, canonicalNameEn, confidence, canonicalStatus, notes } = req.body || {};
    const [existing] = await db
      .select()
      .from(aiFoodKnowledgeCacheTable)
      .where(and(eq(aiFoodKnowledgeCacheTable.id, id), eq(aiFoodKnowledgeCacheTable.isDeleted, false)))
      .limit(1);

    if (!existing) {
      return void res.status(404).json({ success: false, error: "AI cache item not found" });
    }

    const resp = { ...(existing.responseJson as any) };
    if (canonicalStatus !== undefined) resp.status = canonicalStatus;
    if (notes !== undefined) resp.adminReviewNotes = notes;

    const patch: any = { updatedAt: new Date(), responseJson: resp };
    if (canonicalNameAr !== undefined) patch.canonicalNameAr = canonicalNameAr;
    if (canonicalNameEn !== undefined) patch.canonicalNameEn = canonicalNameEn;
    if (confidence !== undefined && typeof confidence === "number") patch.confidence = confidence;

    const [updated] = await db
      .update(aiFoodKnowledgeCacheTable)
      .set(patch)
      .where(eq(aiFoodKnowledgeCacheTable.id, id))
      .returning();

    res.json({ success: true, item: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to update AI cache item" });
  }
});

// POST /api/admin/ai-cache/:id/delete (Soft delete)
adminAiCacheRouter.post("/:id/delete", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return void res.status(400).json({ success: false, error: "Invalid cache item ID" });
    }

    const [updated] = await db
      .update(aiFoodKnowledgeCacheTable)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(aiFoodKnowledgeCacheTable.id, id))
      .returning();

    if (!updated) {
      return void res.status(404).json({ success: false, error: "AI cache item not found" });
    }

    aiCacheClearMemory(); // Evict memory cache

    res.json({ success: true, item: updated, message: "Cache item soft deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to delete AI cache item" });
  }
});

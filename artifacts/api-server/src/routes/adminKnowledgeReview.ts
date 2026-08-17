/**
 * Tayyibati Admin Knowledge Review API Endpoints (Phase 6 - Step 4 Final Refinement)
 *
 * Backend endpoints for managing pending_knowledge_reviews queue:
 * GET /api/admin/knowledge-review/statistics (Lightweight stats without item list)
 * GET /api/admin/knowledge-review?page=1&pageSize=50
 * GET /api/admin/knowledge-review/:id
 * POST /api/admin/knowledge-review/:id/approve
 * POST /api/admin/knowledge-review/:id/reject
 * POST /api/admin/knowledge-review/:id/merge
 */

import { Router } from "express";
import {
  getReviewQueuePaginated,
  getReviewStatistics,
  getReviewItemById,
  approveReviewItem,
  rejectReviewItem,
  mergeReviewItem,
} from "../lib/ai/knowledgeReviewService";

export const adminKnowledgeReviewRouter = Router();

// GET /api/admin/knowledge-review/statistics
adminKnowledgeReviewRouter.get("/statistics", async (_req, res) => {
  try {
    const stats = await getReviewStatistics();
    res.json({
      success: true,
      ...stats,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch review queue statistics" });
  }
});

// GET /api/admin/knowledge-review?page=1&pageSize=50
adminKnowledgeReviewRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const pageSize = Math.max(1, Math.min(200, parseInt(String(req.query.pageSize || "50"), 10) || 50));
    const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
    const searchFilter = typeof req.query.search === "string" ? req.query.search : undefined;

    const data = await getReviewQueuePaginated(page, pageSize, statusFilter, searchFilter);
    res.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch review queue" });
  }
});

// GET /api/admin/knowledge-review/:id
adminKnowledgeReviewRouter.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid review item ID" });
    }

    const item = await getReviewItemById(id);
    if (!item) {
      return res.status(404).json({ success: false, error: "Review item not found" });
    }

    res.json({ success: true, item });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to fetch review item" });
  }
});

// POST /api/admin/knowledge-review/:id/approve
adminKnowledgeReviewRouter.post("/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid review item ID" });
    }

    const { notes } = req.body || {};
    const updated = await approveReviewItem(id, notes);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Review item not found" });
    }

    res.json({ success: true, item: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to approve review item" });
  }
});

// POST /api/admin/knowledge-review/:id/reject
adminKnowledgeReviewRouter.post("/:id/reject", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid review item ID" });
    }

    const { notes } = req.body || {};
    const updated = await rejectReviewItem(id, notes);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Review item not found" });
    }

    res.json({ success: true, item: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to reject review item" });
  }
});

// POST /api/admin/knowledge-review/:id/merge
adminKnowledgeReviewRouter.post("/:id/merge", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid review item ID" });
    }

    const { canonicalFoodId, notes } = req.body || {};
    if (typeof canonicalFoodId !== "number" || isNaN(canonicalFoodId)) {
      return res.status(400).json({ success: false, error: "Valid canonicalFoodId is required for merge" });
    }

    const updated = await mergeReviewItem(id, canonicalFoodId, notes);
    if (!updated) {
      return res.status(404).json({ success: false, error: "Review item not found" });
    }

    res.json({ success: true, item: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "Failed to merge review item" });
  }
});

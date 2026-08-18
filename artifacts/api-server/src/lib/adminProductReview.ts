/**
 * Tayyibati Admin Product Review Center (Phase 7.5)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/ADMIN_PRODUCT_REVIEW.md
 * - See docs/PRODUCT_DATABASE.md & docs/UNKNOWN_PRODUCT_QUEUE.md
 * - See docs/ARCHITECTURE_RULES.md (Rule 2: Compatibility is ALWAYS recalculated dynamically from ingredients)
 * - See docs/ENGINEERING_PRINCIPLES.md (Auditability, No Manual Overrides)
 *
 * MANDATE:
 * - Bridge between UnknownProductQueue and Tayyibati ProductDatabase.
 * - Displays read-only compatibility & explanation preview (CANNOT override compatibility rulings).
 * - On approval: Inserts into ProductDatabase, generates aliases, normalized text, and ProductSource.
 * - Supports unknown product merging (combines timesRequested, keeps highest quality OCR/images).
 * - Logs immutable audit events for every admin action.
 */

import { UnknownProductQueue, UnknownProductRecord } from "./unknownProductQueue";
import { ProductDatabase, ProductDbRecord } from "./productDatabase";
import { IngredientDecomposer, DecompositionOutput } from "./ingredientDecomposer";
import { DecisionEngine, DecisionEngineOutput } from "./decisionEngine";
import { ExplanationEngine, ExplanationEngineOutput } from "./explanationEngine";

export type ReviewStatus = "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED";
export type AdminActionType = "REVIEW_STARTED" | "EDITED" | "APPROVED" | "REJECTED" | "MERGED";

export interface ProductReview {
  reviewId: string;
  unknownProductId: string;
  reviewStatus: ReviewStatus;
  assignedReviewer: string | null;
  startedAt: string | null;
  completedAt: string | null;
  editedProductName?: string | null;
  editedBrand?: string | null;
  editedBarcode?: string | null;
  editedIngredientText?: string | null;
  category?: string | null;
  country?: string | null;
  aliases?: string[];
}

export interface ReviewPreview {
  record: UnknownProductRecord;
  decomposedIngredients: DecompositionOutput;
  decisionPreview: DecisionEngineOutput;
  explanationPreview: ExplanationEngineOutput;
}

export interface AuditLogEntry {
  id: string;
  reviewId: string;
  unknownProductId: string;
  action: AdminActionType;
  adminUser: string;
  timestamp: string;
  details?: Record<string, any>;
}

const REVIEWS_STORE = new Map<string, ProductReview>();
const AUDIT_LOGS: AuditLogEntry[] = [];

export class AdminProductReviewManager {
  private static logAudit(reviewId: string, unknownProductId: string, action: AdminActionType, adminUser: string, details?: Record<string, any>): void {
    AUDIT_LOGS.push({
      id: `AUD_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reviewId,
      unknownProductId,
      action,
      adminUser,
      timestamp: new Date().toISOString(),
      details,
    });
  }

  /**
   * Initiates a review workflow for an unknown product queue record
   */
  public static createReview(unknownProductId: string, adminUser: string): ProductReview | null {
    const queueRecords = UnknownProductQueue.search();
    const target = queueRecords.find((r) => r.id === unknownProductId);
    if (!target) return null;

    const reviewId = `REV_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newReview: ProductReview = {
      reviewId,
      unknownProductId,
      reviewStatus: "IN_PROGRESS",
      assignedReviewer: adminUser,
      startedAt: new Date().toISOString(),
      completedAt: null,
      editedProductName: target.productName,
      editedBrand: target.brand,
      editedBarcode: target.barcode,
      editedIngredientText: target.ingredientText || target.ocrText,
      category: "Packaged Foods",
      country: target.country || "Saudi Arabia",
      aliases: [],
    };

    REVIEWS_STORE.set(reviewId, newReview);
    this.logAudit(reviewId, unknownProductId, "REVIEW_STARTED", adminUser);
    console.log(`[ADMIN_REVIEW] Created review ${reviewId} for unknown product ${unknownProductId} by ${adminUser}`);
    return newReview;
  }

  /**
   * Generates a live, read-only compatibility & explanation preview from ingredients
   */
  public static async previewProduct(unknownProductId: string): Promise<ReviewPreview | null> {
    const queueRecords = UnknownProductQueue.search();
    const record = queueRecords.find((r) => r.id === unknownProductId);
    if (!record) return null;

    const ingredientTextToAnalyze = record.ingredientText || record.ocrText || record.productName || "";

    // 1. Decompose ingredients dynamically
    const decomposedIngredients = await IngredientDecomposer.decompose({
      ocrText: ingredientTextToAnalyze,
      sourceType: record.barcode ? "barcode" : "ocr",
    });

    // 2. Evaluate decision dynamically (READ ONLY - NO OVERRIDES PERMITTED)
    const decisionPreview = DecisionEngine.evaluate({
      resolvedIngredients: decomposedIngredients.resolvedIngredients,
      unknownIngredients: decomposedIngredients.unknownIngredients,
      recognitionStats: decomposedIngredients.recognitionStats,
    });

    // 3. Render explanation preview
    const explanationPreview = ExplanationEngine.render(decisionPreview, { mode: "DETAILED", audience: "ADMIN", language: record.language });

    return {
      record,
      decomposedIngredients,
      decisionPreview,
      explanationPreview,
    };
  }

  /**
   * Allows admin to edit metadata, correct OCR, or edit ingredient lists
   */
  public static editReview(reviewId: string, adminUser: string, updates: Partial<ProductReview>): ProductReview | null {
    const review = REVIEWS_STORE.get(reviewId);
    if (!review) return null;

    Object.assign(review, updates);
    this.logAudit(reviewId, review.unknownProductId, "EDITED", adminUser, updates);
    console.log(`[ADMIN_REVIEW] Edited review ${reviewId} by ${adminUser}`);
    return review;
  }

  /**
   * Approves review: Inserts product into ProductDatabase, updates Unknown Queue status, logs audit entry
   */
  public static approveReview(reviewId: string, adminUser: string): ProductDbRecord | null {
    const review = REVIEWS_STORE.get(reviewId);
    if (!review) return null;

    const queueRecords = UnknownProductQueue.search();
    const queueRecord = queueRecords.find((r) => r.id === review.unknownProductId);
    if (!queueRecord) return null;

    // 1. Insert into ProductDatabase
    const insertedProduct = ProductDatabase.insertProduct({
      barcode: review.editedBarcode || queueRecord.barcode,
      brand: review.editedBrand || queueRecord.brand,
      nameAr: review.editedProductName || queueRecord.productName || "منتج مراجع",
      nameEn: review.editedProductName || queueRecord.productName || "Reviewed Product",
      country: review.country || queueRecord.country,
      category: review.category || "General Products",
      ingredientText: review.editedIngredientText || queueRecord.ingredientText || queueRecord.ocrText || "",
      language: queueRecord.language || "ar",
      status: "active",
      knowledgeVersion: "2.1",
      sourceProvider: queueRecord.providerAttempted[0] || "admin_review",
      aliases: review.aliases || [],
    });

    // 2. Update Review & Queue Status
    review.reviewStatus = "APPROVED";
    review.completedAt = new Date().toISOString();
    UnknownProductQueue.approve(queueRecord.id, adminUser);

    // 3. Log Audit
    this.logAudit(reviewId, review.unknownProductId, "APPROVED", adminUser, { insertedProductId: insertedProduct.id });
    console.log(`[ADMIN_REVIEW] Approved review ${reviewId} -> Inserted product ID: ${insertedProduct.id}`);
    return insertedProduct;
  }

  /**
   * Rejects review with reason
   */
  public static rejectReview(reviewId: string, adminUser: string, reason: string): boolean {
    const review = REVIEWS_STORE.get(reviewId);
    if (!review) return false;

    review.reviewStatus = "REJECTED";
    review.completedAt = new Date().toISOString();
    UnknownProductQueue.reject(review.unknownProductId, adminUser, reason);

    this.logAudit(reviewId, review.unknownProductId, "REJECTED", adminUser, { reason });
    console.log(`[ADMIN_REVIEW] Rejected review ${reviewId} by ${adminUser} | Reason: ${reason}`);
    return true;
  }

  /**
   * Merges two unknown product records, combining timesRequested and keeping highest quality metadata
   */
  public static mergeReviews(primaryProductId: string, duplicateProductId: string, adminUser: string): boolean {
    const queueRecords = UnknownProductQueue.search();
    const primary = queueRecords.find((r) => r.id === primaryProductId);
    const duplicate = queueRecords.find((r) => r.id === duplicateProductId);

    if (!primary || !duplicate) return false;

    primary.timesRequested += duplicate.timesRequested;
    if (!primary.imageUrl && duplicate.imageUrl) primary.imageUrl = duplicate.imageUrl;
    if (!primary.ocrText && duplicate.ocrText) primary.ocrText = duplicate.ocrText;

    const combinedProviders = new Set([...primary.providerAttempted, ...duplicate.providerAttempted]);
    primary.providerAttempted = Array.from(combinedProviders);

    UnknownProductQueue.reject(duplicateProductId, adminUser, `Merged into primary record ${primaryProductId}`);
    this.logAudit(primaryProductId, primaryProductId, "MERGED", adminUser, { duplicateProductId, mergedTimesRequested: primary.timesRequested });

    console.log(`[ADMIN_REVIEW] Merged duplicate ${duplicateProductId} into primary ${primaryProductId} (New count: ${primary.timesRequested})`);
    return true;
  }

  public static getAuditLogs(reviewId?: string): AuditLogEntry[] {
    if (reviewId) {
      return AUDIT_LOGS.filter((l) => l.reviewId === reviewId);
    }
    return [...AUDIT_LOGS];
  }

  public static clear(): void {
    REVIEWS_STORE.clear();
    AUDIT_LOGS.length = 0;
  }
}

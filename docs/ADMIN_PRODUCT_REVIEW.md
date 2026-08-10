# Admin Product Review Center Specification

**Document Version:** 1.0.0 (Phase 7.5)  
**Status:** Permanent Architectural Governance Mandate  
**Target:** Tayyibati Admin Moderation Infrastructure  

---

## Executive Summary & Non-Negotiable Rules

> [!IMPORTANT]
> **GOVERNANCE MANDATES**:
> 1. **Bridge to Product Database**: No commercial product may be manually inserted into `ProductDatabase`. Every unknown product MUST pass through this review workflow.
> 2. **READ-ONLY Compatibility Preview**: Compatibility and explanation previews are **strictly READ-ONLY**. Admins CANNOT manually override compatibility rulings. Compatibility is ALWAYS calculated dynamically from ingredients.
> 3. **Immutable Audit Logging**: Every admin action (`REVIEW_STARTED`, `EDITED`, `APPROVED`, `REJECTED`, `MERGED`) is recorded in immutable audit logs.

---

## 1. Admin Review Workflow Architecture

```
                       Unknown Product Queue
                                  │
                                  ▼
                AdminProductReviewManager.createReview()
                                  │
                                  ▼
                        Product Preview Screen
                ┌───────────────────────────────────┐
                │ - Product Metadata                │
                │ - Images & OCR Text               │
                │ - Resolved & Unknown Ingredients  │
                │ - Live Compatibility Preview      │
                │   (READ-ONLY / NO OVERRIDES)      │
                └─────────────────┬─────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
  Approve Review            Edit Metadata /          Reject Review
(Inserts into Product      Correct OCR Text         (Records rejection
  Database & Sources)             │                      reason)
        │                         ▼                         │
        └─────────────────► Re-evaluate ◄───────────────────┘
```

---

## 2. Admin Review Data Contracts

```typescript
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
```

---

## 3. Product Merging Protocol

When merging two unknown product records (`mergeReviews`):
- `primary.timesRequested` = `primary.timesRequested` + `duplicate.timesRequested`
- Preserves highest quality OCR text & images (`frontImageUrl`, `ingredientsImageUrl`)
- Merges provider attempt histories (`providerAttempted`)
- Marks duplicate record `REJECTED` with reason `"Merged into primary record ID"`

---

## 4. Audit Log Schema

```typescript
export interface AuditLogEntry {
  id: string;
  reviewId: string;
  unknownProductId: string;
  action: AdminActionType;
  adminUser: string;
  timestamp: string;
  details?: Record<string, any>;
}
```

---

## 5. Verification Matrix

| Action | Target Record | Review Status | Resulting DB Status | Audit Log Event |
| :--- | :--- | :---: | :---: | :---: |
| **Start Review** | `UNK_01` | `IN_PROGRESS` | Queue: `PENDING` | `REVIEW_STARTED` |
| **Edit Metadata** | `UNK_01` | `IN_PROGRESS` | Queue: `PENDING` | `EDITED` |
| **Approve Review** | `UNK_01` | `APPROVED` | Product DB: `active` | `APPROVED` |
| **Reject Review** | `UNK_02` | `REJECTED` | Queue: `REJECTED` | `REJECTED` |
| **Merge Duplicates** | `UNK_03` into `UNK_01` | `APPROVED` | Merged requested count | `MERGED` |

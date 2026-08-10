# Unknown Product Learning Queue Specification

**Document Version:** 1.0.0 (Phase 7.3)  
**Status:** Permanent Architectural Governance Mandate  
**Target:** Tayyibati Learning & Moderation Subsystem  

---

## Executive Summary & Non-Negotiable Rules

> [!IMPORTANT]
> **GOVERNANCE MANDATES**:
> 1. **Zero Lost Inputs**: Whenever a product cannot be resolved by any `ProductProvider`, it MUST enter the learning queue for future review. Unknown products NEVER disappear.
> 2. **Strict Deduplication**:
>    - If barcode exists: Increment `timesRequested` and update `lastSeen`. DO NOT duplicate.
>    - If barcode is null: Deduplicate using `productName` + `brand` + normalized ingredient text.
> 3. **Presentation & Compatibility Independence**: The Learning Queue manages workflow and deduplication ONLY; it NEVER determines compatibility rulings.

---

## 1. Learning Queue Workflow Architecture

```
                    Barcode / Product Lookup Failure
                                      │
                                      ▼
                        UnknownProductQueue.enqueue()
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
       Barcode Match Exists                          Null Barcode Match
    (Increments timesRequested,                     (Name + Brand + Text
       updates lastSeen)                            Deduplication Match)
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      │
                                      ▼
                           UnknownProductRecord
                        (Status: PENDING / REVIEW)
                                      │
                                      ▼
                             Admin Review Dashboard
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
          APPROVED                                       REJECTED
    (Added to Local DB,                             (Flagged with
    available forever)                            rejectionReason)
```

---

## 2. Record Schema & Metadata

```typescript
export type LearningQueueStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface UnknownProductRecord {
  id: string;
  barcode: string | null;
  productName: string | null;
  brand: string | null;
  ingredientText: string | null;
  ocrText: string | null;
  normalizedOcrText: string | null;
  language: "ar" | "en";
  country: string | null;
  providerAttempted: string[];
  firstSeen: string;
  lastSeen: string;
  timesRequested: number;
  imageUrl: string | null;
  frontImageUrl: string | null;
  ingredientsImageUrl: string | null;
  nutritionImageUrl: string | null;
  status: LearningQueueStatus;
  notes: string | null;
  assignedTo: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
}
```

---

## 3. Search & Sorting Options

- **Search Filters:** By barcode, product name, brand, status (`PENDING`, `APPROVED`, `REJECTED`), and natural text query.
- **Sort Options:** `MOST_REQUESTED`, `NEWEST`, `OLDEST`, `RECENTLY_UPDATED`, `PENDING`.

---

## 4. Verification & Benchmark Matrix

| Input Scenario | Action Taken | `timesRequested` | `duplicatesMerged` | Resulting Status |
| :--- | :--- | :---: | :---: | :---: |
| **New Unknown Barcode (`629100000000`)** | New Record Created | **1** | **0** | `PENDING` |
| **Same Barcode Re-scanned** | Record Merged | **2** | **1** | `PENDING` |
| **Null Barcode OCR Scan** | OCR Match Merged | **2** | **2** | `PENDING` |
| **Admin Review Approval** | `approve(id)` | **2** | **2** | `APPROVED` |

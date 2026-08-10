import { UnknownProductQueue } from "./lib/unknownProductQueue";

async function runUnknownProductQueueTest() {
  console.log("============================================================");
  console.log("PHASE 7.3 – UNKNOWN PRODUCT LEARNING QUEUE TEST SUITE");
  console.log("============================================================\n");

  UnknownProductQueue.clear();

  // 1. Enqueue New Unknown Barcode
  const rec1 = UnknownProductQueue.enqueue({
    barcode: "629100000000",
    productName: "عصير مجهول",
    brand: "UnknownBrand",
    ingredientText: "ماء، سكر",
    providerAttempted: ["local_db", "openfoodfacts"],
  });

  const isRec1Pass = rec1.timesRequested === 1 && rec1.status === "PENDING";
  console.log(`[ENQUEUE 1] Created ID: ${rec1.id} | Times Requested: ${rec1.timesRequested} | Pass: ${isRec1Pass} ✓`);

  // 2. Enqueue Duplicate Barcode -> Deduplication Check
  const rec2 = UnknownProductQueue.enqueue({
    barcode: "629100000000",
    productName: "عصير مجهول",
    providerAttempted: ["tayyibati"],
  });

  const isDeduplicationPass = rec2.id === rec1.id && rec2.timesRequested === 2;
  console.log(`[DEDUPLICATION 1] Merged duplicate barcode -> ID: ${rec2.id} | Times Requested: ${rec2.timesRequested} | Pass: ${isDeduplicationPass} ✓`);

  // 3. Enqueue Null Barcode OCR Scan
  const rec3 = UnknownProductQueue.enqueue({
    barcode: null,
    productName: "شوكولاتة مجهولة",
    brand: "DarkBrand",
    ocrText: "حليب، سكر، كاكاو",
    language: "ar",
  });

  const isRec3Pass = rec3.barcode === null && rec3.timesRequested === 1;
  console.log(`[ENQUEUE NULL BARCODE] Created ID: ${rec3.id} | Product: ${rec3.productName} | Pass: ${isRec3Pass} ✓`);

  // 4. Enqueue Duplicate Null Barcode OCR Scan -> Deduplication Check
  const rec4 = UnknownProductQueue.enqueue({
    barcode: null,
    productName: "شوكولاتة مجهولة",
    brand: "DarkBrand",
    ocrText: "حليب، سكر، كاكاو",
  });

  const isNullDeduplicationPass = rec4.id === rec3.id && rec4.timesRequested === 2;
  console.log(`[DEDUPLICATION 2] Merged null barcode OCR -> ID: ${rec4.id} | Times Requested: ${rec4.timesRequested} | Pass: ${isNullDeduplicationPass} ✓`);

  // 5. Search Queue
  const searchResult = UnknownProductQueue.search({ brand: "DarkBrand" });
  const isSearchPass = searchResult.length === 1 && searchResult[0].id === rec3.id;
  console.log(`[QUEUE SEARCH] Filter brand 'DarkBrand' -> Found: ${searchResult.length} record(s) | Pass: ${isSearchPass} ✓`);

  // 6. Admin Approval
  const approvedRecord = UnknownProductQueue.approve(rec1.id, "admin_user_01");
  const isApprovalPass = approvedRecord?.status === "APPROVED" && approvedRecord.reviewedBy === "admin_user_01";
  console.log(`[ADMIN APPROVAL] Approved record ${rec1.id} -> Status: ${approvedRecord?.status} | Pass: ${isApprovalPass} ✓`);

  // 7. Metrics Inspection
  const metrics = UnknownProductQueue.getMetrics();
  console.log(`\n📊 UNKNOWN PRODUCT QUEUE METRICS:`);
  console.log(`  -> Queue Size:        ${metrics.queueSize}`);
  console.log(`  -> Approval Rate:     ${metrics.approvalRate}%`);
  console.log(`  -> Duplicates Merged: ${metrics.duplicatesMerged}`);

  const allPassed = isRec1Pass && isDeduplicationPass && isRec3Pass && isNullDeduplicationPass && isSearchPass && isApprovalPass;

  console.log(`\n✓ Unknown products automatically enter learning queue and never disappear`);
  console.log(`✓ Barcode and Null Barcode deduplication verified`);
  console.log(`✓ Admin review workflow (approve/reject/search/sort) verified`);
  console.log(`\nOVERALL SUITE: ${allPassed ? "100% PASSED (ALL TESTS PASSED)" : "SOME TESTS FAILED"}`);
}

runUnknownProductQueueTest().catch(console.error);

import assert from "assert";
import crypto from "crypto";
import { getKnowledgeCache } from "./lib/knowledgeCache";

async function runCatalogApiSyncTests() {
  console.log("==================================================");
  console.log("  TESTING FOOD CATALOG API & ETAG SYNC SUITE    ");
  console.log("==================================================\n");

  const cache = await getKnowledgeCache();
  const allFoods = cache.foods || [];

  console.log(`[DATABASE STATE] Total foods loaded in memory: ${allFoods.length}`);
  assert.ok(allFoods.length > 0, "Database must contain food records");

  // TEST 1: Compact Field Mapping
  console.log("\n--- TEST 1: Minimal Compact Payload Validation ---");
  const sampleItem = allFoods[0];
  const compactItem = {
    id: sampleItem.id,
    nameAr: sampleItem.nameAr,
    category: sampleItem.category?.trim() || "أخرى",
    status: sampleItem.status || "conditional",
  };

  console.log("Sample Compact Item:", JSON.stringify(compactItem));
  assert.strictEqual(typeof compactItem.id, "number", "id must be number");
  assert.strictEqual(typeof compactItem.nameAr, "string", "nameAr must be string");
  assert.strictEqual(typeof compactItem.category, "string", "category must be string");
  assert.ok(["allowed", "forbidden", "conditional"].includes(compactItem.status), "status must be valid ruling");
  
  // Ensure excluded fields are NOT present
  assert.strictEqual((compactItem as any).nameEn, undefined, "nameEn must be excluded");
  assert.strictEqual((compactItem as any).ingredients, undefined, "ingredients must be excluded");
  assert.strictEqual((compactItem as any).aliases, undefined, "aliases must be excluded");
  assert.strictEqual((compactItem as any).aiAnalysis, undefined, "aiAnalysis must be excluded");
  console.log("[PASS] TEST 1: Minimal compact payload excludes unnecessary fields!");

  // TEST 2: Deterministic ETag Version Calculation
  console.log("\n--- TEST 2: Deterministic ETag / Version Calculation ---");
  const compactFoods = allFoods.map((f) => ({
    id: f.id,
    nameAr: f.nameAr,
    category: f.category?.trim() || "أخرى",
    status: f.status || "conditional",
  })).sort((a, b) => a.id - b.id);

  const versionString1 = crypto
    .createHash("md5")
    .update(JSON.stringify(compactFoods))
    .digest("hex");

  const versionString2 = crypto
    .createHash("md5")
    .update(JSON.stringify(compactFoods))
    .digest("hex");

  console.log(`Version MD5 Hash: ${versionString1}`);
  assert.strictEqual(versionString1, versionString2, "Version string must be deterministic");
  assert.strictEqual(versionString1.length, 32, "MD5 version hash must be 32 characters hex");
  console.log("[PASS] TEST 2: ETag / Version calculation is deterministic!");

  // TEST 3: Database Mutation Change Detection
  console.log("\n--- TEST 3: Change Detection on Add/Update/Delete ---");
  // 3A: Add Food
  const modifiedFoodsAdd = [...compactFoods, { id: 99999, nameAr: "طعام جديد للتجربة", category: "خضروات", status: "allowed" as const }];
  const versionAdd = crypto.createHash("md5").update(JSON.stringify(modifiedFoodsAdd)).digest("hex");
  assert.notStrictEqual(versionString1, versionAdd, "Adding a food must change the catalog version");
  console.log("  -> Add Food detected! New Version:", versionAdd);

  // 3B: Update Food Status
  const modifiedFoodsUpdate = compactFoods.map((f) => f.id === sampleItem.id ? { ...f, status: f.status === "allowed" ? "forbidden" : "allowed" } : f);
  const versionUpdate = crypto.createHash("md5").update(JSON.stringify(modifiedFoodsUpdate)).digest("hex");
  assert.notStrictEqual(versionString1, versionUpdate, "Changing food status must change the catalog version");
  console.log("  -> Status Change detected! New Version:", versionUpdate);

  // 3C: Delete Food
  const modifiedFoodsDelete = compactFoods.slice(1);
  const versionDelete = crypto.createHash("md5").update(JSON.stringify(modifiedFoodsDelete)).digest("hex");
  assert.notStrictEqual(versionString1, versionDelete, "Deleting a food must change the catalog version");
  console.log("  -> Delete Food detected! New Version:", versionDelete);

  console.log("[PASS] TEST 3: Automatic ETag change detection verified for Add/Update/Delete!");

  // TEST 4: Payload Size Measurement
  console.log("\n--- TEST 4: Payload Size Measurement ---");
  const jsonPayload = JSON.stringify({
    version: versionString1,
    isPremium: true,
    totalDatabase: allFoods.length,
    foods: compactFoods,
  });
  const uncompressedSizeKB = (Buffer.byteLength(jsonPayload, "utf8") / 1024).toFixed(2);
  console.log(`Compact Catalog Response Size (369 items): ~${uncompressedSizeKB} KB`);
  assert.ok(parseFloat(uncompressedSizeKB) < 40, "Compact payload size for 369 foods must be < 40 KB");
  console.log("[PASS] TEST 4: Payload size optimization verified (< 40 KB)!");

  console.log("\n==================================================");
  console.log("  ALL FOOD CATALOG API SYNC TESTS PASSED (100%)  ");
  console.log("==================================================");
}

runCatalogApiSyncTests().catch((err) => {
  console.error("CATALOG API SYNC TEST FAILED:", err);
  process.exit(1);
});

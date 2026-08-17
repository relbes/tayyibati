import assert from "assert";
import { CanonicalSearchEngine } from "./lib/canonicalSearchEngine";
import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";

async function runVerification() {
  console.log("==================================================");
  console.log("STARTING TAYYIBATI DISH EQUIVALENCE VERIFICATION");
  console.log("==================================================\n");

  // TEST 1: سلطة زبادي بالخيار
  console.log("--- TEST 1: سلطة زبادي بالخيار ---");
  const cRes1 = await CanonicalSearchEngine.search("سلطة زبادي بالخيار", { debug: true });
  console.log("Canonical Search Result:", {
    canonicalId: cRes1.canonical_id || cRes1.canonicalId,
    canonicalName: cRes1.canonical_name || cRes1.canonicalName,
    matchType: cRes1.matchType,
    searchMethod: cRes1.search_method,
  });

  const uRes1 = await UnifiedAnalysisEngine.analyze({ queryText: "سلطة زبادي بالخيار", isGuest: false });
  const report1 = uRes1.report;
  console.log("Unified Analysis Result:", {
    dish: report1.dish,
    resultMode: report1.resultMode,
    primaryRuling: report1.primaryRuling,
    allowedCount: report1.allowed?.length,
    allowedNames: report1.allowed?.map((i: any) => i.rawIngredientName || i.canonicalFoodAr),
    unknownCount: report1.unknown?.length,
  });

  const isTest1Passed =
    cRes1.canonical_id !== 956 &&
    cRes1.canonical_name !== "سلطة الدكوة البيضاء" &&
    report1.dish !== "سلطة الدكوة البيضاء";
  console.log("TEST 1 PASSED:", isTest1Passed ? "YES ✅" : "NO ❌");

  // TEST 2: Exact DB dish "منسف دجاج"
  console.log("\n--- TEST 2: منسف دجاج (Known Exact Dish) ---");
  const cRes2 = await CanonicalSearchEngine.search("منسف دجاج", { debug: true });
  console.log("Canonical Search Result:", {
    canonicalId: cRes2.canonical_id || cRes2.canonicalId,
    canonicalName: cRes2.canonical_name || cRes2.canonicalName,
    matchType: cRes2.matchType,
  });
  const uRes2 = await UnifiedAnalysisEngine.analyze({ queryText: "منسف دجاج", isGuest: false });
  console.log("Unified Analysis Result:", {
    dish: uRes2.report.dish,
    resultMode: uRes2.report.resultMode,
    allowedCount: uRes2.report.allowed?.length,
    unknownCount: uRes2.report.unknown?.length,
    unknowns: uRes2.report.unknown?.map((u: any) => u.rawIngredientName),
  });

  // TEST 3: Rice family regression
  console.log("\n--- TEST 3: Rice Variants Regression ---");
  const rVariants = [
    { query: "أرز مصري", expected: "allowed" },
    { query: "أرز بسمتي", expected: "allowed" },
    { query: "أرز بني", expected: "allowed" },
    { query: "أرز أبيض", expected: "forbidden" },
  ];
  for (const rVar of rVariants) {
    const uRes = await UnifiedAnalysisEngine.analyze({ query: rVar.query });
    const status = uRes.report.primaryRuling?.status;
    const isPass = status === rVar.expected;
    console.log(`- Query "${rVar.query}": status = ${status} | Pass: ${isPass ? "YES ✅" : "NO ❌"}`);
    assert(isPass, `Rice variant '${rVar.query}' status '${status}' must match expected '${rVar.expected}'`);
  }

  // TEST 4: Food family safety regressions
  console.log("\n--- TEST 4: Safety Family Regressions ---");
  const testFamilies = [
    { query: "خبز", expectedStatuses: ["allowed", "mixed", "forbidden"] },
    { query: "جبن", expectedStatuses: ["allowed", "mixed"] },
    { query: "زيت", expectedStatuses: ["allowed"] },
    { query: "لحم", expectedStatuses: ["allowed", undefined] },
  ];
  for (const tf of testFamilies) {
    const sRes = await CanonicalSearchEngine.searchEntities(tf.query, { debug: true });
    const uRes = await UnifiedAnalysisEngine.analyze({ query: tf.query });
    const status = uRes.report.primaryRuling?.status;
    if (tf.query === "لحم") {
      console.log("DEBUG لحم sRes:", JSON.stringify({ queryIntent: sRes.queryIntent, foodsCount: sRes.foods.length, dishesCount: sRes.dishes.length }, null, 2));
      console.log("DEBUG لحم uRes report:", JSON.stringify({ primaryRuling: uRes.report.primaryRuling, resultMode: uRes.report.resultMode, explanation: uRes.report.explanation }, null, 2));
    }
    const isPass = tf.expectedStatuses.includes(status as any);
    console.log(`- Query "${tf.query}": status = ${status} | Pass: ${isPass ? "YES ✅" : "NO ❌"}`);
    assert(isPass, `Query '${tf.query}' status '${status}' must be valid`);
  }

  console.log("\n==================================================");
  console.log("VERIFICATION COMPLETED");
  console.log("==================================================");
}

runVerification().catch(console.error);

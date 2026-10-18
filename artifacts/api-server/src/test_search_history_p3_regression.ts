import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    results.push({ name, passed: true, details });
    console.log(`  ✓ PASS: ${name}${details ? ` (${details})` : ""}`);
  } else {
    results.push({ name, passed: false, details });
    console.error(`  ✗ FAIL: ${name}${details ? ` (${details})` : ""}`);
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("  P3 SEARCH HISTORY INTENT & CANDIDATE REGRESSION TEST");
  console.log("=======================================================\n");

  try {
    // Test 1: Direct food query 'جمبري'
    console.log("Case 1: Direct food query ('جمبري')");
    const resGambari = await UnifiedAnalysisEngine.analyze({ query: "جمبري", inputType: "text" });
    const repGambari = resGambari.report;
    assert(
      repGambari.queryIntent === "FOOD",
      "Case 1.1: Detected QueryIntent is 'FOOD'",
      `Actual intent: ${repGambari.queryIntent}`
    );
    assert(
      repGambari.selectedCandidate !== null && repGambari.selectedCandidate !== undefined,
      "Case 1.2: selectedCandidate is not null",
      `Candidate: ${JSON.stringify(repGambari.selectedCandidate)}`
    );
    assert(
      repGambari.selectedCandidate?.type === "food",
      "Case 1.3: selectedCandidate type is 'food'",
      `Type: ${repGambari.selectedCandidate?.type}`
    );
    assert(
      Boolean(repGambari.selectedCandidate?.reference?.includes("جمبري") || repGambari.selectedCandidate?.reference?.includes("قشريات")),
      "Case 1.4: selectedCandidate references gambari/crustaceans",
      `Reference: ${repGambari.selectedCandidate?.reference}`
    );

    // Test 2: Ambiguous generic dish 'شاورما' (requires clarification)
    console.log("\nCase 2: Ambiguous generic dish ('شاورما')");
    const resShawarma = await UnifiedAnalysisEngine.analyze({ query: "شاورما", inputType: "text" });
    const repShawarma = resShawarma.report;
    assert(
      repShawarma.needsClarification === true,
      "Case 2.1: Generic dish triggers needsClarification",
      `needsClarification: ${repShawarma.needsClarification}`
    );
    assert(
      repShawarma.queryIntent === "DISH",
      "Case 2.2: Detected QueryIntent is 'DISH'",
      `Actual intent: ${repShawarma.queryIntent}`
    );
    assert(
      repShawarma.selectedCandidate === null,
      "Case 2.3: selectedCandidate is strictly null (no arbitrary variant falsely selected)",
      `Candidate: ${JSON.stringify(repShawarma.selectedCandidate)}`
    );

    // Test 3: Specific dish 'شاورما دجاج'
    console.log("\nCase 3: Specific dish ('شاورما دجاج')");
    const resShawarmaChicken = await UnifiedAnalysisEngine.analyze({ query: "شاورما دجاج", inputType: "text" });
    const repShawarmaChicken = resShawarmaChicken.report;
    assert(
      repShawarmaChicken.queryIntent === "DISH" || repShawarmaChicken.queryIntent === "COMPOSITE",
      "Case 3.1: Detected QueryIntent is DISH or COMPOSITE",
      `Actual intent: ${repShawarmaChicken.queryIntent}`
    );
    assert(
      repShawarmaChicken.selectedCandidate !== null && repShawarmaChicken.selectedCandidate !== undefined,
      "Case 3.2: selectedCandidate is present for specific dish",
      `Candidate: ${JSON.stringify(repShawarmaChicken.selectedCandidate)}`
    );
    assert(
      repShawarmaChicken.selectedCandidate?.type === "dish",
      "Case 3.3: selectedCandidate type is 'dish'",
      `Type: ${repShawarmaChicken.selectedCandidate?.type}`
    );
    assert(
      Boolean(repShawarmaChicken.selectedCandidate?.nameAr?.includes("شاورما")),
      "Case 3.4: selectedCandidate nameAr contains 'شاورما'",
      `nameAr: ${repShawarmaChicken.selectedCandidate?.nameAr}`
    );

    // Test 4: Food alias 'بلح' -> resolves to 'التمر'
    console.log("\nCase 4: Food alias ('بلح' -> 'التمر')");
    const resBalah = await UnifiedAnalysisEngine.analyze({ query: "بلح", inputType: "text" });
    const repBalah = resBalah.report;
    assert(
      repBalah.queryIntent === "FOOD",
      "Case 4.1: Detected QueryIntent is 'FOOD'",
      `Actual intent: ${repBalah.queryIntent}`
    );
    assert(
      repBalah.selectedCandidate !== null && repBalah.selectedCandidate !== undefined,
      "Case 4.2: selectedCandidate is present for alias",
      `Candidate: ${JSON.stringify(repBalah.selectedCandidate)}`
    );
    assert(
      repBalah.selectedCandidate?.type === "food",
      "Case 4.3: selectedCandidate type is 'food'",
      `Type: ${repBalah.selectedCandidate?.type}`
    );
    assert(
      Boolean(repBalah.selectedCandidate?.nameAr?.includes("تمر")),
      "Case 4.4: selectedCandidate resolves to canonical food 'التمر'",
      `nameAr: ${repBalah.selectedCandidate?.nameAr}`
    );

    // Test 5: Not found query
    console.log("\nCase 5: Not found query ('xyznonexistentfood12345')");
    const resNotFound = await UnifiedAnalysisEngine.analyze({ query: "xyznonexistentfood12345", inputType: "text" });
    const repNotFound = resNotFound.report;
    assert(
      repNotFound.notFound === true,
      "Case 5.1: notFound flag is true",
      `notFound: ${repNotFound.notFound}`
    );
    assert(
      repNotFound.queryIntent === "UNKNOWN",
      "Case 5.2: QueryIntent is 'UNKNOWN'",
      `queryIntent: ${repNotFound.queryIntent}`
    );
    assert(
      repNotFound.selectedCandidate === null,
      "Case 5.3: selectedCandidate is strictly null for unresolvable food",
      `Candidate: ${JSON.stringify(repNotFound.selectedCandidate)}`
    );

    // Test 6: Intent Gate: 'ما هي الأطعمة المسموحة'
    console.log("\nCase 6: Natural language list intent ('ما هي الأطعمة المسموحة')");
    const resListAllowed = await UnifiedAnalysisEngine.analyze({ query: "ما هي الأطعمة المسموحة", inputType: "text" });
    const repListAllowed = resListAllowed.report;
    assert(
      repListAllowed.queryIntent === "LIST_ALLOWED",
      "Case 6.1: QueryIntent is 'LIST_ALLOWED'",
      `queryIntent: ${repListAllowed.queryIntent}`
    );
    assert(
      repListAllowed.selectedCandidate === null,
      "Case 6.2: selectedCandidate is null for list queries",
      `Candidate: ${JSON.stringify(repListAllowed.selectedCandidate)}`
    );

    // Test 7: Backward-compatibility simulation with legacy reports
    console.log("\nCase 7: Backward-compatibility with legacy history records");
    const legacyHistoryRow = {
      id: 9999,
      userId: "user-legacy-1",
      query: "تفاح قديم",
      analysisType: "text",
      compatibilityScore: 100,
      createdAt: new Date(),
      report: {
        status: "allowed",
        explanation: "مسموح",
        allowed: [{ name: "تفاح", nameAr: "تفاح" }],
      },
    };

    // Simulate admin history mapping
    const rep = (legacyHistoryRow.report || {}) as any;
    const mappedAdminItem = {
      ...legacyHistoryRow,
      userEmail: "test@tayyibati.app",
      queryIntent: rep.queryIntent || null,
      selectedCandidate: rep.selectedCandidate || null,
    };

    assert(
      mappedAdminItem.queryIntent === null,
      "Case 7.1: Legacy row safely maps queryIntent to null",
      `queryIntent: ${mappedAdminItem.queryIntent}`
    );
    assert(
      mappedAdminItem.selectedCandidate === null,
      "Case 7.2: Legacy row safely maps selectedCandidate to null",
      `selectedCandidate: ${mappedAdminItem.selectedCandidate}`
    );

    // Simulate CSV export row formatting
    const selCandRef =
      rep.selectedCandidate?.reference ||
      (rep.selectedCandidate?.nameAr ? `${rep.selectedCandidate.type}: ${rep.selectedCandidate.nameAr}` : "");
    const csvRow = [
      legacyHistoryRow.id,
      "test@tayyibati.app",
      legacyHistoryRow.query,
      legacyHistoryRow.analysisType,
      legacyHistoryRow.compatibilityScore,
      rep.status || "unknown",
      rep.queryIntent || "",
      selCandRef,
      legacyHistoryRow.createdAt.toISOString(),
    ];

    assert(
      csvRow[6] === "",
      "Case 7.3: Legacy row exports empty string for intent column",
      `csvRow[6]: '${csvRow[6]}'`
    );
    assert(
      csvRow[7] === "",
      "Case 7.4: Legacy row exports empty string for selected_candidate column",
      `csvRow[7]: '${csvRow[7]}'`
    );

    const allPassed = results.every((r) => r.passed);
    console.log("\n=======================================================");
    console.log(`  P3 REGRESSION SUMMARY: ${results.filter((r) => r.passed).length}/${results.length} PASSED`);
    console.log("=======================================================\n");

    if (!allPassed) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution threw error:", error);
    process.exit(1);
  }
}

runTests();

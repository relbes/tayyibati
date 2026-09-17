/**
 * Tayyibati Automated Search QA Runner
 *
 * Executes deterministic evaluation of food search resolution logic.
 * Supports BASELINE and AFTER_FIX comparison modes.
 * Exports summary and full test results to JSON and CSV.
 */

import * as fs from "fs";
import * as path from "path";
import { generateSearchQaSuite } from "./searchQaGenerator";
import {
  TestCase,
  TestEvaluation,
  QARunSummary,
  QARegressionComparison,
  TestCategory,
  FailureCategory,
} from "./types";
import { CanonicalSearchEngine } from "../lib/canonicalSearchEngine";
import { FoodResolutionEngine } from "../lib/foodResolutionEngine";
import { normalize, stripArticle } from "../lib/arabicNormalization";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QA_DIR = __dirname;

function parseArgs(): { mode: "BASELINE" | "AFTER_FIX"; maxTests?: number } {
  const args = process.argv.slice(2);
  let mode: "BASELINE" | "AFTER_FIX" = "BASELINE";
  let maxTests: number | undefined = undefined;

  for (const arg of args) {
    if (arg.startsWith("--mode=")) {
      const val = arg.split("=")[1].toUpperCase();
      if (val === "AFTER" || val === "AFTER_FIX") {
        mode = "AFTER_FIX";
      } else {
        mode = "BASELINE";
      }
    } else if (arg.startsWith("--max=")) {
      maxTests = parseInt(arg.split("=")[1], 10);
    }
  }

  return { mode, maxTests };
}

function matchesEntity(
  actualName: string | undefined,
  actualId: number | string | undefined,
  expectedName?: string,
  expectedId?: number | string,
  allowedAlternatives?: (number | string)[]
): boolean {
  if (!actualName && !actualId) return false;

  if (expectedId !== undefined && actualId !== undefined && String(actualId) === String(expectedId)) {
    return true;
  }

  if (expectedName && actualName) {
    const normActual = stripArticle(normalize(actualName));
    const normExpected = stripArticle(normalize(expectedName));
    if (normActual === normExpected || normActual.includes(normExpected) || normExpected.includes(normActual)) {
      return true;
    }
  }

  if (allowedAlternatives && allowedAlternatives.length > 0) {
    for (const alt of allowedAlternatives) {
      if (typeof alt === "number" && actualId !== undefined && Number(actualId) === alt) {
        return true;
      }
      if (typeof alt === "string") {
        const normAlt = stripArticle(normalize(alt));
        const normActual = stripArticle(normalize(actualName || ""));
        if (normActual === normAlt || String(actualId) === alt) {
          return true;
        }
      }
    }
  }

  return false;
}

function isForbiddenMatch(
  actualName: string | undefined,
  actualId: number | string | undefined,
  forbidden?: (number | string)[]
): boolean {
  if (!forbidden || forbidden.length === 0) return false;
  for (const f of forbidden) {
    if (typeof f === "number" && actualId !== undefined && Number(actualId) === f) {
      return true;
    }
    if (typeof f === "string" && actualName) {
      const normF = stripArticle(normalize(f));
      const normActual = stripArticle(normalize(actualName));
      if (normActual === normF || normActual.includes(normF)) {
        return true;
      }
    }
  }
  return false;
}

async function evaluateTestCase(tc: TestCase): Promise<TestEvaluation> {
  const structuredRes = await CanonicalSearchEngine.searchEntities(tc.query);
  const searchRes = await CanonicalSearchEngine.search(tc.query);
  const foodRes = await FoodResolutionEngine.resolve(tc.query, "text", 1.0);

  const primaryResult = structuredRes.primaryResult || searchRes;
  const isNotFound =
    primaryResult?.matchType === "NOT_FOUND" ||
    primaryResult?.search_method === "ai_fallback" ||
    primaryResult?.searchOutcome === "NOT_FOUND" ||
    (primaryResult?.confidence === 0 && primaryResult?.canonicalId === 0);

  // A high-confidence definitive result from CanonicalSearchEngine.searchEntities() is authoritative.
  // FoodResolutionEngine.needsClarification must NOT override a good primaryResult — it is a
  // secondary AI-ingestion engine designed for low-confidence camera/OCR extractions, not for
  // evaluating a high-confidence exact-match text search result.
  const primaryIsDefinitive =
    !!primaryResult &&
    (primaryResult.searchConfidence ?? primaryResult.confidence ?? 0) >= 80 &&
    primaryResult.searchOutcome !== "AMBIGUOUS" &&
    primaryResult.searchOutcome !== "NOT_FOUND" &&
    primaryResult.isAmbiguous !== true &&
    primaryResult.matchType !== "AMBIGUOUS" &&
    primaryResult.matchType !== "NOT_FOUND";

  const isAmbiguous = primaryIsDefinitive
    ? // Even if primaryResult looks good, honour explicit internal ambiguity flags
      primaryResult?.isAmbiguous === true ||
      primaryResult?.searchOutcome === "AMBIGUOUS" ||
      primaryResult?.matchType === "AMBIGUOUS"
    : // No definitive primary — fall back to FoodResolutionEngine signals too
      primaryResult?.isAmbiguous === true ||
      primaryResult?.searchOutcome === "AMBIGUOUS" ||
      primaryResult?.matchType === "AMBIGUOUS" ||
      foodRes.state === "AMBIGUOUS" ||
      foodRes.needsClarification === true;

  const actualName = (isNotFound || isAmbiguous) ? undefined : (primaryResult?.canonicalName || primaryResult?.canonical_name || (foodRes.selectedCandidate as any)?.nameAr);
  const actualId = (isNotFound || isAmbiguous) ? undefined : (primaryResult?.canonicalId || primaryResult?.canonical_id || (foodRes.selectedCandidate as any)?.id);
  const actualEntityType = primaryResult?.canonicalEntityType || primaryResult?.entity_type || (foodRes.selectedCandidate as any)?.type;
  const matchType = primaryResult?.matchType || (primaryResult as any)?.search_method || "UNKNOWN";
  const searchMethod = primaryResult?.searchMethod || primaryResult?.search_method || "UNKNOWN";
  const confidence = primaryResult?.searchConfidence || primaryResult?.confidence || 0;

  const candidateItems = (primaryResult as any)?.candidateDishes || structuredRes.displayFoods || structuredRes.foods || [];
  const choices = candidateItems.map((c: any) => c.canonicalName || c.canonical_name || c.nameAr).filter(Boolean);
  const choicesCount = choices.length;

  let passed = false;
  let failureCategory: FailureCategory | undefined = undefined;
  let failureReason: string | undefined = undefined;

  if (tc.expectedBehavior === "RESOLVE_DIRECT") {
    if (isAmbiguous && !actualName) {
      passed = false;
      failureCategory = "SPECIFIC_QUERY_MADE_AMBIGUOUS";
      failureReason = `Expected direct resolution to '${tc.expectedEntityName || tc.expectedEntityId}', but search returned AMBIGUOUS.`;
    } else if (!actualName && !actualId) {
      const suggestions = (primaryResult as any)?.didYouMean || (searchRes as any)?.didYouMean || [];
      const didYouMeanMatched = suggestions.some((s: string) => {
        const normS = stripArticle(normalize(s));
        const normExp = stripArticle(normalize(tc.expectedEntityName || ""));
        return normS === normExp || normS.includes(normExp) || normExp.includes(normS);
      });
      if (tc.category === "FUZZY_TYPOS" && didYouMeanMatched) {
        passed = true;
      } else {
        passed = false;
        failureCategory = "UNRESOLVED_VALID_QUERY";
        failureReason = `Expected direct resolution to '${tc.expectedEntityName || tc.expectedEntityId}', but search returned NO RESULT.`;
      }
    } else if (isForbiddenMatch(actualName, actualId, tc.forbiddenEntities)) {
      passed = false;
      failureCategory = "FALSE_POSITIVE_VARIANT";
      failureReason = `Resolved to forbidden variant/entity '${actualName}' (ID: ${actualId}).`;
    } else {
      const isExpected =
        (!tc.expectedEntityName && !tc.expectedEntityId && !!actualName) ||
        matchesEntity(
          actualName,
          actualId,
          tc.expectedEntityName,
          tc.expectedEntityId,
          tc.allowedAlternatives
        );

      if (isExpected) {
        passed = true;
      } else {
        passed = false;
        // Check if actual is a variant/substring match instead of canonical
        const normActual = stripArticle(normalize(actualName || ""));
        const normQuery = stripArticle(normalize(tc.query));
        if (normActual.includes(normQuery) && normActual !== normQuery) {
          failureCategory = "EXACT_MATCH_OVERRIDDEN";
          failureReason = `Exact canonical query '${tc.query}' was overridden by variant '${actualName}' (ID: ${actualId}).`;
        } else {
          failureCategory = "WRONG_ENTITY_RESOLVED";
          failureReason = `Resolved to '${actualName}' (ID: ${actualId}), expected '${tc.expectedEntityName}' (ID: ${tc.expectedEntityId}).`;
        }
      }
    }
  } else if (tc.expectedBehavior === "SHOW_CHOICES") {
    // Generic query must either return AMBIGUOUS or have multiple candidate choices,
    // and must not match a forbidden entity.
    if (isForbiddenMatch(actualName, actualId, tc.forbiddenEntities)) {
      passed = false;
      failureCategory = "FALSE_POSITIVE_VARIANT";
      failureReason = `Resolved to forbidden entity '${actualName}' (ID: ${actualId}).`;
    } else if (isAmbiguous) {
      passed = true;
    } else if (choicesCount > 1) {
      passed = true;
    } else if (matchesEntity(actualName, actualId, tc.expectedEntityName, tc.expectedEntityId, tc.allowedAlternatives)) {
      passed = true;
    } else {
      // It resolved directly without ambiguity
      passed = false;
      failureCategory = "GENERIC_QUERY_NOT_AMBIGUOUS";
      failureReason = `Generic query '${tc.query}' resolved directly to '${actualName}' (ID: ${actualId}, ${confidence}%) instead of showing variants/choices.`;
    }
  } else if (tc.expectedBehavior === "NOT_RESOLVE_TO") {
    if (isForbiddenMatch(actualName, actualId, tc.forbiddenEntities)) {
      passed = false;
      failureCategory = "FALSE_POSITIVE_VARIANT";
      failureReason = `Resolved to forbidden entity '${actualName}' (ID: ${actualId}).`;
    } else {
      passed = true;
    }
  }

  return {
    testId: tc.id,
    category: tc.category,
    query: tc.query,
    passed,
    expectedBehavior: tc.expectedBehavior,
    expectedEntity: tc.expectedEntityName || (tc.expectedEntityId ? String(tc.expectedEntityId) : undefined),
    actualEntity: actualName,
    actualEntityType: actualEntityType,
    actualEntityId: actualId,
    matchType,
    searchMethod,
    confidence,
    isAmbiguous,
    choicesCount,
    choices: choices.slice(0, 5),
    failureCategory,
    failureReason,
  };
}

function computeSummary(evaluations: TestEvaluation[], mode: "BASELINE" | "AFTER_FIX"): QARunSummary {
  const totalTests = evaluations.length;
  const passed = evaluations.filter((e) => e.passed).length;
  const failed = totalTests - passed;
  const passRate = totalTests > 0 ? Math.round((passed / totalTests) * 1000) / 10 : 0;

  const categories: TestCategory[] = [
    "EXACT_CANONICAL",
    "NORMALIZED_EXACT",
    "SYNONYMS_DIALECTS",
    "SPECIFIC_VARIANTS",
    "GENERIC_QUERIES",
    "FALSE_POSITIVES",
    "MULTI_WORD",
    "ENGLISH",
    "FUZZY_TYPOS",
  ];

  const byCategory = {} as Record<TestCategory, { total: number; passed: number; failed: number; passRate: number }>;
  for (const cat of categories) {
    const inCat = evaluations.filter((e) => e.category === cat);
    const catPassed = inCat.filter((e) => e.passed).length;
    byCategory[cat] = {
      total: inCat.length,
      passed: catPassed,
      failed: inCat.length - catPassed,
      passRate: inCat.length > 0 ? Math.round((catPassed / inCat.length) * 1000) / 10 : 0,
    };
  }

  const failureCategories: FailureCategory[] = [
    "EXACT_MATCH_OVERRIDDEN",
    "FALSE_POSITIVE_VARIANT",
    "GENERIC_QUERY_NOT_AMBIGUOUS",
    "SPECIFIC_QUERY_MADE_AMBIGUOUS",
    "WRONG_ENTITY_RESOLVED",
    "UNRESOLVED_VALID_QUERY",
    "UNKNOWN_FAILURE",
  ];

  const byFailureCategory = {} as Record<FailureCategory, number>;
  for (const fc of failureCategories) {
    byFailureCategory[fc] = evaluations.filter((e) => !e.passed && e.failureCategory === fc).length;
  }

  const problematic = evaluations
    .filter((e) => !e.passed)
    .slice(0, 25)
    .map((e) => ({
      query: e.query,
      expected: e.expectedEntity || e.expectedBehavior,
      actual: e.actualEntity || "NONE",
      failureCategory: e.failureCategory || "UNKNOWN_FAILURE",
      reason: e.failureReason || "Failed assertion",
    }));

  return {
    timestamp: new Date().toISOString(),
    mode,
    totalTests,
    passed,
    failed,
    passRate,
    byCategory,
    byFailureCategory,
    topProblematicQueries: problematic,
  };
}

function exportCsv(evaluations: TestEvaluation[], filePath: string): void {
  const headers = [
    "TestID",
    "Category",
    "Query",
    "Passed",
    "ExpectedBehavior",
    "ExpectedEntity",
    "ActualEntity",
    "ActualEntityId",
    "ActualEntityType",
    "MatchType",
    "Confidence",
    "IsAmbiguous",
    "FailureCategory",
    "FailureReason",
  ];

  const rows = evaluations.map((e) => {
    return [
      e.testId,
      e.category,
      `"${(e.query || "").replace(/"/g, '""')}"`,
      e.passed ? "PASS" : "FAIL",
      e.expectedBehavior,
      `"${(e.expectedEntity || "").replace(/"/g, '""')}"`,
      `"${(e.actualEntity || "").replace(/"/g, '""')}"`,
      e.actualEntityId ?? "",
      e.actualEntityType ?? "",
      e.matchType ?? "",
      e.confidence ?? "",
      e.isAmbiguous ? "YES" : "NO",
      e.failureCategory ?? "",
      `"${(e.failureReason || "").replace(/"/g, '""')}"`,
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\n");
  fs.writeFileSync(filePath, "\uFEFF" + csvContent, "utf8"); // Add UTF-8 BOM for Excel Arabic support
}

function compareRuns(
  baselineSummary: QARunSummary,
  baselineEvals: TestEvaluation[],
  afterSummary: QARunSummary,
  afterEvals: TestEvaluation[]
): QARegressionComparison {
  const baseMap = new Map<string, TestEvaluation>(baselineEvals.map((e) => [e.testId, e]));
  const afterMap = new Map<string, TestEvaluation>(afterEvals.map((e) => [e.testId, e]));

  let persistedPassCount = 0;
  let fixedCount = 0;
  let regressionCount = 0;
  let persistedFailureCount = 0;

  const regressions: QARegressionComparison["regressions"] = [];
  const newlyFixed: QARegressionComparison["newlyFixed"] = [];

  for (const [testId, aEval] of afterMap.entries()) {
    const bEval = baseMap.get(testId);
    if (!bEval) continue;

    if (bEval.passed && aEval.passed) {
      persistedPassCount++;
    } else if (!bEval.passed && aEval.passed) {
      fixedCount++;
      newlyFixed.push({
        query: aEval.query,
        category: aEval.category,
        previousActual: bEval.actualEntity || "NONE",
        nowResolved: aEval.actualEntity || "AMBIGUOUS_CHOICES",
      });
    } else if (bEval.passed && !aEval.passed) {
      regressionCount++;
      regressions.push({
        query: aEval.query,
        category: aEval.category,
        baselineEntity: bEval.actualEntity || "NONE",
        afterEntity: aEval.actualEntity || "NONE",
        reason: aEval.failureReason || "Regression",
      });
    } else {
      persistedFailureCount++;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    baseline: {
      total: baselineSummary.totalTests,
      passed: baselineSummary.passed,
      failed: baselineSummary.failed,
      passRate: baselineSummary.passRate,
    },
    afterFix: {
      total: afterSummary.totalTests,
      passed: afterSummary.passed,
      failed: afterSummary.failed,
      passRate: afterSummary.passRate,
    },
    persistedPassCount,
    fixedCount,
    regressionCount,
    persistedFailureCount,
    regressions,
    newlyFixed,
  };
}

export async function runSearchQa(
  options?: { mode?: "BASELINE" | "AFTER_FIX"; maxTests?: number }
): Promise<{ summary: QARunSummary; evaluations: TestEvaluation[]; comparison?: QARegressionComparison }> {
  const { mode = "BASELINE", maxTests } = options || parseArgs();

  console.log(`\n======================================================`);
  console.log(`       TAYYIBATI SEARCH QA RUNNER [${mode}]          `);
  console.log(`======================================================`);

  console.log(`[QA] Generating test suite from food database...`);
  let testCases = await generateSearchQaSuite();
  if (maxTests && maxTests > 0) {
    testCases = testCases.slice(0, maxTests);
  }
  console.log(`[QA] Generated ${testCases.length} test cases.`);

  console.log(`[QA] Executing evaluations against search engine...`);
  const evaluations: TestEvaluation[] = [];

  let count = 0;
  for (const tc of testCases) {
    count++;
    if (count % 25 === 0 || count === testCases.length) {
      process.stdout.write(`\r[QA] Processing: ${count}/${testCases.length} (${Math.round((count / testCases.length) * 100)}%)`);
    }
    const evalRes = await evaluateTestCase(tc);
    evaluations.push(evalRes);
  }
  console.log(`\n[QA] Evaluation complete.`);

  const summary = computeSummary(evaluations, mode);

  // File paths
  const prefix = mode === "BASELINE" ? "qa_results_baseline" : "qa_results_after";
  const jsonPath = path.join(QA_DIR, `${prefix}.json`);
  const csvPath = path.join(QA_DIR, `${prefix}.csv`);

  fs.writeFileSync(jsonPath, JSON.stringify({ summary, evaluations }, null, 2), "utf8");
  exportCsv(evaluations, csvPath);

  console.log(`\n------------------------------------------------------`);
  console.log(` RESULTS SUMMARY: ${mode}`);
  console.log(`------------------------------------------------------`);
  console.log(` Total Tests : ${summary.totalTests}`);
  console.log(` Passed      : ${summary.passed} (${summary.passRate}%)`);
  console.log(` Failed      : ${summary.failed}`);
  console.log(`------------------------------------------------------`);
  console.log(` CATEGORY BREAKDOWN:`);
  for (const [cat, data] of Object.entries(summary.byCategory)) {
    console.log(`  - ${cat.padEnd(20)}: ${data.passed}/${data.total} (${data.passRate}%)`);
  }
  console.log(`------------------------------------------------------`);
  console.log(` FAILURE CATEGORIES:`);
  for (const [fc, cnt] of Object.entries(summary.byFailureCategory)) {
    if (cnt > 0) {
      console.log(`  - ${fc.padEnd(30)}: ${cnt}`);
    }
  }
  console.log(`------------------------------------------------------`);
  console.log(` Exported to:`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   CSV : ${csvPath}`);

  let comparison: QARegressionComparison | undefined = undefined;

  if (mode === "AFTER_FIX") {
    const baselineJsonPath = path.join(QA_DIR, `qa_results_baseline.json`);
    if (fs.existsSync(baselineJsonPath)) {
      try {
        const baselineData = JSON.parse(fs.readFileSync(baselineJsonPath, "utf8"));
        comparison = compareRuns(baselineData.summary, baselineData.evaluations, summary, evaluations);
        const compPath = path.join(QA_DIR, `qa_regression_comparison.json`);
        fs.writeFileSync(compPath, JSON.stringify(comparison, null, 2), "utf8");

        console.log(`\n======================================================`);
        console.log(` REGRESSION & IMPROVEMENT COMPARISON`);
        console.log(`======================================================`);
        console.log(` Baseline Pass Rate : ${comparison.baseline.passRate}% (${comparison.baseline.passed}/${comparison.baseline.total})`);
        console.log(` After Fix Pass Rate: ${comparison.afterFix.passRate}% (${comparison.afterFix.passed}/${comparison.afterFix.total})`);
        console.log(` Persisted Passes   : ${comparison.persistedPassCount}`);
        console.log(` Newly Fixed        : ${comparison.fixedCount}`);
        console.log(` Regressions        : ${comparison.regressionCount}`);
        console.log(` Persisted Failures : ${comparison.persistedFailureCount}`);
        console.log(` Comparison JSON    : ${compPath}`);
        console.log(`======================================================\n`);
      } catch (err) {
        console.error(`[QA] Failed to compute regression comparison:`, err);
      }
    } else {
      console.log(`[QA] No baseline JSON found at ${baselineJsonPath}. Skipping comparison.`);
    }
  }

  return { summary, evaluations, comparison };
}

// Direct execution entrypoint
if (process.argv[1]?.includes("searchQaRunner")) {
  const isAfter = process.argv.some((a) => a.toLowerCase().includes("after"));
  const mode = isAfter ? "AFTER_FIX" : "BASELINE";
  runSearchQa({ mode }).catch((err) => {
    console.error("[QA FATAL ERROR]", err);
    process.exit(1);
  });
}

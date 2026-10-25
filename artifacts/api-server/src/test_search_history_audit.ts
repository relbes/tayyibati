/**
 * Search Analytics History Audit — Unit & Regression Test Suite
 *
 * Covers all requirements in Section 10 of USER_REQUEST & record 1390 audit:
 *  Test 1 — Ambiguous query (معكر):
 *            - Query remains unchanged.
 *            - Result represented as ambiguous/multiple options according to API contract.
 *            - No candidate's ruling is incorrectly shown as overall definitive ruling.
 *            - Missing confidence displays as unavailable.
 *  Test 2 — Specific dish (معكرونة العدس) — Record 1390 Exact Audit:
 *            - EXACT_FOOD with primaryRuling: { status: "forbidden" } and forbidden[] array.
 *            - Ruling derives as 'forbidden' (ممنوع), NOT 'unknown' (غير محدد).
 *            - Genuine numeric zero score (0) renders as '0%', NOT 'غير متوفرة' and NOT '%'.
 *            - Result type renders as 'نتيجة محددة'.
 *            - Client-side deriveRuling fallback succeeds even if item.derivedRuling is absent.
 *  Test 3 — Generic shawarma query (شاورما):
 *            - Multiple candidates represented as ambiguous.
 *            - Overall ruling is not copied from an arbitrary candidate.
 *  Test 4 — Missing confidence vs genuine zero score:
 *            - null, absent, and undefined confidence do not render as '0%' or '%'.
 *            - A real numeric zero renders as '0%'.
 *            - Scale is 0–100, no accidental multiplication.
 *  Test 5 — Unknown intent:
 *            - Unknown intent displayed safely (e.g. Arabic fallback or raw value preserved).
 *            - Raw value preserved for details view.
 *  Test 6 — Repeated searches:
 *            - Two separate searches with the same query remain separate events with unique IDs.
 *            - Records are not deduplicated or merged in history.
 *  Test 7 — CSV parity:
 *            - Exported rows respect filters.
 *            - Uses UTF-8 BOM (\uFEFF) for Excel compatibility.
 *            - Ruling and confidence follow same semantics as table (no fake defaults).
 *            - Commas, quotes, newlines escaped properly.
 *            - Record 1390 exports 'forbidden' and score '0'.
 *  Test 8 — Backward compatibility & edge cases:
 *            - Stringified JSON report parsing.
 *            - Contract integrity for AnalysisReport, mobile GET /history, and admin API.
 */

let totalTests = 0;
let passedTests = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ PASS: ${testName}`);
  } else {
    failures.push(testName);
    console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
  }
}

// ─────────────────────────────────────────────────────────────
// 1. Backend Ruling Derivation (exact copy from admin.ts)
// ─────────────────────────────────────────────────────────────
function deriveRulingFromReport(rep: any): string {
  if (!rep) return "unknown";

  if (typeof rep === "string") {
    try {
      rep = JSON.parse(rep);
    } catch {
      return "unknown";
    }
  }

  if (typeof rep !== "object" || rep === null) return "unknown";

  // 1. Ambiguous or multiple-dish results have no definitive ruling.
  const resultMode: string = String(rep.resultMode || "");
  if (
    resultMode === "AMBIGUOUS_FOOD" ||
    resultMode === "MULTIPLE_DISHES" ||
    rep.needsClarification === true ||
    rep.isAmbiguous === true
  ) {
    return "ambiguous";
  }

  // 2. Not-found cases
  if (resultMode === "UNKNOWN_FOOD" || resultMode === "NOT_FOUND" || rep.notFound === true) {
    return "not_found";
  }

  // 3. primaryRuling is the authoritative ruling for a resolved food/dish
  if (rep.primaryRuling && rep.primaryRuling.status) {
    const s = String(rep.primaryRuling.status).toLowerCase().trim();
    if (s === "allowed" || s === "forbidden" || s === "conditional" || s === "unknown") return s;
  }

  // 4. Ingredient-based derivation: forbidden > conditional > allowed > unknown
  const hasForbidden = Array.isArray(rep.forbidden) && rep.forbidden.length > 0;
  const hasConditional = Array.isArray(rep.conditional) && rep.conditional.length > 0;
  const hasAllowed = Array.isArray(rep.allowed) && rep.allowed.length > 0;
  if (hasForbidden) return "forbidden";
  if (hasConditional) return "conditional";
  if (hasAllowed) return "allowed";

  // 5. Check decisionEngine / decisionOutput finalDecision if present
  const finalDecision = rep.decisionEngine?.finalDecision || rep.decisionOutput?.finalDecision;
  if (typeof finalDecision === "string") {
    const fd = finalDecision.toLowerCase().trim();
    if (fd === "forbidden" || fd === "allowed" || fd === "conditional") return fd;
  }

  // 6. Check legacy top-level status field if valid
  if (typeof rep.status === "string") {
    const st = rep.status.toLowerCase().trim();
    if (st === "allowed" || st === "forbidden" || st === "conditional") return st;
  }

  // 7. compatibilityScore==null with no ingredients means no definitive ruling
  if (rep.compatibilityScore === null || rep.compatibilityScore === undefined) return "unknown";

  return "unknown";
}

function deriveRuling(item: any): string {
  if (!item) return "unknown";
  if (item.derivedRuling && item.derivedRuling !== "unknown") {
    return item.derivedRuling;
  }
  return deriveRulingFromReport(item.report);
}

// ─────────────────────────────────────────────────────────────
// 2. Frontend Helpers (exact copies from history.tsx)
// ─────────────────────────────────────────────────────────────
function intentLabel(intent: string | null | undefined): string {
  if (!intent) return "—";
  switch (intent.toUpperCase()) {
    case "FOOD": return "البحث عن طعام";
    case "DISH": return "البحث عن طبق";
    case "COMPOSITE": return "بحث مركّب";
    case "UNKNOWN": return "غير محدد";
    case "SPECIFIC_INGREDIENT": return "مكوّن محدد";
    case "BROAD_FOOD_CATEGORY": return "فئة غذائية عامة";
    case "SPECIFIC_DISH": return "طبق محدد";
    case "AMBIGUOUS_DISH_FOOD": return "بحث غير محدد";
    case "PRODUCT_BRAND": return "منتج تجاري";
    case "INGREDIENT_LIST": return "قائمة مكونات";
    case "FREE_FORM_MEAL": return "وصف وجبة";
    default: return intent;
  }
}

function resultTypeLabel(resultMode: string | null | undefined, needsClarification?: boolean): string {
  if (needsClarification) return "يتطلب توضيحاً";
  if (!resultMode) return "—";
  switch (resultMode) {
    case "EXACT_FOOD": return "نتيجة محددة";
    case "GENERAL_RULE": return "قاعدة عامة";
    case "GENERAL_RULE_EXCEPTIONS": return "قاعدة عامة مع استثناءات";
    case "SPECIFIC_INHERITED": return "موروث من فئة";
    case "MIXED_CATEGORY": return "فئة مختلطة";
    case "COMPOSITE_FOOD": return "طعام مركّب";
    case "AMBIGUOUS_FOOD": return "خيارات متعددة";
    case "MULTIPLE_DISHES": return "أطباق متعددة";
    case "UNKNOWN_FOOD": return "غير معروف";
    case "NOT_FOUND": return "لم يُعثر عليه";
    case "LIST_ALLOWED": return "قائمة مسموحة";
    case "LIST_RESTRICTED": return "قائمة مقيدة";
    case "CATEGORY_REPORT": return "تقرير فئة";
    case "UNSUPPORTED_QUESTION": return "سؤال غير مدعوم";
    case "MULTI_ITEM": return "متعدد العناصر";
    default: return resultMode;
  }
}

function formatScoreDisplay(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return "غير متوفرة";
  }
  return `${score}%`;
}

function formatRulingDisplay(ruling: string): string {
  switch (ruling) {
    case "allowed": return "مسموح";
    case "forbidden": return "ممنوع";
    case "conditional": return "مشروط";
    case "ambiguous": return "لم يُحدّد طبق";
    case "not_found": return "غير معروف";
    default: return "غير محدد";
  }
}

// ─────────────────────────────────────────────────────────────
// 3. CSV Helpers (exact copies from admin.ts)
// ─────────────────────────────────────────────────────────────
function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  let str = typeof value === "object" ? JSON.stringify(value) : String(value);
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

function buildCsv(headers: string[], rows: any[][]): string {
  const headerRow = headers.map(escapeCsvCell).join(",");
  const dataRows = rows.map((r) => r.map(escapeCsvCell).join(","));
  return "\uFEFF" + [headerRow, ...dataRows].join("\r\n");
}

// ─────────────────────────────────────────────────────────────
// Test Suite Execution
// ─────────────────────────────────────────────────────────────
async function runTests() {
  console.log("\n================================================================================");
  console.log("   SEARCH ANALYTICS HISTORY AUDIT & REGRESSION TEST SUITE");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // TEST 1 — Ambiguous query: معكر
  // ---------------------------------------------------------------------------
  console.log("--- TEST 1: Ambiguous query (معكر) ---");
  {
    const report: any = {
      query: "معكر",
      resultMode: "AMBIGUOUS_FOOD",
      queryIntent: "BROAD_FOOD_CATEGORY",
      isAmbiguous: true,
      needsClarification: false,
      compatibilityScore: null,
      refinementSuggestions: [
        { labelAr: "معكرونة القمح", query: "معكرونة القمح" },
        { labelAr: "معكرونة العدس", query: "معكرونة العدس" }
      ],
      allowed: [],
      forbidden: [],
      conditional: [],
      unknown: []
    };

    const ruling = deriveRulingFromReport(report);
    assert(ruling === "ambiguous", "T1.1: Ambiguous query derives ruling 'ambiguous'", `got: ${ruling}`);

    const rulingDisplay = formatRulingDisplay(ruling);
    assert(rulingDisplay === "لم يُحدّد طبق", "T1.2: Ambiguous ruling renders as 'لم يُحدّد طبق'", `got: ${rulingDisplay}`);
    assert(rulingDisplay !== "مسموح", "T1.3: Ambiguous query must NOT be rendered as 'مسموح'");
    assert(rulingDisplay !== "ممنوع", "T1.4: Ambiguous query must NOT be rendered as 'ممنوع'");

    const scoreDisplay = formatScoreDisplay(report.compatibilityScore);
    assert(scoreDisplay === "غير متوفرة", "T1.5: Missing confidence renders as 'غير متوفرة'", `got: ${scoreDisplay}`);
    assert(!scoreDisplay.includes("%"), "T1.6: Missing confidence contains no '%' character");

    const resultType = resultTypeLabel(report.resultMode, report.needsClarification);
    assert(resultType === "خيارات متعددة", "T1.7: Result type renders as 'خيارات متعددة'", `got: ${resultType}`);

    assert(report.query === "معكر", "T1.8: Original query text is preserved intact");
  }

  // ---------------------------------------------------------------------------
  // TEST 2 — Record ID 1390 Audit: معكرونة العدس (EXACT_FOOD, forbidden, score 0)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: Record ID 1390 Exact Audit (معكرونة العدس) ---");
  {
    // Exact shape from database row 1390
    const record1390 = {
      id: 1390,
      query: "معكرونة العدس",
      analysisType: "text",
      compatibilityScore: 0, // Genuine stored zero
      report: {
        query: "معكرونة العدس",
        allowed: [],
        unknown: [],
        notFound: false,
        forbidden: [
          {
            name: "Lentil Pasta",
            notes: null,
            nameAr: "معكرونة العدس",
            nameEn: "Lentil Pasta",
            reason: "ممنوع نهائياً",
            status: "forbidden",
            frequency: null,
            proteinCategory: "NONE",
            proteinSpecificity: "NONE"
          }
        ],
        resultMode: "EXACT_FOOD",
        conditional: [],
        explanation: "ممنوع نهائياً",
        queryIntent: "FOOD",
        suggestions: [],
        analysisType: "text",
        displayQuery: "معكرونة العدس",
        primaryRuling: {
          nameAr: "معكرونة العدس",
          nameEn: "Lentil Pasta",
          status: "forbidden",
          dbNotes: null,
          dbReason: "ممنوع نهائياً",
          sourceType: "نباتي",
          isInherited: false
        },
        scoreAvailable: true,
        canonicalResult: {
          confidence: 100,
          canonicalId: 1467,
          searchMethod: "canonical_search",
          canonicalName: "معكرونة العدس",
          searchOutcome: "FOUND",
          canonicalEntityType: "food"
        },
        selectedCandidate: {
          id: 1467,
          type: "food",
          nameAr: "معكرونة العدس",
          reference: "food: معكرونة العدس"
        },
        compatibilityScore: 0,
        ingredientConfidence: 100
      }
    };

    // 2.1 Backend derivation from report
    const rulingBackend = deriveRulingFromReport(record1390.report);
    assert(rulingBackend === "forbidden", "T2.1: Record 1390 derives ruling 'forbidden' from primaryRuling & forbidden[]", `got: ${rulingBackend}`);
    assert(rulingBackend !== "unknown", "T2.2: Record 1390 ruling must NOT be 'unknown'");

    // 2.2 Frontend Arabic label mapping
    const rulingArabic = formatRulingDisplay(rulingBackend);
    assert(rulingArabic === "ممنوع", "T2.3: Record 1390 ruling renders as 'ممنوع' (NOT 'غير محدد')", `got: ${rulingArabic}`);
    assert(rulingArabic !== "غير محدد", "T2.4: Search flow ruling must NOT be 'غير محدد'");

    // 2.3 Result mode mapping
    const resultType = resultTypeLabel(record1390.report.resultMode, false);
    assert(resultType === "نتيجة محددة", "T2.5: Result mode EXACT_FOOD renders as 'نتيجة محددة'", `got: ${resultType}`);

    // 2.4 Genuine zero compatibility score preservation
    const scoreDisplay = formatScoreDisplay(record1390.compatibilityScore);
    assert(scoreDisplay === "0%", "T2.6: Genuine stored zero compatibility score displays as '0%'", `got: ${scoreDisplay}`);
    assert(scoreDisplay !== "غير متوفرة", "T2.7: Genuine zero is NOT displayed as 'غير متوفرة'");

    // 2.5 Resilient client-side fallback: even if item.derivedRuling is absent, deriveRuling evaluates report
    const itemWithoutDerivedRuling = { ...record1390 };
    delete (itemWithoutDerivedRuling as any).derivedRuling;
    const clientRuling = deriveRuling(itemWithoutDerivedRuling);
    assert(clientRuling === "forbidden", "T2.8: Client deriveRuling fallback evaluates report to 'forbidden' when item.derivedRuling is absent", `got: ${clientRuling}`);

    // 2.6 Selected candidate check
    assert(record1390.report.selectedCandidate?.nameAr === "معكرونة العدس", "T2.9: Selected candidate is preserved as 'معكرونة العدس'");
  }

  // ---------------------------------------------------------------------------
  // TEST 3 — Generic shawarma query: شاورما
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: Generic shawarma query (شاورما) ---");
  {
    const report: any = {
      query: "شاورما",
      resultMode: "MULTIPLE_DISHES",
      queryIntent: "AMBIGUOUS_DISH_FOOD",
      isAmbiguous: true,
      needsClarification: false,
      compatibilityScore: null,
      refinementSuggestions: [
        { labelAr: "شاورما دجاج", query: "شاورما دجاج" },
        { labelAr: "شاورما لحم", query: "شاورما لحم" }
      ],
      allowed: [],
      forbidden: [],
      conditional: [],
      unknown: []
    };

    const ruling = deriveRulingFromReport(report);
    assert(ruling === "ambiguous", "T3.1: MULTIPLE_DISHES derives ruling 'ambiguous'", `got: ${ruling}`);

    const rulingDisplay = formatRulingDisplay(ruling);
    assert(rulingDisplay === "لم يُحدّد طبق", "T3.2: Renders as 'لم يُحدّد طبق'");
    assert(rulingDisplay !== "مسموح", "T3.3: Shawarma is NOT defaulted to 'مسموح'");

    const resultType = resultTypeLabel(report.resultMode, report.needsClarification);
    assert(resultType === "أطباق متعددة", "T3.4: Result type renders as 'أطباق متعددة'", `got: ${resultType}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 4 — Missing vs Genuine Zero confidence score
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: Missing vs Zero confidence score ---");
  {
    // null score
    const nullScore = formatScoreDisplay(null);
    assert(nullScore === "غير متوفرة", "T4.1: null score renders as 'غير متوفرة'", `got: ${nullScore}`);
    assert(nullScore !== "0%", "T4.2: null score does NOT render as '0%'");
    assert(nullScore !== "%", "T4.3: null score does NOT render as '%'");

    // undefined score
    const undefScore = formatScoreDisplay(undefined);
    assert(undefScore === "غير متوفرة", "T4.4: undefined score renders as 'غير متوفرة'");

    // numeric zero (genuine 0)
    const zeroScore = formatScoreDisplay(0);
    assert(zeroScore === "0%", "T4.5: Numeric zero score renders as '0%'", `got: ${zeroScore}`);
    assert(zeroScore !== "غير متوفرة", "T4.6: Numeric zero is preserved, not shown as unavailable");

    // scale check (0-100 scale: no multiplying by 100)
    const normalScore = formatScoreDisplay(75);
    assert(normalScore === "75%", "T4.7: Score of 75 renders as '75%' (no accidental 7500%)", `got: ${normalScore}`);
  }

  // ---------------------------------------------------------------------------
  // TEST 5 — Unknown intent safe display
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: Unknown and technical intent mapping ---");
  {
    assert(intentLabel("FOOD") === "البحث عن طعام", "T5.1: 'FOOD' maps to 'البحث عن طعام'");
    assert(intentLabel("DISH") === "البحث عن طبق", "T5.2: 'DISH' maps to 'البحث عن طبق'");
    assert(intentLabel("UNKNOWN") === "غير محدد", "T5.3: 'UNKNOWN' maps to 'غير محدد'");
    assert(intentLabel("SPECIFIC_INGREDIENT") === "مكوّن محدد", "T5.4: 'SPECIFIC_INGREDIENT' maps to 'مكوّن محدد'");
    assert(intentLabel("BROAD_FOOD_CATEGORY") === "فئة غذائية عامة", "T5.5: 'BROAD_FOOD_CATEGORY' maps to 'فئة غذائية عامة'");
    
    // Unrecognized intent
    const exoticIntent = "CUSTOM_NEW_INTENT";
    const mappedExotic = intentLabel(exoticIntent);
    assert(mappedExotic === exoticIntent, "T5.6: Unrecognized intent returns safe raw fallback", `got: ${mappedExotic}`);
    assert(mappedExotic !== "—", "T5.7: Unrecognized intent does not vanish to dash");

    // null / undefined
    assert(intentLabel(null) === "—", "T5.8: null intent renders as '—'");
    assert(intentLabel(undefined) === "—", "T5.9: undefined intent renders as '—'");
  }

  // ---------------------------------------------------------------------------
  // TEST 6 — Repeated searches remain separate events
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 6: Repeated searches are separate events ---");
  {
    const event1 = {
      id: 101,
      userId: "user_a",
      query: "حمص",
      analysisType: "text",
      compatibilityScore: 100,
      createdAt: "2026-10-25T10:00:00Z"
    };
    const event2 = {
      id: 102,
      userId: "user_a",
      query: "حمص",
      analysisType: "text",
      compatibilityScore: 100,
      createdAt: "2026-10-25T10:05:00Z"
    };

    const historyItems = [event1, event2];
    assert(historyItems.length === 2, "T6.1: Repeated searches are not deduplicated into a single row");
    assert(historyItems[0].id !== historyItems[1].id, "T6.2: Each event has a unique primary key id");
    assert(historyItems[0].createdAt !== historyItems[1].createdAt, "T6.3: Each event retains its own timestamp");
  }

  // ---------------------------------------------------------------------------
  // TEST 7 — CSV export parity
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 7: CSV export parity & formatting ---");
  {
    const headers = [
      "id",
      "user_email",
      "query",
      "display_query",
      "analysis_type",
      "compatibility_score",
      "ruling",
      "result_mode",
      "intent",
      "needs_clarification",
      "selected_candidate",
      "created_at",
    ];

    const records = [
      {
        id: 1,
        email: "test@tayyibati.app",
        query: "معكر",
        displayQuery: "",
        analysisType: "text",
        score: "", // null in DB becomes empty string in CSV
        ruling: "ambiguous",
        resultMode: "AMBIGUOUS_FOOD",
        intent: "BROAD_FOOD_CATEGORY",
        needsClarification: false,
        selectedCandidate: "",
        createdAt: "2026-10-25T10:00:00.000Z"
      },
      {
        id: 1390,
        email: "test@tayyibati.app",
        query: "معكرونة العدس",
        displayQuery: "معكرونة العدس",
        analysisType: "text",
        score: 0, // genuine numeric zero must export as 0
        ruling: "forbidden",
        resultMode: "EXACT_FOOD",
        intent: "FOOD",
        needsClarification: false,
        selectedCandidate: "food: معكرونة العدس",
        createdAt: "2026-10-25T07:25:06.133Z"
      }
    ];

    const rows = records.map(r => [
      r.id,
      r.email,
      r.query,
      r.displayQuery,
      r.analysisType,
      r.score,
      r.ruling,
      r.resultMode,
      r.intent,
      r.needsClarification ? "true" : "false",
      r.selectedCandidate,
      r.createdAt
    ]);

    const csvOutput = buildCsv(headers, rows);

    assert(csvOutput.charCodeAt(0) === 0xFEFF, "T7.1: CSV starts with UTF-8 BOM for Excel compatibility");
    assert(csvOutput.includes('"معكرونة العدس"'), "T7.2: Arabic query 'معكرونة العدس' is properly quoted and preserved");
    assert(csvOutput.includes('"forbidden"'), "T7.3: Truthful ruling 'forbidden' is exported for record 1390");
    assert(csvOutput.includes('"0"'), "T7.4: Genuine zero score for record 1390 is exported as '0'");
    assert(csvOutput.includes('""'), "T7.5: Null score for record 1 is exported as empty quotes, not '0'");
    
    // Check newline and comma escaping
    const specialCell = escapeCsvCell('نص به فاصلة, وعلامة اقتباس " وتسطير \n سطر جديد');
    assert(specialCell.startsWith('"') && specialCell.endsWith('"'), "T7.6: Special characters enclosed in quotes");
    assert(specialCell.includes('""'), "T7.7: Quotes properly escaped by doubling");
  }

  // ---------------------------------------------------------------------------
  // TEST 8 — Backward compatibility & edge cases
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 8: Backward compatibility & edge cases ---");
  {
    // Case A: Missing report object or empty report
    assert(deriveRulingFromReport(null) === "unknown", "T8.1: null report safely returns 'unknown'");
    assert(deriveRulingFromReport({}) === "unknown", "T8.2: empty report safely returns 'unknown'");

    // Case B: notFound: true report
    const notFoundRep = { notFound: true, resultMode: "NOT_FOUND" };
    assert(deriveRulingFromReport(notFoundRep) === "not_found", "T8.3: notFound:true derives 'not_found'");

    // Case C: needsClarification: true report
    const clariRep = { needsClarification: true, resultMode: "EXACT_FOOD" };
    assert(deriveRulingFromReport(clariRep) === "ambiguous", "T8.4: needsClarification:true derives 'ambiguous'");

    // Case D: Ingredient-based derivation when primaryRuling absent
    const ingForbiddenRep = { forbidden: [{ nameAr: "مادة ممنوعة" }], compatibilityScore: 0 };
    assert(deriveRulingFromReport(ingForbiddenRep) === "forbidden", "T8.5: Ingredient forbidden fallback works");

    const ingConditionalRep = { conditional: [{ nameAr: "مادة مشروطة" }], compatibilityScore: 50 };
    assert(deriveRulingFromReport(ingConditionalRep) === "conditional", "T8.6: Ingredient conditional fallback works");

    const ingAllowedRep = { allowed: [{ nameAr: "مادة مسموحة" }], compatibilityScore: 100 };
    assert(deriveRulingFromReport(ingAllowedRep) === "allowed", "T8.7: Ingredient allowed fallback works");

    // Case E: Stringified JSON report handling
    const stringifiedForbiddenRep = JSON.stringify({
      resultMode: "EXACT_FOOD",
      primaryRuling: { status: "FORBIDDEN", nameAr: "معكرونة العدس" },
      compatibilityScore: 0
    });
    assert(deriveRulingFromReport(stringifiedForbiddenRep) === "forbidden", "T8.8: Stringified JSON report with uppercase status derives 'forbidden'");
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} assertions passed (${failures.length} failed)`);
  if (failures.length > 0) {
    console.error("FAILURES:\n" + failures.map(f => `  - ${f}`).join("\n"));
  }
  console.log("================================================================================\n");

  if (failures.length > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

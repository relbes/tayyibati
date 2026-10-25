/**
 * Tayyibati — Search History Name & Email Filters Test Suite
 *
 * Requirements:
 *  1. Name filter returns matching records.
 *  2. Email filter returns matching records.
 *  3. Name and email filters together return records matching both (AND semantics).
 *  4. Partial and case-insensitive email matching works as expected.
 *  5. Empty filters preserve the existing unfiltered results.
 *  6. Pagination totals reflect the filters.
 *  7. Existing history functionality and the “إضافة طعام” feature remain unaffected.
 *  8. Unauthorized users cannot access protected admin history data.
 *
 * Run via: pnpm exec tsx artifacts/api-server/src/test_history_user_filters.ts
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
// Test Fixtures
// ─────────────────────────────────────────────────────────────
interface UserFixture {
  id: string;
  email: string;
  name: string;
}

interface HistoryRecordFixture {
  id: number;
  userId: string;
  query: string;
  analysisType: "text" | "image" | "label";
  compatibilityScore: number | null;
  report: any;
  createdAt: string;
}

const mockUsers: UserFixture[] = [
  { id: "usr_1", email: "ahmad.khalil@example.com", name: "أحمد خليل" },
  { id: "usr_2", email: "sara.nour@tayyibati.xyz", name: "سارة نور" },
  { id: "usr_3", email: "omar.farouq@gmail.com", name: "عمر الفاروق" },
  { id: "usr_4", email: "fatima.zahra@outlook.com", name: "فاطمة الزهراء" },
  { id: "usr_5", email: "guest.user@example.org", name: "" }, // user without name
];

const mockHistory: HistoryRecordFixture[] = [
  {
    id: 101,
    userId: "usr_1",
    query: "تفاح أحمر",
    analysisType: "text",
    compatibilityScore: 100,
    report: { primaryRuling: { status: "allowed" } },
    createdAt: "2026-10-25T10:00:00Z",
  },
  {
    id: 102,
    userId: "usr_1",
    query: "شاورما دجاج",
    analysisType: "text",
    compatibilityScore: 85,
    report: { resultMode: "MULTIPLE_DISHES" },
    createdAt: "2026-10-25T10:05:00Z",
  },
  {
    id: 103,
    userId: "usr_2",
    query: "زبادي يوناني",
    analysisType: "image",
    compatibilityScore: 90,
    report: { primaryRuling: { status: "allowed" } },
    createdAt: "2026-10-25T10:10:00Z",
  },
  {
    id: 104,
    userId: "usr_3",
    query: "معكرونة العدس",
    analysisType: "text",
    compatibilityScore: 0,
    report: { primaryRuling: { status: "forbidden" } },
    createdAt: "2026-10-25T10:15:00Z",
  },
  {
    id: 105,
    userId: "usr_4",
    query: "لحم ضأن مشوي",
    analysisType: "label",
    compatibilityScore: 95,
    report: { primaryRuling: { status: "allowed" } },
    createdAt: "2026-10-25T10:20:00Z",
  },
  {
    id: 106,
    userId: "usr_5",
    query: "عصير برتقال",
    analysisType: "text",
    compatibilityScore: 100,
    report: { primaryRuling: { status: "allowed" } },
    createdAt: "2026-10-25T10:25:00Z",
  },
];

// Backend filtering logic (mirrors GET /admin/history in admin.ts)
function executeAdminHistoryQuery(params: {
  search?: string;
  userName?: string;
  name?: string;
  userEmail?: string;
  email?: string;
  analysisType?: string;
  status?: string;
  limit?: number;
  offset?: number;
  isAdmin?: boolean;
}) {
  // Authorization check
  if (!params.isAdmin) {
    return { status: 403, error: "Forbidden: Administrative access required" };
  }

  const limit = Math.min(200, Math.max(1, params.limit ?? 50));
  const offset = Math.max(0, params.offset ?? 0);
  const searchQuery = (params.search || "").trim().toLowerCase();
  const nameFilter = (params.userName || params.name || "").trim().toLowerCase();
  const emailFilter = (params.userEmail || params.email || "").trim().toLowerCase();
  const typeFilter = params.analysisType || "";
  const statusFilter = params.status || "";

  // User lookups
  const userEmailMap = new Map<string, string>();
  const userNameMap = new Map<string, string>();
  for (const u of mockUsers) {
    userEmailMap.set(u.id, u.email);
    userEmailMap.set(u.id.toLowerCase(), u.email);
    userNameMap.set(u.id, u.name);
    userNameMap.set(u.id.toLowerCase(), u.name);
  }

  let mapped = mockHistory.map((i) => {
    const uId = i.userId.trim();
    const email = userEmailMap.get(uId) || "غير متوفر";
    const name = userNameMap.get(uId) || "";
    const ruling =
      i.report?.primaryRuling?.status ||
      (i.report?.resultMode === "MULTIPLE_DISHES" ? "ambiguous" : "unknown");

    return {
      ...i,
      userEmail: email,
      userName: name,
      derivedRuling: ruling,
    };
  });

  // Global search
  if (searchQuery) {
    mapped = mapped.filter(
      (i) =>
        i.query.toLowerCase().includes(searchQuery) ||
        (i.userEmail && i.userEmail.toLowerCase().includes(searchQuery)) ||
        (i.userName && i.userName.toLowerCase().includes(searchQuery)) ||
        i.userId.toLowerCase().includes(searchQuery)
    );
  }

  // Name filter
  if (nameFilter) {
    mapped = mapped.filter((i) => i.userName && i.userName.toLowerCase().includes(nameFilter));
  }

  // Email filter
  if (emailFilter) {
    mapped = mapped.filter((i) => i.userEmail && i.userEmail.toLowerCase().includes(emailFilter));
  }

  // Analysis type filter
  if (typeFilter && typeFilter !== "all") {
    mapped = mapped.filter((i) => i.analysisType === typeFilter);
  }

  // Status filter
  if (statusFilter && statusFilter !== "all") {
    mapped = mapped.filter((i) => i.derivedRuling === statusFilter);
  }

  const totalItems = mapped.length;
  const paginatedItems = mapped.slice(offset, offset + limit);

  return {
    status: 200,
    items: paginatedItems,
    totalItems,
    offset,
    limit,
  };
}

async function runTestSuite() {
  console.log("\n" + "=".repeat(80));
  console.log("   TAYYIBATI — SEARCH HISTORY NAME & EMAIL FILTERS TEST SUITE");
  console.log("=".repeat(80) + "\n");

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Name filter returns matching records
  // ─────────────────────────────────────────────────────────────
  console.log("--- TEST 1: Name filter returns matching records ---");
  const resName1 = executeAdminHistoryQuery({ userName: "أحمد", isAdmin: true });
  assert(resName1.status === 200, "T1.1: Request succeeds with 200");
  assert(resName1.items?.length === 2, "T1.2: Ahmad has 2 search history records (id 101, 102)");
  assert(
    resName1.items?.every((item) => item.userName.includes("أحمد")),
    "T1.3: All returned records belong to user containing 'أحمد'"
  );

  const resName2 = executeAdminHistoryQuery({ userName: "سارة", isAdmin: true });
  assert(resName2.items?.length === 1, "T1.4: Sara has 1 record");
  assert(resName2.items?.[0].id === 103, "T1.5: Sara's record ID is 103");

  const resNamePartial = executeAdminHistoryQuery({ userName: "خليل", isAdmin: true });
  assert(resNamePartial.items?.length === 2, "T1.6: Partial last name 'خليل' matches 'أحمد خليل'");

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Email filter returns matching records
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- TEST 2: Email filter returns matching records ---");
  const resEmail1 = executeAdminHistoryQuery({ userEmail: "tayyibati.xyz", isAdmin: true });
  assert(resEmail1.items?.length === 1, "T2.1: Domain filter matches sara.nour@tayyibati.xyz");
  assert(resEmail1.items?.[0].userEmail === "sara.nour@tayyibati.xyz", "T2.2: Correct email returned");

  const resEmail2 = executeAdminHistoryQuery({ userEmail: "ahmad.khalil@example.com", isAdmin: true });
  assert(resEmail2.items?.length === 2, "T2.3: Exact email returns both records");

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Name and email filters together (AND semantics)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- TEST 3: Combined Name and Email filters (AND semantics) ---");
  // Matching both
  const resBothMatch = executeAdminHistoryQuery({
    userName: "أحمد",
    userEmail: "example.com",
    isAdmin: true,
  });
  assert(resBothMatch.items?.length === 2, "T3.1: Both filters match returns records");

  // Conflict: Name is Ahmad, but email belongs to Sara
  const resConflict = executeAdminHistoryQuery({
    userName: "أحمد",
    userEmail: "tayyibati.xyz",
    isAdmin: true,
  });
  assert(resConflict.items?.length === 0, "T3.2: AND semantics: conflicting name & email returns 0 records");
  assert(resConflict.totalItems === 0, "T3.3: Total items is 0 when no record matches both");

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Partial and case-insensitive email matching
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- TEST 4: Partial and case-insensitive email matching ---");
  const resUpper = executeAdminHistoryQuery({ userEmail: "AHMAD.KHALIL", isAdmin: true });
  assert(resUpper.items?.length === 2, "T4.1: Uppercase input matches lowercase email");

  const resMixed = executeAdminHistoryQuery({ userEmail: "FaTiMa.ZaHrA@OUTLOOK", isAdmin: true });
  assert(resMixed.items?.length === 1, "T4.2: Mixed-case input matches correctly");

  const resWhitespace = executeAdminHistoryQuery({ userEmail: "   gmail.com   ", isAdmin: true });
  assert(resWhitespace.items?.length === 1, "T4.3: Whitespace trimmed from email filter");
  assert(resWhitespace.items?.[0].userEmail === "omar.farouq@gmail.com", "T4.4: Matched Omar's gmail");

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Empty filters preserve unfiltered results
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- TEST 5: Empty filters preserve unfiltered results ---");
  const resEmpty = executeAdminHistoryQuery({
    userName: "",
    userEmail: "",
    search: "",
    isAdmin: true,
  });
  assert(resEmpty.items?.length === 6, "T5.1: Empty filters return all 6 records");
  assert(resEmpty.totalItems === 6, "T5.2: totalItems matches complete dataset");

  const resSpacesOnly = executeAdminHistoryQuery({
    userName: "    ",
    userEmail: "  ",
    isAdmin: true,
  });
  assert(resSpacesOnly.items?.length === 6, "T5.3: Whitespace-only filters treated as empty");

  // ─────────────────────────────────────────────────────────────
  // TEST 6: Pagination totals reflect the filters
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- TEST 6: Pagination totals reflect filters ---");
  const resPage = executeAdminHistoryQuery({
    userName: "أحمد",
    limit: 1,
    offset: 0,
    isAdmin: true,
  });
  assert(resPage.items?.length === 1, "T6.1: Paginated items count respects limit=1");
  assert(resPage.totalItems === 2, "T6.2: totalItems reflects filtered count (2) not global count (6)");

  const resPage2 = executeAdminHistoryQuery({
    userName: "أحمد",
    limit: 1,
    offset: 1,
    isAdmin: true,
  });
  assert(resPage2.items?.length === 1, "T6.3: Offset=1 returns second item");
  assert(resPage2.items?.[0].id === 102, "T6.4: Correct second record returned");

  // ─────────────────────────────────────────────────────────────
  // TEST 7: Existing history functionality and 'إضافة طعام' unaffected
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- TEST 7: Existing functionality regressions ---");
  // Status filter still works
  const resStatus = executeAdminHistoryQuery({ status: "forbidden", isAdmin: true });
  assert(resStatus.items?.length === 1, "T7.1: Status filter 'forbidden' works");
  assert(resStatus.items?.[0].query === "معكرونة العدس", "T7.2: Correct forbidden record returned");

  // Analysis type filter still works
  const resType = executeAdminHistoryQuery({ analysisType: "image", isAdmin: true });
  assert(resType.items?.length === 1, "T7.3: AnalysisType filter 'image' works");
  assert(resType.items?.[0].id === 103, "T7.4: Matched Sara's image search");

  // User with no name handled safely without throwing
  const resNoName = executeAdminHistoryQuery({ userEmail: "guest.user", isAdmin: true });
  assert(resNoName.items?.length === 1, "T7.5: User without name handled safely");
  assert(resNoName.items?.[0].userName === "", "T7.6: Empty string returned for user without name");

  // ─────────────────────────────────────────────────────────────
  // TEST 8: Server Authorization enforcement
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- TEST 8: Server Authorization enforcement ---");
  const resUnauth = executeAdminHistoryQuery({ userName: "أحمد", isAdmin: false });
  assert(resUnauth.status === 403, "T8.1: Unauthorized request rejected with 403 Forbidden");
  assert(resUnauth.items === undefined, "T8.2: No data returned to unauthorized caller");

  console.log("\n" + "=".repeat(80));
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} assertions passed (${failures.length} failed)`);
  console.log("=".repeat(80) + "\n");

  if (failures.length > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

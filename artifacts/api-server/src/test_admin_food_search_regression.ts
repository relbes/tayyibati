/**
 * P1 Admin Food Search Normalization Regression Test Suite
 *
 * Verifies:
 * 1. Exact/common food search: 'لحم', 'دجاج', 'شاورما'
 * 2. Arabic normalization consistency:
 *    - Diacritics (tashkeel/tatweel): 'لَحْم' === 'لحم'
 *    - Hamza variation: 'الأرانب' === 'الارانب'
 *    - Ta Marbuta vs Ha: 'معكرونه' === 'معكرونة'
 *    - Whitespace trimming & collapsing: '   لحم   ' === 'لحم'
 * 3. Synonym/alias expansion problem cases:
 *    - 'بلح' -> finds dates ('التمر')
 *    - 'معكرون' -> finds pasta ('المكرونة بكل أنواعها وأشكالها' & related)
 * 4. Empty search:
 *    - /api/foods and /api/foods?search= preserve default limit of 50
 * 5. Pagination:
 *    - limit and offset correctly slice returned sets
 * 6. Category & status filtering:
 *    - status filter (e.g. allowed) and category filter continue to work
 */

import { db, foodsTable } from "@workspace/db";
import { sql, or, ilike, and, eq, inArray } from "drizzle-orm";
import { normalize } from "./lib/arabicNormalization";
import { expandSearchQuery } from "./lib/searchExpansion";
import { DB_TAXONOMY_MAP } from "./routes/foods";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
  }
}

/**
 * Mirror the exact search execution logic implemented in GET /api/foods
 */
async function queryFoods(params: {
  search?: string;
  status?: string;
  category?: string;
  limit?: string;
  offset?: string;
}) {
  const { search, status, category, limit = "50", offset = "0" } = params;

  const conditions = [];
  if (status) conditions.push(eq(foodsTable.status, status as any));
  if (category) {
    const catTrim = category.trim();
    const possibleCategories: string[] = [catTrim];

    for (const [dbCat, arCat] of Object.entries(DB_TAXONOMY_MAP)) {
      if (
        dbCat.toLowerCase().includes(catTrim.toLowerCase()) ||
        arCat.includes(catTrim) ||
        catTrim.includes(arCat)
      ) {
        if (!possibleCategories.includes(dbCat)) possibleCategories.push(dbCat);
      }
    }

    if (possibleCategories.length === 1) {
      conditions.push(eq(foodsTable.category, possibleCategories[0]));
    } else {
      conditions.push(inArray(foodsTable.category, possibleCategories));
    }
  }

  if (search && search.trim()) {
    const cleanSearch = search.trim();
    const normQ = normalize(cleanSearch);

    const variants = new Set<string>();
    if (cleanSearch) variants.add(cleanSearch);
    if (normQ) variants.add(normQ);

    const expanded = expandSearchQuery(cleanSearch);
    for (const exp of expanded) {
      const n = normalize(exp);
      if (n) variants.add(n);
    }

    // Normalize Arabic letter shapes & diacritics in SQL (أإآ -> ا, ة -> ه, ى -> ي, strip tashkeel/tatweel)
    const sqlNormNameAr = sql`translate(lower(${foodsTable.nameAr}), 'أإآةىًٌٍَُِّْـ', 'اااهي')`;

    const searchConditions = [
      ilike(foodsTable.nameEn, `%${cleanSearch}%`),
      ilike(foodsTable.nameAr, `%${cleanSearch}%`),
    ];

    for (const v of variants) {
      searchConditions.push(sql`${sqlNormNameAr} ILIKE ${`%${normalize(v)}%`}`);
    }

    conditions.push(or(...searchConditions)!);
  }

  return db
    .select()
    .from(foodsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(Math.min(parseInt(limit), 200))
    .offset(parseInt(offset));
}

async function runAdminFoodSearchRegression() {
  console.log("\n=======================================================");
  console.log("   P1 ADMIN FOOD SEARCH NORMALIZATION REGRESSION SUITE  ");
  console.log("=======================================================\n");

  // SECTION 1: Exact / Common Search
  console.log("--- Section 1: Exact / Common Search ---");
  const lahm = await queryFoods({ search: "لحم" });
  assert(lahm.length >= 10, "Exact search 'لحم' returns meat foods", `Count: ${lahm.length}`);

  const dajaj = await queryFoods({ search: "دجاج" });
  assert(dajaj.length >= 2, "Exact search 'دجاج' returns chicken foods", `Count: ${dajaj.length}`);

  const shawarma = await queryFoods({ search: "شاورما" });
  assert(Array.isArray(shawarma) && shawarma.length === 0, "Culinary dish 'شاورما' returns empty array without error in foods table");

  const shawarmaDajaj = await queryFoods({ search: "شاورما دجاج" });
  assert(Array.isArray(shawarmaDajaj) && shawarmaDajaj.length === 0, "'شاورما دجاج' returns empty array cleanly in foods table");

  // SECTION 2: Arabic Normalization
  console.log("\n--- Section 2: Arabic Normalization ---");

  // 2.1 Tashkeel / Diacritics
  const lahmTashkeel = await queryFoods({ search: "لَحْم" });
  assert(lahmTashkeel.length === lahm.length && lahmTashkeel.length > 0, "Tashkeel 'لَحْم' matches identical results to 'لحم'");

  const dajajTashkeel = await queryFoods({ search: "دَجَاج" });
  assert(dajajTashkeel.length === dajaj.length && dajajTashkeel.length > 0, "Tashkeel 'دَجَاج' matches identical results to 'دجاج'");

  // 2.2 Hamza Variation (أإآ -> ا)
  const aranebHamza = await queryFoods({ search: "الأرانب" });
  const aranebNoHamza = await queryFoods({ search: "الارانب" });
  assert(aranebHamza.length > 0 && aranebHamza.length === aranebNoHamza.length, "Hamza variation 'الأرانب' matches identical results to 'الارانب'");

  // 2.3 Ta Marbuta vs Ha (ة -> ه)
  const pastaHa = await queryFoods({ search: "معكرونه" });
  const pastaTa = await queryFoods({ search: "معكرونة" });
  assert(pastaHa.length > 0 && pastaHa.length === pastaTa.length, "Ta Marbuta / Ha 'معكرونه' matches identical results to 'معكرونة'");

  // 2.4 Whitespace Trimming & Collapsing
  const whitespaceSearch = await queryFoods({ search: "   لحم   " });
  assert(whitespaceSearch.length === lahm.length, "Whitespace padding '   لحم   ' matches identical results to 'لحم'");

  // SECTION 3: Synonym & Dialect Problem Cases
  console.log("\n--- Section 3: Problem Cases ---");

  // 3.1 Balah -> Dates (التمر)
  const balah = await queryFoods({ search: "بلح" });
  assert(
    balah.length >= 2 && balah.some(b => b.nameAr.includes("التمر")),
    "Synonym 'بلح' resolves to dates ('التمر')",
    `Count: ${balah.length}`
  );

  // 3.2 Maakron -> Pasta (المكرونة بكل أنواعها وأشكالها)
  const maakron = await queryFoods({ search: "معكرون" });
  assert(
    maakron.length >= 4 && maakron.some(m => m.nameAr.includes("المكرونة بكل أنواعها")),
    "Dialect query 'معكرون' resolves to canonical pasta ('المكرونة بكل أنواعها وأشكالها')",
    `Count: ${maakron.length}`
  );

  // SECTION 4: Empty Search Behavior
  console.log("\n--- Section 4: Empty Search Behavior ---");
  const emptyNoParam = await queryFoods({});
  assert(emptyNoParam.length === 50, "Empty search without 'search' param returns default limit (50)");

  const emptyBlankString = await queryFoods({ search: "" });
  assert(emptyBlankString.length === 50, "Search with empty string 'search=' returns default limit (50)");

  const emptyWhitespaceOnly = await queryFoods({ search: "    " });
  assert(emptyWhitespaceOnly.length === 50, "Search with whitespace only returns default limit (50)");

  // SECTION 5: Pagination Semantics
  console.log("\n--- Section 5: Pagination Semantics ---");
  const page1 = await queryFoods({ limit: "5", offset: "0" });
  const page2 = await queryFoods({ limit: "5", offset: "5" });
  assert(page1.length === 5 && page2.length === 5, "Pagination limits return exact requested size (5)");
  assert(page1[0].id !== page2[0].id, "Pagination offsets return distinct items across pages");

  // SECTION 6: Filter Preservation (Status & Category)
  console.log("\n--- Section 6: Filter Preservation ---");
  const allowedMeat = await queryFoods({ search: "لحم", status: "allowed" });
  assert(
    allowedMeat.length > 0 && allowedMeat.every(m => m.status === "allowed"),
    "Status filter 'allowed' strictly restricts returned records to allowed status"
  );

  const meatCategory = await queryFoods({ category: "Meat & Protein" });
  assert(
    meatCategory.length > 0 && meatCategory.every(m => m.category === "Meat & Protein"),
    "Category filter 'Meat & Protein' successfully filters by taxonomy category"
  );

  const meatCatAr = await queryFoods({ category: "لحوم" });
  assert(
    meatCatAr.length > 0,
    "Arabic category filter 'لحوم' successfully maps via DB_TAXONOMY_MAP"
  );

  // Summary
  console.log("\n=======================================================");
  console.log(`  RESULTS: ${passedTests}/${totalTests} tests passed`);
  console.log("=======================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAdminFoodSearchRegression().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function runVerification() {
  const url = "http://localhost:5000/api/analysis/text";
  const registerUrl = "http://localhost:5000/api/users/register";

  console.log("-------------------------------------------------------------------------");
  console.log("STARTING API CONTRACT VERIFICATION CLIENT");
  console.log("-------------------------------------------------------------------------");

  // Step 1: Register a new test user to get a valid token
  const testEmail = `test_${Date.now()}@tayyibati.com`;
  const testPassword = "Password123!";
  
  let token = "";
  try {
    console.log(`Registering test user with email: ${testEmail}...`);
    const regRes = await fetch(registerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        nameAr: "مختبر العقد",
        role: "user"
      })
    });

    if (!regRes.ok) {
      const errTxt = await regRes.text();
      throw new Error(`Registration failed: ${regRes.status} - ${errTxt}`);
    }

    const regJson = await regRes.json() as { token: string };
    token = regJson.token;
    
    // Bypass limits by upgrading to Premium in the database
    await db.update(usersTable).set({ isPremium: "true" }).where(eq(usersTable.email, testEmail));
    console.log("Registration successful! Upgraded test user to PREMIUM in DB.");
  } catch (err: any) {
    console.error("FATAL ERROR: Could not register user.", err.message);
    process.exit(1);
  }

  const queries = [
    "لحم",
    "جاج",
    "بطاطا مقلية",
    "كبة بطاطا",
    "جبنة رومي",
    "لحم غنم",
    "لحم بقر",
    "لحم جاموس",
    "لحم جمل",
    "شاورما",
    "شاورما لحم",
    "شاورما دجاج",
    "كبسة لحم",
    "كبسة دجاج",
    "مندي لحم",
    "مندي دجاج",
    "طيور",
    "دواجن"
  ];

  const results: any[] = [];
  
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    console.log(`\n======================================================`);
    console.log(`QUERY ${i + 1}/18: "${q}"`);
    console.log(`======================================================`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ query: q })
      });

      console.log(`HTTP Status: ${response.status}`);
      const json = await response.json() as any;
      console.log("Complete JSON Response:\n", JSON.stringify(json, null, 2));

      // Perform checks
      let pass = false;
      let reason = "";

      const report = json.report;

      if (q === "لحم") {
        const ok = report?.needsClarification === true && report?.clarificationType === "PROTEIN_SPECIFICATION";
        pass = ok;
        reason = ok ? "Clarification triggered with options" : "Clarification missing or incorrect";
      } else if (q === "جاج") {
        const isChicken = report?.proteinSpecificity === "CHICKEN" && report?.primaryRuling?.status === "forbidden";
        const isDish = report?.dish && report.dish.includes("المكبكبة");
        pass = isChicken && !isDish;
        reason = isDish ? "Collided with dish 'المكبكبة'" : isChicken ? "Resolved to CHICKEN/forbidden" : "Failed to resolve to chicken";
      } else if (q === "بطاطا مقلية") {
        const isKibbeh = report?.dish && (report.dish.includes("كبة") || report.dish.includes("كبه"));
        pass = !isKibbeh;
        reason = isKibbeh ? "Collided with dish 'كبة بطاطا'" : "Matched potato food";
      } else if (q === "كبة بطاطا") {
        const isDish = report?.resultMode === "COMPOSITE_FOOD" && report?.dish && (report.dish.includes("كبة") || report.dish.includes("كبه"));
        pass = isDish;
        reason = isDish ? "Resolved to composite dish 'كبة بطاطا'" : "Failed to resolve to dish";
      } else if (q === "جبنة رومي") {
        const isTurkey = report?.proteinSpecificity === "TURKEY";
        pass = !isTurkey;
        reason = isTurkey ? "Collided with turkey" : "Correct cheese mapping";
      } else if (q === "لحم غنم") {
        const first = report?.allowed?.[0];
        const ok = report?.proteinSpecificity === "LAMB" && first?.status === "allowed" && first?.priority === "preferred";
        pass = ok;
        reason = ok ? "LAMB/allowed/preferred" : "Wrong specificity or priority";
      } else if (q === "لحم بقر") {
        const first = report?.allowed?.[0];
        const ok = report?.proteinSpecificity === "BEEF" && first?.status === "allowed" && first?.priority === "allowed_with_conditions";
        pass = ok;
        reason = ok ? "BEEF/allowed/allowed_with_conditions" : "Wrong specificity or priority";
      } else if (q === "لحم جاموس") {
        const first = report?.allowed?.[0];
        const ok = report?.proteinSpecificity === "BUFFALO" && first?.status === "allowed" && first?.priority === "allowed_with_conditions";
        pass = ok;
        reason = ok ? "BUFFALO/allowed/allowed_with_conditions" : "Wrong specificity or priority";
      } else if (q === "لحم جمل") {
        const first = report?.allowed?.[0];
        const ok = report?.proteinSpecificity === "CAMEL" && first?.status === "allowed" && first?.priority === "allowed_with_conditions";
        pass = ok;
        reason = ok ? "CAMEL/allowed/allowed_with_conditions" : "Wrong specificity or priority";
      } else if (q === "شاورما") {
        const isComposite = report?.resultMode === "COMPOSITE_FOOD";
        pass = isComposite;
        reason = isComposite ? "Composite dish" : "Failed to analyze as composite";
      } else if (q === "شاورما لحم") {
        const isComposite = report?.resultMode === "COMPOSITE_FOOD";
        const hasBeef = report?.allowed?.some((i: any) => i.proteinSpecificity === "BEEF") ||
                        report?.conditional?.some((i: any) => i.proteinSpecificity === "BEEF");
        const ok = isComposite && hasBeef && report?.needsClarification !== true;
        pass = ok;
        reason = ok ? "Composite meat shawarma resolved to beef" : "Failed specific meat shawarma resolution";
      } else if (q === "شاورما دجاج") {
        const isComposite = report?.resultMode === "COMPOSITE_FOOD";
        const hasChicken = report?.forbidden?.some((i: any) => i.proteinSpecificity === "CHICKEN");
        pass = isComposite && hasChicken;
        reason = pass ? "Composite chicken shawarma resolved to CHICKEN/forbidden" : "Failed chicken shawarma resolution";
      } else if (q === "كبسة لحم" || q === "مندي لحم") {
        const isComposite = report?.resultMode === "COMPOSITE_FOOD";
        pass = isComposite;
        reason = isComposite ? "Composite dish" : "Failed to remain composite";
      } else if (q === "كبسة دجاج" || q === "مندي دجاج") {
        const isComposite = report?.resultMode === "COMPOSITE_FOOD";
        pass = isComposite;
        reason = isComposite ? "Composite dish" : "Failed to remain composite";
      } else if (q === "طيور" || q === "دواجن") {
        const ok = report?.needsClarification === true && report?.clarificationType === "PROTEIN_SPECIFICATION";
        pass = ok;
        reason = ok ? "Clarification triggered with options" : "Clarification missing or incorrect";
      } else {
        pass = true;
        reason = "Passed base check";
      }

      results.push({
        idx: i + 1,
        query: q,
        entityType: report?.resultMode || "UNKNOWN",
        canonicalId: report?.primaryRuling?.id || 0,
        canonicalName: report?.dish || report?.primaryRuling?.nameAr || "N/A",
        proteinCategory: report?.proteinCategory || "NONE",
        specificity: report?.proteinSpecificity || "NONE",
        status: report?.primaryRuling?.status || "N/A",
        priority: report?.allowed?.[0]?.priority || report?.conditional?.[0]?.priority || "none",
        needsClarification: report?.needsClarification ? "Yes" : "No",
        pass: pass ? "PASS" : "FAIL",
        reason
      });

    } catch (err: any) {
      console.error(`Error querying "${q}":`, err.message);
      results.push({
        idx: i + 1,
        query: q,
        entityType: "ERROR",
        canonicalId: 0,
        canonicalName: "ERROR",
        proteinCategory: "ERROR",
        specificity: "ERROR",
        status: "ERROR",
        priority: "none",
        needsClarification: "No",
        pass: "FAIL",
        reason: err.message
      });
    }
  }

  // Format and print the final table
  console.log("\n=================================================================================");
  console.log("FINAL CONTRACT VERIFICATION TABLE");
  console.log("=================================================================================");
  console.log("| Query | Entity Type | Canonical ID | Canonical Name | Protein Category | Specificity | Status | Priority | Needs Clarification | PASS/FAIL |");
  console.log("|---|---|---|---|---|---|---|---|---|---|");
  results.forEach(r => {
    console.log(`| ${r.query} | ${r.entityType} | ${r.canonicalId} | ${r.canonicalName} | ${r.proteinCategory} | ${r.specificity} | ${r.status} | ${r.priority} | ${r.needsClarification} | ${r.pass} |`);
  });

  console.log("\nSummary of Verification:");
  const total = results.length;
  const passed = results.filter(r => r.pass === "PASS").length;
  console.log(`${passed} / ${total} contract endpoints passed.`);

  if (passed !== total) {
    console.error("❌ FAILED: API Contract mismatch detected!");
    process.exit(1);
  } else {
    console.log("✅ SUCCESS: API Contract verification complete!");
    process.exit(0);
  }
}

runVerification().catch(console.error);

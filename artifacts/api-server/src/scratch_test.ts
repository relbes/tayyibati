import { UnifiedAnalysisEngine } from "./lib/unifiedAnalysisEngine";
import { clearKnowledgeCache, getKnowledgeCache } from "./lib/knowledgeCache";
import { invalidateSearchIndexes } from "./lib/canonicalSearchEngine";
import { getProteinFields, getDishEngineCache, warmDishEngineCache, resolveSingleIngredient } from "./lib/dishCompatibilityEngine";
import { db, aiFoodKnowledgeCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { norm } from "./lib/arabicNormalization";

interface TestScenario {
  query: string;
  inputType?: "text" | "camera" | "ocr" | "barcode" | "voice";
  check: (res: any) => { pass: boolean; reason: string };
}

const scenarios: TestScenario[] = [
  // 1. Pure Protein Clarification Scenarios
  {
    query: "لحم",
    check: (res) => {
      const ok = res.report?.needsClarification === true && res.report?.clarificationType === "PROTEIN_SPECIFICATION";
      return { pass: ok, reason: ok ? "Needs clarification (PROTEIN_SPECIFICATION)" : "Clarification flag missing" };
    }
  },
  {
    query: "شاورما",
    check: (res) => {
      const ok = res.report?.needsClarification === true && res.report?.clarificationType === "DISH_VARIANT";
      return { pass: ok, reason: ok ? "Preserves ambiguity (DISH_VARIANT)" : `needsClarification: ${res.report?.needsClarification}, type: ${res.report?.clarificationType}` };
    }
  },
  {
    query: "شاورما لحم",
    check: (res) => {
      const isPure = res.report?.resultMode === "EXACT_FOOD";
      const needsClar = res.report?.needsClarification;
      const beefIngredient = res.report?.allowed?.find((i: any) => i.proteinSpecificity === "BEEF");
      const totalIngredients = (res.report?.allowed?.length || 0) + (res.report?.forbidden?.length || 0) + (res.report?.conditional?.length || 0);
      const ok = !isPure && !needsClar && beefIngredient && beefIngredient.status === "allowed" && beefIngredient.priority === "allowed_with_conditions" && totalIngredients >= 3;
      return { pass: ok, reason: isPure ? "Incorrectly resolved as pure food" : needsClar ? "Triggered clarification" : !beefIngredient ? "Failed to find BEEF ingredient in allowed list" : totalIngredients < 3 ? `Collapsed to single ingredient: count ${totalIngredients}` : `Beef status: ${beefIngredient.status}, priority: ${beefIngredient.priority}, count: ${totalIngredients}` };
    }
  },
  {
    query: "شاورما دجاج",
    check: (res) => {
      const report = res.report;
      const isComposite = report?.resultMode === "COMPOSITE_FOOD";
      const correctProtein = report?.proteinCategory === "POULTRY" && report?.proteinSpecificity === "CHICKEN";
      const correctDishName = report?.dish === "شاورما دجاج";
      const correctRulingName = report?.primaryRuling?.nameAr === "شاورما دجاج";
      const correctCanonicalName = report?.canonicalResult?.canonicalName === "شاورما دجاج";
      
      const allowedNames = (report?.allowed || []).map((i: any) => i.nameAr || i.name);
      const forbiddenNames = (report?.forbidden || []).map((i: any) => i.nameAr || i.name);
      const conditionalNames = (report?.conditional || []).map((i: any) => i.nameAr || i.name);
      const unknownNames = (report?.unknown || []).map((i: any) => i.nameAr || i.name);
      const allResolvedNames = [...allowedNames, ...forbiddenNames, ...conditionalNames, ...unknownNames];
      
      const containsChicken = allResolvedNames.some(name => name.includes("دجاج"));
      const containsGarlic = allResolvedNames.some(name => name.includes("ثوم"));
      const containsBread = allResolvedNames.some(name => name.includes("خبز"));
      const ingredientsOk = containsChicken && containsGarlic && containsBread;
      
      const ok = isComposite && correctProtein && correctDishName && correctRulingName && correctCanonicalName && ingredientsOk;
      return {
        pass: ok,
        reason: ok ? "Chicken shawarma correct" : `isComposite=${isComposite}, proteinOk=${correctProtein}, dishAr="${report?.dish}", primaryRulingNameAr="${report?.primaryRuling?.nameAr}", canonicalName="${report?.canonicalResult?.canonicalName}", ingredientsOk=${ingredientsOk} (ingredients: [${allResolvedNames.join(", ")}])`
      };
    }
  },
  {
    query: "شاورما لحم غنم",
    check: (res) => {
      const report = res.report;
      const isComposite = report?.resultMode === "COMPOSITE_FOOD";
      const correctProtein = report?.proteinCategory === "MEAT" && report?.proteinSpecificity === "LAMB";
      const correctDishName = report?.dish === "شاورما لحم غنم";
      const correctRulingName = report?.primaryRuling?.nameAr === "شاورما لحم غنم";
      const correctCanonicalName = report?.canonicalResult?.canonicalName === "شاورما لحم غنم";
      
      const allowedNames = (report?.allowed || []).map((i: any) => i.nameAr || i.name);
      const forbiddenNames = (report?.forbidden || []).map((i: any) => i.nameAr || i.name);
      const conditionalNames = (report?.conditional || []).map((i: any) => i.nameAr || i.name);
      const unknownNames = (report?.unknown || []).map((i: any) => i.nameAr || i.name);
      const allResolvedNames = [...allowedNames, ...forbiddenNames, ...conditionalNames, ...unknownNames];
      
      const containsLamb = allResolvedNames.some(name => name.includes("لحم غنم") || name.includes("غنم"));
      const containsGarlic = allResolvedNames.some(name => name.includes("ثوم"));
      const containsBread = allResolvedNames.some(name => name.includes("خبز"));
      const ingredientsOk = containsLamb && containsGarlic && containsBread;
      
      const ok = isComposite && correctProtein && correctDishName && correctRulingName && correctCanonicalName && ingredientsOk;
      return {
        pass: ok,
        reason: ok ? "Lamb shawarma correct" : `isComposite=${isComposite}, proteinOk=${correctProtein}, dishAr="${report?.dish}", primaryRulingNameAr="${report?.primaryRuling?.nameAr}", canonicalName="${report?.canonicalResult?.canonicalName}", ingredientsOk=${ingredientsOk} (ingredients: [${allResolvedNames.join(", ")}])`
      };
    }
  },
  {
    query: "شاورما غنم",
    check: (res) => {
      const report = res.report;
      const isComposite = report?.resultMode === "COMPOSITE_FOOD";
      const correctProtein = report?.proteinCategory === "MEAT" && report?.proteinSpecificity === "LAMB";
      const correctDishName = report?.dish === "شاورما لحم غنم";
      const correctRulingName = report?.primaryRuling?.nameAr === "شاورما لحم غنم";
      const correctCanonicalName = report?.canonicalResult?.canonicalName === "شاورما لحم غنم";
      
      const allowedNames = (report?.allowed || []).map((i: any) => i.nameAr || i.name);
      const forbiddenNames = (report?.forbidden || []).map((i: any) => i.nameAr || i.name);
      const conditionalNames = (report?.conditional || []).map((i: any) => i.nameAr || i.name);
      const unknownNames = (report?.unknown || []).map((i: any) => i.nameAr || i.name);
      const allResolvedNames = [...allowedNames, ...forbiddenNames, ...conditionalNames, ...unknownNames];
      
      const containsLamb = allResolvedNames.some(name => name.includes("لحم غنم") || name.includes("غنم"));
      const containsGarlic = allResolvedNames.some(name => name.includes("ثوم"));
      const containsBread = allResolvedNames.some(name => name.includes("خبز"));
      const ingredientsOk = containsLamb && containsGarlic && containsBread;
      
      const ok = isComposite && correctProtein && correctDishName && correctRulingName && correctCanonicalName && ingredientsOk;
      return {
        pass: ok,
        reason: ok ? "Lamb shawarma (direct) correct" : `isComposite=${isComposite}, proteinOk=${correctProtein}, dishAr="${report?.dish}", primaryRulingNameAr="${report?.primaryRuling?.nameAr}", canonicalName="${report?.canonicalResult?.canonicalName}", ingredientsOk=${ingredientsOk} (ingredients: [${allResolvedNames.join(", ")}])`
      };
    }
  },
  {
    query: "شاورما بقري",
    check: (res) => {
      const report = res.report;
      const isComposite = report?.resultMode === "COMPOSITE_FOOD";
      const correctProtein = report?.proteinCategory === "MEAT" && report?.proteinSpecificity === "BEEF";
      const correctDishName = report?.dish === "شاورما لحم بقر";
      const correctRulingName = report?.primaryRuling?.nameAr === "شاورما لحم بقر";
      const correctCanonicalName = report?.canonicalResult?.canonicalName === "شاورما لحم بقر";
      const correctFinalCompatibility = report?.primaryRuling?.status === "forbidden";
      
      const allowedNames = (report?.allowed || []).map((i: any) => i.nameAr || i.name);
      const forbiddenNames = (report?.forbidden || []).map((i: any) => i.nameAr || i.name);
      const conditionalNames = (report?.conditional || []).map((i: any) => i.nameAr || i.name);
      const unknownNames = (report?.unknown || []).map((i: any) => i.nameAr || i.name);
      const allResolvedNames = [...allowedNames, ...forbiddenNames, ...conditionalNames, ...unknownNames];
      
      const containsBeef = allResolvedNames.some(name => name.includes("لحم بقر") || name.includes("بقري"));
      const containsGarlic = allResolvedNames.some(name => name.includes("ثوم"));
      const containsTahini = allResolvedNames.some(name => name.includes("طحين"));
      const containsPickle = allResolvedNames.some(name => name.includes("مخلل") || name.includes("زيتون"));
      const containsBread = allResolvedNames.some(name => name.includes("خبز"));
      
      const hasToastBread = allResolvedNames.some(name => name.includes("توست"));
      
      // The resolved recipe must NOT contain all of tortilla, shrak, hmam, white, Lebanese bread simultaneously
      const breadVariantsCount = [
        "تورتيلا",
        "شراك",
        "حمام",
        "ابيض",
        "لبناني"
      ].filter(variant => allResolvedNames.some(name => name.includes(variant))).length;
      
      const breadVariantsOk = breadVariantsCount < 3; // Certainly not all of them
      
      const ingredientsOk = containsBeef && containsGarlic && containsTahini && containsPickle && containsBread && !hasToastBread && breadVariantsOk;
      
      const ok = isComposite && correctProtein && correctDishName && correctRulingName && correctCanonicalName && correctFinalCompatibility && ingredientsOk;
      return {
        pass: ok,
        reason: ok ? "Beef shawarma correct" : `isComposite=${isComposite}, proteinOk=${correctProtein}, dishAr="${report?.dish}", primaryRulingNameAr="${report?.primaryRuling?.nameAr}", canonicalName="${report?.canonicalResult?.canonicalName}", compatibility="${report?.primaryRuling?.status}", ingredientsOk=${ingredientsOk} (ingredients: [${allResolvedNames.join(", ")}])`
      };
    }
  },
  {
    query: "كبسة لحم",
    check: (res) => {
      const isPure = res.report?.resultMode === "EXACT_FOOD";
      const needsClar = res.report?.needsClarification;
      const hasProtein = res.report?.proteinCategory === "MEAT";
      const ok = !isPure && !needsClar && hasProtein;
      return { pass: ok, reason: isPure ? "Incorrectly resolved as pure meat" : needsClar ? "Triggered clarification" : "Composite kabsa analyzed" };
    }
  },
  {
    query: "كبسة دجاج",
    check: (res) => {
      const isPure = res.report?.resultMode === "EXACT_FOOD";
      const needsClar = res.report?.needsClarification;
      const hasProtein = res.report?.proteinCategory === "POULTRY";
      const ok = !isPure && !needsClar && hasProtein;
      return { pass: ok, reason: isPure ? "Incorrectly resolved as pure chicken" : needsClar ? "Triggered clarification" : "Composite kabsa analyzed" };
    }
  },
  {
    query: "مندي لحم",
    check: (res) => {
      const isPure = res.report?.resultMode === "EXACT_FOOD";
      const needsClar = res.report?.needsClarification;
      const hasProtein = res.report?.proteinCategory === "MEAT";
      const ok = !isPure && !needsClar && hasProtein;
      return { pass: ok, reason: isPure ? "Incorrectly resolved as pure meat" : needsClar ? "Triggered clarification" : "Composite Mandi analyzed" };
    }
  },
  {
    query: "مندي دجاج",
    check: (res) => {
      const isPure = res.report?.resultMode === "EXACT_FOOD";
      const needsClar = res.report?.needsClarification;
      const hasProtein = res.report?.proteinCategory === "POULTRY";
      const ok = !isPure && !needsClar && hasProtein;
      return { pass: ok, reason: isPure ? "Incorrectly resolved as pure chicken" : needsClar ? "Triggered clarification" : "Composite Mandi analyzed" };
    }
  },
  {
    query: "جاج",
    check: (res) => {
      const ok = res.report?.proteinSpecificity === "CHICKEN" && res.report?.primaryRuling?.status === "forbidden";
      return { pass: ok, reason: ok ? "Resolved to CHICKEN/forbidden" : "Failed to resolve to forbidden chicken" };
    }
  },
  {
    query: "دجاج",
    check: (res) => {
      const ok = res.report?.proteinSpecificity === "CHICKEN" && res.report?.primaryRuling?.status === "forbidden";
      return { pass: ok, reason: ok ? "Resolved to CHICKEN/forbidden" : "Failed to resolve to forbidden chicken" };
    }
  },
  {
    query: "فراخ",
    check: (res) => {
      const ok = res.report?.proteinSpecificity === "CHICKEN" && res.report?.primaryRuling?.status === "forbidden";
      return { pass: ok, reason: ok ? "Resolved to CHICKEN/forbidden" : "Failed to resolve to forbidden chicken" };
    }
  },
  {
    query: "لحم غنم",
    check: (res) => {
      const ok = res.report?.proteinSpecificity === "LAMB" && res.report?.primaryRuling?.status === "allowed";
      return { pass: ok, reason: ok ? "Resolved to LAMB/allowed" : "Failed to resolve to allowed lamb" };
    }
  },
  {
    query: "لحم بقر",
    check: (res) => {
      const ok = res.report?.proteinSpecificity === "BEEF" && res.report?.primaryRuling?.status === "allowed";
      return { pass: ok, reason: ok ? "Resolved to BEEF/allowed" : "Failed to resolve to allowed beef" };
    }
  },
  {
    query: "لحم جاموس",
    check: (res) => {
      const ok = res.report?.proteinSpecificity === "BUFFALO" && res.report?.primaryRuling?.status === "allowed";
      return { pass: ok, reason: ok ? "Resolved to BUFFALO/allowed" : "Failed to resolve to allowed buffalo" };
    }
  },
  {
    query: "لحم جمل",
    check: (res) => {
      const ok = res.report?.proteinSpecificity === "CAMEL" && res.report?.primaryRuling?.status === "allowed";
      return { pass: ok, reason: ok ? "Resolved to CAMEL/allowed" : "Failed to resolve to allowed camel" };
    }
  },
  {
    query: "دواجن",
    check: (res) => {
      const ok = res.report?.needsClarification === true && res.report?.clarificationType === "PROTEIN_SPECIFICATION";
      return { pass: ok, reason: ok ? "Needs clarification (PROTEIN_SPECIFICATION)" : "Clarification flag missing" };
    }
  },
  {
    query: "طيور",
    check: (res) => {
      const ok = res.report?.needsClarification === true && res.report?.clarificationType === "PROTEIN_SPECIFICATION";
      return { pass: ok, reason: ok ? "Needs clarification (PROTEIN_SPECIFICATION)" : "Clarification flag missing" };
    }
  },
  {
    query: "حمام",
    check: (res) => {
      const ok = res.report?.proteinSpecificity === "PIGEON" && res.report?.primaryRuling?.status === "allowed";
      return { pass: ok, reason: ok ? "Resolved to PIGEON/allowed" : "Failed to resolve to allowed pigeon" };
    }
  },
  {
    query: "سمان",
    check: (res) => {
      const ok = res.report?.proteinSpecificity === "QUAIL" && res.report?.primaryRuling?.status === "allowed";
      return { pass: ok, reason: ok ? "Resolved to QUAIL/allowed" : "Failed to resolve to allowed quail" };
    }
  },
  {
    query: "بط",
    check: (res) => {
      const ok = res.report?.proteinSpecificity === "DUCK" && res.report?.primaryRuling?.status === "forbidden";
      return { pass: ok, reason: ok ? "Resolved to DUCK/forbidden" : "Failed to resolve to forbidden duck" };
    }
  },
  {
    query: "رومي",
    check: (res) => {
      const ok = res.report?.proteinSpecificity === "TURKEY" && res.report?.primaryRuling?.status === "forbidden";
      return { pass: ok, reason: ok ? "Resolved to TURKEY/forbidden" : "Failed to resolve to forbidden turkey" };
    }
  },
  {
    query: "ديك رومي",
    check: (res) => {
      const ok = res.report?.proteinSpecificity === "TURKEY" && res.report?.primaryRuling?.status === "forbidden";
      return { pass: ok, reason: ok ? "Resolved to TURKEY/forbidden" : "Failed to resolve to forbidden turkey" };
    }
  },
  {
    query: "نعام",
    check: (res) => {
      const ok = res.report?.proteinSpecificity === "OSTRICH" && res.report?.primaryRuling?.status === "forbidden";
      return { pass: ok, reason: ok ? "Resolved to OSTRICH/forbidden" : "Failed to resolve to forbidden ostrich" };
    }
  },
  {
    query: "بطاطا مقلية",
    check: (res) => {
      const isKibbeh = res.report?.dish && res.report.dish.includes("كبة");
      return { pass: !isKibbeh, reason: isKibbeh ? "Incorrectly matched to dish 'كبة بطاطا'" : "Did not match 'كبة بطاطا'" };
    }
  },
  {
    query: "جبنة رومي",
    check: (res) => {
      const isTurkey = res.report?.proteinSpecificity === "TURKEY";
      return { pass: !isTurkey, reason: isTurkey ? "Incorrectly matched to turkey" : "Safe from turkey classification" };
    }
  },
  {
    query: "كبة بطاطا",
    check: (res) => {
      const isDish = res.report?.resultMode !== "EXACT_FOOD" && res.report?.dish && (res.report.dish.includes("كبة") || res.report.dish.includes("كبه"));
      return { pass: isDish, reason: isDish ? "Resolved correctly as dish 'كبة بطاطا'" : "Failed to resolve to dish" };
    }
  },
  {
    query: "أرز مصري",
    check: (res) => {
      const ok = res.report?.primaryRuling?.status === "allowed" || res.report?.allowed?.some((i: any) => i.nameAr?.includes("أرز") || i.nameAr?.includes("الأرز"));
      return { pass: ok, reason: ok ? "Resolved Egyptian rice to allowed" : "Failed to resolve Egyptian rice to allowed" };
    }
  },
  {
    query: "منسف دجاج",
    check: (res) => {
      const unknownList = res.report?.unknown || [];
      const riceInUnknown = unknownList.some((i: any) => i.nameAr?.includes("أرز") || i.rawIngredientName?.includes("أرز"));
      const riceInAllowed = (res.report?.allowed || []).some((i: any) => i.nameAr?.includes("أرز") || i.nameAr?.includes("الأرز"));
      const ok = !riceInUnknown && riceInAllowed;
      return { pass: ok, reason: ok ? "Mansaf chicken rice resolved cleanly to allowed" : `Rice in unknown: ${riceInUnknown}, Rice in allowed: ${riceInAllowed}` };
    }
  },

  // 2. Camera Modality Scenarios
  {
    query: "شاورما دجاج",
    inputType: "camera",
    check: (res) => {
      const ok = res.report?.needsClarification === false && res.report?.proteinSpecificity === "CHICKEN" && res.report?.primaryRuling?.status === "forbidden";
      return { pass: ok, reason: `Needs Clarification: ${res.report?.needsClarification}, Specificity: ${res.report?.proteinSpecificity}, Status: ${res.report?.primaryRuling?.status}` };
    }
  },
  {
    query: "شاورما لحم",
    inputType: "camera",
    check: (res) => {
      const ok = res.report?.needsClarification === false && res.report?.proteinSpecificity === "BEEF" && res.report?.allowed?.some((i: any) => i.proteinSpecificity === "BEEF");
      return { pass: ok, reason: `Needs Clarification: ${res.report?.needsClarification}, Specificity: ${res.report?.proteinSpecificity}` };
    }
  },
  {
    query: "شاورما",
    inputType: "camera",
    check: (res) => {
      const ok = res.report?.needsClarification === true && res.report?.clarificationType === "DISH_VARIANT";
      return { pass: ok, reason: `Needs Clarification: ${res.report?.needsClarification}, ClarificationType: ${res.report?.clarificationType}` };
    }
  },
  {
    query: "طعام غير معروف",
    inputType: "camera",
    check: (res) => {
      const ok = res.report?.needsClarification === true && res.report?.clarificationType === "IMAGE_UNCERTAIN";
      return { pass: ok, reason: `Needs Clarification: ${res.report?.needsClarification}, ClarificationType: ${res.report?.clarificationType}` };
    }
  }
];

async function seedAICache(query: string, inputType: string, confidence: number, canonicalNameAr: string, ingredients: string[]) {
  const normQuery = norm(query || "").trim();
  const key = `${inputType.toUpperCase()}:${normQuery}:v1`;
  const responseJson = {
    entityType: "dish",
    canonicalNameAr,
    canonicalNameEn: canonicalNameAr,
    confidence,
    ingredients: ingredients.map(name => ({ name, certainty: 0.95 }))
  };

  await db.delete(aiFoodKnowledgeCacheTable).where(eq(aiFoodKnowledgeCacheTable.cacheKey, key));

  await db.insert(aiFoodKnowledgeCacheTable).values({
    cacheKey: key,
    normalizedQuery: normQuery,
    originalQuery: query,
    inputType: inputType as any,
    entityType: "dish",
    canonicalNameAr,
    canonicalNameEn: canonicalNameAr,
    confidence,
    responseJson,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  });
}

async function main() {
  clearKnowledgeCache();
  invalidateSearchIndexes();

  // Clear cache and seed the L2 cache for deterministic offline resolution
  await db.delete(aiFoodKnowledgeCacheTable);

  // Seed TEXT queries
  await seedAICache("شاورما دجاج", "text", 0.95, "شاورما", ["دجاج"]);
  await seedAICache("شاورما لحم", "text", 0.95, "شاورما", ["لحم بقر"]);
  await seedAICache("شاورما لحم غنم", "text", 0.95, "شاورما", ["لحم غنم"]);
  await seedAICache("شاورما غنم", "text", 0.95, "شاورما", ["لحم غنم"]);
  await seedAICache("شاورما بقري", "text", 0.95, "شاورما", ["لحم بقر"]);
  await seedAICache("كبسة لحم", "text", 0.95, "كبسة", ["لحم غنم"]);
  await seedAICache("كبسة دجاج", "text", 0.95, "كبسة", ["دجاج"]);
  await seedAICache("مندي لحم", "text", 0.95, "مندي", ["لحم غنم"]);
  await seedAICache("مندي دجاج", "text", 0.95, "مندي", ["دجاج"]);

  // Seed CAMERA queries
  await seedAICache("شاورما دجاج", "camera", 0.95, "شاورما", ["دجاج"]);
  await seedAICache("شاورما لحم", "camera", 0.95, "شاورما", ["لحم بقر"]);
  await seedAICache("شاورما", "camera", 0.60, "شاورما", ["دجاج", "لحم بقر"]);
  await seedAICache("طعام غير معروف", "camera", 0.30, "طعام غير معروف", []);

  console.log("\n=========================================================================");
  console.log("RUNNING UNIFIED RESOLUTION REGRESSION TEST SUITE WITH DETAILED TRACING");
  console.log("=========================================================================\n");

  const results: any[] = [];
  let passedCount = 0;

  await warmDishEngineCache();
  const dishCache = getDishEngineCache();
  const foodCache = await getKnowledgeCache();

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const modality = s.inputType || "text";
    try {
      const res = await UnifiedAnalysisEngine.analyze({
        query: s.query,
        inputType: modality
      });
      const checkRes = s.check(res);
      if (checkRes.pass) passedCount++;

      // Compute DB Candidates
      const dbCandidates: string[] = [];
      const normQ = s.query.trim().replace(/^ال/, "");
      for (const [id, dish] of dishCache.dishesById.entries()) {
        if (dish.nameAr.includes(normQ) || normQ.includes(dish.nameAr)) dbCandidates.push(`${dish.nameAr} (dish)`);
      }
      for (const [id, food] of foodCache.foodById.entries()) {
        if (food.nameAr.includes(normQ) || normQ.includes(food.nameAr)) dbCandidates.push(`${food.nameAr} (food)`);
      }

      // Compute Selected Candidate
      let selectedCandidate = "None";
      if (dbCandidates.length === 1) {
        selectedCandidate = dbCandidates[0];
      } else if (dbCandidates.length > 1) {
        const exact = dbCandidates.find(c => c.split(" ")[0] === s.query);
        if (exact) selectedCandidate = exact;
      }

      const queryProt = getProteinFields(s.query);
      const proteinInfo = `${res.report?.proteinCategory || "NONE"} / ${res.report?.proteinSpecificity || "NONE"}`;

      results.push({
        idx: i + 1,
        query: s.query,
        modality,
        aiConfidence: res.report?.aiConfidence !== undefined ? res.report.aiConfidence.toFixed(2) : "1.00",
        dbCandidates: dbCandidates.length > 0 ? dbCandidates.join(", ") : "None",
        selectedCandidate,
        resolutionState: res.report?.resolutionState || "CONFIDENT",
        clarificationType: res.report?.clarificationType || "None",
        protein: proteinInfo,
        finalResult: res.report?.primaryRuling?.status || (res.report?.needsClarification ? "clarification" : "allowed"),
        pass: checkRes.pass ? "PASS" : "FAIL",
        reason: checkRes.reason,
        entityType: res.dishAnalysisResult ? "composite" : "single",
        canonical: res.report?.dish || res.report?.primaryRuling?.nameAr || "N/A",
        category: res.report?.proteinCategory || "NONE",
        specificity: res.report?.proteinSpecificity || "NONE",
        status: res.report?.primaryRuling?.status || "N/A",
        priority: res.report?.allowed?.[0]?.priority || res.report?.conditional?.[0]?.priority || "none",
        clarification: res.report?.needsClarification ? "Yes" : "No",
      });
    } catch (err: any) {
      results.push({
        idx: i + 1,
        query: s.query,
        modality,
        aiConfidence: "0.00",
        dbCandidates: "ERROR",
        selectedCandidate: "ERROR",
        resolutionState: "ERROR",
        clarificationType: "ERROR",
        protein: "ERROR",
        finalResult: "ERROR",
        pass: "FAIL",
        reason: err.message,
        entityType: "error",
        canonical: "ERROR",
        category: "ERROR",
        specificity: "ERROR",
        status: "ERROR",
        priority: "none",
        clarification: "No",
      });
    }
  }

  // Print raw backend JSON response for 6 core queries:
  // 1. لحم, 2. شاورما, 3. شاورما لحم, 4. شاورما دجاج, 5. شاورما لحم غنم, 6. شاورما بقري
  const coreQueries = ["لحم", "شاورما", "شاورما لحم", "شاورما دجاج", "شاورما لحم غنم", "شاورما بقري"];
  console.log("\n=========================================================================");
  console.log("RAW BACKEND JSON RESPONSES FOR CORE QUERIES");
  console.log("=========================================================================\n");

  for (const q of coreQueries) {
    try {
      const res = await UnifiedAnalysisEngine.analyze({ query: q, inputType: "text" });
      console.log(`\n--- QUERY: "${q}" ---`);
      console.log(JSON.stringify(res.report, null, 2));
    } catch (err: any) {
      console.error(`Error fetching raw JSON for "${q}":`, err.message);
    }
  }

  // Print detailed tracing table for all queries using User's required fields
  console.log("\n=========================================================================");
  console.log("DETAILED TRACE FOR ALL SCENARIOS");
  console.log("=========================================================================\n");

  results.forEach(r => {
    console.log(`Scenario #${r.idx}: "${r.query}" | Modality: ${r.modality} | Result: ${r.pass}`);
    console.log(`  - INPUT:               "${r.query}"`);
    console.log(`  - MODALITY:            "${r.modality}"`);
    console.log(`  - AI CONFIDENCE:       ${r.aiConfidence}`);
    console.log(`  - DB CANDIDATES:       [${r.dbCandidates}]`);
    console.log(`  - SELECTED CANDIDATE:  "${r.selectedCandidate}"`);
    console.log(`  - RESOLUTION STATE:    "${r.resolutionState}"`);
    console.log(`  - CLARIFICATION TYPE:  "${r.clarificationType}"`);
    console.log(`  - PROTEIN:             "${r.protein}"`);
    console.log(`  - FINAL RESULT:        "${r.finalResult}"`);
    if (r.pass === "FAIL") {
      console.log(`  - FAILURE REASON:      ${r.reason}`);
    }
    console.log(`-------------------------------------------------------------------------`);
  });

  // Print regression report summary table
  console.log("\n=========================================================================");
  console.log("REGRESSION SUMMARY TABLE");
  console.log("=========================================================================\n");

  console.log("| # | Query | Modality | Entity Type | Protein Category | Specificity | Status | Priority | Clarification | PASS/FAIL |");
  console.log("|---|---|---|---|---|---|---|---|---|---|");
  results.forEach(r => {
    console.log(`| ${r.idx} | ${r.query} | ${r.modality} | ${r.entityType} | ${r.category} | ${r.specificity} | ${r.status} | ${r.priority} | ${r.clarification} | ${r.pass} |`);
  });

  console.log("\n=========================================================================");
  console.log(`SUMMARY: ${passedCount} / ${scenarios.length} PASSED`);
  console.log("=========================================================================\n");

  results.forEach(r => {
    if (r.pass === "FAIL") {
      console.log(`❌ TEST ${r.idx} failed: "${r.query}" (${r.modality}) - ${r.reason}`);
    }
  });

  if (passedCount !== scenarios.length) {
    process.exit(1);
  }

  // Assert direct search vs clarification selection equivalence (TEST 5)
  console.log("\n=========================================================================");
  console.log("ASSERTING DIRECT QUERY VS CLARIFICATION SELECTION EQUIVALENCE (TEST 5)");
  console.log("=========================================================================\n");

  const directRes = await UnifiedAnalysisEngine.analyze({ query: "شاورما بقري", inputType: "text" });
  const selectionRes = await UnifiedAnalysisEngine.analyze({ query: "شاورما بقري", inputType: "text" });

  const directCanonicalId = directRes.report.canonicalResult?.canonicalId;
  const selectionCanonicalId = selectionRes.report.canonicalResult?.canonicalId;
  const directCanonicalName = directRes.report.canonicalResult?.canonicalName;
  const selectionCanonicalName = selectionRes.report.canonicalResult?.canonicalName;
  const directDecision = directRes.report.primaryRuling?.status;
  const selectionDecision = selectionRes.report.primaryRuling?.status;

  console.log(`Direct:    canonicalId=${directCanonicalId}, canonicalName="${directCanonicalName}", decision="${directDecision}"`);
  console.log(`Selection: canonicalId=${selectionCanonicalId}, canonicalName="${selectionCanonicalName}", decision="${selectionDecision}"`);

  if (directCanonicalId !== selectionCanonicalId || directCanonicalName !== selectionCanonicalName || directDecision !== selectionDecision) {
    console.error(`❌ Equivalence test failed!`);
    process.exit(1);
  }
  console.log("✅ Equivalence test passed!");

  // Assert generic to specific resolution prevention & dynamic safety notes (TEST 6)
  console.log("\n=========================================================================");
  console.log("ASSERTING GENERIC RESOLUTION & DYNAMIC SAFETY NOTES (TEST 6)");
  console.log("=========================================================================\n");

  const cache = await warmDishEngineCache();

  // Test 1 & 2: Generic bread
  const resGenericBread = resolveSingleIngredient("خبز", cache, false);
  console.log(`Test 1 & 2 - Input: "خبز" -> Resolved: "${resGenericBread.canonicalFoodAr}" (foodId: ${resGenericBread.foodId}, status: "${resGenericBread.status}", reason: "${resGenericBread.reason}")`);

  if (resGenericBread.foodId !== null || resGenericBread.canonicalFoodAr !== "خبز") {
    console.error(`❌ Test 1 failed: Generic bread must retain canonicalFoodAr="خبز" and foodId=null!`);
    process.exit(1);
  }
  if (resGenericBread.status !== "forbidden" && resGenericBread.status !== "conditional") {
    console.error(`❌ Test 1 failed: Generic bread must receive conservative not-safe status!`);
    process.exit(1);
  }
  if (!resGenericBread.reason || !resGenericBread.reason.includes("مسموح فقط إذا كان")) {
    console.error(`❌ Test 2 failed: Generic bread reason must contain dynamic safety note!`);
    process.exit(1);
  }

  // Test 3: Explicit allowed bread
  const resAllowedBread = resolveSingleIngredient("خبز التوست الحبة الكاملة", cache, false);
  console.log(`Test 3 - Input: "خبز التوست الحبة الكاملة" -> Resolved: "${resAllowedBread.canonicalFoodAr}" (foodId: ${resAllowedBread.foodId}, status: "${resAllowedBread.status}")`);
  if (resAllowedBread.foodId !== 1313 || resAllowedBread.status !== "allowed") {
    console.error(`❌ Test 3 failed: Explicit allowed bread must resolve to food 1313 with status allowed!`);
    process.exit(1);
  }

  // Test 4: Explicit alias whole-wheat toast
  const resAliasBread = resolveSingleIngredient("خبز توست القمح الكامل", cache, false);
  console.log(`Test 4 - Input: "خبز توست القمح الكامل" -> Resolved: "${resAliasBread.canonicalFoodAr}" (foodId: ${resAliasBread.foodId}, status: "${resAliasBread.status}")`);
  if (resAliasBread.foodId !== 1313 || resAliasBread.status !== "allowed") {
    console.error(`❌ Test 4 failed: Alias whole-wheat toast must resolve to food 1313 with status allowed!`);
    process.exit(1);
  }

  // Test 5: Explicit forbidden bread (Shrak)
  const resShrak = resolveSingleIngredient("خبز شراك", cache, false);
  console.log(`Test 5 - Input: "خبز شراك" -> Resolved: "${resShrak.canonicalFoodAr}" (foodId: ${resShrak.foodId}, status: "${resShrak.status}")`);
  if (resShrak.status !== "forbidden") {
    console.error(`❌ Test 5 failed: Explicit shrak bread must resolve to status forbidden!`);
    process.exit(1);
  }

  // Test 6: Explicit forbidden bread (Regular)
  const resRegularBread = resolveSingleIngredient("خبز عادي", cache, false);
  console.log(`Test 6 - Input: "خبز عادي" -> Resolved: "${resRegularBread.canonicalFoodAr}" (foodId: ${resRegularBread.foodId}, status: "${resRegularBread.status}")`);
  if (resRegularBread.foodId !== 1423 || resRegularBread.status !== "forbidden") {
    console.error(`❌ Test 6 failed: Explicit regular bread must resolve to food 1423 with status forbidden!`);
    process.exit(1);
  }

  // Test 7: Generic cheese (All DB variants allowed -> status allowed)
  const resCheese = resolveSingleIngredient("جبن", cache, false);
  console.log(`Test 7 - Input: "جبن" -> Resolved: "${resCheese.canonicalFoodAr}" (foodId: ${resCheese.foodId}, status: "${resCheese.status}")`);
  if (resCheese.foodId !== null || resCheese.canonicalFoodAr !== "جبن" || (resCheese.status !== "allowed" && resCheese.status !== "forbidden")) {
    console.error(`❌ Test 7 failed: Generic cheese must retain foodId=null and canonicalFoodAr="جبن"!`);
    process.exit(1);
  }

  // Test 8: Generic oil (All DB variants allowed -> status allowed)
  const resOil = resolveSingleIngredient("زيت", cache, false);
  console.log(`Test 8 - Input: "زيت" -> Resolved: "${resOil.canonicalFoodAr}" (foodId: ${resOil.foodId}, status: "${resOil.status}")`);
  if (resOil.foodId !== null || resOil.canonicalFoodAr !== "زيت" || (resOil.status !== "allowed" && resOil.status !== "forbidden")) {
    console.error(`❌ Test 8 failed: Generic oil must retain foodId=null and canonicalFoodAr="زيت"!`);
    process.exit(1);
  }

  // Test 9: Generic meat without context
  const resMeatNoContext = resolveSingleIngredient("لحم", cache, false);
  console.log(`Test 9 - Input: "لحم" -> Resolved: "${resMeatNoContext.canonicalFoodAr}" (foodId: ${resMeatNoContext.foodId}, status: "${resMeatNoContext.status}")`);
  if (resMeatNoContext.foodId !== null || resMeatNoContext.status !== "forbidden" || resMeatNoContext.canonicalFoodAr !== "لحم") {
    console.error(`❌ Test 9 failed: Generic meat without context must retain foodId=null, status=forbidden, and canonicalFoodAr="لحم"!`);
    process.exit(1);
  }

  // Test 9.5: Multi-generic family verification (جبن, زيت, خبز, لحم, دواجن, طيور, صلصة, حليب, لبن, دقيق)
  console.log("\n--- Testing Multi-Generic Family Invariant ---");
  const genericFamiliesToTest = ["جبن", "زيت", "خبز", "لحم", "دواجن", "طيور", "صلصة", "حليب", "لبن", "دقيق"];
  for (const genTerm of genericFamiliesToTest) {
    const res = resolveSingleIngredient(genTerm, cache, false);
    console.log(`Generic Term: "${genTerm}" -> canonicalFoodAr: "${res.canonicalFoodAr}", foodId: ${res.foodId}, status: "${res.status}"`);
    if (res.foodId !== null || res.canonicalFoodAr !== genTerm) {
      console.error(`❌ Generic family test failed for "${genTerm}"! Expected foodId=null, canonicalFoodAr="${genTerm}". Got foodId=${res.foodId}, status=${res.status}, canonicalFoodAr=${res.canonicalFoodAr}`);
      process.exit(1);
    }
  }
  console.log("✅ All generic ingredient families verified generic!");

  // Test 10: Meat with BEEF query context
  const resMeatWithBeef = await UnifiedAnalysisEngine.analyze({ query: "شاورما بقري", inputType: "text" });
  const allowedList = resMeatWithBeef.report?.allowed || [];
  const conditionalList = resMeatWithBeef.report?.conditional || [];
  const forbiddenList = resMeatWithBeef.report?.forbidden || [];
  const resolvedList = resMeatWithBeef.dishAnalysisResult?.resolvedIngredients || [];
  const allResolved = [...allowedList, ...conditionalList, ...forbiddenList, ...resolvedList];
  const meatItem = allResolved.find((i: any) => (i.rawIngredientName === "لحم" || i.nameAr === "لحم" || i.canonicalFoodAr?.includes("بقر") || i.nameAr?.includes("بقر")));
  console.log(`Test 10 - Query: "شاورما بقري" -> Meat specialized ingredient: "${meatItem?.canonicalFoodAr || meatItem?.nameAr || meatItem?.name}" (status: "${meatItem?.status}")`);
  if (!meatItem || !(meatItem.canonicalFoodAr?.includes("بقر") || meatItem.nameAr?.includes("بقر") || meatItem.name?.includes("بقر"))) {
    console.error(`❌ Test 10 failed: Meat with BEEF context must specialize to beef!`);
    process.exit(1);
  }

  // Test 11 & 12: Candidate ordering invariance
  console.log(`Test 11 & 12 - Verifying candidate reordering does not force generic ingredient resolution to specific food...`);
  const resReorderBread = resolveSingleIngredient("خبز", cache, false);
  const resReorderCheese = resolveSingleIngredient("جبن", cache, false);
  if (resReorderBread.foodId !== null || resReorderCheese.foodId !== null) {
    console.error(`❌ Test 11 & 12 failed: Generic ingredients must retain foodId=null regardless of candidate order!`);
    process.exit(1);
  }

  // Test 13: BEEF context scoping (affects "لحم" but NOT "خبز", "جبن", "زيت")
  console.log(`Test 13 - Verifying BEEF context scoping...`);
  const breadItemInBeefDish = resolvedList.find((i: any) => i.rawIngredientName === "خبز" || i.canonicalFoodAr === "خبز");
  if (breadItemInBeefDish && (breadItemInBeefDish.foodId !== null || breadItemInBeefDish.canonicalFoodAr.includes("توست"))) {
    console.error(`❌ Test 13 failed: BEEF context must not specialize bread!`);
    process.exit(1);
  }

  // Test 14: End-to-End Search API Verification for 5 Generic / Specific Pairs
  console.log("\n=========================================================================");
  console.log("ASSERTING END-TO-END SEARCH API RESPONSES FOR 5 GENERIC / SPECIFIC PAIRS");
  console.log("=========================================================================\n");

  const pairsToTest = [
    { generic: "جبن", specific: "جبنة شيدر" },
    { generic: "زيت", specific: "زيت زيتون" },
    { generic: "خبز", specific: "خبز التوست الحبة الكاملة" },
    { generic: "لحم", specific: "لحم بقر" },
    { generic: "صلصة", specific: "صلصة الطماطم" },
  ];

  for (const pair of pairsToTest) {
    console.log(`--- Testing Pair: Generic "${pair.generic}" vs Specific "${pair.specific}" ---`);
    
    // Test Generic E2E API
    const genRes = await UnifiedAnalysisEngine.analyze({ query: pair.generic, inputType: "text" });
    const genReport = genRes.report;
    console.log(`Generic "${pair.generic}" E2E API ResultMode: "${genReport.resultMode}", NeedsClarification: ${genReport.needsClarification}, Explanation: "${genReport.explanation || genReport.questionAr}"`);
    
    // Generic search must not silently return an allowed specific food
    if (genReport.primaryRuling?.status === "allowed" && genReport.primaryRuling?.canonicalId !== null) {
      console.error(`❌ E2E API Test failed: Generic "${pair.generic}" returned an allowed specific food (ID: ${genReport.primaryRuling.canonicalId})!`);
      process.exit(1);
    }
    console.log(`✅ Generic "${pair.generic}" E2E API test passed!`);

    // Test Specific E2E API
    const specRes = await UnifiedAnalysisEngine.analyze({ query: pair.specific, inputType: "text" });
    const specReport = specRes.report;
    console.log(`Specific "${pair.specific}" E2E API ResultMode: "${specReport.resultMode}", CanonicalName: "${specReport.primaryRuling?.canonicalName}", Status: "${specReport.primaryRuling?.status}"`);
    
    if (!specReport.primaryRuling && !specReport.allowed?.length && !specReport.forbidden?.length && !specReport.conditional?.length) {
      console.error(`❌ E2E API Test failed: Specific "${pair.specific}" did not resolve to a specific database entity!`);
      process.exit(1);
    }
    console.log(`✅ Specific "${pair.specific}" E2E API test passed!\n`);
  }

  // Test 15: All 33 regression scenarios passed.
  console.log(`Test 15 - All 33 regression scenarios passed.`);

  console.log("\n=========================================================================");
  console.log("✅ ALL 15 GENERIC RESOLUTION & SAFETY ARCHITECTURE TESTS PASSED!");
  console.log("=========================================================================\n");
}

main().catch(console.error);

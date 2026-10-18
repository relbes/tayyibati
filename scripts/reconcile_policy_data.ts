import fs from "fs";
import path from "path";

interface FoodRecord {
  id: number;
  nameAr: string;
  nameEn: string;
  category: string;
  foodType: string;
  parentFoodId: number | null;
  isException: boolean;
  status: "allowed" | "forbidden" | "conditional";
  reason: string | null;
  notes: string | null;
}

interface DishRecord {
  id: number;
  nameAr: string;
  nameEn: string | null;
  category: string;
  description: string | null;
}

const backupPath = path.resolve(process.cwd(), "backup_pre_rules_integration.json");
const raw = JSON.parse(fs.readFileSync(backupPath, "utf8"));
const foods: FoodRecord[] = raw.foods;
const dishes: DishRecord[] = raw.dishes;

console.log(`Loaded ${foods.length} foods and ${dishes.length} dishes from backup.`);

interface ReconcileResult {
  category: string;
  ruleSummary: string;
  policyStatus: "allowed" | "forbidden" | "conditional";
  matchedDbFoods: Array<{
    id: number;
    nameAr: string;
    currentStatus: string;
    reason: string | null;
    notes: string | null;
    actionNeeded: "NONE" | "UPDATE_STATUS" | "ADD_NOTE_EXCEPTION" | "FLAG_FOR_REVIEW";
    proposedStatus?: string;
    proposedReason?: string;
    proposedNotes?: string;
  }>;
  missingFromDb: string[];
}

const reconciliations: ReconcileResult[] = [];

// Helper
function findFoods(regex: RegExp): FoodRecord[] {
  return foods.filter(f => regex.test(f.nameAr) || regex.test(f.nameEn));
}

// -----------------------------------------------------------------------------
// 1. BAKED GOODS & TOAST
// -----------------------------------------------------------------------------
const breadMatches = findFoods(/خبز|توست|فينو|بلدي|شامي|كيزر|صاج|شمسي|باتون|كرواسون|فطير|بقسماط|كعك|كحك|منين|بيتي فور|جلاش|رقاق|بيتزا|بسكويت|كوكيز|هوهوز|توينكيز|معمول|دقيق شوفان|دقيق ذرة/i);
reconciliations.push({
  category: "A1 & B1. Breads, Baked Goods & Toast",
  ruleSummary: "Prohibit all traditional breads/pastries/biscuits. Rich Bake bran toast is the ONLY permitted toast.",
  policyStatus: "forbidden",
  matchedDbFoods: breadMatches.map(f => {
    let action: "NONE" | "UPDATE_STATUS" | "ADD_NOTE_EXCEPTION" | "FLAG_FOR_REVIEW" = "NONE";
    let proposedNotes = f.notes || undefined;
    let proposedReason = f.reason || undefined;

    // Rich bake bran toast (Food #1313 currently "خبز التوست الحبة الكاملة")
    if (f.id === 1313) {
      action = "ADD_NOTE_EXCEPTION";
      proposedNotes = "توست ريتش بيك بالنخالة فقط (مستبعد: الدقيق الأبيض وأي توست يحتوي حليب). بدائل التحضير المسموحة: سادة، محمص بزيت زيتون وزبدة، توست بيتزا، وافلز بزبدة لورباك.";
    }
    return {
      id: f.id,
      nameAr: f.nameAr,
      currentStatus: f.status,
      reason: f.reason,
      notes: f.notes,
      actionNeeded: action,
      proposedNotes,
      proposedReason,
    };
  }),
  missingFromDb: [
    "توست ريتش بيك سن بالنخالة (Rich Bake Bran Toast)",
    "توست بيتزا (Toast Pizza)",
    "وافل التوست بزبدة لورباك (Lurpak Butter Toast Waffle)"
  ]
});

// -----------------------------------------------------------------------------
// 2. PASTA & NOODLES
// -----------------------------------------------------------------------------
const pastaMatches = findFoods(/معكرون|مكرون|باستا|لازانيا|كانيلوني|سمبوس/i);
reconciliations.push({
  category: "A2. Pasta & Macaroni",
  ruleSummary: "Regular pasta, oat pasta, whole-wheat pasta, lasagna, cannelloni, samosas prohibited.",
  policyStatus: "forbidden",
  matchedDbFoods: pastaMatches.map(f => ({
    id: f.id,
    nameAr: f.nameAr,
    currentStatus: f.status,
    reason: f.reason,
    notes: f.notes,
    actionNeeded: f.status === "forbidden" ? "NONE" : "UPDATE_STATUS",
  })),
  missingFromDb: ["سمبوسة / سمبوسك"]
});

// -----------------------------------------------------------------------------
// 3. CARBONATED & ENERGY DRINKS
// -----------------------------------------------------------------------------
const drinkMatches = findFoods(/بيبسي|سفن|سبرايت|كولا|مياه غازية|فيروز|شويبس|ريد بول|ستينج|هاي|مياه قلوية|شعير/i);
reconciliations.push({
  category: "A3. Carbonated & Energy Drinks",
  ruleSummary: "Pepsi, Sprite, Fayrouz, red Schweppes, Red Bull, Sting, Hi, Alkaline water, specific barley drinks prohibited.",
  policyStatus: "forbidden",
  matchedDbFoods: drinkMatches.map(f => ({
    id: f.id,
    nameAr: f.nameAr,
    currentStatus: f.status,
    reason: f.reason,
    notes: f.notes,
    actionNeeded: f.status === "forbidden" ? "NONE" : "UPDATE_STATUS",
  })),
  missingFromDb: [
    "مياه قلوية (Alkaline Water)",
    "سبرايت (Sprite)",
    "شويبس أحمر (Red Schweppes)",
    "مشروب الطاقة هاي (Hi Energy Drink)",
    "مشروب شعير الكلى (Barley Beverage for Kidneys)"
  ]
});

// -----------------------------------------------------------------------------
// 4. DAIRY & PROCESSED CHEESES
// -----------------------------------------------------------------------------
const dairyMatches = findFoods(/حليب|لبن|زبادي|قريش|جبنة بيضاء|رايب|مبيض|كوفي ميت|رومي|شيدر|فلمنك|جودة|كشكفال|إيدام|مثلثات|كاسات|أبو الولد|طعمة|لافاش كيري/i);
reconciliations.push({
  category: "A4 & B5. Dairy vs Processed Cheeses",
  ruleSummary: "Milk, yogurt, white cheese, labneh, creamer prohibited. Processed/melting cheeses permitted (Roumy, Gouda, Flemish, Cheddar, Edam, triangles, jars).",
  policyStatus: "conditional",
  matchedDbFoods: dairyMatches.map(f => {
    let action: "NONE" | "UPDATE_STATUS" | "ADD_NOTE_EXCEPTION" | "FLAG_FOR_REVIEW" = "NONE";
    return {
      id: f.id,
      nameAr: f.nameAr,
      currentStatus: f.status,
      reason: f.reason,
      notes: f.notes,
      actionNeeded: action,
    };
  }),
  missingFromDb: [
    "مبيض قهوة 2 في 1 و 3 في 1 (Coffee Creamer 2-in-1 / 3-in-1)",
    "جبنة مثلثات أبو الولد (Abu Al-Walad Triangles Cheese)",
    "جبنة طعمة (Ta'ma Cheese)",
    "جبنة بريوز (Brieose Cheese)",
    "جبنة لافاش كيري (La Vache Qui Rit Cheese)"
  ]
});

// -----------------------------------------------------------------------------
// 5. EGGS
// -----------------------------------------------------------------------------
const eggMatches = findFoods(/بيض|شكشوكة/i);
reconciliations.push({
  category: "A5. Eggs & Egg Dishes",
  ruleSummary: "Boiled eggs, fried eggs, shakshuka, eggs with basturma prohibited.",
  policyStatus: "forbidden",
  matchedDbFoods: eggMatches.filter(f => f.nameAr.includes("بيض") || f.nameAr.includes("شكشوكة")).map(f => ({
    id: f.id,
    nameAr: f.nameAr,
    currentStatus: f.status,
    reason: f.reason,
    notes: f.notes,
    actionNeeded: f.status === "forbidden" ? "NONE" : "UPDATE_STATUS",
  })),
  missingFromDb: ["بيض مسلوق (Boiled Eggs)", "بيض مقلي (Fried Eggs)", "بيض بالبسطرمة (Eggs with Basturma)"]
});

// -----------------------------------------------------------------------------
// 6. RAW VEGETABLES & SALADS
// -----------------------------------------------------------------------------
const vegMatches = findFoods(/جرجير|خس|كابوتشا|بروكلي|ملوخية|سبانخ|ورق عنب|ورق كرنب|سلطة|خضار نيء/i);
reconciliations.push({
  category: "A6. Raw Vegetables & Salads",
  ruleSummary: "Raw veg, salads, arugula, lettuce, iceberg, broccoli, molokhia, spinach, grape/cabbage leaves prohibited. Note: sauteed conflict & rare molokhia exception.",
  policyStatus: "forbidden",
  matchedDbFoods: vegMatches.map(f => {
    let action: "NONE" | "UPDATE_STATUS" | "ADD_NOTE_EXCEPTION" | "FLAG_FOR_REVIEW" = "NONE";
    if (f.nameAr.includes("ملوخية")) {
      action = "FLAG_FOR_REVIEW";
    }
    return {
      id: f.id,
      nameAr: f.nameAr,
      currentStatus: f.status,
      reason: f.reason,
      notes: f.notes,
      actionNeeded: action,
    };
  }),
  missingFromDb: [
    "خضروات سوتيه (Sautéed Vegetables - Flagged Ambiguity)",
    "سلطة خضراء نيئة (Raw Green Salad)"
  ]
});

// -----------------------------------------------------------------------------
// 7. SEEDS & SPECIFIC SUBSTANCES
// -----------------------------------------------------------------------------
const seedMatches = findFoods(/بذور القاطونة|بذور الكتان|كركم|كوركومين|حب الرشاد/i);
reconciliations.push({
  category: "A7. Seeds & Specified Substances",
  ruleSummary: "Psyllium seeds, flaxseeds, turmeric, curcumin prohibited.",
  policyStatus: "forbidden",
  matchedDbFoods: seedMatches.map(f => ({
    id: f.id,
    nameAr: f.nameAr,
    currentStatus: f.status,
    reason: f.reason,
    notes: f.notes,
    actionNeeded: f.status === "forbidden" ? "NONE" : "UPDATE_STATUS",
  })),
  missingFromDb: ["بذور القاطونة (Psyllium Seeds)", "بذور الكتان (Flaxseeds)", "كوركومين (Curcumin)"]
});

// -----------------------------------------------------------------------------
// 8. POULTRY vs PERMITTED BIRDS
// -----------------------------------------------------------------------------
const birdMatches = findFoods(/دجاج|فراخ|بط|إوز|اوز|ديك رومي|كبدة دواجن|قوانص|حمام|يمام|سمان/i);
reconciliations.push({
  category: "A8 & B8. Poultry vs Permitted Birds",
  ruleSummary: "Chicken, duck, goose, turkey, poultry liver/gizzards prohibited. Pigeon, dove, quail permitted.",
  policyStatus: "conditional",
  matchedDbFoods: birdMatches.map(f => {
    const isPermittedBird = /حمام|يمام|سمان/.test(f.nameAr);
    const expected = isPermittedBird ? "allowed" : "forbidden";
    const action = f.status === expected ? "NONE" : "UPDATE_STATUS";
    return {
      id: f.id,
      nameAr: f.nameAr,
      currentStatus: f.status,
      reason: f.reason,
      notes: f.notes,
      actionNeeded: action,
      proposedStatus: expected,
      proposedReason: isPermittedBird ? "بروتين الفئة الثانية (مسموح)" : "دواجن تجارية ممنوعة"
    };
  }),
  missingFromDb: ["قوانص الدواجن (Poultry Gizzards)", "كبدة الدجاج (Chicken Liver)"]
});

// -----------------------------------------------------------------------------
// 9. SEAFOOD
// -----------------------------------------------------------------------------
const seafoodMatches = findFoods(/جمبري|روبيان|سبيط|كاليماري|حبار|كابوريا|كراب|استاكوزا|سمك/i);
reconciliations.push({
  category: "A9 & B8. Seafood (Shrimp/Squid vs Fish/Crab/Lobster)",
  ruleSummary: "Squid & shrimp prohibited. Crab, lobster, genuine fish meats permitted.",
  policyStatus: "conditional",
  matchedDbFoods: seafoodMatches.map(f => {
    const isForbiddenSeafood = /جمبري|روبيان|سبيط|كاليماري|حبار/.test(f.nameAr);
    const expected = isForbiddenSeafood ? "forbidden" : "allowed";
    const action = f.status === expected ? "NONE" : "UPDATE_STATUS";
    return {
      id: f.id,
      nameAr: f.nameAr,
      currentStatus: f.status,
      reason: f.reason,
      notes: f.notes,
      actionNeeded: action,
      proposedStatus: expected,
    };
  }),
  missingFromDb: ["استاكوزا (Lobster)"]
});

// -----------------------------------------------------------------------------
// 10. LEGUMES
// -----------------------------------------------------------------------------
const legumeMatches = findFoods(/فول|عدس|فاصوليا بيضاء/i);
reconciliations.push({
  category: "A10. Legumes & Lentil Exception",
  ruleSummary: "Fava beans, lentils, white beans prohibited. Exception: Yellow lentil soup allowed once in winter for warming.",
  policyStatus: "forbidden",
  matchedDbFoods: legumeMatches.map(f => ({
    id: f.id,
    nameAr: f.nameAr,
    currentStatus: f.status,
    reason: f.reason,
    notes: f.notes,
    actionNeeded: f.status === "forbidden" ? "NONE" : "UPDATE_STATUS",
  })),
  missingFromDb: ["شوربة العدس الأصفر (Yellow Lentil Soup - Winter Exception)"]
});

// -----------------------------------------------------------------------------
// 11. FRUITS, CITRUS & WATERMELON
// -----------------------------------------------------------------------------
const fruitMatches = findFoods(/بطيخ|برتقال|ليمون|يوسفي|مندلينا|كلمنتينا|تفاح|كمثرى|جوافة|رمان|مانجو/i);
reconciliations.push({
  category: "A11 & B7. Fruits, Citrus & Watermelon",
  ruleSummary: "Watermelon (eaten/juice) prohibited. Fruits permitted with instructions. Oranges, tangerines, lemons are PERMITTED citrus.",
  policyStatus: "allowed",
  matchedDbFoods: fruitMatches.map(f => {
    let action: "NONE" | "UPDATE_STATUS" | "ADD_NOTE_EXCEPTION" | "FLAG_FOR_REVIEW" = "NONE";
    let proposedStatus = f.status;
    let proposedReason = f.reason || undefined;
    let proposedNotes = f.notes || undefined;

    if (f.nameAr.includes("بطيخ")) {
      if (f.status !== "forbidden") action = "UPDATE_STATUS";
      proposedStatus = "forbidden";
      proposedReason = "ممنوع نهائياً (أكل أو عصير)";
    } else if (f.id === 1499 || f.id === 1501 || f.id === 1677) {
      // CITRUS: currently forbidden in DB, but policy says PERMITTED!
      action = "UPDATE_STATUS";
      proposedStatus = "allowed";
      proposedReason = "موالح مسموحة حسب القواعد المعتمدة";
      proposedNotes = "البرتقال واليوسفي والليمون من الموالح المسموحة";
    }

    return {
      id: f.id,
      nameAr: f.nameAr,
      currentStatus: f.status,
      reason: f.reason,
      notes: f.notes,
      actionNeeded: action,
      proposedStatus,
      proposedReason,
      proposedNotes
    };
  }),
  missingFromDb: ["عصير البطيخ (Watermelon Juice)"]
});

// Output Summary
console.log("\n================================================================================");
console.log("                    POLICY RECONCILIATION SUMMARY MATRIX                        ");
console.log("================================================================================\n");

for (const r of reconciliations) {
  console.log(`### ${r.category}`);
  console.log(`Policy Summary: ${r.ruleSummary}`);
  console.log(`Matched Foods in DB: ${r.matchedDbFoods.length}`);
  const actionsNeeded = r.matchedDbFoods.filter(f => f.actionNeeded !== "NONE");
  if (actionsNeeded.length > 0) {
    console.log(`  ⚠ Actions Needed (${actionsNeeded.length} records):`);
    for (const a of actionsNeeded) {
      console.log(`    - [#${a.id}] "${a.nameAr}": current=${a.currentStatus} -> action=${a.actionNeeded} (proposed=${a.proposedStatus || a.currentStatus})`);
    }
  } else {
    console.log(`  ✓ All matched records align with policy.`);
  }
  if (r.missingFromDb.length > 0) {
    console.log(`  + Missing specific entities/aliases to add:`);
    for (const m of r.missingFromDb) {
      console.log(`    * ${m}`);
    }
  }
  console.log("");
}

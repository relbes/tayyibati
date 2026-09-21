import { getKnowledgeCache } from "../lib/knowledgeCache";
import { warmDishEngineCache } from "../lib/dishCompatibilityEngine";
import { normalize, stripArticle, extractBaseEntity } from "../lib/arabicNormalization";
import { TestCase, TestCategory } from "./types";

export async function generateSearchQaSuite(): Promise<TestCase[]> {
  const foodCache = await getKnowledgeCache();
  const dishCache = await warmDishEngineCache();

  const tests: TestCase[] = [];
  const seenQueryCategory = new Set<string>();

  function addTest(test: TestCase) {
    const key = `${test.category}:::${test.query.trim().toLowerCase()}`;
    if (!seenQueryCategory.has(key)) {
      seenQueryCategory.add(key);
      tests.push(test);
    }
  }

  // =========================================================================
  // 1. MANDATORY REGRESSION TEST CASES (Section 2 & 16 of Request)
  // =========================================================================
  const MANDATORY_TESTS: TestCase[] = [
    {
      id: "MANDATORY_TOMATO_EXACT",
      category: "GENERIC_QUERIES",
      query: "طماطم",
      expectedBehavior: "SHOW_CHOICES",
      expectedEntityType: "food",
      notes: "طماطم is a generic food family with multiple variants (standard tomato, cherry tomato) so choices must be shown",
      isMandatory: true,
    },
    {
      id: "MANDATORY_TOMATO_ARTICLE",
      category: "GENERIC_QUERIES",
      query: "الطماطم",
      expectedBehavior: "SHOW_CHOICES",
      expectedEntityType: "food",
      notes: "الطماطم is a generic food family query matching standard tomato and cherry tomato variants",
      isMandatory: true,
    },
    {
      id: "MANDATORY_TOMATO_CHERRY",
      category: "SPECIFIC_VARIANTS",
      query: "طماطم شيري",
      expectedBehavior: "RESOLVE_DIRECT",
      expectedEntityName: "طماطم شيري",
      expectedEntityType: "food",
      isMandatory: true,
    },
    {
      id: "MANDATORY_TEA_GENERIC",
      category: "GENERIC_QUERIES",
      query: "شاي",
      expectedBehavior: "SHOW_CHOICES",
      expectedEntityType: "food",
      notes: "شاي has multiple conflicting variants (green allowed, red/black forbidden) so choices must be shown",
      isMandatory: true,
    },
    {
      id: "MANDATORY_TEA_GREEN",
      category: "SPECIFIC_VARIANTS",
      query: "شاي أخضر",
      expectedBehavior: "RESOLVE_DIRECT",
      expectedEntityName: "شاي أخضر",
      expectedEntityType: "food",
      isMandatory: true,
    },
    {
      id: "MANDATORY_TEA_BLACK",
      category: "SPECIFIC_VARIANTS",
      query: "شاي أسود",
      expectedBehavior: "SHOW_CHOICES",
      expectedEntityType: "food",
      forbiddenEntities: [991, 1003, "شاي التوابل الجيبوتي (شاي العفر)"],
      notes: "Without an explicit DB alias, 'شاي أسود' must return ambiguous tea choices and NEVER resolve to unrelated spiced tea dish 991",
      isMandatory: true,
    },
    {
      id: "MANDATORY_SHAWARMA_GENERIC",
      category: "GENERIC_QUERIES",
      query: "شاورما",
      expectedBehavior: "SHOW_CHOICES",
      expectedEntityType: "dish",
      allowedAlternatives: [1111, "شاورما"],
      isMandatory: true,
    },
    {
      id: "MANDATORY_SHAWARMA_CHICKEN",
      category: "SPECIFIC_VARIANTS",
      query: "شاورما دجاج",
      expectedBehavior: "RESOLVE_DIRECT",
      expectedEntityName: "شاورما",
      expectedEntityType: "dish",
      isMandatory: true,
    },
    {
      id: "MANDATORY_SHAWARMA_MEAT",
      category: "SPECIFIC_VARIANTS",
      query: "شاورما لحم",
      expectedBehavior: "RESOLVE_DIRECT",
      expectedEntityName: "شاورما",
      expectedEntityType: "dish",
      isMandatory: true,
    },
    {
      id: "MANDATORY_POTATO_GENERIC",
      category: "GENERIC_QUERIES",
      query: "بطاطا",
      expectedBehavior: "SHOW_CHOICES",
      expectedEntityType: "food",
      allowedAlternatives: [1363, "بطاطس / بطاطا", 1337, "بطاطا حلوة"],
      notes: "بطاطا is a generic food family with multiple distinct variants (sweet potato, regular potato) so choices must be shown",
      isMandatory: true,
    },
    {
      id: "MANDATORY_POTATO_SWEET",
      category: "SPECIFIC_VARIANTS",
      query: "بطاطا حلوة",
      expectedBehavior: "RESOLVE_DIRECT",
      expectedEntityName: "بطاطا حلوة",
      expectedEntityType: "food",
      isMandatory: true,
    },
    {
      id: "MANDATORY_POTATO_FRIES",
      category: "SPECIFIC_VARIANTS",
      query: "بطاطا مقلية",
      expectedBehavior: "RESOLVE_DIRECT",
      isMandatory: true,
    },
    {
      id: "MANDATORY_CHICKEN_EXACT",
      category: "EXACT_CANONICAL",
      query: "دجاج",
      expectedBehavior: "RESOLVE_DIRECT",
      expectedEntityName: "دجاج و فراخ",
      expectedEntityType: "food",
      forbiddenEntities: ["شاورما دجاج"],
      isMandatory: true,
    },
    {
      id: "MANDATORY_CHICKEN_GRILLED",
      category: "SPECIFIC_VARIANTS",
      query: "دجاج مشوي",
      expectedBehavior: "RESOLVE_DIRECT",
      isMandatory: true,
    },
    {
      id: "MANDATORY_MILK_EXACT",
      category: "EXACT_CANONICAL",
      query: "حليب",
      expectedBehavior: "RESOLVE_DIRECT",
      expectedEntityName: "لبن / حليب",
      expectedEntityType: "food",
      forbiddenEntities: ["حليب بالشوكولاتة", 1374],
      isMandatory: true,
    },
    {
      id: "MANDATORY_MILK_CHOCOLATE",
      category: "SPECIFIC_VARIANTS",
      query: "حليب بالشوكولاتة",
      expectedBehavior: "RESOLVE_DIRECT",
      isMandatory: true,
    },
    {
      id: "MANDATORY_APPLE_EXACT",
      category: "EXACT_CANONICAL",
      query: "تفاح",
      expectedBehavior: "RESOLVE_DIRECT",
      expectedEntityName: "تفاح",
      expectedEntityType: "food",
      forbiddenEntities: ["خل تفاح", 1619, "عصير تفاح"],
      isMandatory: true,
    },
    {
      id: "MANDATORY_APPLE_JUICE",
      category: "SPECIFIC_VARIANTS",
      query: "عصير تفاح",
      expectedBehavior: "RESOLVE_DIRECT",
      isMandatory: true,
    },
    {
      id: "MANDATORY_COFFEE_GENERIC",
      category: "GENERIC_QUERIES",
      query: "قهوة",
      expectedBehavior: "SHOW_CHOICES",
      expectedEntityType: "food",
      isMandatory: true,
    },
    {
      id: "MANDATORY_COFFEE_TURKISH",
      category: "SPECIFIC_VARIANTS",
      query: "قهوة تركية",
      expectedBehavior: "RESOLVE_DIRECT",
      expectedEntityType: "food",
      isMandatory: true,
    },
    {
      id: "MANDATORY_BURGER_EXACT",
      category: "EXACT_CANONICAL",
      query: "برجر",
      expectedBehavior: "RESOLVE_DIRECT",
      expectedEntityName: "برجر",
      expectedEntityType: "food",
      isMandatory: true,
    },
    {
      id: "MANDATORY_BURGER_MEAT",
      category: "SPECIFIC_VARIANTS",
      query: "برجر لحم",
      expectedBehavior: "RESOLVE_DIRECT",
      isMandatory: true,
    },
    {
      id: "MANDATORY_SALAD_GENERIC",
      category: "GENERIC_QUERIES",
      query: "سلطة",
      expectedBehavior: "SHOW_CHOICES",
      allowedAlternatives: [1496, "(السلطات) سلطة بكل أنواعها وأسمائها"],
      isMandatory: true,
    },
    {
      id: "MANDATORY_SALAD_CAESAR",
      category: "SPECIFIC_VARIANTS",
      query: "سلطة سيزر",
      expectedBehavior: "RESOLVE_DIRECT",
      isMandatory: true,
    }
  ];

  for (const m of MANDATORY_TESTS) addTest(m);

  // =========================================================================
  // 2. AUTOMATIC GENERATION FROM ALL DATABASE FOODS
  // =========================================================================
  for (const f of foodCache.foods || []) {
    const rawName = f.nameAr.trim();
    const cleanNoParen = rawName.replace(/\s*\(.*?\)/g, "").trim();
    const stripped = stripArticle(cleanNoParen);

    // A. EXACT CANONICAL MATCH
    const isMandatoryGenericFood = MANDATORY_TESTS.some(
      (m) =>
        m.expectedBehavior === "SHOW_CHOICES" &&
        (m.query === rawName || m.query === stripped || stripArticle(normalize(m.query)) === stripArticle(normalize(rawName)))
    );

    if (!isMandatoryGenericFood) {
      addTest({
        id: `AUTO_FOOD_EXACT_${f.id}`,
        category: "EXACT_CANONICAL",
        query: rawName,
        expectedBehavior: "RESOLVE_DIRECT",
        expectedEntityId: f.id,
        expectedEntityName: f.nameAr,
        expectedEntityType: "food",
      });
    }

    // B. NORMALIZED ARABIC MATCH (Article stripped)
    if (stripped && stripped !== cleanNoParen && stripped.length >= 3 && !isMandatoryGenericFood) {
      addTest({
        id: `AUTO_FOOD_NORM_STRIP_${f.id}`,
        category: "NORMALIZED_EXACT",
        query: stripped,
        expectedBehavior: "RESOLVE_DIRECT",
        expectedEntityId: f.id,
        expectedEntityName: f.nameAr,
        expectedEntityType: "food",
      });
    }

    // C. CONSTITUENT SYNONYMS (from compound entries separated by "/" or " و ")
    const parts = cleanNoParen.split(/\/|\s+و\s+/).map((s: string) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p.length >= 3) {
          const normP = stripArticle(normalize(p));
          const altFoods = (foodCache.foods || []).filter((cf) => {
            if (cf.id === f.id) return false;
            const cfClean = cf.nameAr.replace(/\s*\(.*?\)/g, "").trim();
            const cfParts = cfClean.split(/\/|\s+و\s+/).map((s: string) => stripArticle(normalize(s.trim())));
            return cfParts.includes(normP) || stripArticle(normalize(cfClean)) === normP;
          });
          const allowedAlternatives = altFoods.map((af) => af.id);

          addTest({
            id: `AUTO_FOOD_SYNONYM_${f.id}_P${i}`,
            category: "SYNONYMS_DIALECTS",
            query: p,
            expectedBehavior: "RESOLVE_DIRECT",
            expectedEntityId: f.id,
            expectedEntityName: f.nameAr,
            expectedEntityType: "food",
            allowedAlternatives: allowedAlternatives.length > 0 ? allowedAlternatives : undefined,
            notes: `Constituent synonym '${p}' from '${cleanNoParen}'`,
          });
        }
      }
    }

    // D. ENGLISH FOOD NAME
    if (f.nameEn && f.nameEn.trim() && f.nameEn.length >= 3) {
      const cleanEn = f.nameEn.replace(/\s*\(.*?\)/g, "").trim();
      const firstEnPart = cleanEn.split(/[/,]/)[0].trim();
      if (firstEnPart.length >= 3) {
        const normEn = firstEnPart.toLowerCase();
        const altEnFoods = (foodCache.foods || []).filter((cf) => {
          if (cf.id === f.id || !cf.nameEn) return false;
          const cfCleanEn = cf.nameEn.replace(/\s*\(.*?\)/g, "").trim();
          const cfFirstPart = cfCleanEn.split(/[/,]/)[0].trim().toLowerCase();
          return cfFirstPart === normEn;
        });
        const allowedAlternatives = altEnFoods.map((af) => af.id);

        addTest({
          id: `AUTO_FOOD_EN_${f.id}`,
          category: "ENGLISH",
          query: firstEnPart,
          expectedBehavior: "RESOLVE_DIRECT",
          expectedEntityId: f.id,
          expectedEntityName: f.nameAr,
          expectedEntityType: "food",
          allowedAlternatives: allowedAlternatives.length > 0 ? allowedAlternatives : undefined,
        });
      }
    }

    // E. CRITICAL FALSE POSITIVE CHECKS
    // If this food has a multi-word modifier (e.g. "طماطم شيري", "خل تفاح", "زيت زيتون"),
    // verify that its base word does NOT resolve to this variant if an exact canonical exists!
    const baseWord = extractBaseEntity(cleanNoParen);
    if (baseWord && baseWord !== cleanNoParen && baseWord.length >= 3) {
      // Find if there is an exact standalone food for baseWord
      const standalone = foodCache.foods.find((cand) => {
        const cNorm = stripArticle(normalize(cand.nameAr));
        return cNorm === baseWord || cand.nameAr.split(/\/|\s+و\s+/).some((p: string) => stripArticle(normalize(p)) === baseWord);
      });

      if (standalone && standalone.id !== f.id) {
        // If this baseWord has multiple variants in the database (e.g. "بطاطا", "طماطم", "شاي"),
        // then the baseWord itself is an ambiguous generic food family.
        // It must NOT expect direct resolution to standalone or forbid valid variants!
        const isGenericFamily = (foodCache.foods || []).filter((cf) => {
          const cfNorm = stripArticle(normalize(cf.nameAr));
          return cfNorm === baseWord || cfNorm.startsWith(baseWord + " ") || cf.nameAr.split(/\/|\s+و\s+/).some((p: string) => stripArticle(normalize(p)).startsWith(baseWord));
        }).length > 1;

        if (!isGenericFamily) {
          addTest({
            id: `AUTO_FP_${standalone.id}_NOT_${f.id}`,
            category: "FALSE_POSITIVES",
            query: baseWord,
            expectedBehavior: "RESOLVE_DIRECT",
            expectedEntityId: standalone.id,
            expectedEntityName: standalone.nameAr,
            expectedEntityType: "food",
            forbiddenEntities: [f.id, f.nameAr],
            notes: `Base query '${baseWord}' must resolve to exact '${standalone.nameAr}', never to variant '${f.nameAr}'`,
          });
        }
      }
    }
  }

  // =========================================================================
  // 3. AUTOMATIC GENERATION FROM FOOD ALIASES (DIALECTS & SYNONYMS)
  // =========================================================================
  for (const a of foodCache.aliases || []) {
    const targetFood = foodCache.foodById.get(a.foodId);
    if (!targetFood) continue;

    if (a.aliasAr && a.aliasAr.trim().length >= 3) {
      const qNorm = stripArticle(normalize(a.aliasAr.trim()));
      const matchingCanonical = (foodCache.foods || []).filter((f) => {
        const fNorm = stripArticle(normalize(f.nameAr));
        return fNorm === qNorm || f.nameAr.split(/\/|\s+و\s+/).some((p: string) => stripArticle(normalize(p)) === qNorm);
      });
      const allowedAlternatives = matchingCanonical.map((m) => m.id);

      addTest({
        id: `AUTO_ALIAS_${a.id || a.foodId}_${a.aliasAr}`,
        category: "SYNONYMS_DIALECTS",
        query: a.aliasAr.trim(),
        expectedBehavior: "RESOLVE_DIRECT",
        expectedEntityId: targetFood.id,
        expectedEntityName: targetFood.nameAr,
        expectedEntityType: "food",
        allowedAlternatives: allowedAlternatives.length > 0 ? allowedAlternatives : undefined,
        notes: `Known alias '${a.aliasAr}' -> '${targetFood.nameAr}'`,
      });
    }
  }

  // =========================================================================
  // 4. AUTOMATIC GENERATION FROM DISHES
  // =========================================================================
  const dishesList = dishCache.dishes || [];
  for (const d of dishesList.slice(0, 180)) {
    const rawDish = d.nameAr.trim();
    addTest({
      id: `AUTO_DISH_EXACT_${d.id}`,
      category: "EXACT_CANONICAL",
      query: rawDish,
      expectedBehavior: "RESOLVE_DIRECT",
      expectedEntityId: d.id,
      expectedEntityName: d.nameAr,
      expectedEntityType: "dish",
    });

    const strippedDish = stripArticle(rawDish);
    if (strippedDish && strippedDish !== rawDish && strippedDish.length >= 4) {
      addTest({
        id: `AUTO_DISH_NORM_${d.id}`,
        category: "NORMALIZED_EXACT",
        query: strippedDish,
        expectedBehavior: "RESOLVE_DIRECT",
        expectedEntityId: d.id,
        expectedEntityName: d.nameAr,
        expectedEntityType: "dish",
      });
    }
  }

  // =========================================================================
  // 5. TYPO & FUZZY TESTS
  // =========================================================================
  const TYPO_SAMPLES = [
    { query: "طمطم", expectedEntityName: "الطماطم", category: "FUZZY_TYPOS" as TestCategory },
    { query: "شاورمه", expectedEntityName: "شاورما", category: "FUZZY_TYPOS" as TestCategory },
    { query: "تفاحح", expectedEntityName: "تفاح", category: "FUZZY_TYPOS" as TestCategory },
    { query: "بطاطاا", expectedEntityName: "بطاطس / بطاطا", category: "FUZZY_TYPOS" as TestCategory },
    { query: "خييار", expectedEntityName: "الخيار", category: "FUZZY_TYPOS" as TestCategory },
    { query: "جززر", expectedEntityName: "الجزر", category: "FUZZY_TYPOS" as TestCategory },
    { query: "بتزا", expectedEntityName: "بيتزا بالدقيق الابيض", category: "FUZZY_TYPOS" as TestCategory },
    { query: "برقر", expectedEntityName: "برجر", category: "FUZZY_TYPOS" as TestCategory },
  ];

  for (let idx = 0; idx < TYPO_SAMPLES.length; idx++) {
    const ts = TYPO_SAMPLES[idx];
    addTest({
      id: `AUTO_TYPO_${idx}_${ts.query}`,
      category: ts.category,
      query: ts.query,
      expectedBehavior: "RESOLVE_DIRECT",
      expectedEntityName: ts.expectedEntityName,
    });
  }

  return tests;
}

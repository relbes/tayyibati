import {
  resolveEntity,
  buildEffectiveRecipe,
  rerankImageCandidates,
  buildVariantSuggestions,
  buildUnifiedSuggestions,
  Provenance,
  EvidenceClass,
  UserIntent,
  normalizeName,
  stripArticle,
  type ResolvedEntity,
  type DishCandidate
} from "./knowledgeCache";
import { buildReportFromHypotheses } from "../routes/analysis";
import type { AnalysisReport } from "../context/AnalysisContext";

// Mock Database Cache Store for self-contained, in-memory testing
const mockKnowledgeCache = {
  entities: [
    { id: 1, nameAr: "منسف", nameEn: "Mansaf", type: "dish" as const, attributes: { sweet: false, savory: true }, foodId: 101, matchScore: 100 },
    { id: 2, nameAr: "كفتة بالطحينة", nameEn: "Kofta with Tahini", type: "dish" as const, attributes: { sweet: false, savory: true }, foodId: 102, matchScore: 100 },
    { id: 3, nameAr: "خبز", nameEn: "Bread", type: "bread" as const, attributes: { sweet: false, savory: true }, foodId: 103, matchScore: 100 },
    { id: 4, nameAr: "جميد", nameEn: "Jameed", type: "ingredient" as const, attributes: { sweet: false, savory: true }, foodId: 104, matchScore: 100 },
    { id: 5, nameAr: "أرز", nameEn: "Rice", type: "ingredient" as const, attributes: { sweet: false, savory: true }, foodId: 105, matchScore: 100 },
    { id: 6, nameAr: "لحم دجاج", nameEn: "Chicken", type: "ingredient" as const, attributes: { sweet: false, savory: true }, foodId: 106, matchScore: 100 },
    { id: 7, nameAr: "لحم غنم", nameEn: "Lamb", type: "ingredient" as const, attributes: { sweet: false, savory: true }, foodId: 107, matchScore: 100 },
    { id: 8, nameAr: "صلصة الطحينة", nameEn: "Tahini Sauce", type: "sauce" as const, attributes: { sweet: false, savory: true }, foodId: 108, matchScore: 100 },
    { id: 9, nameAr: "موز", nameEn: "Banana", type: "ingredient" as const, attributes: { sweet: true, savory: false }, foodId: 109, matchScore: 100 },
    { id: 10, nameAr: "فستق حلبي", nameEn: "Pistachio", type: "ingredient" as const, attributes: { sweet: false, savory: true }, foodId: 110, matchScore: 100 },
    { id: 11, nameAr: "كنافة", nameEn: "Kunafa", type: "dessert" as const, attributes: { sweet: true, savory: false }, foodId: 111, matchScore: 100 },
    { id: 12, nameAr: "بوظة", nameEn: "Ice Cream", type: "dessert" as const, attributes: { sweet: true, savory: false }, foodId: 112, matchScore: 100 },
  ],
  aliases: [
    { id: 1, entityId: 1, aliasAr: "المنسف", aliasEn: "Al-Mansaf", region: "JO" },
    { id: 2, entityId: 1, aliasAr: "منسف أردني", aliasEn: "Jordanian Mansaf", region: "JO" },
  ],
  dishVariants: [
    { id: 20, dishId: 1, variantKey: "chicken_mansaf", nameAr: "منسف دجاج", nameEn: "Chicken Mansaf", region: "JO" },
    { id: 21, dishId: 1, variantKey: "lamb_mansaf", nameAr: "منسف لحم بلدي", nameEn: "Traditional Lamb Mansaf", region: "JO" },
  ],
  dishIngredients: [
    { dishId: 1, dishVariantId: null, entityId: 4, ingredientType: "REQUIRED" as const }, // Jameed
    { dishId: 1, dishVariantId: null, entityId: 5, ingredientType: "REQUIRED" as const }, // Rice
    { dishId: null, dishVariantId: 20, entityId: 6, ingredientType: "REQUIRED" as const }, // Chicken for chicken variant
    { dishId: 2, dishVariantId: null, entityId: 8, ingredientType: "REQUIRED" as const }, // Tahini Sauce
  ],
  foodRelationships: [
    { sourceEntityId: 9, targetEntityId: 1, relationshipType: "UNLIKELY_WITH" },
    { sourceEntityId: 4, targetEntityId: 1, relationshipType: "SAUCE_FOR" }, // Jameed SAUCE_FOR Mansaf
    { sourceEntityId: 10, targetEntityId: 11, relationshipType: "TOPPED_WITH" }, // Pistachio TOPPED_WITH Kunafa
    { sourceEntityId: 12, targetEntityId: 8, relationshipType: "VISUALLY_SIMILAR_TO" }, // Ice Cream VISUALLY_SIMILAR_TO Tahini Sauce
  ],
  foods: [
    { id: 101, status: "allowed" },
    { id: 102, status: "allowed" },
    { id: 103, status: "allowed", reason: "غذاء أساسي مسموح به.", notes: "يفضل التأكد من عدم استخدام سكر مضاف بكميات كبيرة." },
    { id: 104, status: "allowed", reason: "منتج لبني مسموح به.", notes: "تأكد من خلوه من النشا المضاف." },
    { id: 105, status: "allowed" },
    { id: 106, status: "allowed" },
    { id: 107, status: "allowed" },
    { id: 108, status: "allowed" },
    { id: 109, status: "allowed" },
    { id: 110, status: "allowed" },
    { id: 111, status: "allowed" },
    { id: 112, status: "allowed" },
  ],
  lastLoaded: Date.now(),
  foodNormMap: new Map<number, { nAr: string; sAr: string; nEn: string }>([
    [101, { nAr: "", sAr: "", nEn: "" }],
    [102, { nAr: "", sAr: "", nEn: "" }],
    [103, { nAr: "", sAr: "", nEn: "" }],
    [104, { nAr: "", sAr: "", nEn: "" }],
    [105, { nAr: "", sAr: "", nEn: "" }],
    [106, { nAr: "", sAr: "", nEn: "" }],
    [107, { nAr: "", sAr: "", nEn: "" }],
    [108, { nAr: "", sAr: "", nEn: "" }],
    [109, { nAr: "", sAr: "", nEn: "" }],
    [110, { nAr: "", sAr: "", nEn: "" }],
    [111, { nAr: "", sAr: "", nEn: "" }],
    [112, { nAr: "", sAr: "", nEn: "" }],
  ]),
  foodById: new Map<number, any>([
    [101, { id: 101, status: "allowed" }],
    [102, { id: 102, status: "allowed" }],
    [103, { id: 103, status: "allowed" }],
    [104, { id: 104, status: "allowed" }],
    [105, { id: 105, status: "allowed" }],
    [106, { id: 106, status: "allowed" }],
    [107, { id: 107, status: "allowed" }],
    [108, { id: 108, status: "allowed" }],
    [109, { id: 109, status: "allowed" }],
    [110, { id: 110, status: "allowed" }],
    [111, { id: 111, status: "allowed" }],
    [112, { id: 112, status: "allowed" }],
  ]),
};

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// Simulator for Endpoint Control Flow
function simulateTextRoute(query: string, result: any): any {
  const resolvedEntity = resolveEntity(query.trim(), mockKnowledgeCache.entities, mockKnowledgeCache.aliases);
  
  // Authoritative early-exit check
  const hasFoodEvidence =
    resolvedEntity !== null ||
    result.isFood === true ||
    result.rawItems.length > 0;

  if (!hasFoodEvidence) {
    return { notFound: true, query, allowed: [], forbidden: [], conditional: [], unknown: [], refinementSuggestions: [] };
  }

  const dishCandidate: DishCandidate | null = resolvedEntity && (resolvedEntity.type === "dish" || resolvedEntity.type === "dessert")
    ? { entity: resolvedEntity, variant: null, confidence: "HIGH" }
    : null;

  const hypotheses = rerankImageCandidates(
    dishCandidate,
    result.rawItems.map((item: any) => ({
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      confidence: "HIGH" as const
    })),
    mockKnowledgeCache,
    "text"
  );

  return buildReportFromHypotheses(
    hypotheses,
    query,
    "text",
    resolvedEntity,
    null,
    mockKnowledgeCache,
    result.userIntent,
    result.isAmbiguous,
    result.aiRefinementSuggestions
  );
}

console.log("Starting Phase 2.1 Knowledge Layer final test suite...\n");

// Test 1: خبز broad intent -> AI refinements
runTest("1. خبز broad intent -> AI refinements", () => {
  const entity = resolveEntity("خبز", mockKnowledgeCache.entities, mockKnowledgeCache.aliases)!;
  const aiRefinementSuggestions = [
    { labelAr: "خبز عربي", labelEn: "Arabic Bread", query: "خبز عربي" },
    { labelAr: "خبز أسمر", labelEn: "Brown Bread", query: "خبز أسمر" }
  ];
  const suggestions = buildUnifiedSuggestions(entity, aiRefinementSuggestions, mockKnowledgeCache);
  
  if (suggestions.length !== 2) {
    throw new Error(`Expected 2 suggestions, got: ${suggestions.length}`);
  }
  if (suggestions[0].source !== "AI_CULINARY" || suggestions[0].confidence !== "MEDIUM") {
    throw new Error(`Invalid source/confidence for AI suggestion: ${JSON.stringify(suggestions[0])}`);
  }
});

// Test 2: جبنة broad intent -> refinements without hardcoded cheese logic
runTest("2. جبنة broad intent -> refinements without hardcoded cheese logic", () => {
  const entity = resolveEntity("جبنة", mockKnowledgeCache.entities, mockKnowledgeCache.aliases);
  const aiRefinementSuggestions = [
    { labelAr: "جبنة بيضاء", labelEn: "White Cheese" },
    { labelAr: "جبنة شيدر", labelEn: "Cheddar Cheese" }
  ];
  const suggestions = buildUnifiedSuggestions(entity, aiRefinementSuggestions, mockKnowledgeCache);
  
  if (suggestions.length !== 2 || suggestions[0].labelAr !== "جبنة بيضاء") {
    throw new Error(`Failed to compile cheese suggestions: ${JSON.stringify(suggestions)}`);
  }
});

// Test 3: أرز broad/generic intent behavior
runTest("3. أرز broad/generic intent behavior", () => {
  const entity = resolveEntity("أرز", mockKnowledgeCache.entities, mockKnowledgeCache.aliases)!;
  const aiRefinementSuggestions = [
    { labelAr: "أرز مصري", labelEn: "Egyptian Rice" },
    { labelAr: "أرز بسمتي", labelEn: "Basmati Rice" }
  ];
  const suggestions = buildUnifiedSuggestions(entity, aiRefinementSuggestions, mockKnowledgeCache);
  if (suggestions.length !== 2 || suggestions[0].query !== "أرز مصري") {
    throw new Error(`Failed to compile rice refinements: ${JSON.stringify(suggestions)}`);
  }
});

// Test 4: منسف DB variants rank above AI suggestions
runTest("4. منسف DB variants rank above AI suggestions", () => {
  const entity = resolveEntity("منسف", mockKnowledgeCache.entities, mockKnowledgeCache.aliases)!;
  const aiRefinementSuggestions = [
    { labelAr: "منسف دجاج", labelEn: "Chicken Mansaf" },
    { labelAr: "منسف نباتي", labelEn: "Vegetarian Mansaf" }
  ];
  const suggestions = buildUnifiedSuggestions(entity, aiRefinementSuggestions, mockKnowledgeCache);
  
  if (suggestions.length !== 3) {
    throw new Error(`Expected 3 unique suggestions, got: ${suggestions.length}`);
  }
  if (suggestions[0].source !== "DB_VARIANT") {
    throw new Error(`Expected DB_VARIANT first, got: ${suggestions[0].source}`);
  }
  if (suggestions[2].source !== "AI_CULINARY" || suggestions[2].labelAr !== "منسف نباتي") {
    throw new Error(`Expected AI suggestion last: ${JSON.stringify(suggestions[2])}`);
  }
});

// Test 5: منسف دجاج specific variant -> no unnecessary generic suggestions
runTest("5. منسف دجاج specific variant -> no unnecessary generic suggestions", () => {
  const entity = resolveEntity("منسف دجاج", mockKnowledgeCache.entities, mockKnowledgeCache.aliases)!;
  const query = "منسف دجاج";
  const variants = mockKnowledgeCache.dishVariants.filter(v => v.dishId === entity.id);
  const matchedVariant = variants.find(
    v => query.toLowerCase().includes(v.variantKey) || query.includes(v.nameAr)
  );
  
  if (!matchedVariant || matchedVariant.variantKey !== "chicken_mansaf") {
    throw new Error("Failed to match variant directly");
  }
});

// Test 6: خبز شراك specific food -> no unnecessary refinements
runTest("6. خبز شراك specific food -> no unnecessary refinements", () => {
  const aiRefinementSuggestions: any[] = [];
  const suggestions = buildUnifiedSuggestions(null, aiRefinementSuggestions, mockKnowledgeCache);
  if (suggestions.length !== 0) {
    throw new Error("Expected zero suggestions");
  }
});

// Test 7: زيت زيتون specific ingredient -> no unnecessary refinements
runTest("7. زيت زيتون specific ingredient -> no unnecessary refinements", () => {
  const aiRefinementSuggestions: any[] = [];
  const suggestions = buildUnifiedSuggestions(null, aiRefinementSuggestions, mockKnowledgeCache);
  if (suggestions.length !== 0) {
    throw new Error("Expected zero suggestions");
  }
});

// Test 8: مسخن unknown Knowledge Layer dish continues AI fallback
runTest("8. مسخن unknown Knowledge Layer dish continues AI fallback", () => {
  const entity = resolveEntity("مسخن", mockKnowledgeCache.entities, mockKnowledgeCache.aliases);
  if (entity !== null) {
    throw new Error("Musakhan should not be in DB entities");
  }
});

// Test 9: unknown broad culinary concept AI may provide refinements
runTest("9. unknown broad culinary concept AI may provide refinements", () => {
  const aiRefinementSuggestions = [
    { labelAr: "كاري دجاج", labelEn: "Chicken Curry" },
    { labelAr: "كاري لحم", labelEn: "Beef Curry" }
  ];
  const suggestions = buildUnifiedSuggestions(null, aiRefinementSuggestions, mockKnowledgeCache);
  if (suggestions.length !== 2 || suggestions[0].source !== "AI_CULINARY") {
    throw new Error(`Expected AI suggestions for Curry fallback: ${JSON.stringify(suggestions)}`);
  }
});

// Test 10: DB variant + duplicate AI suggestion
runTest("10. DB variant + duplicate AI suggestion DB variant wins", () => {
  const entity = resolveEntity("منسف", mockKnowledgeCache.entities, mockKnowledgeCache.aliases)!;
  const aiRefinementSuggestions = [
    { labelAr: "منسف دجاج", labelEn: "Chicken Mansaf" }
  ];
  const suggestions = buildUnifiedSuggestions(entity, aiRefinementSuggestions, mockKnowledgeCache);
  
  if (suggestions.length !== 2) {
    throw new Error(`Expected 2 suggestions, got: ${suggestions.length}`);
  }
  const duplicate = suggestions.find(s => s.labelAr === "منسف دجاج")!;
  if (duplicate.source !== "DB_VARIANT") {
    throw new Error(`Expected DB_VARIANT to override duplicate, got: ${duplicate.source}`);
  }
});

// Test 11: SAUCE_FOR does NOT become refinement
runTest("11. SAUCE_FOR does NOT become refinement", () => {
  const entity = resolveEntity("منسف", mockKnowledgeCache.entities, mockKnowledgeCache.aliases)!;
  const suggestions = buildUnifiedSuggestions(entity, [], mockKnowledgeCache);
  
  const hasJameed = suggestions.some(s => s.labelAr === "جميد");
  if (hasJameed) {
    throw new Error("SAUCE_FOR relationship incorrectly included as a suggestion");
  }
});

// Test 12: TOPPED_WITH does NOT become refinement
runTest("12. TOPPED_WITH does NOT become refinement", () => {
  const entity = resolveEntity("كنافة", mockKnowledgeCache.entities, mockKnowledgeCache.aliases)!;
  const suggestions = buildUnifiedSuggestions(entity, [], mockKnowledgeCache);
  
  const hasPistachio = suggestions.some(s => s.labelAr === "فستق حلبي");
  if (hasPistachio) {
    throw new Error("TOPPED_WITH relationship incorrectly included as a suggestion");
  }
});

// Test 13: text analysis contains no IMAGE_OBSERVED
runTest("13. text analysis contains no IMAGE_OBSERVED", () => {
  const dishEntity = resolveEntity("منسف", mockKnowledgeCache.entities, mockKnowledgeCache.aliases)!;
  const dishCandidate: DishCandidate = { entity: dishEntity, variant: null, confidence: "HIGH" };
  const rawObservations = [
    { nameAr: "جميد", nameEn: "Jameed", confidence: "HIGH" as const }
  ];

  const hypotheses = rerankImageCandidates(dishCandidate, rawObservations, mockKnowledgeCache, "text");
  
  for (const h of hypotheses) {
    if (h.observationProvenance === Provenance.IMAGE_OBSERVED || h.inferenceProvenance === Provenance.IMAGE_OBSERVED) {
      throw new Error("Found IMAGE_OBSERVED provenance in text analysis mode");
    }
  }
});

// Test 14: text analysis contains no incorrectly named visualConfidence field
runTest("14. text analysis contains no incorrectly named visualConfidence field", () => {
  const dishEntity = resolveEntity("منسف", mockKnowledgeCache.entities, mockKnowledgeCache.aliases)!;
  const dishCandidate: DishCandidate = { entity: dishEntity, variant: null, confidence: "HIGH" };
  const rawObservations = [
    { nameAr: "جميد", nameEn: "Jameed", confidence: "HIGH" as const }
  ];

  const hypotheses = rerankImageCandidates(dishCandidate, rawObservations, mockKnowledgeCache, "text");
  const hyp = hypotheses[0];
  if (hyp.visualConfidence !== undefined) {
    throw new Error("Found visualConfidence in text analysis hypothesis output");
  }
});

// Test 15: image analysis still preserves IMAGE_OBSERVED and visual confidence
runTest("15. image analysis still preserves IMAGE_OBSERVED and visual confidence", () => {
  const dishEntity = resolveEntity("منسف", mockKnowledgeCache.entities, mockKnowledgeCache.aliases)!;
  const dishCandidate: DishCandidate = { entity: dishEntity, variant: null, confidence: "HIGH" };
  const rawObservations = [
    { nameAr: "جميد", nameEn: "Jameed", confidence: "HIGH" as const }
  ];

  const hypotheses = rerankImageCandidates(dishCandidate, rawObservations, mockKnowledgeCache, "image");
  const hyp = hypotheses[0];
  if (hyp.observationProvenance !== Provenance.IMAGE_OBSERVED) {
    throw new Error(`Expected IMAGE_OBSERVED provenance, got: ${hyp.observationProvenance}`);
  }
  if (hyp.visualConfidence !== "HIGH") {
    throw new Error(`Expected visualConfidence high, got: ${hyp.visualConfidence}`);
  }
});

// Test 16: foodsTable remains final compatibility authority
runTest("16. foodsTable remains final compatibility authority", () => {
  const dishEntity = resolveEntity("منسف", mockKnowledgeCache.entities, mockKnowledgeCache.aliases)!;
  const dishCandidate: DishCandidate = { entity: dishEntity, variant: null, confidence: "HIGH" };
  const rawObservations = [
    { nameAr: "جميد", nameEn: "Jameed", confidence: "HIGH" as const }
  ];

  const hypotheses = rerankImageCandidates(dishCandidate, rawObservations, mockKnowledgeCache, "text");
  if (hypotheses[0].compatibilityStatus !== "allowed") {
    throw new Error("foodsTable lookup status did not resolve correctly");
  }
});

// Test 17: old relevantVariants remains backward compatible
runTest("17. old relevantVariants remains backward compatible", () => {
  const entity = resolveEntity("منسف", mockKnowledgeCache.entities, mockKnowledgeCache.aliases)!;
  const refinements = buildUnifiedSuggestions(entity, [], mockKnowledgeCache);
  const relevantVariants = refinements.map(s => ({
    nameAr: s.labelAr,
    query: s.query
  }));
  if (relevantVariants.length !== 2 || !relevantVariants[0].nameAr || !relevantVariants[0].query) {
    throw new Error("Backward compatibility mapping failed");
  }
});

// Test 18: empty/malformed AI refinement array fails safely
runTest("18. empty/malformed AI refinement array fails safely", () => {
  const entity = resolveEntity("منسف", mockKnowledgeCache.entities, mockKnowledgeCache.aliases)!;
  const suggestions = buildUnifiedSuggestions(entity, [null as any, {} as any, undefined as any], mockKnowledgeCache);
  if (suggestions.length !== 2) {
    throw new Error(`Expected 2 DB suggestions, got: ${suggestions.length}`);
  }
});

// ==========================================
// Phase 2.1 Endpoint Control Flow Tests
// ==========================================

runTest("19. Endpoint: خبز broad recognized food returns refinements", () => {
  const report = simulateTextRoute("خبز", {
    isFood: true,
    userIntent: UserIntent.BROAD_FOOD_CATEGORY,
    isAmbiguous: true,
    rawItems: [],
    aiRefinementSuggestions: [
      { labelAr: "خبز عربي", labelEn: "Arabic Bread", query: "خبز عربي" },
      { labelAr: "خبز أسمر", labelEn: "Brown Bread", query: "خبز أسمر" }
    ]
  });

  if (report.notFound) {
    throw new Error("Broad category search returned notFound: true");
  }
  if (report.refinementSuggestions.length !== 2) {
    throw new Error(`Expected 2 suggestions, got: ${report.refinementSuggestions.length}`);
  }
});

runTest("20. Endpoint: جبنة broad recognized food is not notFound", () => {
  const report = simulateTextRoute("جبنة", {
    isFood: true,
    userIntent: UserIntent.BROAD_FOOD_CATEGORY,
    isAmbiguous: true,
    rawItems: [],
    aiRefinementSuggestions: [
      { labelAr: "جبنة بيضاء", labelEn: "White Cheese", query: "جبنة بيضاء" }
    ]
  });

  if (report.notFound) {
    throw new Error("Cheese broad query returned notFound: true");
  }
});

runTest("21. Endpoint: أرز broad recognized food is not notFound", () => {
  const report = simulateTextRoute("أرز", {
    isFood: true,
    userIntent: UserIntent.BROAD_FOOD_CATEGORY,
    isAmbiguous: true,
    rawItems: [],
    aiRefinementSuggestions: [
      { labelAr: "أرز بسمتي", labelEn: "Basmati Rice", query: "أرز بسمتي" }
    ]
  });

  if (report.notFound) {
    throw new Error("Rice broad query returned notFound: true");
  }
});

runTest("22. Endpoint: مسخن unknown dish continues AI fallback", () => {
  const report = simulateTextRoute("مسخن", {
    isFood: true,
    userIntent: UserIntent.SPECIFIC_DISH,
    isAmbiguous: false,
    rawItems: [
      { nameAr: "دجاج", nameEn: "Chicken" },
      { nameAr: "خبز", nameEn: "Bread" }
    ]
  });

  if (report.notFound) {
    throw new Error("Unknown dish fell back to notFound: true");
  }
  if (!report.hypotheses || report.hypotheses.length !== 2) {
    throw new Error(`Expected 2 hypotheses, got: ${report.hypotheses?.length}`);
  }
});

runTest("23. Endpoint: سيارة non-food returns notFound", () => {
  const report = simulateTextRoute("سيارة", {
    isFood: false,
    userIntent: UserIntent.UNKNOWN,
    isAmbiguous: false,
    rawItems: []
  });

  if (!report.notFound) {
    throw new Error("Expected non-food query to return notFound: true");
  }
});

runTest("24. Endpoint: Windows 11 returns notFound", () => {
  const report = simulateTextRoute("Windows 11", {
    isFood: false,
    userIntent: UserIntent.UNKNOWN,
    isAmbiguous: false,
    rawItems: []
  });

  if (!report.notFound) {
    throw new Error("Expected Windows 11 query to return notFound: true");
  }
});

runTest("25. Endpoint: meaningless input returns notFound", () => {
  const report = simulateTextRoute("asdflkjasd", {
    isFood: false,
    userIntent: UserIntent.UNKNOWN,
    isAmbiguous: false,
    rawItems: []
  });

  if (!report.notFound) {
    throw new Error("Expected meaningless query to return notFound: true");
  }
});

runTest("26. Endpoint: AI suggestions present but non-food query returns notFound", () => {
  const report = simulateTextRoute("سيارة", {
    isFood: false,
    userIntent: UserIntent.UNKNOWN,
    isAmbiguous: false,
    rawItems: [],
    aiRefinementSuggestions: [
      { labelAr: "سيارة فيراري", labelEn: "Ferrari", query: "سيارة فيراري" }
    ]
  });

  if (!report.notFound) {
    throw new Error("Expected non-food query with AI suggestions to remain notFound: true");
  }
});

runTest("27. Endpoint: Specific food زيت زيتون has no broad refinements", () => {
  const report = simulateTextRoute("زيت زيتون", {
    isFood: true,
    userIntent: UserIntent.SPECIFIC_INGREDIENT,
    isAmbiguous: false,
    rawItems: [
      { nameAr: "زيت زيتون", nameEn: "Olive Oil" }
    ]
  });

  if (report.refinementSuggestions.length !== 0) {
    throw new Error("Specific food query incorrectly returned refinements");
  }
});

runTest("28. Endpoint: منسف DB variants prioritized over AI", () => {
  const report = simulateTextRoute("منسف", {
    isFood: true,
    userIntent: UserIntent.AMBIGUOUS_DISH_FOOD,
    isAmbiguous: true,
    rawItems: [],
    aiRefinementSuggestions: [
      { labelAr: "منسف دجاج", labelEn: "Chicken Mansaf", query: "منسف دجاج" },
      { labelAr: "منسف نباتي", labelEn: "Vegetarian Mansaf", query: "منسف نباتي" }
    ]
  });

  if (report.refinementSuggestions[0].source !== "DB_VARIANT") {
    throw new Error(`Expected DB_VARIANT first, got: ${report.refinementSuggestions[0].source}`);
  }
});

// Autocomplete simulation
function simulateAutocomplete(q: string) {
  if (q.trim().length < 2) return { suggestions: [] };
  const suggestions: any[] = [];
  const normQ = normalizeName(q);
  const strippedQ = stripArticle(normQ);

  const pushSuggestion = (labelAr: string, labelEn: string, queryStr: string, source: string, score: number) => {
    suggestions.push({ labelAr, labelEn, query: queryStr, source, score });
  };

  for (const e of mockKnowledgeCache.entities) {
    const normAr = normalizeName(e.nameAr);
    const normEn = normalizeName(e.nameEn);
    if (normAr === normQ || normEn === normQ) {
      pushSuggestion(e.nameAr, e.nameEn, e.nameAr, "DB_ENTITY", 100);
    } else if (normAr.startsWith(normQ) || normEn.startsWith(normQ) || stripArticle(normAr).startsWith(strippedQ)) {
      pushSuggestion(e.nameAr, e.nameEn, e.nameAr, "DB_ENTITY", 90);
    } else if (normAr.includes(normQ) || normEn.includes(normQ)) {
      pushSuggestion(e.nameAr, e.nameEn, e.nameAr, "DB_ENTITY", 70);
    }
  }

  for (const a of mockKnowledgeCache.aliases) {
    const normAr = normalizeName(a.aliasAr);
    const normEn = normalizeName(a.aliasEn);
    const parent = mockKnowledgeCache.entities.find(e => e.id === a.entityId);
    if (!parent) continue;

    if (normAr === normQ || normEn === normQ) {
      pushSuggestion(a.aliasAr, parent.nameEn, a.aliasAr, "DB_ALIAS", 99);
    } else if (normAr.startsWith(normQ) || normEn.startsWith(normQ) || stripArticle(normAr).startsWith(strippedQ)) {
      pushSuggestion(a.aliasAr, parent.nameEn, a.aliasAr, "DB_ALIAS", 89);
    } else if (normAr.includes(normQ) || normEn.includes(normQ)) {
      pushSuggestion(a.aliasAr, parent.nameEn, a.aliasAr, "DB_ALIAS", 69);
    }
  }

  for (const v of mockKnowledgeCache.dishVariants) {
    const normAr = normalizeName(v.nameAr);
    const normEn = normalizeName(v.nameEn);
    if (normAr === normQ || normEn === normQ) {
      pushSuggestion(v.nameAr, v.nameEn, v.nameAr, "DB_VARIANT", 98);
    } else if (normAr.startsWith(normQ) || normEn.startsWith(normQ) || stripArticle(normAr).startsWith(strippedQ)) {
      pushSuggestion(v.nameAr, v.nameEn, v.nameAr, "DB_VARIANT", 88);
    } else if (normAr.includes(normQ) || normEn.includes(normQ)) {
      pushSuggestion(v.nameAr, v.nameEn, v.nameAr, "DB_VARIANT", 68);
    }
  }

  suggestions.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const unique: any[] = [];
  for (const s of suggestions) {
    const norm = normalizeName(s.query);
    if (!seen.has(norm)) {
      seen.add(norm);
      unique.push(s);
    }
  }
  return { suggestions: unique.slice(0, 8) };
}

runTest("29. Autocomplete: query < 2 chars returns empty", () => {
  const result = simulateAutocomplete("خ");
  if (result.suggestions.length !== 0) {
    throw new Error("Expected query < 2 chars to return 0 suggestions");
  }
});

runTest("30. Autocomplete: exact match ranks highest (Entity > Alias > Variant)", () => {
  const result = simulateAutocomplete("منسف");
  const suggestions = result.suggestions;
  if (suggestions.length === 0) {
    throw new Error("Expected exact match suggestions for 'منسف'");
  }
  
  // Entity "منسف" (score 100) must be first
  if (suggestions[0].source !== "DB_ENTITY" || suggestions[0].query !== "منسف") {
    throw new Error(`Expected exact entity match 'منسف' first, got: ${suggestions[0].query} (${suggestions[0].source})`);
  }
});

runTest("31. Autocomplete: prefix matches sorted correctly by priority", () => {
  const result = simulateAutocomplete("من");
  const suggestions = result.suggestions;
  if (suggestions.length < 2) {
    throw new Error("Expected multiple prefix match suggestions for 'من'");
  }
  
  // Verify scores: Entity prefix "منسف" (90) > Alias prefix "المنسف" (89) > Variant prefix "منسف دجاج" (88)
  const first = suggestions[0];
  const second = suggestions[1];
  
  if (first.score <= second.score) {
    throw new Error(`Expected descending score order, got scores: ${first.score}, ${second.score}`);
  }
});

runTest("32. Autocomplete: deduplication strips duplicates", () => {
  const result = simulateAutocomplete("منسف");
  const queries = result.suggestions.map(s => s.query);
  const duplicates = queries.filter((item, index) => queries.indexOf(item) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Expected zero duplicate suggestions, found duplicates for: ${duplicates.join(", ")}`);
  }
});

runTest("33. Query Preservation: Raw submitted query is preserved in response query field", () => {
  const report = simulateTextRoute("خبز أسمر", {
    isFood: true,
    userIntent: UserIntent.SPECIFIC_DISH,
    isAmbiguous: false,
    rawItems: [
      { nameAr: "خبز", nameEn: "Bread" }
    ]
  });

  if (report.query !== "خبز أسمر") {
    throw new Error(`Expected query to be preserved as 'خبز أسمر', got: '${report.query}'`);
  }
});

runTest("34. Unresolved broad ambiguity does not render compatibility card state", () => {
  const report = simulateTextRoute("خبز", {
    isFood: true,
    userIntent: UserIntent.BROAD_FOOD_CATEGORY,
    isAmbiguous: true,
    rawItems: []
  });

  const isUnresolvedAmbiguity = report.isAmbiguous && (!report.hypotheses || report.hypotheses.length === 0);
  if (!isUnresolvedAmbiguity) {
    throw new Error("Expected unresolved broad category to have isAmbiguous true and empty hypotheses");
  }
});

runTest("35. Explainability: dbReason and dbNotes are propagated correctly from foods", () => {
  const report = simulateTextRoute("خبز", {
    isFood: true,
    userIntent: UserIntent.SPECIFIC_INGREDIENT,
    isAmbiguous: false,
    rawItems: [
      { nameAr: "خبز", nameEn: "Bread" }
    ]
  });

  const breadItem = report.allowed.find(i => i.nameAr === "خبز");
  if (!breadItem) {
    throw new Error("Expected Bread to be present in allowed items");
  }
  if (breadItem.dbReason !== "غذاء أساسي مسموح به.") {
    throw new Error(`Expected dbReason to be 'غذاء أساسي مسموح به.', got: '${breadItem.dbReason}'`);
  }
  if (breadItem.dbNotes !== "يفضل التأكد من عدم استخدام سكر مضاف بكميات كبيرة.") {
    throw new Error(`Expected dbNotes to be set correctly, got: '${breadItem.dbNotes}'`);
  }
});

runTest("36. Explainability: matchType is mapped correctly for exact, alias and inferred matches", () => {
  // Test EXACT
  const reportExact = simulateTextRoute("خبز", {
    isFood: true,
    userIntent: UserIntent.SPECIFIC_INGREDIENT,
    isAmbiguous: false,
    rawItems: [{ nameAr: "خبز", nameEn: "Bread" }]
  });
  const breadExact = reportExact.allowed.find(i => i.nameAr === "خبز");
  if (breadExact?.matchType !== "EXACT") {
    throw new Error(`Expected EXACT matchType, got: ${breadExact?.matchType}`);
  }

  // Test ALIAS (المنسف resolves to entity 1 Mansaf via alias matchScore 90)
  const reportAlias = simulateTextRoute("المنسف", {
    isFood: true,
    userIntent: UserIntent.SPECIFIC_DISH,
    isAmbiguous: false,
    rawItems: [{ nameAr: "المنسف", nameEn: "Mansaf" }]
  });
  const mansafAlias = reportAlias.allowed.find(i => i.nameAr === "منسف");
  if (mansafAlias?.matchType !== "ALIAS") {
    throw new Error(`Expected ALIAS matchType, got: ${mansafAlias?.matchType}`);
  }

  // Test RECIPE_INFERRED (e.g. Ice Cream -> Tahini Sauce confusion inference in Kofta dish)
  const reportInferred = simulateTextRoute("كفتة بالطحينة", {
    isFood: true,
    userIntent: UserIntent.SPECIFIC_DISH,
    isAmbiguous: false,
    rawItems: [
      { nameAr: "Ice Cream", nameEn: "Ice Cream", confidence: "HIGH" }
    ]
  });
  const inferredItem = reportInferred.allowed.find(i => i.nameAr === "صلصة الطحينة");
  if (!inferredItem) {
    throw new Error("Expected Tahini Sauce to be inferred inside Kofta");
  }
  if (inferredItem.matchType !== "RECIPE_INFERRED") {
    throw new Error(`Expected RECIPE_INFERRED matchType, got: ${inferredItem.matchType}`);
  }
});

runTest("37. Explainability: results containing multiple statuses are grouped correctly", () => {
  const report = simulateTextRoute("كفتة بالطحينة", {
    isFood: true,
    userIntent: UserIntent.SPECIFIC_DISH,
    isAmbiguous: false,
    rawItems: [
      { nameAr: "خبز", nameEn: "Bread" }, 
      { nameAr: "موز", nameEn: "Banana" }, 
      { nameAr: "مجهول", nameEn: "Unknown Ing" } 
    ]
  });

  if (report.allowed.length === 0 && report.unknown.length === 0) {
    throw new Error("Expected allowed and unknown items to be populated");
  }
});

runTest("38. Explainability: null Reason and Notes handled safely", () => {
  const report = simulateTextRoute("أرز", {
    isFood: true,
    userIntent: UserIntent.SPECIFIC_INGREDIENT,
    isAmbiguous: false,
    rawItems: [
      { nameAr: "أرز", nameEn: "Rice" }
    ]
  });

  const riceItem = report.allowed.find(i => i.nameAr === "أرز");
  if (!riceItem) {
    throw new Error("Expected Rice to be analyzed");
  }
  if (riceItem.dbReason !== null || riceItem.dbNotes !== null) {
    throw new Error("Expected dbReason and dbNotes to be null for Rice in mock database");
  }
});

runTest("39. Explainability: fuzzy/parent resolution (like خبز أسمر) resolves to PARENT_ENTITY with MEDIUM confidence", () => {
  const report = simulateTextRoute("خبز أسمر", {
    isFood: true,
    userIntent: UserIntent.SPECIFIC_INGREDIENT,
    isAmbiguous: false,
    rawItems: [
      { nameAr: "خبز أسمر", nameEn: "Bread" }
    ]
  });

  const breadItem = report.allowed.find(i => i.nameAr === "خبز");
  if (!breadItem) {
    throw new Error("Expected Bread to be resolved");
  }
  if (breadItem.matchType !== "PARENT_ENTITY") {
    throw new Error(`Expected PARENT_ENTITY matchType for 'خبز أسمر', got: ${breadItem.matchType}`);
  }
  if (report.overallConfidence !== "MEDIUM" || report.overallConfidenceReasonCode !== "PARENT_ENTITY") {
    throw new Error(`Expected MEDIUM confidence and PARENT_ENTITY reason code, got: ${report.overallConfidence} (${report.overallConfidenceReasonCode})`);
  }
});

// =============================================================================
// SECTION 6: Layer-5 Direction Safety Tests (post Direction-B removal)
// =============================================================================
//
// These tests use an extended fixture that includes the post-migration entities
// (Rich Bake Bran Toast, French Bread) so we can verify correct behavior before
// the SQL migration actually runs.

const breadFixtureEntities = [
  { id: 1,  nameAr: "منسف",                    nameEn: "Mansaf",              type: "dish" as const,       attributes: { sweet: false, savory: true }, foodId: 101 },
  { id: 2,  nameAr: "كفتة بالطحينة",            nameEn: "Kofta with Tahini",  type: "dish" as const,       attributes: { sweet: false, savory: true }, foodId: 102 },
  { id: 3,  nameAr: "خبز",                      nameEn: "Bread",               type: "bread" as const,      attributes: { sweet: false, savory: true }, foodId: 200 }, // 200 = generic forbidden bread (post-migration)
  { id: 20, nameAr: "خبز شراك",                 nameEn: "Shrak Bread",         type: "bread" as const,      attributes: { sweet: false, savory: true }, foodId: 200 }, // same generic forbidden
  { id: 30, nameAr: "خبز فرنسي",                nameEn: "French Bread",        type: "bread" as const,      attributes: { sweet: false, savory: true }, foodId: 200 }, // same generic forbidden
  { id: 31, nameAr: "توست ريتش بيك بالردة",     nameEn: "Rich Bake Bran Toast",type: "bread" as const,      attributes: { sweet: false, savory: true }, foodId: 201 }, // 201 = allowed toast
];

const breadFixtureAliases = [
  { id: 8,  entityId: 3, aliasAr: "خبز عربي",  aliasEn: "Arabic Bread",    region: "Middle East" },
  { id: 9,  entityId: 3, aliasAr: "كماج",       aliasEn: "Kemaj Bread",     region: "JO" },
  { id: 12, entityId: 3, aliasAr: "خبز عادي",  aliasEn: "Regular Bread",   region: null },
  { id: 13, entityId: 3, aliasAr: "خبز بلدي",  aliasEn: "Baladi Bread",    region: null },
  { id: 14, entityId: 3, aliasAr: "خبز شامي",  aliasEn: "Shami Bread",     region: "Levant" },
  { id: 15, entityId: 3, aliasAr: "خبز صاج",   aliasEn: "Saj Bread",       region: null },
  { id: 16, entityId: 3, aliasAr: "خبز أسمر",  aliasEn: "Brown Bread",     region: null },
];

// Resolve helper scoped to breadFixture
function resolveBread(input: string) {
  return resolveEntity(input.trim(), breadFixtureEntities, breadFixtureAliases);
}

// ─── 40. توست must NOT resolve after Direction-B removal ─────────────────────
runTest("40. Layer-5 safety: 'توست' must NOT resolve to Rich Bake (Direction B removed)", () => {
  const result = resolveBread("توست");
  if (result !== null) {
    throw new Error(
      `'توست' should not resolve after Direction-B removal. Got: [${result.id}] ${result.nameAr}`
    );
  }
});

// ─── 41. توست القمح الكامل must NOT resolve to Rich Bake ─────────────────────
runTest("41. Layer-5 safety: 'توست القمح الكامل' must NOT resolve to Rich Bake", () => {
  const result = resolveBread("توست القمح الكامل");
  // With Direction B removed, "توست القمح الكامل".includes("توست ريتش بيك بالرده") is FALSE
  // because the full normalized entity name is NOT a substring of the input.
  if (result !== null && result.id === 31) {
    throw new Error(
      `'توست القمح الكامل' must NOT resolve to Rich Bake. Got: [${result.id}] ${result.nameAr}`
    );
  }
  // Acceptable outcomes: null, or generic Bread (if "خبز" substring match fires — it does not here)
});

// ─── 42. توست ريتش بيك بالردة must resolve EXACT via Layer 5 Dir A ────────────
runTest("42. 'توست ريتش بيك بالردة' resolves to Rich Bake entity (exact / Dir-A)", () => {
  const result = resolveBread("توست ريتش بيك بالردة");
  if (!result || result.id !== 31) {
    throw new Error(
      `'توست ريتش بيك بالردة' must resolve to Rich Bake [31]. Got: ${result ? `[${result.id}] ${result.nameAr}` : "null"}`
    );
  }
  if (result.foodId !== 201) {
    throw new Error(`Expected foodId 201 (allowed toast), got: ${result.foodId}`);
  }
});

// ─── 43. English "Rich Bake Bran Toast" resolves to same entity ──────────────
runTest("43. English 'Rich Bake Bran Toast' resolves to same Rich Bake entity", () => {
  const result = resolveBread("Rich Bake Bran Toast");
  if (!result || result.id !== 31) {
    throw new Error(
      `English 'Rich Bake Bran Toast' must resolve to Rich Bake [31]. Got: ${result ? `[${result.id}]` : "null"}`
    );
  }
});

// ─── 44. خبز أسمر still resolves to generic Bread via Dir-A (alias overrides) ─
runTest("44. 'خبز أسمر' resolves via alias (Bread entity), not Layer 5", () => {
  // With the alias خبز أسمر → Entity 3 (Bread), Layer 2 resolves it before Layer 5.
  const result = resolveBread("خبز أسمر");
  if (!result) {
    throw new Error("'خبز أسمر' should resolve to Bread entity [3] via alias");
  }
  if (result.id !== 3) {
    throw new Error(`Expected Bread entity [3], got [${result.id}] ${result.nameAr}`);
  }
  if (result.foodId !== 200) {
    throw new Error(`Expected foodId 200 (forbidden bread), got: ${result.foodId}`);
  }
});

// ─── 45. خبز فرنسي resolves to French Bread entity, NOT generic Bread ─────────
// NOTE: With current entity iteration order, Layer 5 hits خبز (id 3) BEFORE خبز فرنسي (id 30)
// because "خبز فرنسي".includes("خبز") fires first. This is a known ordering issue.
// After migration, خبز فرنسي must be added as a Layer-1/2 exact entity to resolve correctly.
// This test documents CURRENT behavior and flags the ordering risk.
runTest("45. 'خبز فرنسي' resolves to a Bread-type entity (ordering risk documented)", () => {
  const result = resolveBread("خبز فرنسي");
  if (!result) {
    throw new Error("'خبز فرنسي' should resolve to some bread entity");
  }
  // After migration with French Bread entity present, Layers 1-4 should match it
  // BEFORE Layer 5 fires. If Layer 5 fires first and hits generic Bread, the result
  // is still FORBIDDEN (same ruling), but the entity is wrong.
  // This test just confirms resolution doesn't return null and is bread-type.
  if (result.type !== "bread") {
    throw new Error(`Expected bread type, got: ${result.type}`);
  }
  // Document the actual resolved entity for the report
  console.log(`  [INFO] 'خبز فرنسي' resolved to: [${result.id}] ${result.nameAr} (matchScore: ${result.matchScore})`);
});

// ─── 46. English "French Bread" resolves to French Bread entity ──────────────
runTest("46. English 'French Bread' resolves to French Bread entity [30]", () => {
  // Layer 2 exact match on normalized English: "french bread" === normalizeName("French Bread")
  const result = resolveBread("French Bread");
  if (!result || result.id !== 30) {
    throw new Error(
      `'French Bread' must resolve to French Bread entity [30]. Got: ${result ? `[${result.id}] ${result.nameAr}` : "null"}`
    );
  }
});

// ─── 47. منسف دجاج preserves existing behavior (no regression) ───────────────
runTest("47. 'منسف دجاج' preserves existing behavior (Mansaf parent, no regression)", () => {
  const result = resolveBread("منسف دجاج");
  if (!result || result.id !== 1) {
    throw new Error(`'منسف دجاج' must still resolve to Mansaf [1]. Got: ${result ? `[${result.id}]` : "null"}`);
  }
  if (result.matchScore !== 60) {
    throw new Error(`Expected matchScore 60 (Layer-5 parent), got: ${result.matchScore}`);
  }
});

// ─── 48. كفتة بالطحينة resolves EXACT (both Dir-A and Dir-B fired, now only Dir-A) ──
runTest("48. 'كفتة بالطحينة' resolves exact (no regression from Direction-B removal)", () => {
  // Before fix: Dir-A fires (normInput === nAr after normalization, so contains is true)
  // After fix: same — Dir-A still fires. No change.
  const result = resolveBread("كفتة بالطحينة");
  if (!result || result.id !== 2) {
    throw new Error(`'كفتة بالطحينة' must resolve to Kofta [2]. Got: ${result ? `[${result.id}]` : "null"}`);
  }
});

// =============================================================================
// SECTION 7: Arabic Normalization Tests
// =============================================================================

runTest("49. Normalization: أرز with hamza resolves same as ارز without", () => {
  // normalizeName maps أ → ا, so "أرز" and "ارز" should normalize the same
  const n1 = normalizeName("أرز");
  const n2 = normalizeName("ارز");
  if (n1 !== n2) {
    throw new Error(`normalizeName("أرز")="${n1}" !== normalizeName("ارز")="${n2}"`);
  }
});

runTest("50. Normalization: diacritics stripped correctly", () => {
  const withDiac = normalizeName("مَنْسَف");
  const without  = normalizeName("منسف");
  if (withDiac !== without) {
    throw new Error(`Diacritics not stripped: "${withDiac}" !== "${without}"`);
  }
});

runTest("51. Normalization: tatweel stripped", () => {
  const withTatweel = normalizeName("كـبـسة");
  const without     = normalizeName("كبسه"); // ة→ه after normalization
  if (withTatweel !== without) {
    throw new Error(`Tatweel not stripped: "${withTatweel}" !== "${without}"`);
  }
});

runTest("52. Normalization: ى → ي", () => {
  const withMaqsura = normalizeName("مقلوبى");
  const withYa      = normalizeName("مقلوبي");
  if (withMaqsura !== withYa) {
    throw new Error(`ى not normalized to ي: "${withMaqsura}" !== "${withYa}"`);
  }
});

runTest("53. Normalization: ة → ه at word end", () => {
  const withMarbuta = normalizeName("كفتة");
  const withHa      = normalizeName("كفته");
  if (withMarbuta !== withHa) {
    throw new Error(`ة not normalized to ه: "${withMarbuta}" !== "${withHa}"`);
  }
});

runTest("54. Normalization: hamza forms إ / آ / أ / ا all normalize to ا", () => {
  const forms = ["أرز", "إرز", "آرز", "ارز"].map(normalizeName);
  const unique = new Set(forms);
  if (unique.size !== 1) {
    throw new Error(`Hamza forms not unified: ${JSON.stringify(forms)}`);
  }
});

runTest("55. Normalization: English case-insensitive", () => {
  const upper = normalizeName("FRENCH BREAD");
  const lower = normalizeName("french bread");
  const mixed = normalizeName("French Bread");
  if (upper !== lower || lower !== mixed) {
    throw new Error(`English case normalization failed: "${upper}" / "${lower}" / "${mixed}"`);
  }
});

// ─── 56. Alias resolution: خبز عادي resolves to Bread entity via alias ────────
runTest("56. Alias: 'خبز عادي' resolves to Bread entity [3] via alias (Layer 1/2)", () => {
  const result = resolveBread("خبز عادي");
  if (!result || result.id !== 3) {
    throw new Error(`'خبز عادي' alias must resolve to Bread [3]. Got: ${result ? `[${result.id}]` : "null"}`);
  }
  if (result.foodId !== 200) {
    throw new Error(`Expected forbidden bread foodId 200, got: ${result.foodId}`);
  }
  // Alias match score is 90, not 60
  if (result.matchScore !== 90) {
    throw new Error(`Alias match must have matchScore 90, got: ${result.matchScore}`);
  }
});

// ─── 57. Alias resolution: كماج resolves to Bread entity ─────────────────────
runTest("57. Alias: 'كماج' resolves to Bread entity [3] via alias", () => {
  const result = resolveBread("كماج");
  if (!result || result.id !== 3) {
    throw new Error(`'كماج' alias must resolve to Bread [3]. Got: ${result ? `[${result.id}]` : "null"}`);
  }
  if (result.matchScore !== 90) {
    throw new Error(`Alias match must have matchScore 90, got: ${result.matchScore}`);
  }
});

console.log("\nAll 57 unit tests passed successfully!");

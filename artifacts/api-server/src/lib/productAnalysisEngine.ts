/**
 * Tayyibati Product Intelligence Foundation Engine (Phase 7.0)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/PRODUCT_INTELLIGENCE.md
 * - See docs/ANALYSIS_PIPELINE_SPEC.md (Stage 8 & 9 integration)
 * - See docs/ARCHITECTURE_RULES.md (Rule 2: Dynamic Decomposition, A Product is NOT a Food)
 * - See docs/ENGINEERING_PRINCIPLES.md (Decomposition Before Decision, Knowledge First)
 *
 * MANDATE:
 * - A Product is NOT a Food. Products NEVER store compatibility rulings.
 * - Products are decomposed into ingredient lists and routed through the universal pipeline:
 *   Product -> Ingredient Extraction -> Resolution -> Decision Engine -> Explanation Engine.
 */

import { IngredientDecomposer } from "./ingredientDecomposer";
import { DecisionEngine, DecisionEngineOutput } from "./decisionEngine";
import { ExplanationEngine, ExplanationEngineOutput, ExplanationOptions } from "./explanationEngine";

export interface Product {
  productId: string;
  barcode: string | null;
  brand: string | null;
  productName: string;
  country: string | null;
  manufacturer: string | null;
  ingredientText: string;
  nutritionFacts?: Record<string, any> | null;
  imageUrl?: string | null;
  language: "ar" | "en";
  knowledgeVersion: string;
}

export interface ProductAnalysisInput {
  barcode?: string;
  productId?: string;
  rawOcrText?: string;
  productPayload?: Partial<Product>;
  explanationOptions?: ExplanationOptions;
}

export interface ProductAnalysisOutput {
  product: Product | null;
  isUnknownProduct: boolean;
  needsAdminReview: boolean;
  knowledgeVersion: string;
  confidenceMetrics: {
    productConfidence: number; // 0 to 100
    ingredientConfidence: number;
    recognitionConfidence: number;
    decisionConfidence: number;
  };
  decisionOutput: DecisionEngineOutput;
  explanationOutput: ExplanationEngineOutput;
}

// In-Memory Known Products Registry (Product Database Foundation)
const KNOWN_PRODUCTS_DB: Map<string, Product> = new Map([
  [
    "629100123456",
    {
      productId: "PROD_NUTELLA_01",
      barcode: "629100123456",
      brand: "Ferrero",
      productName: "Nutella Hazelnut Spread",
      country: "Italy",
      manufacturer: "Ferrero SpA",
      ingredientText: "سكر، زيت النخيل، بندق، حليب فرز مجفف، كاكاو قليل الدسم، ليسيثين الصويا، فانيلين",
      language: "ar",
      knowledgeVersion: "2.1",
    },
  ],
  [
    "012000000133",
    {
      productId: "PROD_PEPSI_01",
      barcode: "012000000133",
      brand: "PepsiCo",
      productName: "Pepsi Can",
      country: "USA",
      manufacturer: "PepsiCo, Inc.",
      ingredientText: "مياه غازية، سكر، لون الكراميل، حمض الفوسفوريك، كافيين، نكهات طبيعية",
      language: "ar",
      knowledgeVersion: "2.1",
    },
  ],
]);

export class ProductAnalysisEngine {
  /**
   * Universal Product Analysis Entry Point:
   * 1. Product Lookup (by Barcode, Product ID, or Manual Payload)
   * 2. Ingredient Extraction & Decomposition via IngredientDecomposer
   * 3. Compatibility Evaluation via DecisionEngine
   * 4. Natural-Language Presentation via ExplanationEngine
   * 5. Product Confidence & Knowledge Version Tagging ("2.1")
   */
  public static async analyzeProduct(input: ProductAnalysisInput): Promise<ProductAnalysisOutput> {
    const tStart = performance.now();
    const knowledgeVersion = "2.1";

    let product: Product | null = null;
    let isUnknownProduct = false;
    let productConfidence = 0;
    let ingredientTextToAnalyze = "";

    // 1. Lookup Product by Barcode or Product ID
    if (input.barcode && KNOWN_PRODUCTS_DB.has(input.barcode)) {
      product = KNOWN_PRODUCTS_DB.get(input.barcode)!;
      productConfidence = 100;
      ingredientTextToAnalyze = product.ingredientText;
    } else if (input.productId && Array.from(KNOWN_PRODUCTS_DB.values()).some((p) => p.productId === input.productId)) {
      product = Array.from(KNOWN_PRODUCTS_DB.values()).find((p) => p.productId === input.productId)!;
      productConfidence = 100;
      ingredientTextToAnalyze = product.ingredientText;
    } else if (input.productPayload && input.productPayload.productName) {
      product = {
        productId: input.productPayload.productId || `PROD_MANUAL_${Date.now()}`,
        barcode: input.productPayload.barcode || null,
        brand: input.productPayload.brand || null,
        productName: input.productPayload.productName,
        country: input.productPayload.country || null,
        manufacturer: input.productPayload.manufacturer || null,
        ingredientText: input.productPayload.ingredientText || "",
        language: input.productPayload.language || "ar",
        knowledgeVersion,
      };
      productConfidence = 90;
      ingredientTextToAnalyze = product.ingredientText;
    } else if (input.rawOcrText && input.rawOcrText.trim()) {
      productConfidence = 85;
      ingredientTextToAnalyze = input.rawOcrText.trim();
    } else {
      isUnknownProduct = true;
      productConfidence = 0;
    }

    // 2. Ingredient Extraction & Decomposition (Universal Pipeline Stage 4 & 5)
    const decompResult = await IngredientDecomposer.decompose({
      ocrText: ingredientTextToAnalyze || undefined,
      rawIngredientNames: ingredientTextToAnalyze ? undefined : [],
      sourceType: input.barcode ? "barcode" : input.rawOcrText ? "ocr" : "manual",
    });

    // 3. Compatibility Decision (Universal Decision Engine - Stage 8)
    const decisionOutput = DecisionEngine.evaluate({
      resolvedIngredients: decompResult.resolvedIngredients,
      unknownIngredients: decompResult.unknownIngredients,
      recognitionStats: decompResult.recognitionStats,
    });

    // 4. Natural-Language Presentation (Universal Explanation Engine - Stage 9)
    const explanationOutput = ExplanationEngine.render(decisionOutput, input.explanationOptions);

    // 5. Confidence Metrics Assembly
    const ingredientConfidence = decompResult.recognitionStats.averageConfidence || 0;
    const recognitionConfidence = decompResult.recognitionStats.recognitionPercentage || 0;
    const decisionConfidence = decisionOutput.decisionConfidence;

    const durationMs = performance.now() - tStart;
    console.log(`[PRODUCT_INTELLIGENCE] Product: ${product?.productName || "Unknown"} | Barcode: ${input.barcode || "N/A"} | Decision: ${decisionOutput.finalDecision} | KnowledgeVersion: ${knowledgeVersion} | Latency: ${durationMs.toFixed(3)} ms`);

    return {
      product,
      isUnknownProduct,
      needsAdminReview: isUnknownProduct || decompResult.unknownIngredients.length > 0,
      knowledgeVersion,
      confidenceMetrics: {
        productConfidence,
        ingredientConfidence,
        recognitionConfidence,
        decisionConfidence,
      },
      decisionOutput,
      explanationOutput,
    };
  }

  /**
   * Helper to register new products dynamically into memory database
   */
  public static registerProduct(product: Product): void {
    if (product.barcode) {
      KNOWN_PRODUCTS_DB.set(product.barcode, product);
    }
  }
}

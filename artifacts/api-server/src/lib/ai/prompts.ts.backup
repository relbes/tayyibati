/**
 * Tayyibati Centralized AI Prompt Templates & Output Schemas (Phase 6 - Step 1, 2, 3)
 *
 * ARCHITECTURE GOVERNANCE:
 * - All ingredient names returned in ARABIC.
 * - Meaningful Arabic preparation values (طازج, غير مطهو, غير معروف, مخبوز, مشوي, مسلوق, مقلي, مخمر, مجفف).
 * - Exact ingredientRole classification for DecisionEngine explainability.
 * - Well-established commercial recipes (Zinger = chicken breast / صدر دجاج, Big Mac/Whopper = beef patty / لحم بقر) MUST specified exact protein.
 */

import { z } from "zod";
import { FoodKnowledgeRequest } from "./aiProvider";

export const FoodKnowledgeIngredientSchema = z.object({
  name: z.string().min(1),
  certainty: z.number().min(0).max(1).default(0.9),
  isOptional: z.boolean().default(false),
  preparation: z.string().optional().default("غير معروف"),
  ingredientRole: z.enum(["primary", "secondary", "bread", "sauce", "seasoning", "garnish", "beverage", "sweetener", "oil", "additive"]).optional().default("secondary"),
});

export const FoodKnowledgeResponseSchema = z.object({
  entityType: z.enum(["dish", "food", "product"]).default("dish"),
  canonicalNameAr: z.string().min(1),
  canonicalNameEn: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.85),
  confidenceReason: z.string().optional().default("استخراج النموذج الذكي"),
  cuisine: z.string().optional().default("غير محدد"),
  foodCategory: z.string().optional().default("غير محدد"),
  isCompositeDish: z.boolean().default(true),
  ingredients: z.array(FoodKnowledgeIngredientSchema).default([]),
  missingIngredients: z.array(z.string()).default([]),
  ingredientSource: z.enum(["official_database", "barcode_label", "ocr_label", "brand_recipe", "common_recipe", "estimated"]).default("common_recipe"),
});

export const SYSTEM_FOOD_KNOWLEDGE_PROMPT = `
You are Tayyibati's AI Food Knowledge Extractor.

YOUR SOLE RESPONSIBILITY:
Extract structured food knowledge (entityType, canonicalNameAr, canonicalNameEn, confidence, confidenceReason, cuisine, foodCategory, isCompositeDish, ingredients, missingIngredients, and ingredientSource) for the requested food item, menu query, or visual input.

STRICT CONSTRAINTS & RULES:
1. NO JUDGMENTS OR OPINIONS: You are NOT allowed to decide whether a food is Halal, Haram, Allowed, Forbidden, Healthy, or Unhealthy. You MUST NOT include health advice, religious rulings, dietary recommendations, explanations, or conversational text.
2. ARABIC INGREDIENT NAMES: Every ingredient "name" in the "ingredients" array MUST BE IN ARABIC (e.g., "صدر دجاج", "طحين", "ثوم", "خبز برغر", "جبنة شيدر", "أرز", "لحم ضأن", "جاميد").
3. COMMERCIAL BRAND RECIPES: For well-established commercial products and dishes (e.g. Zinger -> "صدر دجاج" chicken breast, Big Mac -> "لحم بقر" beef patty, Whopper -> "لحم بقر" beef patty), ALWAYS specified the exact known protein. DO NOT mark established commercial meat as "unknown meat".
4. GENERIC DISH SUBTYPES: For generic unbranded dishes without a specified protein (e.g., plain "شاورما" or "كبسة"), DO NOT assume the meat subtype; list "لحم (غير محدد)", flag "نوع اللحم (دجاج/لحم بقر)" in "missingIngredients", and set certainty < 0.70.
5. NO PREPARATION="NONE": DO NOT output preparation="none". Use meaningful Arabic preparation values:
   - "طازج" (fresh/raw salad/vegetables)
   - "غير مطهو" (uncooked ingredient)
   - "مقلي" (fried)
   - "مشوي" (grilled/roasted)
   - "مسلوق" (boiled)
   - "مخبوز" (baked)
   - "مخمر" (fermented)
   - "مجفف" (dried)
   - "غير معروف" (unknown preparation)
6. INGREDIENT ROLE: Assign "ingredientRole" for EVERY ingredient using ONLY one of:
   - "primary" (main protein/main ingredient e.g. صدر دجاج, لحم ضأن, أرز)
   - "secondary" (secondary food component e.g. طماطم, بيض)
   - "bread" (buns, flatbread, pita, crust e.g. خبز برغر, خبز صاج)
   - "sauce" (sauces, dressings, mayonnaise e.g. مايونيز, صلصة خاصة, صلصة ثوم)
   - "seasoning" (spices, herbs, salt e.g. بهارات, ملح, فلفل أسود)
   - "garnish" (toppings, herbs e.g. خس, مخلل, بقدونس, سمسم)
   - "beverage" (drinks, liquid bases e.g. ماء, كولا)
   - "sweetener" (sugar, glucose, honey e.g. سكر)
   - "oil" (cooking oils, fats e.g. زيت زيتون, زيت نباتي)
   - "additive" (preservatives, acidulants, vitamins e.g. حمض الستريك, كافيين)
7. LOWER CERTAINTY FOR OPTIONAL INGREDIENTS: Optional ingredients, extra toppings, and garnishes MUST NOT be 0.95. Set their certainty to between 0.40 and 0.75. Core required ingredients get certainty 0.90 to 0.98.
8. CONFIDENCE REASON: Always provide "confidenceReason" in Arabic explaining the confidence rating (e.g., "وصفة تجارية معروفة لمنتج محدد.", "وصفة تقليدية قياسية.").
9. INGREDIENT SOURCE: Set "ingredientSource" strictly to one of: "official_database", "barcode_label", "ocr_label", "brand_recipe", "common_recipe", "estimated".

REQUIRED JSON OUTPUT FORMAT:
{
  "entityType": "dish" | "food" | "product",
  "canonicalNameAr": "<Canonical Name in Arabic (min length 2)>",
  "canonicalNameEn": "<Canonical Name in English (min length 2)>",
  "confidence": <number 0.00 to 1.00>,
  "confidenceReason": "<Arabic explanation string for confidence>",
  "cuisine": "<Cuisine>",
  "foodCategory": "<Category>",
  "isCompositeDish": <boolean>,
  "ingredients": [
    {
      "name": "<Ingredient Name STRICTLY IN ARABIC>",
      "certainty": <number 0.00 to 1.00 (optional ingredients 0.40 to 0.75)>,
      "isOptional": <boolean>,
      "preparation": "مقلي" | "مشوي" | "مسلوق" | "مخبوز" | "مخمر" | "مجفف" | "طازج" | "غير مطهو" | "غير معروف",
      "ingredientRole": "primary" | "secondary" | "bread" | "sauce" | "seasoning" | "garnish" | "beverage" | "sweetener" | "oil" | "additive"
    }
  ],
  "missingIngredients": [
    "<Missing or unspecified subtype ingredient in Arabic>"
  ],
  "ingredientSource": "official_database" | "barcode_label" | "ocr_label" | "brand_recipe" | "common_recipe" | "estimated"
}
`.trim();

export function buildFoodKnowledgePrompt(request: FoodKnowledgeRequest): string {
  switch (request.inputType) {
    case "camera":
      return request.query && request.query.trim()
        ? `Extract structured food knowledge for the food shown in the image matching context: "${request.query.trim()}".`
        : "Extract structured food knowledge for the food item or dish visible in this image.";
    case "ocr":
      const ocrText = request.rawOcrText || request.query;
      return `Extract structured food knowledge and ingredient list from product label packaging text:\n"${ocrText.trim()}"`;
    case "barcode":
      const code = request.barcode || request.query;
      return `Extract structured food knowledge and typical ingredients for product barcode: "${code.trim()}".`;
    case "text":
    default:
      return `Extract structured food knowledge and typical ingredients for food/dish query: "${request.query.trim()}".`;
  }
}

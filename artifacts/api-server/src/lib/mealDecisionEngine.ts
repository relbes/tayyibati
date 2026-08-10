/**
 * Tayyibati Phase 8 - Step 3.3: Meal Decision Engine
 *
 * ARCHITECTURE GOVERNANCE:
 * - Pure structured business logic only.
 * - NO human-readable text generation (summaryReason removed).
 * - Human-readable text generation belongs strictly to ExplanationEngine.
 */

import { IngredientDecisionItem } from "./decisionEngine";

export interface MealDecisionItemRef {
  input: string;
  canonicalName: string;
  canonicalId: number | string;
  status: "allowed" | "forbidden" | "conditional" | "unknown";
}

export interface MealDecisionBreakdown {
  forbidden: MealDecisionItemRef[];
  conditional: MealDecisionItemRef[];
  allowed: MealDecisionItemRef[];
  unknown: MealDecisionItemRef[];
}

export interface MealDecision {
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  forbiddenCount: number;
  conditionalCount: number;
  allowedCount: number;
  unknownCount: number;
  totalIngredients: number;
  breakdown: MealDecisionBreakdown;
}

export class MealDecisionEngine {
  /**
   * Aggregate an array of individual ingredientDecisions into a structured top-level MealDecision
   */
  public static evaluateMeal(ingredientDecisions: IngredientDecisionItem[]): MealDecision {
    const items = ingredientDecisions || [];
    const totalIngredients = items.length;

    const breakdown: MealDecisionBreakdown = {
      forbidden: [],
      conditional: [],
      allowed: [],
      unknown: [],
    };

    for (const item of items) {
      const ref: MealDecisionItemRef = {
        input: item.input,
        canonicalName: item.canonicalName,
        canonicalId: item.canonicalId,
        status: item.status,
      };

      if (item.status === "forbidden") {
        breakdown.forbidden.push(ref);
      } else if (item.status === "conditional") {
        breakdown.conditional.push(ref);
      } else if (item.status === "allowed") {
        breakdown.allowed.push(ref);
      } else {
        breakdown.unknown.push(ref);
      }
    }

    const forbiddenCount = breakdown.forbidden.length;
    const conditionalCount = breakdown.conditional.length;
    const allowedCount = breakdown.allowed.length;
    const unknownCount = breakdown.unknown.length;

    let status: "allowed" | "forbidden" | "conditional" | "unknown" = "allowed";

    if (forbiddenCount > 0) {
      status = "forbidden";
    } else if (conditionalCount > 0) {
      status = "conditional";
    } else if (totalIngredients === 0 || (unknownCount > 0 && allowedCount === 0)) {
      status = "unknown";
    }

    return {
      status,
      forbiddenCount,
      conditionalCount,
      allowedCount,
      unknownCount,
      totalIngredients,
      breakdown,
    };
  }
}

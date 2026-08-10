/**
 * Tayyibati Phase 10.3 - Explanation Framework (STABLE & FROZEN CONTRACT)
 *
 * ARCHITECTURE GOVERNANCE:
 * - Pure presentation-independent data provider.
 * - Answers ONLY: "What happened?" (NEVER "What should the user see?").
 * - Contract Invariant: `status` and `reasonCode` MUST always agree.
 * - Allowed Mappings:
 *     status = "allowed"     --> "ONLY_ALLOWED_INGREDIENTS"
 *     status = "forbidden"   --> "FORBIDDEN_INGREDIENTS"
 *     status = "conditional" --> "CONDITIONAL_INGREDIENTS_PRESENT"
 *     status = "unknown"     --> "UNKNOWN_MEAL_STATUS" | "UNKNOWN_INGREDIENTS_PRESENT" | "PARTIAL_ANALYSIS" | "NO_INGREDIENTS_FOUND"
 * - Official frozen backend contract consumed by Mobile UI.
 */

import { IngredientDecisionItem } from "./decisionEngine";
import { MealDecision } from "./mealDecisionEngine";

export type CanonicalId = number;

export type ExplanationReasonCode =
  | "FORBIDDEN_INGREDIENTS"
  | "ONLY_ALLOWED_INGREDIENTS"
  | "CONDITIONAL_INGREDIENTS_PRESENT"
  | "UNKNOWN_INGREDIENTS_PRESENT"
  | "PARTIAL_ANALYSIS"
  | "NO_INGREDIENTS_FOUND"
  | "UNKNOWN_MEAL_STATUS";

export interface ExplanationStatistics {
  totalIngredients: number;
  forbiddenCount: number;
  allowedCount: number;
  conditionalCount: number;
  unresolvedCount: number;
}

export interface ExplanationModel {
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  reasonCode: ExplanationReasonCode;
  forbiddenIngredientIds: CanonicalId[];
  allowedIngredientIds: CanonicalId[];
  conditionalIngredientIds: CanonicalId[];
  unresolvedIngredientInputs: string[];
  statistics: ExplanationStatistics;
}

export class ExplanationFramework {
  /**
   * Builds a structured, presentation-independent ExplanationModel from decision outputs.
   */
  public static generateExplanation(
    mealDecision: MealDecision | null | undefined,
    ingredientDecisions: IngredientDecisionItem[] | null | undefined,
    canonicalResult?: any
  ): ExplanationModel {
    const items = ingredientDecisions || [];

    const forbiddenIngredientIds: CanonicalId[] = [];
    const allowedIngredientIds: CanonicalId[] = [];
    const conditionalIngredientIds: CanonicalId[] = [];
    const unresolvedIngredientInputs: string[] = [];

    for (const item of items) {
      const numericId = typeof item.canonicalId === "string" ? parseInt(item.canonicalId, 10) : item.canonicalId;

      if (item.status === "forbidden") {
        if (numericId && numericId !== 0 && !isNaN(numericId)) {
          forbiddenIngredientIds.push(numericId);
        }
      } else if (item.status === "conditional") {
        if (numericId && numericId !== 0 && !isNaN(numericId)) {
          conditionalIngredientIds.push(numericId);
        }
      } else if (item.status === "allowed") {
        if (numericId && numericId !== 0 && !isNaN(numericId)) {
          allowedIngredientIds.push(numericId);
        }
      } else {
        if (item.input) {
          unresolvedIngredientInputs.push(item.input);
        }
      }
    }

    const forbiddenCount = forbiddenIngredientIds.length;
    const conditionalCount = conditionalIngredientIds.length;
    const allowedCount = allowedIngredientIds.length;
    const unresolvedCount = unresolvedIngredientInputs.length;
    const totalIngredients = items.length;

    const statistics: ExplanationStatistics = {
      totalIngredients,
      forbiddenCount,
      allowedCount,
      conditionalCount,
      unresolvedCount,
    };

    const status: "allowed" | "forbidden" | "conditional" | "unknown" =
      mealDecision?.status ||
      (forbiddenCount > 0
        ? "forbidden"
        : conditionalCount > 0
        ? "conditional"
        : totalIngredients > 0 && allowedCount === totalIngredients
        ? "allowed"
        : "unknown");

    let reasonCode: ExplanationReasonCode = "ONLY_ALLOWED_INGREDIENTS";

    if (totalIngredients === 0) {
      reasonCode = "NO_INGREDIENTS_FOUND";
    } else if (status === "forbidden" || forbiddenCount > 0) {
      reasonCode = "FORBIDDEN_INGREDIENTS";
    } else if (status === "conditional" || conditionalCount > 0) {
      reasonCode = "CONDITIONAL_INGREDIENTS_PRESENT";
    } else if (status === "unknown" && unresolvedCount > 0 && allowedCount > 0) {
      reasonCode = "PARTIAL_ANALYSIS";
    } else if (status === "unknown" && unresolvedCount > 0) {
      reasonCode = "UNKNOWN_INGREDIENTS_PRESENT";
    } else if (status === "unknown") {
      reasonCode = "UNKNOWN_MEAL_STATUS";
    } else {
      reasonCode = "ONLY_ALLOWED_INGREDIENTS";
    }

    return {
      status,
      reasonCode,
      forbiddenIngredientIds,
      allowedIngredientIds,
      conditionalIngredientIds,
      unresolvedIngredientInputs,
      statistics,
    };
  }
}

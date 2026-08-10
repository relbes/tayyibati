export interface MealDecisionItemVM {
  input: string;
  canonicalName: string;
  canonicalId: number | string;
  status: "allowed" | "forbidden" | "conditional" | "unknown";
}

export interface MealDecisionBreakdownVM {
  forbidden: MealDecisionItemVM[];
  conditional: MealDecisionItemVM[];
  allowed: MealDecisionItemVM[];
  unknown: MealDecisionItemVM[];
}

export interface MealDecisionVM {
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  forbiddenCount: number;
  conditionalCount: number;
  allowedCount: number;
  unknownCount: number;
  totalIngredients: number;
  breakdown: MealDecisionBreakdownVM;
}

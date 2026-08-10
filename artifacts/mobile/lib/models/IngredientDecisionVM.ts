export interface IngredientDecisionVM {
  input: string;
  canonicalId: number | string;
  canonicalName: string;
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  reason?: string;
  source?: string;
  searchMethod?: string;
  confidence?: number;
}

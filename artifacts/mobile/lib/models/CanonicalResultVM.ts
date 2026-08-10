export interface CanonicalResultVM {
  canonicalId: number | string;
  canonicalName: string;
  canonicalEntityType: "food" | "dish" | "product";
  searchOutcome: string;
  confidence: number;
  searchMethod: string;
}

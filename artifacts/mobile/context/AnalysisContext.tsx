import React, { createContext, useContext, useState } from "react";

export type IngredientFrequency = "basic" | "daily" | "weekly" | "occasional" | null;

export interface IngredientResult {
  id?: number | string;
  name: string;
  nameAr: string;
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  frequency?: IngredientFrequency;
  reason?: string | null;
  notes?: string | null;
  dbReason?: string | null;
  dbNotes?: string | null;
  matchType?: string;
  rawNameAr?: string | null;
  rawNameEn?: string | null;
  confidence?: string;
  observationProvenance?: string;
  inferenceProvenance?: string;
  evidenceClass?: string;
}

export interface DishAnalysisPayload {
  dish: {
    id: number | null;
    nameAr: string;
    nameEn: string | null;
    category: string | null;
    countryOrigins: string[];
  } | null;
  ingredientAnalysis: IngredientResult[];
  allowedIngredients: IngredientResult[];
  forbiddenIngredients: IngredientResult[];
  conditionalIngredients: IngredientResult[];
  unknownIngredients: IngredientResult[];
  recognitionStats: {
    totalDetected: number;
    totalResolved: number;
    totalUnknown: number;
    recognitionPercentage: number;
  };
  finalCompatibility: "allowed" | "forbidden" | "conditional" | "unknown";
  explanation: {
    summaryAr: string;
    summaryEn: string;
    detailedReasonAr: string;
    detailedReasonEn: string;
  };
}

export interface AnalysisReport {
  query: string;
  resultMode?: "EXACT_FOOD" | "GENERAL_RULE" | "GENERAL_RULE_EXCEPTIONS" | "SPECIFIC_INHERITED" | "MIXED_CATEGORY" | "COMPOSITE_FOOD" | "UNKNOWN_FOOD";
  dishAnalysis?: DishAnalysisPayload;

  primaryRuling?: {
    status: "allowed" | "forbidden" | "conditional" | "unknown";
    nameAr: string;
    nameEn: string;
    dbReason: string | null;
    dbNotes: string | null;
    isInherited: boolean;
    inheritsFrom?: { nameAr: string; nameEn: string };
  };

  subtypes?: {
    allowed: IngredientResult[];
    forbidden: IngredientResult[];
    conditional: IngredientResult[];
  };

  categoryItems?: {
    allowed: IngredientResult[];
    forbidden: IngredientResult[];
    conditional: IngredientResult[];
  };

  ingredients?: IngredientResult[];

  compatibilityScore: number | null;
  /** 0-100: fraction of all ingredients that are known (known/total). Drops when unknowns exist. */
  ingredientConfidence?: number | null;
  scoreAvailable?: boolean;

  allowed: IngredientResult[];
  forbidden: IngredientResult[];
  conditional: IngredientResult[];
  unknown: IngredientResult[];
  explanation: string;
  suggestions: string[];
  analysisType: "text" | "image" | "label";
  notFound?: boolean;
  overallConfidence?: "HIGH" | "MEDIUM" | "LOW";
  overallConfidenceReasonCode?: string;
  imageRecognition?: {
    status: "CONFIDENT" | "AMBIGUOUS" | "UNKNOWN" | "INSUFFICIENT_IMAGE";
    imageType: "SINGLE_FOOD" | "MULTIPLE_FOODS" | "DISH" | "PACKAGED_PRODUCT" | "AMBIGUOUS";
    candidates: {
      nameAr: string;
      nameEn: string;
      recognitionScore: number;
      resolution?: {
        resolved: boolean;
        canonicalNameAr: string;
        canonicalNameEn: string;
        resolutionType: string;
      };
    }[];
    visibleComponents: string[];
    likelyIngredients: string[];
    confirmedIngredients: string[];
  };

  // Phase 8 backend properties
  aiKnowledge?: {
    entityType: "dish" | "food" | "product";
    canonicalName: string;
    confidence: number;
    ingredients: string[];
  };
  resolvedIngredients?: {
    input: string;
    searchOutcome: "FOUND" | "AMBIGUOUS" | "NOT_FOUND";
    canonicalId: number | string;
    canonicalEntityType: "food" | "dish" | "product";
    canonicalName: string;
    confidence: number;
    matchedAlias: string | null;
    searchMethod: string;
  }[];
  ingredientDecisions?: {
    input: string;
    canonicalId: number | string;
    canonicalName: string;
    status: "allowed" | "forbidden" | "conditional" | "unknown";
    reason: string;
    source: string;
  }[];
  mealDecision?: {
    status: "allowed" | "forbidden" | "conditional" | "unknown";
    forbiddenCount: number;
    conditionalCount: number;
    allowedCount: number;
    unknownCount: number;
    totalIngredients: number;
    breakdown: {
      forbidden: { input: string; canonicalName: string; canonicalId: number | string; status: "allowed" | "forbidden" | "conditional" | "unknown" }[];
      conditional: { input: string; canonicalName: string; canonicalId: number | string; status: "allowed" | "forbidden" | "conditional" | "unknown" }[];
      allowed: { input: string; canonicalName: string; canonicalId: number | string; status: "allowed" | "forbidden" | "conditional" | "unknown" }[];
      unknown: { input: string; canonicalName: string; canonicalId: number | string; status: "allowed" | "forbidden" | "conditional" | "unknown" }[];
    };
  };
  canonicalResult?: {
    canonicalId: number | string;
    canonicalName: string;
    canonicalEntityType: "food" | "dish" | "product";
    searchOutcome: string;
    confidence: number;
    searchMethod: string;
  } | null;
}

interface AnalysisContextType {
  currentReport: AnalysisReport | null;
  setCurrentReport: (r: AnalysisReport | null) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (v: boolean) => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [currentReport, setCurrentReport] = useState<AnalysisReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  return (
    <AnalysisContext.Provider value={{ currentReport, setCurrentReport, isAnalyzing, setIsAnalyzing }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
}

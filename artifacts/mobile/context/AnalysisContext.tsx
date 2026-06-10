import React, { createContext, useContext, useState } from "react";

export type IngredientFrequency = "basic" | "daily" | "weekly" | "occasional" | null;

export interface IngredientResult {
  name: string;
  nameAr: string;
  status: "allowed" | "forbidden" | "conditional" | "unknown";
  frequency?: IngredientFrequency;
  reason?: string | null;
}

export interface AnalysisReport {
  query: string;
  compatibilityScore: number;
  allowed: IngredientResult[];
  forbidden: IngredientResult[];
  conditional: IngredientResult[];
  unknown: IngredientResult[];
  explanation: string;
  suggestions: string[];
  analysisType: "text" | "image" | "label";
  notFound?: boolean;
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

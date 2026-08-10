import type { IngredientDecisionVM } from "./IngredientDecisionVM";
import type { MealDecisionVM, MealDecisionItemVM } from "./MealDecisionVM";
import type { CanonicalResultVM } from "./CanonicalResultVM";
import type { AnalysisReport } from "@/context/AnalysisContext";

export interface AnalysisResultViewModel {
  inputType: "text" | "camera";
  originalInput: string;
  recognizedName: string;
  analysis?: AnalysisReport | null;
  ingredientDecisions: IngredientDecisionVM[];
  mealDecision: MealDecisionVM | null;
  canonicalResult?: CanonicalResultVM | null;
}

/**
 * Pure adapter function to transform an AnalysisReport into a clean AnalysisResultViewModel
 */
export function createAnalysisResultViewModel(
  report: AnalysisReport
): AnalysisResultViewModel {
  const inputType: "text" | "camera" =
    report.analysisType === "image" || (report as { inputType?: string }).inputType === "camera"
      ? "camera"
      : "text";

  const rawCanonical = report.canonicalResult as any;

  const recognizedName =
    report.aiKnowledge?.canonicalName ||
    rawCanonical?.canonical_name ||
    rawCanonical?.canonicalName ||
    report.primaryRuling?.nameAr ||
    report.query ||
    "مأكولات ومشروبات";

  const originalInput = report.query || recognizedName;

  const rawDecisions = report.ingredientDecisions || [];
  const rawResolved = report.resolvedIngredients || [];

  const ingredientDecisions: IngredientDecisionVM[] =
    rawDecisions.length > 0
      ? rawDecisions.map((d, i) => {
          const res = rawResolved[i];
          return {
            input: d.input,
            canonicalId: d.canonicalId,
            canonicalName: d.canonicalName,
            status: d.status,
            reason: d.reason,
            source: d.source,
            searchMethod: res?.searchMethod || "canonical_search",
            confidence: res?.confidence || 100,
          };
        })
      : rawResolved.map((res) => ({
          input: res.input,
          canonicalId: res.canonicalId,
          canonicalName: res.canonicalName,
          status: "unknown" as const,
          reason: "مكون غير مفسر",
          source: res.canonicalEntityType || "resolved",
          searchMethod: res.searchMethod,
          confidence: res.confidence,
        }));

  // Fallback map if both raw arrays are empty
  const finalDecisions: IngredientDecisionVM[] =
    ingredientDecisions.length > 0
      ? ingredientDecisions
      : [
          ...(report.forbidden || []).map((i) => ({
            input: i.rawNameAr || i.nameAr || i.name,
            canonicalId: i.id || 0,
            canonicalName: i.nameAr || i.name,
            status: "forbidden" as const,
            reason: i.dbReason || i.reason || "",
            source: "foods",
          })),
          ...(report.conditional || []).map((i) => ({
            input: i.rawNameAr || i.nameAr || i.name,
            canonicalId: i.id || 0,
            canonicalName: i.nameAr || i.name,
            status: "conditional" as const,
            reason: i.dbReason || i.reason || "",
            source: "foods",
          })),
          ...(report.allowed || []).map((i) => ({
            input: i.rawNameAr || i.nameAr || i.name,
            canonicalId: i.id || 0,
            canonicalName: i.nameAr || i.name,
            status: "allowed" as const,
            reason: i.dbReason || i.reason || "",
            source: "foods",
          })),
          ...(report.unknown || []).map((i) => ({
            input: i.rawNameAr || i.nameAr || i.name,
            canonicalId: i.id || 0,
            canonicalName: i.nameAr || i.name,
            status: "unknown" as const,
            reason: i.dbReason || i.reason || "",
            source: "unknown",
          })),
        ];

  const mealDecision: MealDecisionVM | null =
    report.mealDecision ||
    (report.primaryRuling
      ? {
          status: report.primaryRuling.status,
          forbiddenCount: report.forbidden?.length || 0,
          conditionalCount: report.conditional?.length || 0,
          allowedCount: report.allowed?.length || 0,
          unknownCount: report.unknown?.length || 0,
          totalIngredients: finalDecisions.length,
          breakdown: {
            forbidden: (report.forbidden || []).map((f): MealDecisionItemVM => ({
              input: f.rawNameAr || f.nameAr || f.name,
              canonicalName: f.nameAr || f.name,
              canonicalId: f.id || 0,
              status: "forbidden" as const,
            })),
            conditional: (report.conditional || []).map((c): MealDecisionItemVM => ({
              input: c.rawNameAr || c.nameAr || c.name,
              canonicalName: c.nameAr || c.name,
              canonicalId: c.id || 0,
              status: "conditional" as const,
            })),
            allowed: (report.allowed || []).map((a): MealDecisionItemVM => ({
              input: a.rawNameAr || a.nameAr || a.name,
              canonicalName: a.nameAr || a.name,
              canonicalId: a.id || 0,
              status: "allowed" as const,
            })),
            unknown: (report.unknown || []).map((u): MealDecisionItemVM => ({
              input: u.rawNameAr || u.nameAr || u.name,
              canonicalName: u.nameAr || u.name,
              canonicalId: u.id || 0,
              status: "unknown" as const,
            })),
          },
        }
      : null);

  const canonicalResult: CanonicalResultVM | null = rawCanonical
    ? {
        canonicalId: rawCanonical.canonicalId || rawCanonical.canonical_id || 0,
        canonicalName: rawCanonical.canonicalName || rawCanonical.canonical_name || "",
        canonicalEntityType: rawCanonical.canonicalEntityType || rawCanonical.entity_type || "food",
        searchOutcome: rawCanonical.searchOutcome || rawCanonical.matchType || "FOUND",
        confidence: rawCanonical.confidence || rawCanonical.searchConfidence || 100,
        searchMethod: rawCanonical.searchMethod || rawCanonical.search_method || "canonical_search",
      }
    : null;

  return {
    inputType,
    originalInput,
    recognizedName,
    analysis: report,
    ingredientDecisions: finalDecisions,
    mealDecision,
    canonicalResult,
  };
}

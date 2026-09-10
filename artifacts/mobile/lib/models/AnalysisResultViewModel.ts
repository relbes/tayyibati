import type { IngredientDecisionVM } from "./IngredientDecisionVM";
import type { MealDecisionVM, MealDecisionItemVM } from "./MealDecisionVM";
import type { CanonicalResultVM } from "./CanonicalResultVM";
import type { AnalysisReport, IngredientResult, ReportIngredientDecision, ReportResolvedIngredient } from "../../context/AnalysisContext";

import { extractBaseEntityWithModifiers } from "../../../api-server/src/lib/arabicNormalization";

export type ResultPresentationMode = "GENERIC_FOOD_FAMILY" | "SPECIFIC_FOOD" | "DISH" | "NOT_FOUND";

export interface FoodFamilyMemberVM {
  nameAr: string;
  nameEn?: string;
  status: "allowed" | "forbidden" | "conditional";
  reason?: string;
  notes?: string;
}

export interface FoodFamilyViewModel {
  familyName: string;
  familyStatus: "allowed" | "forbidden" | "conditional" | "mixed";
  summaryText: string;
  allowedVariants: FoodFamilyMemberVM[];
  forbiddenVariants: FoodFamilyMemberVM[];
  conditionalVariants: FoodFamilyMemberVM[];
}

export interface AnalysisResultViewModel {
  inputType: "text" | "camera";
  originalInput: string;
  recognizedName: string;
  presentationMode: ResultPresentationMode;
  familyViewModel?: FoodFamilyViewModel | null;
  familyData?: FoodFamilyViewModel | null;
  analysis?: AnalysisReport | null;
  ingredientDecisions: IngredientDecisionVM[];
  mealDecision: MealDecisionVM | null;
  canonicalResult?: CanonicalResultVM | null;
  /** Smart fallback suggestions — only populated when presentationMode is NOT_FOUND */
  fallbackSuggestions?: Array<{
    canonicalId: number;
    canonicalEntityType: "food" | "dish";
    nameAr: string;
    nameEn: string;
  }>;
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
    (report as any).displayQuery ||
    report.query ||
    report.primaryRuling?.nameAr ||
    rawCanonical?.canonical_name ||
    rawCanonical?.canonicalName ||
    report.aiKnowledge?.canonicalName ||
    "مأكولات ومشروبات";

  const originalInput = report.query || recognizedName;

  const rawDecisions = report.ingredientDecisions || [];
  const rawResolved = report.resolvedIngredients || [];

  const ingredientDecisions: IngredientDecisionVM[] =
    rawDecisions.length > 0
      ? rawDecisions.map((d: ReportIngredientDecision, i: number) => {
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
      : rawResolved.map((res: ReportResolvedIngredient) => ({
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
          ...(report.forbidden || []).map((i: IngredientResult) => ({
            input: i.rawNameAr || i.nameAr || i.name,
            canonicalId: i.id || 0,
            canonicalName: i.nameAr || i.name,
            status: "forbidden" as const,
            reason: i.dbReason || i.reason || "",
            source: "foods",
          })),
          ...(report.conditional || []).map((i: IngredientResult) => ({
            input: i.rawNameAr || i.nameAr || i.name,
            canonicalId: i.id || 0,
            canonicalName: i.nameAr || i.name,
            status: "conditional" as const,
            reason: i.dbReason || i.reason || "",
            source: "foods",
          })),
          ...(report.allowed || []).map((i: IngredientResult) => ({
            input: i.rawNameAr || i.nameAr || i.name,
            canonicalId: i.id || 0,
            canonicalName: i.nameAr || i.name,
            status: "allowed" as const,
            reason: i.dbReason || i.reason || "",
            source: "foods",
          })),
          ...(report.unknown || []).map((i: IngredientResult) => ({
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
            forbidden: (report.forbidden || []).map((f: IngredientResult): MealDecisionItemVM => ({
              input: f.rawNameAr || f.nameAr || f.name,
              canonicalName: f.nameAr || f.name,
              canonicalId: f.id || 0,
              status: "forbidden" as const,
            })),
            conditional: (report.conditional || []).map((c: IngredientResult): MealDecisionItemVM => ({
              input: c.rawNameAr || c.nameAr || c.name,
              canonicalName: c.nameAr || c.name,
              canonicalId: c.id || 0,
              status: "conditional" as const,
            })),
            allowed: (report.allowed || []).map((a: IngredientResult): MealDecisionItemVM => ({
              input: a.rawNameAr || a.nameAr || a.name,
              canonicalName: a.nameAr || a.name,
              canonicalId: a.id || 0,
              status: "allowed" as const,
            })),
            unknown: (report.unknown || []).map((u: IngredientResult): MealDecisionItemVM => ({
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

  // -------------------------------------------------------------------------
  // Presentation Mode Classification
  // -------------------------------------------------------------------------
  let presentationMode: ResultPresentationMode = "SPECIFIC_FOOD";
  let familyViewModel: FoodFamilyViewModel | null = null;

  if ((report.notFound || report.resultMode === "NOT_FOUND") && !report.needsClarification && !(report.suggestions && report.suggestions.length > 0)) {
    presentationMode = "NOT_FOUND";
  } else if (
    report.resultMode === "COMPOSITE_FOOD" ||
    report.resultMode === "MULTIPLE_DISHES" ||
    report.needsClarification ||
    report.analysisType === "image" ||
    report.analysisType === "label" ||
    (report as any).entityType === "dish" ||
    (report as any).dish !== undefined
  ) {
    presentationMode = "DISH";
  } else if (report.resultMode === "EXACT_FOOD") {
    const hasFamilyData =
      Boolean((report as any).familySummary) ||
      Boolean((report as any).familyStatus) ||
      Boolean((report as any).allowedExceptions?.length) ||
      Boolean((report as any).prohibitedExceptions?.length) ||
      Boolean((report as any).forbiddenExceptions?.length);

    const queryText = (report as any).displayQuery || report.query || "";
    const baseWithMod = extractBaseEntityWithModifiers(queryText);
    const hasModifiers = Boolean(baseWithMod && baseWithMod.modifiers && baseWithMod.modifiers.length > 0);

    const isGenericFamily = hasFamilyData && !hasModifiers;

    if (isGenericFamily) {
      presentationMode = "GENERIC_FOOD_FAMILY";

      const allowedVariants: FoodFamilyMemberVM[] = (report.allowed || []).map((i: IngredientResult) => ({
        nameAr: i.nameAr || i.name || "",
        nameEn: i.rawNameEn || undefined,
        status: "allowed" as const,
        reason: (i.dbReason || i.reason) || undefined,
        notes: i.notes || undefined,
      }));

      const forbiddenVariants: FoodFamilyMemberVM[] = (report.forbidden || []).map((i: IngredientResult) => ({
        nameAr: i.nameAr || i.name || "",
        nameEn: i.rawNameEn || undefined,
        status: "forbidden" as const,
        reason: (i.dbReason || i.reason) || undefined,
        notes: i.notes || undefined,
      }));

      const conditionalVariants: FoodFamilyMemberVM[] = (report.conditional || []).map((i: IngredientResult) => ({
        nameAr: i.nameAr || i.name || "",
        nameEn: i.rawNameEn || undefined,
        status: "conditional" as const,
        reason: (i.dbReason || i.reason) || undefined,
        notes: i.notes || undefined,
      }));

      const rawFamilyStatus = (report as any).familyStatus || report.primaryRuling?.status || "allowed";
      let familyStatus: "allowed" | "forbidden" | "conditional" | "mixed" = rawFamilyStatus as any;

      if (allowedVariants.length > 0 && (forbiddenVariants.length > 0 || conditionalVariants.length > 0)) {
        familyStatus = "mixed";
      }

      const summaryText =
        (report as any).familySummary ||
        report.explanation ||
        report.primaryRuling?.dbReason ||
        "حالة هذه الفئة من الأطعمة وفق نظام الطيباتي.";

      familyViewModel = {
        familyName: recognizedName,
        familyStatus,
        summaryText,
        allowedVariants,
        forbiddenVariants,
        conditionalVariants,
      };
    } else {
      presentationMode = "SPECIFIC_FOOD";
    }
  }

  return {
    inputType,
    originalInput,
    recognizedName,
    presentationMode,
    familyViewModel,
    familyData: familyViewModel,
    analysis: report,
    ingredientDecisions: finalDecisions,
    mealDecision,
    canonicalResult,
    // Propagate smart fallback suggestions when the report is NOT_FOUND
    fallbackSuggestions: report.fallbackSuggestions ?? undefined,
  };
}

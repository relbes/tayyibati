/**
 * Tayyibati Universal Explanation Engine (Phase 6.5)
 *
 * ARCHITECTURE GOVERNANCE:
 * - See docs/EXPLANATION_ENGINE.md
 * - See docs/ANALYSIS_PIPELINE_SPEC.md (Stage 9: Universal Explanation Engine)
 * - See docs/ARCHITECTURE_RULES.md (Rule 7: Explainability)
 * - See docs/ENGINEERING_PRINCIPLES.md (Presentation Layer Only, Pure Template Rendering)
 *
 * MANDATE:
 * - Pure PRESENTATION LAYER converting structured DecisionEngineOutput into human-readable explanations.
 * - MUST NOT recalculate compatibility, change decisions/scores, query DB, or call AI.
 * - Supports ExplanationMode (SHORT, NORMAL, DETAILED).
 * - Supports ExplanationAudience (USER, EDUCATIONAL, ADMIN, DEBUG).
 * - Supports Multilingual Rendering (ar, en).
 */

import type { DecisionEngineOutput, DecisionCategory, DecisionIngredient } from "./decisionEngine";

export type ExplanationMode = "SHORT" | "NORMAL" | "DETAILED";
export type ExplanationAudience = "USER" | "EDUCATIONAL" | "ADMIN" | "DEBUG";
export type ExplanationLanguage = "ar" | "en";
export type SeverityLevel = "SUCCESS" | "INFO" | "WARNING" | "ERROR";

export interface ExplanationOptions {
  mode?: ExplanationMode;
  audience?: ExplanationAudience;
  language?: ExplanationLanguage;
}

export interface ExplanationSection {
  id: string;
  title: string;
  content: string;
  severity: SeverityLevel;
}

export interface ExplanationEngineOutput {
  explanationMode: ExplanationMode;
  explanationAudience: ExplanationAudience;
  language: ExplanationLanguage;
  headline: string;
  summary: string;
  severity: SeverityLevel;
  sections: ExplanationSection[];
  ingredientExplanation: string;
  criticalIngredientExplanation: string;
  confidenceExplanation: string;
  warnings: string[];
  recommendations: string[];
  metadata: {
    engineVersion: string;
    renderedTimestamp: string;
    renderTimeMs: number;
    decisionMetadata: any;
  };
}

// Templates Dictionary (Language -> Category -> Mode -> Text)
const HEADLINE_TEMPLATES: Record<ExplanationLanguage, Record<DecisionCategory, string>> = {
  ar: {
    ALLOWED: "الطعام متوافق",
    FORBIDDEN: "الطعام غير متوافق",
    CONDITIONAL: "متوافق بشروط",
    NEEDS_REVIEW: "يتطلب المراجعة",
    UNKNOWN: "غير معروف",
  },
  en: {
    ALLOWED: "Compatible",
    FORBIDDEN: "Not Compatible",
    CONDITIONAL: "Conditionally Compatible",
    NEEDS_REVIEW: "Needs Review",
    UNKNOWN: "Unknown",
  },
};

const SUMMARY_TEMPLATES: Record<ExplanationLanguage, Record<DecisionCategory, string>> = {
  ar: {
    ALLOWED: "جميع المكونات التي تم التعرف عليها متوافقة مع إرشادات نظام طيباتي.",
    FORBIDDEN: "هذه الوجبة غير متوافقة لأنها تحتوي على مكونات غير مسموحة في نظام طيباتي.",
    CONDITIONAL: "هذه الوجبة متوافقة بشروط وتتطلب الملاحظة أو الاستهلاك المعتدل.",
    NEEDS_REVIEW: "يتطلب هذا العنصر مراجعة إضافية لعدم التعرف القاطع على بعض المكونات.",
    UNKNOWN: "لم نتمكن من التعرف على أي مكونات كافية لإجراء التقييم.",
  },
  en: {
    ALLOWED: "All identified ingredients are fully compatible with Tayyibati guidelines.",
    FORBIDDEN: "This meal is not compatible because it contains ingredients that are forbidden under Tayyibati rules.",
    CONDITIONAL: "This meal is conditionally compatible and requires moderation or specific dietary notes.",
    NEEDS_REVIEW: "This item requires additional review because some ingredients could not be identified conclusively.",
    UNKNOWN: "Insufficient ingredient information to perform compatibility evaluation.",
  },
};

export class ExplanationEngine {
  /**
   * Deterministic Presentation Rendering executing Stage 9:
   * 1. Consumes DecisionEngineOutput without modifying decision or score
   * 2. Renders deterministic templates according to Language, ExplanationMode, and ExplanationAudience
   * 3. Assembles sections, warnings, recommendations, and evidence summaries
   */
  public static render(
    decisionOutput: DecisionEngineOutput,
    options?: ExplanationOptions
  ): ExplanationEngineOutput {
    const tStart = performance.now();

    const mode: ExplanationMode = options?.mode || "NORMAL";
    const audience: ExplanationAudience = options?.audience || "USER";
    const lang: ExplanationLanguage = options?.language || "ar";

    const decision = decisionOutput.finalDecision;
    const evidence = decisionOutput.decisionEvidence;
    const summary = decisionOutput.ingredientSummary;

    // 1. Headline & Severity
    const headline = HEADLINE_TEMPLATES[lang][decision] || HEADLINE_TEMPLATES[lang].UNKNOWN;
    const baseSummary = SUMMARY_TEMPLATES[lang][decision] || SUMMARY_TEMPLATES[lang].UNKNOWN;

    let severity: SeverityLevel = "INFO";
    if (decision === "ALLOWED") severity = "SUCCESS";
    else if (decision === "FORBIDDEN") severity = "ERROR";
    else if (decision === "CONDITIONAL" || decision === "NEEDS_REVIEW") severity = "WARNING";

    // 2. Critical Ingredient Explanation
    const criticals = evidence?.criticalIngredients || [];
    let criticalExplanation = "";
    if (criticals.length > 0) {
      const names = criticals.map((c) => (lang === "ar" ? c.canonicalFoodAr : c.canonicalFoodEn)).join("، ");
      if (decision === "FORBIDDEN") {
        criticalExplanation =
          lang === "ar"
            ? `السبب الرئيسي لعدم التوافق هو وجود المكونات التالية: ${names}.`
            : `The primary reason for non-compatibility is the presence of: ${names}.`;
      } else if (decision === "CONDITIONAL") {
        criticalExplanation =
          lang === "ar"
            ? `المكونات التي تتطلب رعاية خاصة هي: ${names}.`
            : `Ingredients requiring special attention: ${names}.`;
      } else if (decision === "NEEDS_REVIEW") {
        criticalExplanation =
          lang === "ar"
            ? `المكونات التي تتطلب المراجعة: ${names}.`
            : `Ingredients requiring review: ${names}.`;
      } else {
        criticalExplanation =
          lang === "ar"
            ? `المكونات الرئيسية المتوافقة: ${names}.`
            : `Primary compatible ingredients: ${names}.`;
      }
    } else {
      criticalExplanation =
        lang === "ar" ? "لا توجد مكونات حرجة مستهدفة." : "No specific critical ingredients targeted.";
    }

    // 3. Ingredient Group Explanation
    let ingredientExp = "";
    if (lang === "ar") {
      ingredientExp = `تم تحليل ${summary.totalIngredients} مكوناً (المسموح: ${summary.allowedCount}، الممنوع: ${summary.forbiddenCount}، المشروط: ${summary.conditionalCount}، غير معروف: ${summary.unknownCount}).`;
    } else {
      ingredientExp = `Analyzed ${summary.totalIngredients} ingredients (Allowed: ${summary.allowedCount}, Forbidden: ${summary.forbiddenCount}, Conditional: ${summary.conditionalCount}, Unknown: ${summary.unknownCount}).`;
    }

    // 4. Confidence Explanation
    const confScore = decisionOutput.decisionConfidence;
    let confExp = "";
    if (lang === "ar") {
      confExp =
        confScore >= 90
          ? `درجة موثوقية عالية جداً (${confScore}%).`
          : confScore >= 70
          ? `درجة موثوقية متوسطة (${confScore}%).`
          : `درجة موثوقية منخفضة (${confScore}%) تتطلب التدقيق.`;
    } else {
      confExp =
        confScore >= 90
          ? `Very high confidence level (${confScore}%).`
          : confScore >= 70
          ? `Moderate confidence level (${confScore}%).`
          : `Low confidence level (${confScore}%) requiring verification.`;
    }

    // 5. Sections Assembly based on ExplanationMode & ExplanationAudience
    const sections: ExplanationSection[] = [];

    sections.push({
      id: "summary_section",
      title: lang === "ar" ? "ملخص النتيجة" : "Result Summary",
      content: baseSummary,
      severity,
    });

    if (mode !== "SHORT") {
      sections.push({
        id: "critical_ingredients_section",
        title: lang === "ar" ? "المكونات المؤثرة" : "Influencing Ingredients",
        content: criticalExplanation,
        severity: decision === "FORBIDDEN" ? "ERROR" : decision === "CONDITIONAL" ? "WARNING" : "INFO",
      });

      sections.push({
        id: "ingredient_breakdown_section",
        title: lang === "ar" ? "تفاصيل المكونات" : "Ingredient Breakdown",
        content: ingredientExp,
        severity: "INFO",
      });
    }

    if (mode === "DETAILED" || audience === "EDUCATIONAL" || audience === "ADMIN" || audience === "DEBUG") {
      sections.push({
        id: "confidence_section",
        title: lang === "ar" ? "تقييم الموثوقية" : "Confidence Assessment",
        content: confExp,
        severity: confScore >= 70 ? "INFO" : "WARNING",
      });
    }

    // Additional Admin/Debug Sections
    if (audience === "ADMIN" || audience === "DEBUG") {
      sections.push({
        id: "admin_evidence_section",
        title: "Admin Evidence & Provenance",
        content: JSON.stringify(evidence, null, 2),
        severity: "INFO",
      });
    }

    if (audience === "DEBUG") {
      sections.push({
        id: "debug_metadata_section",
        title: "Debug Execution Metadata",
        content: JSON.stringify(decisionOutput.decisionMetadata, null, 2),
        severity: "INFO",
      });
    }

    // 6. Warnings Construction
    const warnings: string[] = [];
    if (summary.unknownCount > 0) {
      warnings.push(
        lang === "ar"
          ? `تنبيه: تعذر التعرف على ${summary.unknownCount} من المكونات.`
          : `Warning: Unable to identify ${summary.unknownCount} ingredient(s).`
      );
    }
    if (confScore < 70) {
      warnings.push(
        lang === "ar"
          ? "تنبيه: مستوى ثقة التقييم منخفض، يُنصح بالتحقق اليدوي."
          : "Warning: Assessment confidence is low, manual verification recommended."
      );
    }

    // 7. Recommendations
    const recommendations = (decisionOutput.recommendations || []).map((rec) => {
      if (lang === "ar") {
        if (rec === "Review ingredient list") return "يرجى مراجعة قائمة المكونات.";
        if (rec === "Search exact product") return "ابحث عن المنتج بالاسم الدقيق.";
        if (rec === "Retake photo") return "أعد التقاط صورة الوجبة وضّح الإضاءة.";
        if (rec === "Improve lighting") return "حسّن إضاءة التصوير.";
        if (rec === "Scan barcode") return "قم بمسح الباروكود مباشرة.";
      }
      return rec;
    });

    const durationMs = performance.now() - tStart;

    return {
      explanationMode: mode,
      explanationAudience: audience,
      language: lang,
      headline,
      summary: baseSummary,
      severity,
      sections,
      ingredientExplanation: ingredientExp,
      criticalIngredientExplanation: criticalExplanation,
      confidenceExplanation: confExp,
      warnings,
      recommendations,
      metadata: {
        engineVersion: "1.0.0",
        renderedTimestamp: new Date().toISOString(),
        renderTimeMs: Math.round(durationMs * 1000) / 1000,
        decisionMetadata: decisionOutput.decisionMetadata,
      },
    };
  }
}

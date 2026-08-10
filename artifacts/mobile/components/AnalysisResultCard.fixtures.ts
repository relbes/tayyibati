import type { AnalysisReport } from "@/context/AnalysisContext";

export const allowedExactFixture: AnalysisReport = {
  query: "توست ريتش بيك بالرَّدّة",
  compatibilityScore: 100,
  explanation: "مسموح به في نظام الطيبات (استثناء محدد لتوست الردة)",
  overallConfidence: "HIGH",
  overallConfidenceReasonCode: "EXACT_MATCH",
  allowed: [
    {
      id: 1001,
      nameAr: "توست ريتش بيك بالردة",
      name: "Rich Bake Bran Toast",
      status: "allowed",
      dbReason: "مسموح كاستثناء محدد لخبز الردة في نظام الطيبات.",
      dbNotes: "تأكد من شراء النوع الأصلي المسمى ريتش بيك بالردة.",
      matchType: "EXACT",
      confidence: "HIGH",
      observationProvenance: "TEXT_EXTRACTED",
    }
  ],
  forbidden: [],
  conditional: [],
  unknown: [],
  suggestions: [],
};

export const forbiddenExactFixture: AnalysisReport = {
  query: "لحم الخنزير",
  compatibilityScore: 0,
  explanation: "ممنوع تماماً في نظام الطيبات",
  overallConfidence: "HIGH",
  overallConfidenceReasonCode: "EXACT_MATCH",
  allowed: [],
  forbidden: [
    {
      id: 1,
      nameAr: "لحم الخنزير",
      name: "pork",
      status: "forbidden",
      dbReason: "ممنوع شرعاً - من أصل الخنزير",
      dbNotes: "يشمل ذلك جميع مشتقات الخنزير ودهونه وجيلاتينه.",
      matchType: "EXACT",
      confidence: "HIGH",
      observationProvenance: "TEXT_EXTRACTED",
    }
  ],
  conditional: [],
  unknown: [],
  suggestions: [],
};

export const conditionalFixture: AnalysisReport = {
  query: "الجيلاتين",
  compatibilityScore: 50,
  explanation: "مشروط بمصدر الجيلاتين وطريقة التحضير",
  overallConfidence: "HIGH",
  overallConfidenceReasonCode: "EXACT_MATCH",
  allowed: [],
  forbidden: [],
  conditional: [
    {
      id: 14,
      nameAr: "الجيلاتين",
      name: "gelatin",
      status: "conditional",
      dbReason: "يعتمد على المصدر - جيلاتين حيواني حلال مسموح، والجيلاتين البقري المذبوح ذبحاً شرعياً مسموح.",
      dbNotes: "تجنب الجيلاتين مجهول المصدر أو المستورد من دول غير إسلامية دون شهادة حلال.",
      matchType: "EXACT",
      confidence: "HIGH",
      observationProvenance: "TEXT_EXTRACTED",
    }
  ],
  unknown: [],
  suggestions: [],
};

export const parentFuzzyFixture: AnalysisReport = {
  query: "خبز أسمر",
  compatibilityScore: 100,
  explanation: "تم التقييم بالاعتماد على الصنف الرئيسي العام للخبز",
  overallConfidence: "MEDIUM",
  overallConfidenceReasonCode: "PARENT_ENTITY",
  allowed: [
    {
      id: 38,
      nameAr: "القمح",
      name: "wheat",
      status: "allowed",
      dbReason: "القمح كحبوب مسموح به في النظام الغذائي.",
      dbNotes: "تنبيه: تم المطابقة مع الصنف العام للخبز؛ قد تختلف المكونات الفعلية للمنتج التجاري.",
      matchType: "PARENT_ENTITY",
      rawNameAr: "خبز أسمر",
      nameAr: "خبز",
      confidence: "MEDIUM",
      observationProvenance: "TEXT_EXTRACTED",
    }
  ],
  forbidden: [],
  conditional: [],
  unknown: [],
  suggestions: [],
};

export const multiIngredientsFixture: AnalysisReport = {
  query: "خلطة بهارات اللحم ومضافات",
  compatibilityScore: 45,
  explanation: "يحتوي المنتج على بهارات مسموحة ولكنه يحتوي أيضاً على دهن خنزير وملون مشروط",
  overallConfidence: "HIGH",
  overallConfidenceReasonCode: "EXACT_MATCH",
  allowed: [
    {
      id: 56,
      nameAr: "الفلفل الأسود",
      name: "black pepper",
      status: "allowed",
      dbReason: "بهارات طبيعية مسموحة.",
      dbNotes: null,
      matchType: "EXACT",
      confidence: "HIGH",
      observationProvenance: "TEXT_EXTRACTED",
    },
    {
      id: 57,
      nameAr: "الكركم",
      name: "turmeric",
      status: "allowed",
      dbReason: "بهارات طبيعية مسموحة ومفيدة.",
      dbNotes: null,
      matchType: "EXACT",
      confidence: "HIGH",
      observationProvenance: "TEXT_EXTRACTED",
    }
  ],
  forbidden: [
    {
      id: 8,
      nameAr: "شحم الخنزير",
      name: "lard",
      status: "forbidden",
      dbReason: "من الخنزير وممنوع شرعاً.",
      dbNotes: null,
      matchType: "EXACT",
      confidence: "HIGH",
      observationProvenance: "TEXT_EXTRACTED",
    }
  ],
  conditional: [
    {
      id: 25,
      nameAr: "الكارمين",
      name: "carmine",
      status: "conditional",
      dbReason: "ملون غذائي مشتق من الدودة القرمزية - خلاف فقهي بين العلماء.",
      dbNotes: "يفضل تجنبه للاحتياط.",
      matchType: "EXACT",
      confidence: "HIGH",
      observationProvenance: "TEXT_EXTRACTED",
    }
  ],
  unknown: [],
  suggestions: [],
};

export const mixedLanguageFixture: AnalysisReport = {
  query: "خبز فرنسي French Bread",
  compatibilityScore: 0,
  explanation: "الخبز الفرنسي ممنوع نهائياً في نظام الطيبات",
  overallConfidence: "HIGH",
  overallConfidenceReasonCode: "EXACT_MATCH",
  allowed: [],
  forbidden: [
    {
      id: 1002,
      nameAr: "خبز فرنسي",
      name: "French Bread",
      status: "forbidden",
      dbReason: "جميع أنواع الخبز العادي ممنوعة في نظام الطيبات.",
      dbNotes: "الاستثناء الوحيد المسموح به هو توست ريتش بيك بالردة.",
      matchType: "EXACT",
      confidence: "HIGH",
      observationProvenance: "TEXT_EXTRACTED",
    }
  ],
  conditional: [],
  unknown: [],
  suggestions: [],
};

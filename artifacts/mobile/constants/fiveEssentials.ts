export interface EssentialFoodItem {
  id: number;
  numberAr: string;
  title: string;
  description: string;
}

export const FIVE_ESSENTIALS_DATA = {
  badgeTitle: "من الأساسيات الخمسة",
  togglePrompt: "ما هي الأساسيات الخمسة؟",
  authorIntro: "الأساسيات الخمسة في نظام الطيبات (للدكتور ضياء العوضي) هي الأطعمة التي تُعتبر حجر الأساس لبناء الطاقة والجسم بلا قيود كمية صارمة، وهي:",
  items: [
    {
      id: 1,
      numberAr: "١",
      title: "الأرز",
      description: "المصدر الرئيسي والآمن للكربوهيدرات.",
    },
    {
      id: 2,
      numberAr: "٢",
      title: "التمر",
      description: "يُستخدم كمصدر طبيعي للطاقة والمعادن.",
    },
    {
      id: 3,
      numberAr: "٣",
      title: "الدهون",
      description: "مثل الزبدة والسمن الطبيعي.",
    },
    {
      id: 4,
      numberAr: "٤",
      title: "البطاطا",
      description: "تُعد من النشويات الأساسية المسموحة والمريحة للمعدة.",
    },
    {
      id: 5,
      numberAr: "٥",
      title: "السكر",
      description: "السكر الطبيعي (مثل سكر القصب) وليس السكر الصناعي المكرر.",
    },
  ] as EssentialFoodItem[],
};

export function isFiveEssentialsReport(report: any): boolean {
  if (!report || report.notFound) return false;
  if (report.resultMode === "UNKNOWN_FOOD") return false;

  const checkText = (text?: string | null) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
      lower.includes("الأساسيات الخمسة") ||
      lower.includes("الاساسيات الخمسه") ||
      lower.includes("من الأساسيات") ||
      lower.includes("من الاساسيات") ||
      lower.includes("الأساسيات 5") ||
      lower.includes("الاساسيات 5")
    );
  };

  // Check primary ruling dbReason / dbNotes
  if (report.primaryRuling) {
    if (checkText(report.primaryRuling.dbReason) || checkText(report.primaryRuling.dbNotes)) {
      return true;
    }
  }

  // Check explanation
  if (checkText(report.explanation)) return true;

  // Check allowed/conditional items dbReason / dbNotes
  const allItems = [...(report.allowed || []), ...(report.conditional || [])];
  for (const item of allItems) {
    if (checkText(item.dbReason) || checkText(item.dbNotes) || checkText(item.reason) || checkText(item.notes)) {
      return true;
    }
  }

  // Check canonical core essential names
  const mainName = report.primaryRuling?.nameAr || report.query || "";
  const coreNames = ["الأرز", "الارز", "التمر", "الزبدة", "البطاطس", "البطاطا", "السكر الطبيعي", "السمنة البلدي"];
  if (coreNames.some((c) => mainName.includes(c))) {
    if (
      report.primaryRuling?.status === "allowed" ||
      report.primaryRuling?.status === "conditional" ||
      (report.allowed && report.allowed.length > 0)
    ) {
      return true;
    }
  }

  return false;
}

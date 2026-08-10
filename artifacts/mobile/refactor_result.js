const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'artifacts/mobile/components/AnalysisResultCard.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Imports
content = content.replace(
  /import \{ ArabicText, ArabicParagraph \} from "\.\/ArabicText";/,
  `import { LocalizedText, LocalizedParagraph } from "./LocalizedText";`
);
content = content.replace(
  /import \{ rtlRow, ltrText \} from "@\/lib\/rtl";/,
  `import { localizedRow, ltrText } from "@/lib/layoutDirection";\nimport { t, getLocalizedFoodName } from "@/lib/i18n";`
);

// Tags
content = content.replace(/<ArabicText/g, '<LocalizedText');
content = content.replace(/<\/ArabicText/g, '</LocalizedText');
content = content.replace(/<ArabicParagraph/g, '<LocalizedParagraph');
content = content.replace(/<\/ArabicParagraph/g, '</LocalizedParagraph');
content = content.replace(/\[rtlRow/g, '[localizedRow()');
content = content.replace(/\[ltrText,/g, '[ltrText(),');

// Hardcoded text replacements (Banner/Status)
content = content.replace(/"مسموح"/g, `t("status.allowedBanner")`);
content = content.replace(/"محظور"/g, `t("status.forbiddenBanner")`);
content = content.replace(/"مسموح بشروط"/g, `t("status.conditionalBanner")`);
content = content.replace(/"غير معروف"/g, `t("status.unknownBanner")`);
content = content.replace(/"غير مكتمل \/ يحتاج معلومات"/g, `t("status.unknownBannerLegacy")`);
content = content.replace(/"مسموح حسب المعلومات المتوفرة"/g, `t("status.allowedLegacyMedium")`);
content = content.replace(/"غير مؤكد - بحاجة لمعلومات إضافية"/g, `t("status.unknownLegacyLow")`);
content = content.replace(/"هذا حكم عام للفئة\. قد تختلف النتيجة لبعض الأصناف المندرجة تحتها\."/g, `t("result.generalRule")`);
content = content.replace(/`حكم موروث من الفئة العامة: \$\{report\.primaryRuling\.inheritsFrom\?\.nameAr \|\| ""\}`/g, '`${t("result.inheritedRule")} ${getLocalizedFoodName(report.primaryRuling.inheritsFrom || {})}`');
content = content.replace(/"تحليل تقريبي غير مؤكد\. يرجى التحقق من المكونات\."/g, `t("status.legacyLowGuidance")`);
content = content.replace(/"النتيجة تقريبية وقد تختلف حسب مكونات المنتج الفعلي\."/g, `t("status.legacyMediumGuidance")`);
content = content.replace(/"مكونات محظورة"/g, `t("result.forbiddenItems")`);
content = content.replace(/"مكونات مشروطة"/g, `t("result.conditionalItems")`);
content = content.replace(/"مكونات غير معروفة"/g, `t("result.unknownItems")`);
content = content.replace(/"مكونات مسموحة"/g, `t("result.allowedItems")`);
content = content.replace(/>\s*لم يتم التعرف على طعام\s*</g, `>{t("result.notFound")}<`);
content = content.replace(/>\s*لم نتمكن من اكتشاف طعام في هذا الإدخال\.{"\\n"}جرّب صورة أوضح للطعام أو الملصق، أو اكتب اسم الطعام بشكل أكثر تحديداً\.\s*</g, `>{t("result.notFoundDesc")}<`);
content = content.replace(/>\s*حاول مجدداً\s*</g, `>{t("result.retry")}<`);
content = content.replace(/>\s*درجة الملاءمة\s*</g, `>{t("result.compatibilityScore")}<`);
content = content.replace(/>\s*للحصول على نتيجة أدق\s*</g, `>{t("home.betterResultTitle")}<`);
content = content.replace(/>\s*صوّر قائمة مكونات المنتج\.\s*</g, `>{t("result.betterResultAction")}<`);
content = content.replace(/>\s*سبب الحكم\s*</g, `>{t("result.reason")}<`);
content = content.replace(/>\s*ملاحظات\s*</g, `>{t("result.notes")}<`);
content = content.replace(/>\s*الشروط والسبب المذكور تنطبق على المكون المستنتج بالوصفة وليس بالضرورة المكون الأصلي المرصود\.\s*</g, `>{t("result.recipeInferredInfo")}<`);
content = content.replace(/>\s*اقتراحات بديلة\s*</g, `>{t("result.alternativeSuggestions")}<`);

// Replace food names correctly: `item.nameAr || item.name` -> `getLocalizedFoodName(item)`
content = content.replace(/const displayName = item\.nameAr \|\| item\.name;/g, `const displayName = getLocalizedFoodName(item);`);

// And for `firstItem.nameAr` -> `getLocalizedFoodName(firstItem)`
content = content.replace(/const matchedFoodNameAr = firstItem \? firstItem\.nameAr : "";/g, `const matchedFoodNameAr = firstItem ? getLocalizedFoodName(firstItem) : "";`);
content = content.replace(/"طعام عام"/g, `t("autocomplete.sourceEntity")`); // close enough generic fallback

// Clean up `statusText` assignments
// In stats row
content = content.replace(/\{ label: "محظور" \}/g, `{ label: t("status.forbiddenBanner") }`);
content = content.replace(/\{ label: "مشروط" \}/g, `{ label: t("status.conditionalBanner") }`);
content = content.replace(/\{ label: "مجهول" \}/g, `{ label: t("status.unknownBanner") }`);
content = content.replace(/\{ label: "مسموح" \}/g, `{ label: t("status.allowedBanner") }`);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Refactored AnalysisResultCard");

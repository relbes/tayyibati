export interface CategoryOption {
  canonical: string;
  ar: string;
  en: string;
}

export const CATEGORY_TAXONOMY: CategoryOption[] = [
  { canonical: "لحوم", ar: "لحوم", en: "Meat" },
  { canonical: "مأكولات بحرية", ar: "مأكولات بحرية", en: "Seafood" },
  { canonical: "ألبان", ar: "ألبان", en: "Dairy" },
  { canonical: "حبوب", ar: "حبوب", en: "Grains" },
  { canonical: "خضروات", ar: "خضروات", en: "Vegetables" },
  { canonical: "فواكه", ar: "فواكه", en: "Fruits" },
  { canonical: "بقوليات", ar: "بقوليات", en: "Legumes" },
  { canonical: "مكسرات وبذور", ar: "مكسرات وبذور", en: "Nuts & Seeds" },
  { canonical: "زيوت", ar: "زيوت", en: "Oils" },
  { canonical: "دهون", ar: "دهون", en: "Fats" },
  { canonical: "مشروبات", ar: "مشروبات", en: "Beverages" },
  { canonical: "إضافات", ar: "إضافات", en: "Additives" },
  { canonical: "توابل", ar: "توابل", en: "Spices" },
  { canonical: "صلصات", ar: "صلصات", en: "Sauces" },
  { canonical: "أعشاب", ar: "أعشاب", en: "Herbs" },
  { canonical: "حلويات", ar: "حلويات", en: "Sweets" },
  { canonical: "محليات", ar: "محليات", en: "Sweeteners" },
  { canonical: "نكهات", ar: "نكهات", en: "Flavors" },
  { canonical: "بروتين", ar: "بروتين", en: "Protein" },
  { canonical: "أخرى", ar: "أخرى", en: "Other" },
  { canonical: "مواد كيميائية", ar: "مواد كيميائية", en: "Chemicals" },
  { canonical: "ألوان", ar: "ألوان", en: "Colors" },
];

export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "Meat & Poultry": "لحوم",
  "Meat": "لحوم",
  "Seafood": "مأكولات بحرية",
  "Dairy": "ألبان",
  "Grains & Bread": "حبوب",
  "Grains": "حبوب",
  "Vegetables": "خضروات",
  "Fruits": "فواكه",
  "Fruits & Dried Fruits": "فواكه",
  "Legumes": "بقوليات",
  "Nuts & Seeds": "مكسرات وبذور",
  "Oils & Fats": "زيوت",
  "Oils": "زيوت",
  "Fats": "دهون",
  "Fats & Oils": "دهون",
  "Beverages": "مشروبات",
  "Additives & Preservatives": "إضافات",
  "Additives": "إضافات",
  "Sweeteners": "محليات",
  "Spices & Herbs": "توابل",
  "Spices": "توابل",
  "Sauces & Condiments": "صلصات",
  "Sauces": "صلصات",
  "Herbs": "أعشاب",
  "Sweets": "حلويات",
  "Sweets & Desserts": "حلويات",
  "Flavors": "نكهات",
  "Protein": "بروتين",
  "Chemicals": "مواد كيميائية",
  "Colors": "ألوان",
  "Processed Foods": "إضافات",
  "Snacks": "أخرى",
  "Alcohol & Intoxicants": "مشروبات",
  "Insects": "أخرى",
  "Reptiles & Amphibians": "لحوم",
  "Wild Animals": "لحوم",
  "Other": "أخرى",
};

export function getCanonicalCategory(val?: string | null): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (LEGACY_CATEGORY_MAP[trimmed]) return LEGACY_CATEGORY_MAP[trimmed];
  const found = CATEGORY_TAXONOMY.find(
    (c) => c.canonical === trimmed || c.ar === trimmed || c.en.toLowerCase() === trimmed.toLowerCase()
  );
  return found ? found.canonical : trimmed;
}

export function getCategoryLabel(val?: string | null, lang: "ar" | "en" = "ar"): string {
  if (!val) return "";
  const canonical = getCanonicalCategory(val);
  const found = CATEGORY_TAXONOMY.find((c) => c.canonical === canonical);
  if (found) {
    return lang === "ar" ? found.ar : found.en;
  }
  return val;
}

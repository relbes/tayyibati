/**
 * Tayyibati Single Source of Truth (SSoT) for Arabic String Normalization
 *
 * All modules (Search, Knowledge Cache, Dish Engine, Ingredient Decomposer,
 * Intent Classifier, API Routes) MUST import normalization functions from this module.
 */

/**
 * Standardize letter shapes, strip diacritics & tatweel, lowercase, and collapse spaces.
 */
export function normalize(input: string | null | undefined): string {
  if (!input || typeof input !== "string") return "";

  let s = input.trim().toLowerCase();

  // Strip Arabic diacritics (tashkeel & dagger alif)
  s = s.replace(/[\u064B-\u0652\u0640\u0670]/g, "");

  // Normalize letter shapes
  s = s.replace(/[أإآ]/g, "ا");
  s = s.replace(/ة/g, "ه");
  s = s.replace(/ى/g, "ي");
  s = s.replace(/ؤ/g, "و");
  s = s.replace(/ئ/g, "ي");

  // Remove punctuation & collapse extra spaces
  s = s.replace(/[^\w\u0621-\u064A\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/**
 * Alias for normalize() to maintain compatibility with existing callers.
 */
export const normalizeName = normalize;
export const norm = normalize;

/**
 * Normalize and strip Arabic definite article ("ال" / "al-").
 * Also handles short word Alif stripping (e.g., "أرز" -> "رز").
 */
export function stripArticle(input: string | null | undefined): string {
  if (!input || typeof input !== "string") return "";

  let clean = normalize(input);
  if (!clean) return "";

  const words = clean.split(" ").map((w) => {
    let word = w.replace(/^al-?/i, "");
    if (word.startsWith("ال") && word.length > 3) {
      word = word.slice(2);
    }
    return word;
  });

  clean = words.join(" ").trim();

  // Strip leading Alif (ا/أ/إ/آ) for short words like (أرز -> رز)
  if ((clean.startsWith("ار") || clean.startsWith("أر")) && clean.length <= 4) {
    clean = clean.replace(/^[اأإآ]/, "");
  }

  return clean;
}

/**
 * Alias for stripArticle() to maintain compatibility with existing callers.
 */
export const stripAlefLam = stripArticle;

/**
 * Arabic stop words & conjunctions to exclude during substring token matching.
 */
export const ARABIC_STOP_WORDS = new Set([
  "و", "او", "في", "من", "على", "عن", "مع", "ان", "قد", "لا", "ما", "ال", "ثم", "بل", "حتى"
]);

/**
 * Standard culinary descriptor words that can be ignored for main food token matching.
 */
export const CULINARY_DESCRIPTORS = new Set([
  "عربي", "عربيه", "تركي", "تركيه", "سعودي", "سعوديه", "مصري", "مصريه", "بلدي", "شامي", "عادي"
]);

/**
 * Generic Culinary & Geographical Descriptors for Entity Extraction.
 * Covers:
 * - Regional & Origin descriptors (مصري, كركي, شامي, سعودي, أردني, تركي...)
 * - Color descriptors (أبيض, بني, أحمر, أخضر, أسود...)
 * - Processing & Quality descriptors (طازج, مجفف, عضوي, مطحون, مفروم, معلب...)
 * - Size descriptors (كبير, صغير, متوسط...)
 * - Associated preparation & dish names modifying base ingredients (منسف, شراك, كبسة...)
 */
export const GENERIC_DESCRIPTORS = new Set([
  // Regional & Country Origins
  "مصري", "مصريه", "اردني", "اردنيه", "سوري", "سوريه", "سعودي", "سعوديه",
  "تركي", "تركيه", "ايطالي", "ايطاليه", "هندي", "هنديه", "كركي", "كركيه",
  "شامي", "شاميه", "خليجي", "خليجيه", "مغربي", "مغربيه", "تونسي", "تونسيه",
  "يمني", "يمنيه", "لبناني", "لبنانيه", "فلسطيني", "فلسطينيه", "بلدي", "بلديه",
  "عربي", "عربيه", "امريكي", "امريكيه", "صيني", "صينيه", "ياباني", "يابانيه", "خياري", "خياريه",
  // Colors
  "ابيض", "بيضاء", "بني", "بنيه", "احمر", "حمراء", "اخضر", "خضراء", "اصفر", "صفراء", "اسود", "سوداء", "وردي", "ورديه",
  // Processing & Form
  "طازج", "طازجه", "مجفف", "مجففه", "عضوي", "عضويه", "مطحون", "مطحونه", "مفروم", "مفرومه",
  "مبشور", "مبشوره", "معلب", "معلبه", "طبيعي", "طبيعيه", "محمص", "محمصه", "مسلوق", "مسلوقه",
  "مشوي", "مشويه", "مقلي", "مقليه", "خام", "ناعم", "ناعمه", "خشن", "خشنه", "كامل", "كامله",
  // Sizes
  "كبير", "كبيره", "صغير", "صغيره", "متوسط", "متوسطه", "طويل", "طويله", "قصير", "قصيره",
  // Dish & Recipe Associations
  "منسف", "شراك", "كبسه", "كبسة", "برياني", "مندي", "مجدرة", "مجدره", "فتوش", "تبولة", "تبوله"
]);

export interface BaseEntityExtractionResult {
  baseEntity: string;
  modifiers: string[];
}

/**
 * Extracts the base food/entity name from a descriptive phrase by stripping generic descriptors,
 * while PRESERVING the modifiers for downstream compatibility analysis.
 * Example: "رز بني" -> { baseEntity: "رز", modifiers: ["بني"] }
 * Example: "خبز أسمر" -> { baseEntity: "خبز", modifiers: ["اسمر"] }
 */
export function extractBaseEntityWithModifiers(query: string | null | undefined): BaseEntityExtractionResult | null {
  if (!query || typeof query !== "string") return null;

  const normalized = normalize(query);
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return null;

  const baseTokens: string[] = [];
  const modifiers: string[] = [];

  for (const w of words) {
    const stripped = stripArticle(w);
    if (ARABIC_STOP_WORDS.has(w)) continue;

    if (GENERIC_DESCRIPTORS.has(w) || GENERIC_DESCRIPTORS.has(stripped)) {
      modifiers.push(w);
    } else {
      baseTokens.push(w);
    }
  }

  if (baseTokens.length > 0 && baseTokens.length < words.length) {
    return {
      baseEntity: baseTokens.join(" "),
      modifiers,
    };
  }

  // Fallback: If modifier list didn't hit but expression has >= 2 words, return primary head noun
  if (words.length >= 2) {
    return {
      baseEntity: words[0],
      modifiers: words.slice(1),
    };
  }

  return null;
}

/**
 * Extracts the base food/entity name string (backward compatibility wrapper).
 */
export function extractBaseEntity(query: string | null | undefined): string | null {
  const res = extractBaseEntityWithModifiers(query);
  return res ? res.baseEntity : null;
}

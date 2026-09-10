/**
 * Tayyibati Smart Fallback Suggestions Engine
 *
 * PURPOSE:
 *   Runs ONLY when the CanonicalSearchEngine returns NOT_FOUND.
 *   Scans the in-memory food/dish dataset and returns up to 5 genuinely-relevant
 *   existing Tayyibati records as suggestions — never invented names.
 *
 * ARCHITECTURE RULES:
 *   - This engine is NEVER called on a successful (FOUND / AMBIGUOUS) result.
 *   - It MUST NOT alter compatibility status or confirmed resolution.
 *   - Zero database queries at suggestion-time (all data is in warm caches).
 *   - Zero external AI calls.
 *   - Zero modifications to CanonicalSearchEngine resolution tiers.
 */

import {
  normalize,
  stripArticle,
  extractBaseEntityWithModifiers,
  ARABIC_STOP_WORDS,
  CULINARY_DESCRIPTORS,
  PREPARATION_DESCRIPTORS,
  GENERIC_DESCRIPTORS,
} from "./arabicNormalization";
import { expandSearchQuery } from "./searchExpansion";
import { getKnowledgeCache } from "./knowledgeCache";
import { warmDishEngineCache } from "./dishCompatibilityEngine";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type FallbackEntityType = "food" | "dish";

export interface FallbackSuggestion {
  canonicalId: number;
  canonicalEntityType: FallbackEntityType;
  nameAr: string;
  nameEn: string;
  /** Internal only — NOT serialised to API response. */
  similarityScore: number;
}

export interface FallbackResult {
  hasSuggestions: boolean;
  suggestions: FallbackSuggestion[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum similarity score to include a candidate as a suggestion. */
const SUGGESTION_MIN_SCORE = 35;

/** Maximum number of suggestions returned. */
const MAX_SUGGESTIONS = 5;

/** Minimum token length for meaningful matching. */
const MIN_TOKEN_LENGTH = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard Levenshtein distance for fuzzy misspelling handling.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 99; // Quick length-difference cutoff

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Count shared prefix characters between two strings.
 */
function countSharedPrefix(a: string, b: string): number {
  let count = 0;
  while (count < a.length && count < b.length && a[count] === b[count]) {
    count++;
  }
  return count;
}

/**
 * Clean and split a normalized Arabic string into meaningful content tokens.
 * Handles conjunctions (e.g. "وبصل" -> "بصل"), strips stop words, descriptors, and short noise.
 */
function extractMeaningfulTokens(normStr: string): string[] {
  const rawWords = normStr.split(/\s+/).filter(Boolean);
  const result: string[] = [];

  for (const rawWord of rawWords) {
    let w = rawWord.trim();
    if (ARABIC_STOP_WORDS.has(w)) continue;

    // Conjunction 'و' stripping for joined words (e.g. "وبصل" -> "بصل")
    if (w.startsWith("و") && w.length >= 4 && !w.startsWith("ور")) {
      const strippedConj = w.slice(1);
      if (strippedConj.length >= MIN_TOKEN_LENGTH) {
        w = strippedConj;
      }
    }

    const stripped = stripArticle(w);
    if (
      stripped.length >= MIN_TOKEN_LENGTH &&
      !ARABIC_STOP_WORDS.has(stripped) &&
      !CULINARY_DESCRIPTORS.has(stripped) &&
      !GENERIC_DESCRIPTORS.has(stripped) &&
      !PREPARATION_DESCRIPTORS.has(stripped)
    ) {
      result.push(stripped);
    }
  }

  return result;
}

/**
 * Check whether a token matches as a whole word in a candidate token set.
 * Prevents "بني" matching inside "سبنيورية".
 */
function isWholeWordMatch(token: string, candidateTokenSet: Set<string>): boolean {
  if (candidateTokenSet.has(token)) return true;
  if (token.length >= 4) {
    for (const ct of candidateTokenSet) {
      if (ct === token) return true;
      if (ct.startsWith(token) && ct.length <= token.length + 3) return true;
    }
  }
  return false;
}

/**
 * Build a normalized whole-word token set for a candidate's name.
 */
function buildCandidateTokenSet(nameAr: string, nameEn?: string | null): Set<string> {
  const parts: string[] = [];
  if (nameAr) {
    parts.push(...normalize(nameAr).split(/\s+/).filter(Boolean));
    parts.push(
      ...normalize(nameAr)
        .split(/\s+/)
        .map(stripArticle)
        .filter(Boolean)
    );
  }
  if (nameEn) {
    parts.push(...normalize(nameEn).toLowerCase().split(/\s+/).filter(Boolean));
  }
  return new Set(parts.filter((t) => t.length >= 2));
}

interface ScoreParams {
  queryStripped: string;
  coreBaseStripped: string | null;
  baseEntityStripped: string | null;
  contentTokens: string[];
  prepWords: string[];
  expandedVariants: string[];
  hasPreparationIndicator: boolean;
  englishQueryTokens: string[];
}

/**
 * Score a single candidate against the decomposed query.
 */
function scoreCandidate(
  candidate: { nameAr: string; nameEn?: string | null },
  entityType: FallbackEntityType,
  params: ScoreParams
): number {
  if (!candidate.nameAr) return 0;

  const {
    queryStripped,
    coreBaseStripped,
    baseEntityStripped,
    contentTokens,
    prepWords,
    expandedVariants,
    hasPreparationIndicator,
    englishQueryTokens,
  } = params;

  const candNorm = normalize(candidate.nameAr);
  const candStripped = stripArticle(candNorm);
  const candTokens = buildCandidateTokenSet(candidate.nameAr, candidate.nameEn);

  let score = 0;

  // -- Signal 1: Core Base Entity Match (+50) --------------------------------
  if (coreBaseStripped && candStripped === coreBaseStripped) {
    score += 50;
  } else if (queryStripped && candStripped === queryStripped) {
    score += 50;
  } else if (baseEntityStripped && candStripped === baseEntityStripped) {
    score += 45;
  } else if (
    coreBaseStripped &&
    coreBaseStripped.length >= 4 &&
    (candStripped.startsWith(coreBaseStripped) || coreBaseStripped.startsWith(candStripped))
  ) {
    score += 35;
  }

  // -- Signal 2: Content-Token Overlap (+30 max) -----------------------------
  if (contentTokens.length > 0) {
    const matched = contentTokens.filter((t) => isWholeWordMatch(t, candTokens));
    if (matched.length > 0) {
      score += Math.min(30, Math.round((matched.length / contentTokens.length) * 30));
    }
  }

  // -- Signal 3: Expanded Orthographic Variants (+25) ------------------------
  for (const variant of expandedVariants) {
    if (variant.length >= 3 && (candStripped === variant || candNorm === variant)) {
      score += 25;
      break;
    }
  }

  // -- Signal 4: Levenshtein Typo Distance Matching (+40 / +35) --------------
  // Requires shared prefix >= 3 chars to prevent "بازلا" matching "بابا" or "باشا"
  if (queryStripped.length >= 4) {
    for (const ct of candTokens) {
      if (ct.length >= 4) {
        const prefixLen = countSharedPrefix(queryStripped, ct);
        const dist = levenshteinDistance(queryStripped, ct);
        if (dist === 1 && prefixLen >= 2) {
          score += 40;
          break;
        } else if (dist === 2 && prefixLen >= 3) {
          score += 35;
          break;
        }
      }
    }
  }

  // -- Signal 5: English Token Overlap (+15 max) ------------------------------
  if (englishQueryTokens.length > 0 && candidate.nameEn) {
    const candEnLower = (candidate.nameEn || "").toLowerCase();
    const matchedEn = englishQueryTokens.filter(
      (t) => t.length >= 3 && candEnLower.includes(t)
    );
    if (matchedEn.length > 0) {
      score += Math.min(15, matchedEn.length * 8);
    }
  }

  // -- Preparation Indicator Rules -------------------------------------------
  if (hasPreparationIndicator) {
    if (entityType === "dish") {
      // Prepared dish boost applies ONLY if the candidate has an underlying ingredient/content match
      if (score > 0) {
        score += 20; // Base boost for prepared dish containing query ingredients
        if (prepWords && prepWords.length > 0) {
          const matchedPrep = prepWords.filter((pw) => isWholeWordMatch(pw, candTokens));
          if (matchedPrep.length > 0) {
            score += 25; // Significant boost for matching cooking technique as well
          }
        }
      }
    } else {
      // For raw foods when query explicitly asks for a prepared dish:
      // Cap raw food score so it remains a secondary alternative when matching dishes exist
      score = Math.min(score, 60);
    }
  }

  return Math.max(0, score);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Engine
// ─────────────────────────────────────────────────────────────────────────────

export class SmartFallbackEngine {
  /**
   * Compute smart fallback suggestions for a query that the canonical search
   * engine could not resolve.
   *
   * CALLED ONLY after searchOutcome === "NOT_FOUND".
   * Returns up to 5 relevant real Tayyibati records.
   * Returns empty suggestions when no candidate exceeds SUGGESTION_MIN_SCORE.
   */
  public static async suggest(rawQuery: string): Promise<FallbackResult> {
    const empty: FallbackResult = { hasSuggestions: false, suggestions: [] };

    if (!rawQuery || rawQuery.trim().length < 2) return empty;

    // -- Phase 1: Query Decomposition ----------------------------------------
    const queryNorm = normalize(rawQuery);
    const queryStripped = stripArticle(queryNorm);

    if (!queryStripped || queryStripped.length < 2) return empty;

    const words = queryNorm.split(/\s+/).filter(Boolean);

    // Identify preparation words (e.g. "مشوي", "بالفرن")
    const prepWords = words.filter(
      (w) => PREPARATION_DESCRIPTORS.has(w) || PREPARATION_DESCRIPTORS.has(stripArticle(w))
    );
    const hasPreparationIndicator = prepWords.length > 0;

    // Extract core base entity by removing preparation indicators and stop words
    const nonPrepWords = words.filter(
      (w) =>
        !PREPARATION_DESCRIPTORS.has(w) &&
        !PREPARATION_DESCRIPTORS.has(stripArticle(w)) &&
        !ARABIC_STOP_WORDS.has(w)
    );
    const coreBase = nonPrepWords.length > 0 ? nonPrepWords.join(" ") : null;
    const coreBaseStripped = coreBase ? stripArticle(coreBase) : null;

    const baseExtraction = extractBaseEntityWithModifiers(rawQuery);
    const baseEntity = baseExtraction?.baseEntity ?? null;
    const baseEntityStripped = baseEntity ? stripArticle(normalize(baseEntity)) : null;

    const contentTokens = extractMeaningfulTokens(queryNorm);

    const expandedVariants = expandSearchQuery(rawQuery).map((v) => stripArticle(v));

    // English tokens (>= 3 chars, only actual letters)
    const englishQueryTokens: string[] =
      rawQuery.toLowerCase().match(/[a-z]{3,}/g) ?? [];

    // Guard: if there is truly nothing to match on, skip
    if (
      contentTokens.length === 0 &&
      !coreBaseStripped &&
      !baseEntityStripped &&
      englishQueryTokens.length === 0
    ) {
      return empty;
    }

    const scoreParams: ScoreParams = {
      queryStripped,
      coreBaseStripped,
      baseEntityStripped,
      contentTokens,
      prepWords,
      expandedVariants,
      hasPreparationIndicator,
      englishQueryTokens,
    };

    // -- Phase 2: Candidate Scoring ------------------------------------------
    const [knowledgeCache, dishCache] = await Promise.all([
      getKnowledgeCache(),
      warmDishEngineCache(),
    ]);

    const scored: Array<{ candidate: FallbackSuggestion; score: number }> = [];

    // Score all foods
    for (const food of knowledgeCache.foods) {
      if (!food.nameAr) continue;
      const score = scoreCandidate(
        { nameAr: food.nameAr, nameEn: food.nameEn },
        "food",
        scoreParams
      );
      if (score >= SUGGESTION_MIN_SCORE) {
        scored.push({
          score,
          candidate: {
            canonicalId: food.id,
            canonicalEntityType: "food",
            nameAr: food.nameAr,
            nameEn: food.nameEn || food.nameAr,
            similarityScore: score,
          },
        });
      }
    }

    // Score all dishes
    for (const [, dish] of dishCache.dishesById) {
      if (!dish.nameAr) continue;
      const score = scoreCandidate(
        { nameAr: dish.nameAr, nameEn: dish.nameEn },
        "dish",
        scoreParams
      );
      if (score >= SUGGESTION_MIN_SCORE) {
        scored.push({
          score,
          candidate: {
            canonicalId: dish.id,
            canonicalEntityType: "dish",
            nameAr: dish.nameAr,
            nameEn: dish.nameEn || dish.nameAr,
            similarityScore: score,
          },
        });
      }
    }

    if (scored.length === 0) return empty;

    // -- Phase 3: Rank, Deduplicate, Select ----------------------------------
    scored.sort((a, b) => {
      if (hasPreparationIndicator) {
        // When preparation indicators are present in the query, dishes take priority over raw foods
        if (a.candidate.canonicalEntityType !== b.candidate.canonicalEntityType) {
          if (a.candidate.canonicalEntityType === "dish" && a.score >= 35) return -1;
          if (b.candidate.canonicalEntityType === "dish" && b.score >= 35) return 1;
        }
      }
      if (b.score !== a.score) return b.score - a.score;
      return a.candidate.nameAr.length - b.candidate.nameAr.length;
    });

    const seen = new Set<string>();
    const topCandidates: FallbackSuggestion[] = [];
    for (const { candidate } of scored) {
      const key = `${candidate.canonicalEntityType}:${candidate.canonicalId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      topCandidates.push(candidate);
      if (topCandidates.length >= MAX_SUGGESTIONS) break;
    }

    if (topCandidates.length === 0) return empty;

    return {
      hasSuggestions: true,
      suggestions: topCandidates,
    };
  }
}
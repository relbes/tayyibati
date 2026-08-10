/**
 * @internal
 * ARCHITECTURE RULE — SINGLE SOURCE OF TRUTH:
 * This module is PRIVATE to `decisionEngine.ts`.
 *
 * NO other file may import from this module.
 * All consumers must call `DecisionEngine.computeScores()` or `DecisionEngine.evaluate()`.
 * Violation of this rule breaks the SSoT contract for scoring.
 *
 * Separates three independent concepts:
 *
 *   compatibilityScore  — What fraction of KNOWN ingredients are compatible?
 *                         Unknown ingredients are excluded; they reduce confidence.
 *
 *   confidence          — What fraction of ALL ingredients are KNOWN?
 *                         Drops when many unknowns exist.
 *
 *   decision            — Is the food/dish allowed?  (owned by the Decision Engine)
 *
 * Formula
 * -------
 *   known = allowed + forbidden + conditional
 *   compatibilityScore = known === 0 ? null
 *                       : round( (allowed + 0.5 × conditional) / known × 100 )
 *
 *   confidence         = total === 0 ? null
 *                       : round( known / total × 100 )
 */

export interface CompatibilityScoreResult {
  /** 0-100 based on known ingredients only. null if no known ingredients. */
  compatibilityScore: number | null;
  /** 0-100 fraction of ingredients that were resolved. null if total is 0. */
  confidence: number | null;
  /** true when compatibilityScore is a valid number */
  scoreAvailable: boolean;
}

export function computeCompatibilityScore(
  allowedCount: number,
  forbiddenCount: number,
  conditionalCount: number,
  unknownCount: number,
): CompatibilityScoreResult {
  const known = allowedCount + forbiddenCount + conditionalCount;
  const total = known + unknownCount;

  const compatibilityScore =
    known === 0
      ? null
      : Math.round(((allowedCount + 0.5 * conditionalCount) / known) * 100);

  const confidence =
    total === 0 ? null : Math.round((known / total) * 100);

  return {
    compatibilityScore,
    confidence,
    scoreAvailable: compatibilityScore !== null,
  };
}

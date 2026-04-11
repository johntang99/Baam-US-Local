/**
 * Kendall tau ranking consistency guard.
 * Detects when intent-based ranking deviates too much from a fairness baseline (total_score).
 * Extracted from NY assistant's calculateRankingConsistency.
 */

/**
 * Calculate a Kendall-tau-like consistency score between two rankings.
 * Returns 1.0 if perfectly consistent, 0.0 if completely inverted.
 *
 * @param ranked - Items in intent-based ranked order
 * @param baselineByScore - Items in total_score baseline order
 * @param getId - Function to extract a unique ID from an item
 * @param topN - Number of top items to compare (default 10)
 */
export function calculateRankingConsistency<T>(
  ranked: T[],
  baselineByScore: T[],
  getId: (item: T) => string,
  topN = 10,
): number {
  const rankedTop = ranked.slice(0, topN).map(getId);
  const baselinePos = new Map<string, number>();
  baselineByScore.slice(0, topN).forEach((item, idx) => baselinePos.set(getId(item), idx));

  const comparable = rankedTop.filter((id) => baselinePos.has(id));
  if (comparable.length < 2) return 1;

  let inversions = 0;
  const maxPairs = (comparable.length * (comparable.length - 1)) / 2;

  for (let i = 0; i < comparable.length; i++) {
    for (let j = i + 1; j < comparable.length; j++) {
      const pi = baselinePos.get(comparable[i])!;
      const pj = baselinePos.get(comparable[j])!;
      if (pi > pj) inversions++;
    }
  }

  return Number((1 - inversions / maxPairs).toFixed(3));
}

/** Threshold below which we fall back to score-based ordering */
export const CONSISTENCY_THRESHOLD = 0.65;

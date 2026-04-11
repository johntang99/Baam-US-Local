/**
 * Relevance scoring and filtering for search results.
 * Extracted from NY assistant's getRelevanceScore + filterByRelevance.
 */

/**
 * Score how relevant a text block is to given keywords.
 * Handles CJK compound keywords by checking 2-char head/tail fragments.
 * Returns 0-1 normalized score.
 */
export function getRelevanceScore(text: string, keywords: string[]): number {
  if (!text || keywords.length === 0) return 0;
  const lower = text.toLowerCase();
  let matchedScore = 0;

  for (const kw of keywords) {
    if (lower.includes(kw)) {
      matchedScore += 1;
      continue;
    }
    // CJK compound fallback: check 2-char head/tail fragments
    if (kw.length >= 4) {
      const fragments = [kw.slice(0, 2), kw.slice(-2)];
      if (fragments.some((f) => lower.includes(f))) {
        matchedScore += 0.5;
      }
    }
  }
  return matchedScore / keywords.length;
}

/**
 * Filter an array of items by keyword relevance score.
 *
 * @param rows - Items to filter
 * @param keywords - Keywords to match against
 * @param toText - Function to extract searchable text from an item
 * @param minScore - Minimum relevance score to keep (0-1)
 * @param options.keepTopOneFallback - If all items filtered out, keep top 1
 * @param options.minFallbackScore - Minimum score for fallback item
 */
export function filterByRelevance<T>(
  rows: T[],
  keywords: string[],
  toText: (row: T) => string,
  minScore: number,
  options?: { keepTopOneFallback?: boolean; minFallbackScore?: number },
): T[] {
  if (rows.length === 0 || keywords.length === 0) return rows;

  const scored = rows.map((row) => ({ row, score: getRelevanceScore(toText(row), keywords) }));
  const filtered = scored.filter((x) => x.score >= minScore).map((x) => x.row);

  if (filtered.length === 0 && options?.keepTopOneFallback) {
    const minFallbackScore = options.minFallbackScore ?? minScore;
    const top = scored.sort((a, b) => b.score - a.score)[0];
    if (top && top.score >= minFallbackScore) return [top.row];
  }

  return filtered;
}

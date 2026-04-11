/**
 * Answer post-processing utilities.
 * Handles table normalization, source deduplication, and ranking.
 */

import type { SourceItem } from '../types';

/**
 * Deduplicate and cap sources list.
 */
export function dedupeAndCapSources(sources: SourceItem[], maxTotal = 20): SourceItem[] {
  const seen = new Set<string>();
  const deduped: SourceItem[] = [];
  for (const s of sources) {
    const key = `${s.type}|${s.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
    if (deduped.length >= maxTotal) break;
  }
  return deduped;
}

/**
 * Interleave sources by type for diverse display.
 */
export function diversifySources(sources: SourceItem[]): SourceItem[] {
  const typeGroups: Record<string, SourceItem[]> = {};
  for (const s of sources) {
    (typeGroups[s.type] ||= []).push(s);
  }
  const result: SourceItem[] = [];
  let hasMore = true;
  for (let i = 0; hasMore; i++) {
    hasMore = false;
    for (const type of Object.keys(typeGroups)) {
      if (i < typeGroups[type].length) {
        result.push(typeGroups[type][i]);
        hasMore = true;
      }
    }
  }
  return result;
}

/**
 * Rank sources by keyword relevance to the query.
 */
export function rankSourcesByRelevance(
  sources: SourceItem[],
  query: string,
  keywords: string[],
  primaryType?: string,
): SourceItem[] {
  const allKeywords = [...keywords, ...query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2)];
  const scored = sources.map((s, idx) => {
    const text = `${s.title || ''} ${s.snippet || ''}`.toLowerCase();
    let score = 0;
    for (const kw of allKeywords) {
      if (text.includes(kw.toLowerCase())) score += 1;
    }
    if (primaryType && s.type === primaryType) score += 1.5;
    return { s, score, idx };
  });
  return scored
    .sort((a, b) => (b.score - a.score) || (a.idx - b.idx))
    .map((x) => x.s);
}

/**
 * Select visible sources based on intent.
 */
export function selectVisibleSources(
  intent: string,
  internal: { sources: SourceItem[] },
  web: { sources: SourceItem[] },
  primaryType: string,
): SourceItem[] {
  const internalByType = (type: string) => internal.sources.filter((s) => s.type === type);
  const webSources = web.sources;

  switch (intent) {
    case 'localRecommendation':
      return internalByType(primaryType).slice(0, 6);
    case 'discoverMode':
      return internal.sources.slice(0, 9);
    case 'freshInfo':
      return [...internal.sources.slice(0, 5), ...webSources.slice(0, 3)];
    case 'guideMode':
      return [...internal.sources.slice(0, 6), ...internalByType(primaryType).slice(0, 3)];
    default:
      return [...internal.sources.slice(0, 8), ...webSources.slice(0, 2)];
  }
}

/**
 * Promise.race with timeout.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout:${ms}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

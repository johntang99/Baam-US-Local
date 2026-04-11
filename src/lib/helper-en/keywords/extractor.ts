/**
 * English keyword extraction: regex-based fallback.
 */

import { ENGLISH_LOCATIONS, ENGLISH_STOP_PHRASES, ENGLISH_STOP_WORDS } from './stop-words';

/**
 * Regex-based keyword extraction fallback for English queries.
 */
export function fallbackKeywordExtraction(query: string): string[] {
  let remaining = query.trim().toLowerCase();

  for (const loc of ENGLISH_LOCATIONS) {
    remaining = remaining.replace(new RegExp(loc, 'gi'), ' ');
  }

  [...ENGLISH_STOP_PHRASES]
    .sort((a, b) => b.length - a.length)
    .forEach((w) => {
      remaining = remaining.replace(new RegExp(w, 'gi'), ' ');
    });

  let segments = remaining
    .split(/[\s,;:!?.'"()\-—]+/)
    .filter((w) => w.length >= 2);

  segments = segments
    .filter((w) => !ENGLISH_STOP_WORDS.has(w.toLowerCase()));

  return [...new Set(segments)].filter((k) => k.length >= 2).slice(0, 8);
}

/**
 * Normalize keywords: lowercase, dedupe, filter short.
 */
export function normalizeKeywords(keywords: string[]): string[] {
  return [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 2))];
}

/**
 * Retrieval composition: merge internal + web results.
 */

import type { RetrievalPayload, HelperSiteConfig, HelperIntent } from '../types';
import { searchWebFallback } from './web';

/**
 * Determine if web fallback should be used based on internal results.
 */
export function shouldUseWebFallback(
  config: HelperSiteConfig,
  intent: HelperIntent,
  internal: RetrievalPayload,
): boolean {
  if (config.features?.webFallbackEnabled === false) return false;
  if (intent === 'followup') return false;

  // Find the primary content type
  const primaryType = config.contentTypes.find((ct) => ct.isPrimary);
  const primaryLabel = primaryType?.label;

  if (intent === 'localRecommendation' && primaryLabel) {
    const primaryCount = internal.sources.filter((s) => s.type === primaryLabel).length;
    return primaryCount < 3;
  }

  return internal.sources.length < 4;
}

/**
 * Fetch web results if needed and merge with internal results.
 */
export async function composeRetrieval(
  config: HelperSiteConfig,
  intent: HelperIntent,
  internal: RetrievalPayload,
  query: string,
): Promise<{ internal: RetrievalPayload; web: RetrievalPayload; usedWebFallback: boolean }> {
  let web: RetrievalPayload = { sources: [], contextBlocks: [], counts: { web: 0 } };

  if (shouldUseWebFallback(config, intent, internal)) {
    web = await searchWebFallback(query);
  }

  return {
    internal,
    web,
    usedWebFallback: web.sources.length > 0,
  };
}

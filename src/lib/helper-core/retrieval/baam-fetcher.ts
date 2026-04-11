/**
 * Baam Content Fetcher — wraps the existing searchBaamContent as a ContentFetcher.
 *
 * This bridges the legacy baam.ts retrieval code with the new createHelper() API.
 * The existing baam.ts already implements 3-strategy business search with
 * search_terms, cuisine profiles, location filtering, and review integration.
 *
 * Usage:
 *   import { createBaamFetcher } from '@baam/helper-core/retrieval/baam-fetcher';
 *   const fetcher = createBaamFetcher(supabase);
 *   const helper = createHelper({ ...config, fetcher });
 */

import type { ContentFetcher, SearchParams, RetrievalPayload } from '../types';
import { searchBaamContent } from './baam';

/**
 * Create a Baam-specific ContentFetcher that wraps the existing searchBaamContent.
 *
 * @param supabase - Supabase admin client
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createBaamFetcher(supabase: any): ContentFetcher {
  return {
    async search(params: SearchParams): Promise<RetrievalPayload> {
      return searchBaamContent({
        supabase,
        query: params.query,
        keywords: params.keywords,
        intent: params.intent,
      });
    },
  };
}

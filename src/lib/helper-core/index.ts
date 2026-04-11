/**
 * @baam/helper-core — AI Helper Plugin Engine
 *
 * Usage:
 *   import { createHelper } from '@baam/helper-core';
 *   const helper = createHelper(config);
 *   const result = await helper.ask('推荐法拉盛川菜');
 */

import { createEngine } from './engine';
import type { HelperEngine, HelperSiteConfig, HelperRunInput, HelperResult, RetrievalPayload } from './types';

// ─── New API ───────────────────────────────────────────────────────

/**
 * Create a Helper engine configured for a specific site.
 * This is the primary entry point for the v2 plugin architecture.
 */
export function createHelper(config: HelperSiteConfig): HelperEngine {
  return createEngine(config);
}

// ─── Legacy compatibility shim ─────────────────────────────────────
// Preserves the runHelper2(input) API so apps/web/helper-2/actions.ts
// continues to work without changes during migration.

let _legacyRunHelper2: ((input: HelperRunInput) => Promise<HelperResult>) | null = null;

async function loadLegacyRunner(): Promise<(input: HelperRunInput) => Promise<HelperResult>> {
  if (_legacyRunHelper2) return _legacyRunHelper2;

  // Dynamically import the legacy modules that still exist
  const { buildAnswerSystemPrompt, buildAnswerUserPrompt, buildIntentPrompt, buildKeywordPrompt, guessIntentHeuristically } = await import('./prompts');
  const { createProviderRouter } = await import('./providers');
  const { searchBaamContent } = await import('./retrieval/baam');
  const { searchWebFallback } = await import('./retrieval/web');

  // This is a bridge — once apps migrate to createHelper(), this shim is removed.

  _legacyRunHelper2 = async function runHelper2Legacy(input: HelperRunInput): Promise<HelperResult> {
    const query = input.query.trim();
    if (!query) throw new Error('Empty query');

    const history = input.history ?? [];
    const router = createProviderRouter({
      providerStrategy: input.config.providerStrategy,
      openAiApiKey: input.config.openAiApiKey,
      openAiModel: input.config.openAiModel,
      anthropicApiKey: input.config.anthropicApiKey,
      anthropicModel: input.config.anthropicModel,
    });

    // Intent classification
    let decision;
    try {
      const response = await router.complete<{ intent: string; needsWeb: boolean; reason?: string }>('classify', {
        system: '你是一个严格输出 JSON 的中文路由器。只能返回 JSON。',
        prompt: buildIntentPrompt(query, history),
        json: true,
        maxTokens: 200,
      });
      decision = response.data as { intent: string; needsWeb: boolean; reason?: string };
    } catch {
      decision = guessIntentHeuristically(query, history);
    }

    // Keyword extraction
    let keywords: string[] = [];
    if (decision.intent !== 'followup') {
      try {
        const response = await router.complete<{ keywords: string[] }>('keywords', {
          system: '你是一个严格输出 JSON 的关键词提取器。只能返回 JSON。',
          prompt: buildKeywordPrompt(query),
          json: true,
          maxTokens: 180,
        });
        keywords = Array.isArray(response.data.keywords)
          ? response.data.keywords.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
          : [];
      } catch {
        // fallback
      }
    }

    // Retrieval
    let internal: RetrievalPayload = { sources: [], contextBlocks: [], counts: {} };
    let web: RetrievalPayload = { sources: [], contextBlocks: [], counts: { web: 0 } };

    if (decision.intent !== 'followup') {
      internal = await searchBaamContent({ supabase: input.supabaseAdmin, query, keywords, intent: decision.intent as any });
    }

    if (input.config.webFallbackEnabled !== false && decision.intent !== 'followup' && internal.sources.length < 4) {
      web = await searchWebFallback(query);
    }

    const usedWebFallback = web.sources.length > 0;

    // Answer generation
    try {
      const providerResponse = await router.complete<string>('answer', {
        system: buildAnswerSystemPrompt(input.config.assistantNameZh, input.config.siteName),
        prompt: decision.intent === 'followup'
          ? `根据对话上下文继续回答：\n${history.slice(-8).map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`).join('\n')}\n\n用户最新问题：${query}`
          : buildAnswerUserPrompt({
              query,
              intent: decision.intent as any,
              history,
              internal: internal as any,
              web: web as any,
              usedWebFallback,
            }),
        maxTokens: input.config.answerMaxTokens ?? 1800,
      });

      return {
        answer: String(providerResponse.data || '').trim(),
        sources: internal.sources.slice(0, 10),
        intent: decision.intent as any,
        keywords,
        usedWebFallback,
        provider: `${providerResponse.provider}:${providerResponse.model}`,
      };
    } catch {
      return {
        answer: '我暂时没能完成回答，请稍后再试。',
        sources: internal.sources.slice(0, 10),
        intent: decision.intent as any,
        keywords,
        usedWebFallback,
        provider: 'fallback',
      };
    }
  };

  return _legacyRunHelper2;
}

/**
 * Legacy API — preserved for backward compatibility.
 * @deprecated Use createHelper() instead.
 */
export async function runHelper2(input: HelperRunInput): Promise<HelperResult> {
  const runner = await loadLegacyRunner();
  return runner(input);
}

// ─── Re-exports ────────────────────────────────────────────────────

export type * from './types';

// Ranking utilities (available for site-level fetchers to use)
export { getRelevanceScore, filterByRelevance } from './ranking/relevance';
export { calculateRankingConsistency, CONSISTENCY_THRESHOLD } from './ranking/consistency';
export { evaluateQualityLevel } from './ranking/quality';

// Table utilities (available for locale plugins)
export {
  buildStrictRecommendationTable,
  countMarkdownTableRows,
  harmonizeRecommendationCount,
  injectStrictRecommendationTable,
  readBusinessMetadata,
  resolveBusinessTitle,
  resolveRequestedBusinessCount,
  normalizeCell,
} from './answer/table';

// Post-processing
export {
  dedupeAndCapSources,
  diversifySources,
  rankSourcesByRelevance,
  selectVisibleSources,
  withTimeout,
} from './answer/post-process';

// Provider
export { createProviderRouter, createProviderRouterFromConfig } from './providers';

// Telemetry
export { logSearchTelemetry } from './telemetry/logger';

// Baam-specific fetchers (for sites using Baam's Supabase schema)
export { createBaamFetcher } from './retrieval/baam-fetcher';
export { createBaamEnglishFetcher } from './retrieval/baam-en-fetcher';

// Category matcher utility (for custom fetchers that want search_terms matching)
export { matchCategories } from './retrieval/category-matcher';

// Legacy Baam retrieval (used by runHelper2 shim)
export { searchBaamContent } from './retrieval/baam';

/**
 * Intent classification using AI with heuristic fallback.
 * The actual prompts come from the LocaleKit — this module handles orchestration.
 */

import type { HelperMessage, IntentDecision, LocaleKit, ProviderRouter } from '../types';

/**
 * Classify user intent using AI, falling back to locale heuristics.
 */
export async function classifyIntent(
  router: ProviderRouter,
  localeKit: LocaleKit,
  query: string,
  history: HelperMessage[],
): Promise<IntentDecision> {
  try {
    const response = await router.complete<IntentDecision>('classify', {
      system: localeKit.locale === 'zh'
        ? '你是一个严格输出 JSON 的中文路由器。只能返回 JSON。'
        : 'You are a strict JSON intent router. Return only JSON.',
      prompt: localeKit.buildIntentPrompt(query, history),
      json: true,
      maxTokens: 200,
    });
    return response.data;
  } catch {
    return localeKit.guessIntent(query, history);
  }
}

/**
 * Extract keywords using AI, falling back to locale heuristics.
 */
export async function extractKeywords(
  router: ProviderRouter,
  localeKit: LocaleKit,
  query: string,
  siteDescription: string,
): Promise<string[]> {
  try {
    const response = await router.complete<{ keywords: string[] }>('keywords', {
      system: localeKit.locale === 'zh'
        ? '你是一个严格输出 JSON 的关键词提取器。只能返回 JSON。'
        : 'You are a strict JSON keyword extractor. Return only JSON.',
      prompt: localeKit.buildKeywordPrompt(query, siteDescription),
      json: true,
      maxTokens: 180,
    });

    const keywords = Array.isArray(response.data.keywords)
      ? response.data.keywords.map((item) => String(item).trim()).filter(Boolean)
      : [];

    return keywords.length > 0 ? keywords.slice(0, 5) : localeKit.fallbackKeywords(query);
  } catch {
    return localeKit.fallbackKeywords(query);
  }
}

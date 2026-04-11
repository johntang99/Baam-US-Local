/**
 * @baam/helper-en — English locale plugin for AI Helper
 *
 * Implements the LocaleKit interface with English-specific logic:
 * - English keyword extraction
 * - English prompts (system, user, intent, keyword, follow-up)
 * - English heuristic intent classification
 * - English service intent detection (dentist, lawyer, plumber, etc.)
 */

import type { HelperIntent, HelperMessage, IntentDecision, LocaleKit, ServiceIntentProfile, UserPromptParams } from '@/lib/helper-core';
import { fallbackKeywordExtraction } from './keywords/extractor';
import {
  buildEnglishSystemPrompt,
  buildEnglishFollowUpSystemPrompt,
  buildEnglishFollowUpPrompt,
  buildEnglishIntentPrompt,
  buildEnglishKeywordPrompt,
  buildEnglishUserPrompt,
  buildEnglishModeInstructions,
} from './prompts';
import { RECENT_HINTS, DISCOVER_HINTS, GUIDE_HINTS, RECOMMEND_HINTS } from './intent-hints';
import { detectEnglishServiceIntent, extractEnglishServiceConstraints } from './service-intent/profiles';

export interface EnglishLocaleOptions {
  /** Override the default personality in system prompt */
  personalityOverride?: string;
  /** Extra hints for recommendation intent */
  extraRecommendHints?: string[];
  /** Extra hints for guide intent */
  extraGuideHints?: string[];
}

/**
 * Create an English LocaleKit for the Helper engine.
 */
export function createEnglishLocaleKit(options?: EnglishLocaleOptions): LocaleKit {
  const extraRecommend = options?.extraRecommendHints ?? [];
  const extraGuide = options?.extraGuideHints ?? [];

  return {
    locale: 'en',

    buildSystemPrompt(assistantName: string, siteName: string): string {
      if (options?.personalityOverride) {
        const base = buildEnglishSystemPrompt(assistantName, siteName);
        const lines = base.split('\n');
        lines[0] = options.personalityOverride;
        return lines.join('\n');
      }
      return buildEnglishSystemPrompt(assistantName, siteName);
    },

    buildUserPrompt(params: UserPromptParams): string {
      return buildEnglishUserPrompt(params);
    },

    buildIntentPrompt(query: string, history: HelperMessage[]): string {
      return buildEnglishIntentPrompt(query, history);
    },

    buildKeywordPrompt(query: string, siteDescription: string): string {
      return buildEnglishKeywordPrompt(query, siteDescription);
    },

    guessIntent(query: string, history: HelperMessage[]): IntentDecision {
      const trimmed = query.trim().toLowerCase();
      const shortFollowup = trimmed.length <= 20 && history.length > 0;

      if (shortFollowup && /^(yes|no|thanks|ok|sure|more|also|what about|and|tell me)/.test(trimmed)) {
        return { intent: 'followup', needsWeb: false, reason: 'short conversational reply' };
      }

      if (DISCOVER_HINTS.some((h) => trimmed.includes(h))) {
        return { intent: 'discoverMode', needsWeb: false, reason: 'community/discover content' };
      }

      if ([...GUIDE_HINTS, ...extraGuide].some((h) => trimmed.includes(h))) {
        return { intent: 'guideMode', needsWeb: false, reason: 'how-to or guide request' };
      }

      if ([...RECOMMEND_HINTS, ...extraRecommend].some((h) => trimmed.includes(h))) {
        return { intent: 'localRecommendation', needsWeb: false, reason: 'recommendation request' };
      }

      if (RECENT_HINTS.some((h) => trimmed.includes(h))) {
        return { intent: 'freshInfo', needsWeb: true, reason: 'needs recent information' };
      }

      return { intent: 'localLookup', needsWeb: false, reason: 'default local lookup' };
    },

    fallbackKeywords(query: string): string[] {
      return fallbackKeywordExtraction(query);
    },

    buildFollowUpPrompt(query: string, lastExcerpt: string): string {
      return buildEnglishFollowUpPrompt(query, lastExcerpt);
    },

    buildFollowUpSystemPrompt(assistantName: string, siteName: string): string {
      return buildEnglishFollowUpSystemPrompt(assistantName, siteName);
    },

    buildModeInstructions(intent: HelperIntent): string {
      return buildEnglishModeInstructions(intent);
    },

    detectServiceIntent(query: string, keywords: string[]): ServiceIntentProfile | null {
      return detectEnglishServiceIntent(query, keywords);
    },

    extractServiceConstraints(query: string): string[] {
      return extractEnglishServiceConstraints(query);
    },

    messages: {
      emptyQueryError: 'Please enter your question',
      fallbackError: "I wasn't able to complete the answer right now. Please try again or rephrase your question with more specific details.",
      noResultsMessage: (query: string) =>
        `⚠️ I couldn't find enough local data to match "${query}".\n\nTry adding:\n1. A specific area or neighborhood\n2. A more specific need\n3. Budget range or timing`,
    },
  };
}

// Re-export useful utilities
export { normalizeKeywords } from './keywords/extractor';
export { detectEnglishServiceIntent, extractEnglishServiceConstraints } from './service-intent/profiles';

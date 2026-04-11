/**
 * Helper Engine: the main orchestrator.
 * Pipeline: follow-up detection → intent → keywords → retrieval → ranking → answer.
 */

import type {
  HelperEngine,
  HelperMessage,
  HelperResult,
  HelperSiteConfig,
  QualityLevel,
  RetrievalPayload,
  SourceItem,
} from './types';
import { createProviderRouterFromConfig } from './providers';
import { classifyIntent, extractKeywords } from './intent/classifier';
import { classifyFollowUp, generateFollowUpAnswer } from './intent/follow-up';
import { evaluateQualityLevel } from './ranking/quality';
import { buildEffectiveSystemPrompt, buildAnswerUserPrompt } from './answer/builder';
import {
  buildStrictRecommendationTable,
  countMarkdownTableRows,
  harmonizeRecommendationCount,
  injectStrictRecommendationTable,
} from './answer/table';
import {
  dedupeAndCapSources,
  diversifySources,
  rankSourcesByRelevance,
  selectVisibleSources,
} from './answer/post-process';
import { composeRetrieval } from './retrieval/compose';
import { logSearchTelemetry } from './telemetry/logger';

export function createEngine(config: HelperSiteConfig): HelperEngine {
  const router = createProviderRouterFromConfig(config);
  const { localeKit } = config;
  const locale = localeKit.locale;
  const strictEvidenceMode = config.features?.strictEvidenceMode ?? false;
  const fastMode = config.features?.fastMode ?? false;
  const maxTokens = config.features?.answerMaxTokens ?? 1800;
  const primaryType = config.contentTypes.find((ct) => ct.isPrimary);
  const primaryLabel = primaryType?.label ?? '';

  return {
    async ask(query: string, history: HelperMessage[] = []): Promise<HelperResult> {
      const startedAt = Date.now();

      if (!query?.trim() || query.length < 2) {
        return {
          answer: localeKit.messages.emptyQueryError,
          sources: [],
          intent: 'localLookup',
          keywords: [],
          usedWebFallback: false,
          provider: 'none',
        };
      }

      // ─── Follow-up detection ───────────────────────────────
      if (history.length >= 2) {
        const classification = await classifyFollowUp(router, localeKit, query, history);

        if (classification === 'FOLLOWUP') {
          try {
            const result = await generateFollowUpAnswer(
              router, localeKit, config.assistantName, config.siteName,
              query, history, Math.min(maxTokens, 2048),
            );

            if (config.features?.telemetryEnabled && config.supabaseAdmin) {
              await logSearchTelemetry(config.supabaseAdmin, {
                query,
                queryLanguage: locale,
                regionId: (config.siteContext.regionIds as string[])?.[0] ?? null,
                resultCount: 0,
                resultTypes: [],
                aiIntent: `followup|quality=medium|strict=${strictEvidenceMode ? 1 : 0}`,
                responseTimeMs: Date.now() - startedAt,
              });
            }

            return {
              answer: result.answer,
              sources: [],
              intent: 'followup',
              keywords: ['(follow-up)'],
              usedWebFallback: false,
              provider: result.provider,
              qualityLevel: 'medium',
              debugInfo: {
                keywords: ['(follow-up)'],
                systemPrompt: '(conversation continuation — no RAG search)',
                userPrompt: query,
                model: result.model,
                totalResults: 0,
                qualityLevel: 'medium',
                strictEvidenceMode,
              },
            };
          } catch {
            // Follow-up generation failed — fall through to full search
          }
        }
        // SEARCH or NEW → fall through to full RAG search
      }

      // ─── Intent classification ─────────────────────────────
      const decision = fastMode
        ? localeKit.guessIntent(query, history)
        : await classifyIntent(router, localeKit, query, history);

      // ─── Keyword extraction ────────────────────────────────
      const keywords = decision.intent === 'followup'
        ? []
        : fastMode
          ? localeKit.fallbackKeywords(query)
          : await extractKeywords(router, localeKit, query, config.siteDescription);

      // ─── Content retrieval ─────────────────────────────────
      let internal: RetrievalPayload = { sources: [], contextBlocks: [], counts: {} };

      if (decision.intent !== 'followup') {
        internal = await config.fetcher.search({
          query,
          keywords,
          intent: decision.intent,
          locale,
          siteContext: config.siteContext,
        });
      }

      // ─── Engine-level keyword relevance filter ─────────────
      // Remove sources/candidates that don't match ANY specific keyword.
      // This catches cases where fetchers return broad category results
      // (e.g., all Middletown businesses when user asked for "pizza").
      const genericWordsEn = new Set(['best', 'good', 'top', 'recommend', 'find', 'near', 'nearby', 'place', 'places', 'local']);
      const genericWordsZh = new Set(['推荐', '最好', '附近', '哪家', '好的', '哪里']);
      const genericWords = locale === 'zh' ? genericWordsZh : genericWordsEn;
      const specificKws = keywords
        .filter((kw) => !genericWords.has(kw.toLowerCase()) && kw.length > 1)
        .map((kw) => kw.toLowerCase());

      if (specificKws.length > 0 && internal.sources.length > 0) {
        const isRelevant = (source: SourceItem) => {
          const text = [source.title || '', source.snippet || ''].join(' ').toLowerCase();
          return specificKws.some((kw) => text.includes(kw));
        };

        const filteredSources = internal.sources.filter(isRelevant);
        const filteredCandidates = internal.businessCandidates?.filter(isRelevant);

        // Only apply filter if it keeps at least some results.
        // If ALL results are removed, the query was likely too broad (e.g., "best restaurants")
        // and we should let the AI handle it with all results.
        if (filteredSources.length > 0 || filteredCandidates?.length) {
          internal = {
            ...internal,
            sources: filteredSources,
            businessCandidates: filteredCandidates,
            contextBlocks: internal.contextBlocks, // Keep full context for AI
          };
        } else if (filteredSources.length === 0 && filteredCandidates?.length === 0) {
          // No relevant results at all — clear everything so AI generates a "no results" answer
          internal = {
            ...internal,
            sources: [],
            businessCandidates: [],
            contextBlocks: [],
            counts: Object.fromEntries(Object.keys(internal.counts).map((k) => [k, 0])),
          };
        }
      }

      // ─── Web fallback ──────────────────────────────────────
      const { web, usedWebFallback } = await composeRetrieval(
        config, decision.intent, internal, query,
      );

      // ─── Quality assessment ────────────────────────────────
      const primaryCount = internal.sources.filter((s) => s.type === primaryLabel).length;
      const secondaryCount = internal.sources.filter((s) => s.type !== primaryLabel).length;
      const totalResults = internal.sources.length;
      const hasLocalEvidence = totalResults > 0;

      const qualityLevel: QualityLevel = evaluateQualityLevel({
        hasLocalEvidence,
        totalResults,
        rankingConsistency: 1, // Ranking consistency is handled by the fetcher
        primaryCount,
        secondaryCount,
      });

      // ─── Build context ─────────────────────────────────────
      const contextParts = internal.contextBlocks;

      // ─── Generate answer ───────────────────────────────────
      try {
        const systemPrompt = buildEffectiveSystemPrompt(
          localeKit, config.assistantName, config.siteName,
          qualityLevel, strictEvidenceMode,
        );

        const userPrompt = buildAnswerUserPrompt(localeKit, {
          query,
          intent: decision.intent,
          qualityLevel,
          contextParts,
          hasLocalEvidence,
          totalResults,
          strictEvidenceMode,
          history,
          usedWebFallback,
          webContextBlocks: web.contextBlocks,
          webCounts: web.counts,
        });

        const providerResponse = await router.complete<string>('answer', {
          system: systemPrompt,
          prompt: userPrompt,
          maxTokens: fastMode ? 1200 : maxTokens,
        });

        let answerText = String(providerResponse.data || '').trim();

        // Post-process: inject strict recommendation table for recommendation intent
        // Only inject when we actually have relevant business candidates
        if (decision.intent === 'localRecommendation') {
          const candidates = (internal.businessCandidates || internal.sources.filter((s) => s.type === primaryLabel)).slice(0, 20);
          if (candidates.length > 0) {
            const strictTable = buildStrictRecommendationTable(candidates, query, locale);
            const tableRowCount = countMarkdownTableRows(strictTable);
            if (tableRowCount > 0) {
              answerText = harmonizeRecommendationCount(answerText, tableRowCount);
              answerText = injectStrictRecommendationTable(answerText, strictTable);
            }
          }
        }

        // Build sources
        const visibleSources = selectVisibleSources(decision.intent, internal, web, primaryLabel);
        let finalSources = diversifySources(visibleSources);
        finalSources = dedupeAndCapSources(finalSources, 20);
        finalSources = rankSourcesByRelevance(finalSources, query, keywords, primaryLabel);

        // Build result types for telemetry
        const resultTypes = [...new Set(internal.sources.map((s) => s.type))];

        if (config.features?.telemetryEnabled && config.supabaseAdmin) {
          await logSearchTelemetry(config.supabaseAdmin, {
            query,
            queryLanguage: locale,
            regionId: (config.siteContext.regionIds as string[])?.[0] ?? null,
            resultCount: totalResults,
            resultTypes,
            aiIntent: `rag|quality=${qualityLevel}|strict=${strictEvidenceMode ? 1 : 0}`,
            responseTimeMs: Date.now() - startedAt,
          });
        }

        // Build context counts for debug info
        const contextCounts: Record<string, number> = {};
        for (const ct of config.contentTypes) {
          contextCounts[ct.key] = internal.sources.filter((s) => s.type === ct.label).length;
        }

        return {
          answer: answerText,
          sources: finalSources.slice(0, 10),
          intent: decision.intent,
          keywords,
          usedWebFallback,
          provider: `${providerResponse.provider}:${providerResponse.model}`,
          qualityLevel,
          debugInfo: {
            keywords,
            systemPrompt,
            userPrompt,
            model: providerResponse.model,
            totalResults,
            qualityLevel,
            strictEvidenceMode,
            contextCounts,
          },
        };
      } catch {
        // Fallback answer
        const visibleSources = selectVisibleSources(decision.intent, internal, web, primaryLabel);

        return {
          answer: localeKit.messages.fallbackError,
          sources: dedupeAndCapSources(visibleSources, 10),
          intent: decision.intent,
          keywords,
          usedWebFallback,
          provider: 'fallback',
          qualityLevel,
        };
      }
    },
  };
}

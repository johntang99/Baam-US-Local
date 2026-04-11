'use server';

import { createHelper, createBaamEnglishFetcher, type HelperMessage, type HelperResult } from '@/lib/helper-core';
import { createEnglishLocaleKit } from '@/lib/helper-en';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentSite } from '@/lib/sites';
import { allocateAnswerType } from '@/lib/helper/allocator';
import { fetchCategoryBusinesses, fetchRelatedContent, detectTownRegionId, findCategoryId, fetchCommunityContent, fetchNewsAndEvents, expandKeywordsFromSearchTerms } from '@/lib/helper/data';
import { buildBusinessRecommendation, buildBusinessLookup, buildGuideAnswer, buildInfoLookup, buildMixedAnswer, buildNoMatch, buildCommunityAnswer, buildNewsEventsAnswer, buildComparisonAnswer } from '@/lib/helper/builders';
// Helper types used inline below


function getQuickReplies(
  type: string,
  keywords: string[],
  extra?: { bizName?: string; pairNames?: [string, string]; category?: string; topBizNames?: string[] },
): string[] {
  const kw = keywords[0] || '';
  const cat = extra?.category || kw;
  const top = extra?.topBizNames;

  switch (type) {
    case 'business-recommendation':
      return [
        top?.[0] ? `Tell me about ${top[0]}` : '',
        top?.[0] && top?.[1] ? `${top[0]} vs ${top[1]}` : '',
        `${cat} open on weekends`,
      ].filter(s => s.length > 3);
    case 'business-lookup':
      return extra?.bizName
        ? [`Similar places to ${extra.bizName}`, `${extra.bizName} reviews`, 'Other options nearby']
        : [];
    case 'community':
      return [`${kw} businesses`, `${kw} guides`, `Latest ${kw} news`].filter(s => s.trim().length > 3);
    case 'news-events':
      return ['More events this month', 'Free events only', 'Family-friendly events'];
    case 'comparison':
      return extra?.pairNames
        ? [`Tell me about ${extra.pairNames[0]}`, `Tell me about ${extra.pairNames[1]}`, 'Other options']
        : [];
    case 'guide':
      return [`${kw} services nearby`, `What do locals say about ${kw}`, 'Related events'].filter(s => s.trim().length > 3);
    case 'info-lookup':
      return [`Related services nearby`, `What do locals say`, 'Related guides'];
    case 'mixed':
      return [
        top?.[0] ? `Tell me about ${top[0]}` : `More ${kw} options`,
        `What do locals say about ${kw}`,
      ].filter(s => s.length > 3);
    case 'no-match':
      return ['Browse all businesses', 'What events are happening', 'Ask the community'];
    default:
      return [];
  }
}

export async function askHelper(
  query: string,
  history: HelperMessage[] = [],
): Promise<{ error?: string; data?: HelperResult }> {
  if (!query?.trim() || query.trim().length < 2) {
    return { error: 'Please enter a more specific question' };
  }

  const startTime = Date.now();

  try {
    const supabase = createAdminClient();
    const site = await getCurrentSite();
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

    // ─── Step 1: Allocate answer type ──────────────────────
    let alloc;
    try {
      alloc = await allocateAnswerType(
        query, history, supabase, site.id, anthropicApiKey,
      );
    } catch (allocError) {
      console.error('[Helper] Allocation FAILED:', allocError);
      // Fallback to engine on allocation failure
      alloc = { type: 'follow-up' as const, keywords: [] as string[], businesses: [], matchedCategory: null, locationFallback: false, townLabel: null, related: { guides: [], forum: [], discover: [], news: [] }, singleBusiness: null, comparisonPair: null };
    }

    // ─── Step 2: Route to the appropriate builder ──────────
    const logResult = (result: { error?: string; data?: HelperResult }) => {
      const ms = Date.now() - startTime;
      console.log(`[Helper] ${JSON.stringify({ query, type: alloc.type, keywords: alloc.keywords, provider: result.data?.provider || 'error', ms, sources: result.data?.sources?.length || 0 })}`);
      return result;
    };
    console.log(`[Helper] Allocated type: ${alloc.type} | keywords: ${alloc.keywords.join(',')} | singleBiz: ${alloc.singleBusiness?.display_name || 'none'}`);

    // Type 7 (follow-up) and unimplemented types: delegate to engine
    const engineTypes = new Set(['follow-up', 'life-event']);

    if (engineTypes.has(alloc.type)) {
      // Use the AI engine for these types
      const helper = createHelper({
        siteName: 'Baam',
        assistantName: 'Helper',
        siteDescription: 'Local community platform for Middletown & Orange County, NY — businesses, news, guides, forum, events',
        contentTypes: [
          { key: 'businesses', label: 'Business', pathPrefix: '/businesses/', isPrimary: true, relevanceMin: 0.2, maxContext: 8, maxSources: 12 },
          { key: 'guides', label: 'Guide', pathPrefix: '/guides/', relevanceMin: 0.2, maxContext: 4, maxSources: 4 },
          { key: 'news', label: 'News', pathPrefix: '/news/', relevanceMin: 0.2, maxContext: 3, maxSources: 3 },
          { key: 'forum', label: 'Forum', pathPrefix: '/forum/', relevanceMin: 0.2, maxContext: 3, maxSources: 3 },
          { key: 'discover', label: 'Discover', pathPrefix: '/discover/', relevanceMin: 0.15, maxContext: 3, maxSources: 3 },
          { key: 'events', label: 'Event', pathPrefix: '/events/', relevanceMin: 0.15, maxContext: 3, maxSources: 3 },
        ],
        fetcher: createBaamEnglishFetcher(supabase),
        localeKit: createEnglishLocaleKit(),
        siteContext: { siteId: site.id, regionIds: site.regionIds, siteScope: 'en' },
        providers: {
          strategy: 'anthropic',
          anthropicApiKey,
          anthropicModel: process.env.HELPER_ANTHROPIC_MODEL || 'claude-haiku-4-5',
          openAiApiKey: process.env.OPENAI_API_KEY,
          openAiModel: process.env.HELPER_OPENAI_MODEL || 'gpt-5.4',
        },
        features: { webFallbackEnabled: true, telemetryEnabled: true, answerMaxTokens: 2048 },
        supabaseAdmin: supabase,
      });
      const result = await helper.ask(query, history);
      return logResult({ data: result });
    }

    // ─── Type 9: Specific Business Lookup ────────────────
    if (alloc.type === 'business-lookup') {
      const { answer, sources } = buildBusinessLookup(alloc, query);
      return logResult({
        data: {
          answer, sources, intent: 'localLookup', keywords: alloc.keywords, usedWebFallback: false, provider: 'template',
          quickReplies: getQuickReplies('business-lookup', alloc.keywords, { bizName: alloc.singleBusiness?.display_name }),
        },
      });
    }

    // ─── Type 5: Community / Discover ─────────────────────
    if (alloc.type === 'community') {
      const { forum, discover } = await fetchCommunityContent(supabase, site.id, alloc.keywords);
      const { answer, sources } = buildCommunityAnswer(alloc, forum, discover);
      return logResult({
        data: { answer, sources, intent: 'community', keywords: alloc.keywords, usedWebFallback: false, provider: 'template',
          quickReplies: getQuickReplies('community', alloc.keywords),
        },
      });
    }

    // ─── Type 6: News & Events ──────────────────────────
    if (alloc.type === 'news-events') {
      const { news, events } = await fetchNewsAndEvents(supabase, site.id, alloc.keywords);
      const { answer, sources } = buildNewsEventsAnswer(alloc, news, events);
      return logResult({
        data: { answer, sources, intent: 'newsEvents', keywords: alloc.keywords, usedWebFallback: false, provider: 'template',
          quickReplies: getQuickReplies('news-events', alloc.keywords),
        },
      });
    }

    // ─── Type 10: Comparison ────────────────────────────
    if (alloc.type === 'comparison') {
      const { answer, sources } = buildComparisonAnswer(alloc);
      const pairNames = alloc.comparisonPair ? [alloc.comparisonPair[0].display_name, alloc.comparisonPair[1].display_name] as [string, string] : undefined;
      return logResult({
        data: { answer, sources, intent: 'comparison', keywords: alloc.keywords, usedWebFallback: false, provider: 'template',
          quickReplies: getQuickReplies('comparison', alloc.keywords, { pairNames }),
        },
      });
    }

    // ─── Type 1: Business Recommendation ─────────────────
    if (alloc.type === 'business-recommendation') {
      // Fetch actual businesses from the matched category
      const category = await findCategoryId(supabase, site.id, alloc.keywords, query);
      if (!category) {
        const { answer, sources } = buildNoMatch(query, alloc.keywords);
        return logResult({ data: { answer, sources, intent: 'localRecommendation', keywords: alloc.keywords, usedWebFallback: false, provider: 'template', quickReplies: getQuickReplies('no-match', alloc.keywords) } });
      }

      const townRegionId = detectTownRegionId(query);
      const { businesses, locationFallback } = await fetchCategoryBusinesses(supabase, site.id, category.id, townRegionId);
      const related = await fetchRelatedContent(supabase, site.id, alloc.keywords);

      if (businesses.length === 0) {
        const { answer, sources } = buildNoMatch(query, alloc.keywords);
        return logResult({ data: { answer, sources, intent: 'localRecommendation', keywords: alloc.keywords, usedWebFallback: false, provider: 'template', quickReplies: getQuickReplies('no-match', alloc.keywords) } });
      }

      const enrichedAlloc = {
        ...alloc,
        businesses,
        matchedCategory: category.name,
        locationFallback,
        related,
      };

      const { answer, sources } = buildBusinessRecommendation(enrichedAlloc);
      // Build map data for businesses with coordinates
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapBiz = (businesses as any[]).filter((b) => b.latitude && b.longitude).map((b) => ({
        id: b.id, slug: b.slug, display_name: b.display_name,
        short_desc_en: b.short_desc_en || '', avg_rating: b.avg_rating,
        review_count: b.review_count, phone: b.phone,
        address_full: b.address_full, latitude: Number(b.latitude),
        longitude: Number(b.longitude), ai_tags: b.ai_tags || [],
        total_score: b.total_score || 0, is_featured: !!b.is_featured,
      }));
      return logResult({
        data: {
          answer, sources, intent: 'localRecommendation', keywords: alloc.keywords, usedWebFallback: false, provider: 'template',
          quickReplies: getQuickReplies('business-recommendation', alloc.keywords, {
            category: category.name,
            topBizNames: businesses.slice(0, 2).map(b => b.display_name),
          }),
          mapBusinesses: mapBiz.length > 0 ? mapBiz : undefined,
        },
      });
    }

    // ─── Types 2, 3, 4: Guide, Info, Mixed ───────────────
    // These use AI for the main answer, then enhance with structured content
    if (alloc.type === 'guide' || alloc.type === 'info-lookup' || alloc.type === 'mixed') {
      // For info-lookup and mixed: override locale kit to encourage direct answers
      const localeKit = (alloc.type === 'info-lookup' || alloc.type === 'mixed')
        ? createEnglishLocaleKit({
            personalityOverride: `You are "Helper", Baam's local AI assistant for Middletown & Orange County, NY. Answer directly from your general knowledge AND the search results provided — DO NOT say "I don't have this in my search results" or "no local results found." Just answer the question clearly and helpfully. If you can localize the answer to Orange County, do so. When the question involves both information AND services, provide the info first, then recommend relevant local businesses.`,
          })
        : createEnglishLocaleKit();

      const helper = createHelper({
        siteName: 'Baam',
        assistantName: 'Helper',
        siteDescription: 'Local community platform for Middletown & Orange County, NY',
        contentTypes: [
          { key: 'businesses', label: 'Business', pathPrefix: '/businesses/', isPrimary: true },
          { key: 'guides', label: 'Guide', pathPrefix: '/guides/' },
          { key: 'news', label: 'News', pathPrefix: '/news/' },
          { key: 'forum', label: 'Forum', pathPrefix: '/forum/' },
          { key: 'discover', label: 'Discover', pathPrefix: '/discover/' },
          { key: 'events', label: 'Event', pathPrefix: '/events/' },
        ],
        fetcher: createBaamEnglishFetcher(supabase),
        localeKit,
        siteContext: { siteId: site.id, regionIds: site.regionIds, siteScope: 'en' },
        providers: { strategy: 'anthropic', anthropicApiKey, anthropicModel: process.env.HELPER_ANTHROPIC_MODEL || 'claude-haiku-4-5' },
        features: { webFallbackEnabled: true, answerMaxTokens: 2048 },
        supabaseAdmin: supabase,
      });

      const aiResult = await helper.ask(query, history);
      const aiAnswer = aiResult.answer;

      // Fetch related content and businesses for enrichment
      const related = await fetchRelatedContent(supabase, site.id, alloc.keywords);
      let businesses: import('@/lib/helper/types').BusinessResult[] = [];

      if (alloc.type === 'mixed') {
        // For mixed type: always try to find businesses
        const category = await findCategoryId(supabase, site.id, alloc.keywords, query);
        if (category) {
          const townRegionId = detectTownRegionId(query);
          const fetched = await fetchCategoryBusinesses(supabase, site.id, category.id, townRegionId);
          businesses = fetched.businesses;
        }
      }
      // For guide type: only add businesses if the AI answer already mentions them
      // Don't force-inject unrelated business categories into guide answers

      let enrichedAlloc = { ...alloc, businesses, related };

      let built;
      if (alloc.type === 'guide') {
        // For guide: use AI answer directly
        built = buildGuideAnswer(enrichedAlloc, aiAnswer);
        // Filter sources: remove Business sources for guide queries
        // Engine returns businesses matching location keywords ("Orange County BMW" for food stamps query)
        const businessTypes = new Set(['Business', '商家']);
        built.sources = aiResult.sources.filter((s) => !businessTypes.has(s.type));
      } else if (alloc.type === 'mixed') {
        // Clean AI answer: remove "no local results" apologies
        let cleanedMixed = aiAnswer
          .replace(/^.*?(?:no local results|don't have.*?local|search results.*?don't include|need to be honest).*?\n+/i, '')
          .replace(/^.*?(?:I appreciate the question, but).*?\n+/i, '')
          .replace(/^.*?(?:I need to be honest).*?\n+/i, '')
          .trim();
        if (!cleanedMixed || cleanedMixed.length < 50) cleanedMixed = aiAnswer;

        // Expand keywords using category search_terms from DB (replaces hardcoded mappings)
        const expandedKws = await expandKeywordsFromSearchTerms(supabase, alloc.keywords);

        // Filter businesses by keyword relevance BEFORE passing to builder
        if (businesses.length > 0 && expandedKws.length > 0) {
          const relevantBiz = businesses.filter((b) => {
            const text = [b.display_name, b.short_desc_en, ...(b.ai_tags || [])].join(' ').toLowerCase();
            return expandedKws.some((kw) => text.includes(kw));
          });
          enrichedAlloc = { ...enrichedAlloc, businesses: relevantBiz };
        }

        built = buildMixedAnswer(enrichedAlloc, cleanedMixed);

        // Also filter the answer text: strip any AI-generated table with irrelevant businesses
        if (built.answer && alloc.keywords.length > 0) {
          const tableRegex = /(\|[^\n]+\|\n\|[\s:|-]+\|\n)((?:\|[^\n]+\|\n?)*)/gm;
          const kws = [...expandedKws]; // reuse expanded keywords from above
          built.answer = built.answer.replace(tableRegex, (_match, header, rows) => {
            const dataRows = rows.split('\n').filter((r: string) => r.trim().startsWith('|'));
            const relevant = dataRows.filter((r: string) => kws.some((kw) => r.toLowerCase().includes(kw)));
            if (relevant.length === 0 && dataRows.length > 0) return ''; // strip entirely
            if (relevant.length < dataRows.length) {
              // Renumber and keep only relevant rows
              const renumbered = relevant.map((row: string, idx: number) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : String(idx + 1);
                return row.replace(/^\|\s*(?:🥇|🥈|🥉|\d+)\s*\|/, `| ${medal} |`);
              });
              return header + renumbered.join('\n') + '\n';
            }
            return _match; // keep as-is if all relevant
          });
          built.answer = built.answer.replace(/\n{3,}/g, '\n\n').trim();
        }

        // Combine: business sources from builder + non-business AI sources
        const businessTypes = new Set(['Business', '商家']);
        const aiNonBizSources = aiResult.sources.filter((s) => !businessTypes.has(s.type));
        built.sources = [...built.sources, ...aiNonBizSources];
      } else {
        // Type 3: Info Lookup
        // Clean AI answer: remove "no local results" apologies for fact-based questions
        let cleanedAnswer = aiAnswer
          .replace(/^.*?(?:no local results|don't have.*?local|search results.*?don't include|need to be honest).*?\n+/i, '')
          .replace(/^.*?(?:I appreciate the question, but).*?\n+/i, '')
          .trim();
        if (!cleanedAnswer || cleanedAnswer.length < 50) cleanedAnswer = aiAnswer; // fallback if cleaning removed too much

        built = buildInfoLookup(enrichedAlloc, cleanedAnswer);
        const businessTypesInfo = new Set(['Business', '商家']);
        built.sources = aiResult.sources.filter((s) => !businessTypesInfo.has(s.type));
      }

      return logResult({
        data: {
          answer: built.answer,
          sources: built.sources,
          intent: aiResult.intent,
          keywords: alloc.keywords,
          usedWebFallback: aiResult.usedWebFallback,
          provider: aiResult.provider,
          quickReplies: getQuickReplies(alloc.type, alloc.keywords, {
            topBizNames: enrichedAlloc.businesses.slice(0, 2).map(b => b.display_name),
          }),
        },
      });
    }

    // ─── Type 8: No Match ────────────────────────────────
    const { answer, sources } = buildNoMatch(query, alloc.keywords);
    return logResult({
      data: {
        answer, sources, intent: 'localLookup', keywords: alloc.keywords, usedWebFallback: false, provider: 'template',
        quickReplies: getQuickReplies('no-match', alloc.keywords),
      },
    });
  } catch (error) {
    const ms = Date.now() - startTime;
    console.log(`[Helper] ${JSON.stringify({ query, type: 'error', ms, error: error instanceof Error ? error.message : 'unknown' })}`);
    return {
      error: error instanceof Error ? error.message : 'Helper is temporarily unavailable. Please try again.',
    };
  }
}

export async function submitHelperFeedback(
  query: string,
  rating: 1 | -1,
  meta?: { answerType?: string; keywords?: string[]; provider?: string; comment?: string },
): Promise<{ error?: string }> {
  try {
    const supabase = createAdminClient();
    const site = await getCurrentSite();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('helper_feedback').insert({
      site_id: site.id,
      query,
      answer_type: meta?.answerType || null,
      rating,
      comment: meta?.comment || null,
      keywords: meta?.keywords || [],
      provider: meta?.provider || null,
    });

    if (error) return { error: error.message };
    return {};
  } catch {
    return { error: 'Failed to submit feedback' };
  }
}

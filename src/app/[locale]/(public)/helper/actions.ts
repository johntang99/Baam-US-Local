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

    // Fast direct OpenAI call — bypasses full engine pipeline (2-3x faster)
    // GPT-4.1-mini: best balance of speed + quality
    const runFastAI = async (systemPrompt: string): Promise<HelperResult> => {
      const openAiKey = process.env.OPENAI_API_KEY || '';
      const model = process.env.HELPER_FAST_MODEL || 'gpt-4.1-mini';
      const msgs = [
        { role: 'system' as const, content: systemPrompt },
        ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        { role: 'user' as const, content: query },
      ];
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiKey}` },
        body: JSON.stringify({ model, max_tokens: 2048, messages: msgs }),
      });
      if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || '';
      return { answer, sources: [], intent: 'guideMode' as HelperResult['intent'], keywords: alloc.keywords, usedWebFallback: false, provider: `openai:${model}` };
    };

    // Type 7 (follow-up): needs full engine for conversation context
    // Type 11 (life-event): use fast AI
    if (alloc.type === 'follow-up') {
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

    if (alloc.type === 'life-event') {
      const result = await runFastAI(
        `You are "Helper", Baam's local AI assistant for Middletown & Orange County, NY. The user is going through a major life change. Give a comprehensive, structured guide covering multiple areas (documents, housing, healthcare, education, transportation, finances). Use tables, checklists, and timelines. Be specific about local resources.`
      );
      const related = await fetchRelatedContent(supabase, site.id, alloc.keywords);
      result.sources = [
        ...related.guides.map(g => ({ type: 'Guide', title: g.title, url: `/guides/${g.slug}`, snippet: g.snippet })),
        ...related.news.map(n => ({ type: 'News', title: n.title, url: `/news/${n.slug}`, snippet: n.snippet })),
      ];
      result.quickReplies = getQuickReplies('guide', alloc.keywords);
      return logResult({ data: result });
    }

    // ─── Helper: build mapBusinesses from any business array ───
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toMapBusinesses = (businesses: any[]) => {
      const mapped = businesses.filter((b) => b.latitude && b.longitude).map((b) => ({
        id: b.id, slug: b.slug, display_name: b.display_name,
        short_desc_en: b.short_desc_en || '', avg_rating: b.avg_rating,
        review_count: b.review_count, phone: b.phone, website_url: b.website_url || null,
        address_full: b.address_full, latitude: Number(b.latitude),
        longitude: Number(b.longitude), ai_tags: b.ai_tags || [],
        total_score: b.total_score || 0, is_featured: !!b.is_featured,
      }));
      return mapped.length > 0 ? mapped : undefined;
    };

    // ─── Type 9: Specific Business Lookup ────────────────
    if (alloc.type === 'business-lookup') {
      const { answer, sources } = buildBusinessLookup(alloc, query);
      // Single business → show on map if it has coordinates
      const singleBiz = alloc.singleBusiness;
      return logResult({
        data: {
          answer, sources, intent: 'localLookup', keywords: alloc.keywords, usedWebFallback: false, provider: 'template',
          quickReplies: getQuickReplies('business-lookup', alloc.keywords, { bizName: singleBiz?.display_name }),
          mapBusinesses: singleBiz ? toMapBusinesses([singleBiz]) : undefined,
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
      // Show both businesses on map
      const compMapBiz = alloc.comparisonPair ? toMapBusinesses([alloc.comparisonPair[0], alloc.comparisonPair[1]]) : undefined;
      return logResult({
        data: { answer, sources, intent: 'comparison', keywords: alloc.keywords, usedWebFallback: false, provider: 'template',
          quickReplies: getQuickReplies('comparison', alloc.keywords, { pairNames }),
          mapBusinesses: compMapBiz,
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

      // Approach 3: If ambiguous, add alternative category quick replies
      let ambiguityReplies: string[] | undefined;
      if (category.ambiguous && category.alternatives && category.alternatives.length > 0) {
        ambiguityReplies = category.alternatives.map(alt =>
          `Show me ${alt.name} instead`
        );
      }

      const townRegionId = detectTownRegionId(query);
      const { businesses: rawBusinesses, locationFallback } = await fetchCategoryBusinesses(supabase, site.id, category.id, townRegionId);
      // Use category name + keywords for related content (more relevant than generic keywords alone)
      const relatedKeywords = [...new Set([
        ...category.name.toLowerCase().split(/\s+&?\s*/).filter(w => w.length > 2),
        ...alloc.keywords.filter(kw => kw.length > 3), // only meaningful keywords
      ])].slice(0, 5); // max 5 keywords for relevance
      const related = await fetchRelatedContent(supabase, site.id, relatedKeywords);

      if (rawBusinesses.length === 0) {
        const { answer, sources } = buildNoMatch(query, alloc.keywords);
        return logResult({ data: { answer, sources, intent: 'localRecommendation', keywords: alloc.keywords, usedWebFallback: false, provider: 'template', quickReplies: getQuickReplies('no-match', alloc.keywords) } });
      }

      // Boost businesses whose name/description matches search keywords — demote generic chains
      // Skip this for parent categories (e.g. "best restaurants" → food-dining) since all results are relevant
      const { data: hasChildren } = await supabase.from('categories').select('id').eq('parent_id', category.id).limit(1);
      const isParentCategory = hasChildren && hasChildren.length > 0;

      const expandedKws = await expandKeywordsFromSearchTerms(supabase, alloc.keywords);
      let businesses = rawBusinesses;
      if (!isParentCategory && expandedKws.length > 0 && rawBusinesses.length > 3) {
        const relevant = rawBusinesses.filter(b => {
          const text = [b.display_name, b.short_desc_en, ...(b.ai_tags || [])].join(' ').toLowerCase();
          return expandedKws.some(kw => text.includes(kw));
        });
        const irrelevant = rawBusinesses.filter(b => !relevant.includes(b));
        // Show relevant first, then fill with remaining (don't drop them entirely)
        businesses = [...relevant, ...irrelevant];
      }

      const enrichedAlloc = {
        ...alloc,
        businesses,
        matchedCategory: category.name,
        locationFallback,
        related,
      };

      const { answer, sources } = buildBusinessRecommendation(enrichedAlloc);
      return logResult({
        data: {
          answer, sources, intent: 'localRecommendation', keywords: alloc.keywords, usedWebFallback: false, provider: 'template',
          quickReplies: [
            // If ambiguous, prepend alternative category suggestions
            ...(ambiguityReplies || []),
            ...getQuickReplies('business-recommendation', alloc.keywords, {
              category: category.name,
              topBizNames: businesses.slice(0, 2).map(b => b.display_name),
            }),
          ].slice(0, 4), // max 4 quick replies
          mapBusinesses: toMapBusinesses(businesses),
        },
      });
    }

    // ─── Types 2, 3, 4: Guide, Info, Mixed ───────────────
    // Use fast direct OpenAI call (2-3x faster than full engine pipeline)
    if (alloc.type === 'guide' || alloc.type === 'info-lookup' || alloc.type === 'mixed') {
      const systemPrompt = `You are "Helper", Baam's local AI assistant for Middletown & Orange County, NY. Answer directly and helpfully. Use headings, tables, and bullet points for structure. Localize answers to Orange County/Middletown when possible. DO NOT say "I don't have this in my search results". ${alloc.type === 'mixed' ? 'When the question involves both information AND services, provide the info first, then recommend relevant local businesses.' : ''}${alloc.type === 'info-lookup' ? 'Give a direct, concise factual answer.' : ''}`;

      const aiResult = await runFastAI(systemPrompt);
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
          mapBusinesses: businesses.length > 0 ? toMapBusinesses(businesses) : undefined,
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

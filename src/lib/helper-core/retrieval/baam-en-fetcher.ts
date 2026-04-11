/**
 * English Baam Content Fetcher
 *
 * Queries English columns (display_name, short_desc_en, title_en, summary_en)
 * with site_id + region_id filtering for the English site.
 */

import type { ContentFetcher, HelperIntent, RetrievalPayload, SearchParams, SourceItem } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

function escapeLikeKeyword(kw: string): string {
  return kw.replace(/,/g, ' ').trim();
}

function buildOr(keywords: string[], columns: string[]): string {
  const conditions: string[] = [];
  for (const kw of keywords) {
    const safe = escapeLikeKeyword(kw);
    if (!safe) continue;
    for (const col of columns) {
      conditions.push(`${col}.ilike.%${safe}%`);
    }
  }
  return conditions.join(',');
}

const GENERIC_WORDS = new Set([
  'apply', 'how', 'what', 'where', 'which', 'can', 'need', 'process',
  'service', 'consult', 'recommend', 'good', 'best', 'nearby', 'price',
  'cost', 'much', 'find', 'top', 'restaurant', 'place', 'shop', 'store',
]);

function buildBusinessOr(keywords: string[], columns: string[]): string {
  const specific = keywords.filter((kw) => !GENERIC_WORDS.has(kw.toLowerCase()) && kw.length > 1);
  return buildOr(specific.length > 0 ? specific : keywords, columns);
}

function toSnippet(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 180);
  return fallback;
}

const TOWN_REGION_MAP: Record<string, string> = {
  'middletown': 'a5bb3fb8-26b4-4a91-928e-0373f1d28be0',
  'newburgh': '1e316411-9ee1-41e5-b6d1-a0d92b0683d6',
  'goshen': '5b84e90c-0f37-4e33-b361-b870de175cf7',
  'monroe': 'cdec82a7-eb63-41d2-8c82-95ec36bdb020',
  'warwick': '9d32b3ba-650a-4b52-96bb-7a587891e344',
  'chester': '1e8e1ce2-1d65-49dc-a3d1-de9ad2123519',
  'port jervis': '7a66b436-6117-463b-896a-19b928f67e92',
  'wallkill': 'd10ee554-82a7-4e21-8a2c-95dcaf53b297',
  'cornwall': '0f9cfd16-d1f7-4474-8ff1-20a2e7eb4a89',
  'new windsor': '44972762-2abe-4dd9-91b6-148bf072f440',
  'montgomery': '3feb9bc2-f1d8-4254-91c9-b383fa109d35',
  'pine bush': '980b9088-e084-4479-b62c-ecda4f8f9f16',
  'deerpark': 'bdae86a0-5d2e-4898-912b-cd19acebbfa3',
};

function detectTownRegionId(query: string): string | null {
  const lower = query.toLowerCase();
  for (const [town, regionId] of Object.entries(TOWN_REGION_MAP)) {
    if (lower.includes(town)) return regionId;
  }
  return null;
}

// ─── Business search ─────────────────────────────────────────

async function searchBusinesses(
  supabase: any,
  keywords: string[],
  query: string,
  siteId: string,
  townBizIds: Set<string> | null,
): Promise<SourceItem[]> {
  const bizFields = 'id, slug, display_name, short_desc_en, ai_tags, avg_rating, review_count, phone, is_featured, address_full, website_url, total_score';
  const results: AnyRow[] = [];
  const seenIds = new Set<string>();
  const categoryBizIds = new Set<string>();

  const addResults = (data: AnyRow[] | null) => {
    for (const b of data || []) {
      if (!b?.id || seenIds.has(b.id)) continue;
      if (townBizIds && !townBizIds.has(b.id)) continue;
      seenIds.add(b.id);
      results.push(b);
    }
  };

  // Strategy 1: Category matching using name_en + search_terms
  const { data: allBizCats } = await supabase
    .from('categories')
    .select('id, name_en, slug, parent_id, search_terms')
    .eq('type', 'business')
    .eq('site_scope', 'en');

  const matchedCats: { cat: AnyRow; matchType: 'name' | 'terms' }[] = [];
  for (const cat of (allBizCats || []) as AnyRow[]) {
    const nameEn = (cat.name_en || '').toLowerCase();
    const terms: string[] = cat.search_terms || [];
    for (const kw of keywords) {
      if (kw.length < 2) continue;
      const kwLower = kw.toLowerCase();
      const nameMatch = nameEn && (nameEn.includes(kwLower) || kwLower.includes(nameEn));
      const termsMatch = terms.some((t: string) => {
        const tLower = t.toLowerCase();
        return tLower.includes(kwLower) || (tLower.length >= 3 && kwLower.includes(tLower));
      });
      if (nameMatch || termsMatch) {
        matchedCats.push({ cat, matchType: nameMatch ? 'name' : 'terms' });
        break;
      }
    }
  }

  if (matchedCats.length > 0) {
    const MAX_TERMS_ONLY_SIZE = 50;
    const catIdsByMatch = new Map<string, 'name' | 'terms'>();
    for (const { cat, matchType } of matchedCats) {
      catIdsByMatch.set(cat.id, matchType);
    }

    // Parent → children expansion
    const parentMatches = matchedCats.filter((m) => !m.cat.parent_id);
    if (parentMatches.length > 0) {
      const { data: children } = await supabase
        .from('categories').select('id, parent_id')
        .in('parent_id', parentMatches.map((m) => m.cat.id));
      for (const child of (children || []) as AnyRow[]) {
        const parentType = catIdsByMatch.get(child.parent_id);
        if (parentType) catIdsByMatch.set(child.id, parentType);
      }
    }

    const { data: bizCatLinks } = await supabase
      .from('business_categories')
      .select('business_id, category_id')
      .in('category_id', [...catIdsByMatch.keys()])
      .limit(10000);

    const bizPerCat = new Map<string, string[]>();
    for (const link of (bizCatLinks || []) as AnyRow[]) {
      if (!bizPerCat.has(link.category_id)) bizPerCat.set(link.category_id, []);
      bizPerCat.get(link.category_id)!.push(link.business_id);
    }

    const includedBizIds = new Set<string>();
    for (const [catId, matchType] of catIdsByMatch) {
      const bizList = bizPerCat.get(catId) || [];
      if (matchType === 'name' || bizList.length <= MAX_TERMS_ONLY_SIZE) {
        bizList.forEach((id) => { includedBizIds.add(id); categoryBizIds.add(id); });
      }
    }

    if (includedBizIds.size > 0) {
      const { data } = await supabase
        .from('businesses').select(bizFields)
        .eq('is_active', true).eq('site_id', siteId)
        .in('id', [...includedBizIds].slice(0, 100))
        .order('total_score', { ascending: false, nullsFirst: false }).limit(30);
      addResults(data);
    }
  }

  // Strategy 2: ai_tags search
  for (const kw of keywords) {
    if (kw.length < 2 || results.length >= 30) continue;
    const { data } = await supabase
      .from('businesses').select(bizFields)
      .eq('is_active', true).eq('site_id', siteId)
      .contains('ai_tags', [kw])
      .order('total_score', { ascending: false, nullsFirst: false }).limit(10);
    addResults(data);
  }

  // Strategy 3: Text search on English columns
  {
    const { data } = await supabase
      .from('businesses').select(bizFields)
      .eq('is_active', true).eq('site_id', siteId)
      .or(buildBusinessOr(keywords, ['display_name', 'short_desc_en']))
      .order('total_score', { ascending: false, nullsFirst: false }).limit(10);
    addResults(data);
  }

  // ─── Relevance filter: remove businesses that don't match ANY keyword ───
  // Without this, category expansion returns ALL businesses in a broad category
  // (e.g., "food-dining" includes plumbing if miscategorized) and town filtering
  // only scopes to location, not to relevance.
  const specificKeywords = keywords
    .filter((kw) => !GENERIC_WORDS.has(kw.toLowerCase()) && kw.length > 1)
    .map((kw) => kw.toLowerCase());

  console.log(`[baam-en-fetcher] Before relevance filter: ${results.length} results, specificKeywords: ${specificKeywords.join(', ')}`);
  let relevantResults = results;
  if (specificKeywords.length > 0) {
    relevantResults = results.filter((b) => {
      const text = [
        b.display_name || '',
        b.short_desc_en || '',
        ...(Array.isArray(b.ai_tags) ? b.ai_tags : []),
      ].join(' ').toLowerCase();
      return specificKeywords.some((kw) => text.includes(kw));
    });
    console.log(`[baam-en-fetcher] After relevance filter: ${relevantResults.length} results`);
    // Do NOT fall back to full results when specific keywords exist.
    // If "pizza" matches nothing, showing plumbing/urgent care is worse than showing nothing.
    // The AI will generate a "no results" answer with helpful next steps instead.
  }

  // Sort: keyword match > category > other, then total_score
  relevantResults.sort((a, b) => {
    const aText = [a.display_name, a.short_desc_en].filter(Boolean).join(' ').toLowerCase();
    const bText = [b.display_name, b.short_desc_en].filter(Boolean).join(' ').toLowerCase();
    const aHasKw = specificKeywords.some((kw) => aText.includes(kw));
    const bHasKw = specificKeywords.some((kw) => bText.includes(kw));
    const aInCat = categoryBizIds.has(a.id);
    const bInCat = categoryBizIds.has(b.id);
    const aTier = aHasKw ? 0 : aInCat ? 1 : 2;
    const bTier = bHasKw ? 0 : bInCat ? 1 : 2;
    if (aTier !== bTier) return aTier - bTier;
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return (b.total_score || 0) - (a.total_score || 0);
  });

  // Prioritize businesses with strong core data (rating + reviews + phone + address)
  const withStrongData = relevantResults.filter((b) => hasStrongCoreData(b));
  const withWeakData = relevantResults.filter((b) => !hasStrongCoreData(b));
  const finalBusinesses = [...withStrongData, ...withWeakData].slice(0, 15);

  // Fetch reviews for top businesses
  let reviewsByBiz: Record<string, string[]> = {};
  const topIds = finalBusinesses.slice(0, 8).map((b) => b.id);
  if (topIds.length > 0) {
    const { data: reviewData } = await supabase
      .from('reviews')
      .select('business_id, rating, body, google_author_name')
      .eq('status', 'approved')
      .in('business_id', topIds)
      .order('rating', { ascending: false })
      .limit(24);
    for (const r of (reviewData || []) as AnyRow[]) {
      const bizId = String(r.business_id || '');
      if (!bizId) continue;
      if (!reviewsByBiz[bizId]) reviewsByBiz[bizId] = [];
      if (reviewsByBiz[bizId].length >= 2) continue;
      const body = String(r.body || '').trim();
      if (!body) continue;
      const author = String(r.google_author_name || 'User');
      const rating = r.rating ? `${r.rating}★` : '';
      reviewsByBiz[bizId].push(`"${body.slice(0, 40)}" (${author}${rating ? `, ${rating}` : ''})`);
    }
  }

  return finalBusinesses.map((b) => ({
    type: 'Business',
    title: String(b.display_name || 'Unnamed Business'),
    url: `/businesses/${String(b.slug || '')}`,
    snippet: toSnippet(b.short_desc_en, buildSnippet(b, reviewsByBiz[b.id] || [])),
    metadata: {
      avgRating: b.avg_rating || null,
      reviewCount: b.review_count || null,
      phone: b.phone || null,
      address: b.address_full || null,
      displayName: b.display_name || null,
      briefDesc: b.short_desc_en || null,
      isFeatured: Boolean(b.is_featured),
      reviewSnippets: reviewsByBiz[b.id] || [],
    },
  }));
}

function buildSnippet(b: AnyRow, reviews: string[]): string {
  const parts = [
    b.avg_rating ? `Rating ${b.avg_rating}` : '',
    b.review_count ? `${b.review_count} reviews` : '',
    b.phone ? `Phone ${b.phone}` : '',
    b.address_full ? `${String(b.address_full).slice(0, 48)}` : '',
    Array.isArray(b.ai_tags) ? b.ai_tags.slice(0, 3).join(', ') : '',
  ].filter(Boolean).join(' · ');
  if (reviews.length === 0) return parts;
  return `${parts}${parts ? ' · ' : ''}Reviews: ${reviews.join('; ')}`;
}

/** Check if business has strong core data (rating + reviews + phone + address). */
function hasStrongCoreData(b: AnyRow): boolean {
  const hasRating = Number(b.avg_rating || 0) > 0;
  const hasReviews = Number(b.review_count || 0) > 0;
  const hasPhone = String(b.phone || '').trim().length >= 8;
  const hasAddress = String(b.address_full || '').trim().length >= 6;
  return [hasRating, hasReviews, hasPhone, hasAddress].filter(Boolean).length >= 3;
}

// ─── Content search functions ────────────────────────────────

async function searchArticles(
  supabase: any, keywords: string[], siteId: string, regionIds: string[],
  verticals: string[], typeLabel: string,
): Promise<SourceItem[]> {
  const { data } = await supabase
    .from('articles')
    .select('slug, title_en, summary_en, content_vertical')
    .eq('site_id', siteId)
    .eq('editorial_status', 'published')
    .in('content_vertical', verticals)
    .in('region_id', regionIds)
    .or(buildOr(keywords, ['title_en', 'summary_en', 'body_en']))
    .limit(10);

  return ((data || []) as AnyRow[]).map((a) => ({
    type: typeLabel,
    title: String(a.title_en || 'Untitled'),
    url: typeLabel === 'News' ? `/news/${a.slug}` : `/guides/${a.slug}`,
    snippet: toSnippet(a.summary_en),
  }));
}

async function searchForum(
  supabase: any, keywords: string[], siteId: string, regionIds: string[],
): Promise<SourceItem[]> {
  const { data } = await supabase
    .from('forum_threads')
    .select('slug, title, summary_en, reply_count, categories:board_id(slug)')
    .eq('site_id', siteId)
    .eq('status', 'published')
    .in('region_id', regionIds)
    .or(buildOr(keywords, ['title', 'body', 'summary_en']))
    .limit(8);

  return ((data || []) as AnyRow[]).map((t) => {
    const boardSlug = typeof t.categories === 'object' && t.categories?.slug
      ? String(t.categories.slug) : 'general';
    return {
      type: 'Forum',
      title: String(t.title || 'Forum Post'),
      url: `/forum/${boardSlug}/${t.slug}`,
      snippet: toSnippet(t.summary_en),
    };
  });
}

async function searchDiscover(
  supabase: any, keywords: string[], siteId: string,
): Promise<SourceItem[]> {
  const { data } = await supabase
    .from('voice_posts')
    .select('slug, title, excerpt')
    .eq('site_id', siteId)
    .eq('status', 'published')
    .or(buildOr(keywords, ['title', 'content', 'excerpt']))
    .limit(6);

  return ((data || []) as AnyRow[]).map((p) => ({
    type: 'Discover',
    title: String(p.title || 'Community Post'),
    url: `/discover/${p.slug}`,
    snippet: toSnippet(p.excerpt),
  }));
}

async function searchEvents(
  supabase: any, keywords: string[], siteId: string, regionIds: string[],
): Promise<SourceItem[]> {
  const { data } = await supabase
    .from('events')
    .select('slug, title_en, summary_en, venue_name, start_at, is_free')
    .eq('site_id', siteId)
    .eq('status', 'published')
    .in('region_id', regionIds)
    .or(buildOr(keywords, ['title_en', 'summary_en', 'venue_name']))
    .limit(6);

  return ((data || []) as AnyRow[]).map((e) => ({
    type: 'Event',
    title: String(e.title_en || 'Local Event'),
    url: `/events/${e.slug}`,
    snippet: toSnippet(e.summary_en || e.venue_name),
  }));
}

// ─── Main fetcher ─────────────────────────────────────────────

function uniqueByUrl(sources: SourceItem[]): SourceItem[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

/**
 * Create an English Baam-specific ContentFetcher.
 * Queries English columns, filters by site_id + region, supports town-level scoping.
 */
export function createBaamEnglishFetcher(supabase: any): ContentFetcher {
  return {
    async search(params: SearchParams): Promise<RetrievalPayload> {
      const siteId = params.siteContext.siteId as string;
      const regionIds = (params.siteContext.regionIds as string[]) || [];
      const query = params.query;
      const keywords = params.keywords;

      // Town-level business scoping
      const townRegionId = detectTownRegionId(query);
      let townBizIds: Set<string> | null = null;
      if (townRegionId) {
        const allLocs: AnyRow[] = [];
        let offset = 0;
        while (true) {
          const { data: locs } = await supabase
            .from('business_locations')
            .select('business_id')
            .eq('region_id', townRegionId)
            .range(offset, offset + 999);
          if (!locs || locs.length === 0) break;
          allLocs.push(...locs);
          if (locs.length < 1000) break;
          offset += 1000;
        }
        townBizIds = new Set(allLocs.map((l: AnyRow) => l.business_id as string));
      }

      const contentKeywords = [...new Set([query, ...keywords].map((s) => s.trim()).filter(Boolean))].slice(0, 6);

      const [businesses, news, guides, forum, discover, events] = await Promise.all([
        searchBusinesses(supabase, keywords.length > 0 ? keywords : contentKeywords, query, siteId, townBizIds),
        searchArticles(supabase, contentKeywords, siteId, regionIds,
          ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'], 'News'),
        searchArticles(supabase, contentKeywords, siteId, regionIds,
          ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison', 'guide_neighborhood', 'guide_seasonal', 'guide_resource', 'guide_scenario'], 'Guide'),
        searchForum(supabase, contentKeywords, siteId, regionIds),
        searchDiscover(supabase, contentKeywords, siteId),
        searchEvents(supabase, contentKeywords, siteId, regionIds),
      ]);

      // Build context blocks
      const contextBlocks: string[] = [];
      if (businesses.length > 0) {
        const detail = businesses.slice(0, 8).map((b, i) => {
          const m = b.metadata || {};
          return `${i + 1}. ${b.title}\n- Phone: ${m.phone || 'N/A'}\n- Address: ${m.address || 'N/A'}\n- Rating: ${m.avgRating || 'N/A'} (${m.reviewCount || 0} reviews)\n- ${b.snippet || ''}`;
        }).join('\n');
        contextBlocks.push(`Business results (sorted by relevance and rating):\n${detail}`);
      }
      if (guides.length > 0) {
        contextBlocks.push(`Guide results:\n${guides.map((g) => `- ${g.title}: ${g.snippet || ''}`).join('\n')}`);
      }
      if (news.length > 0) {
        contextBlocks.push(`News results:\n${news.map((n) => `- ${n.title}: ${n.snippet || ''}`).join('\n')}`);
      }
      if (forum.length > 0) {
        contextBlocks.push(`Forum results:\n${forum.map((f) => `- ${f.title}: ${f.snippet || ''}`).join('\n')}`);
      }
      if (discover.length > 0) {
        contextBlocks.push(`Community posts:\n${discover.map((d) => `- ${d.title}: ${d.snippet || ''}`).join('\n')}`);
      }
      if (events.length > 0) {
        contextBlocks.push(`Events:\n${events.map((e) => `- ${e.title}: ${e.snippet || ''}`).join('\n')}`);
      }

      const sources = uniqueByUrl([...businesses, ...guides, ...news, ...discover, ...forum, ...events]);

      return {
        sources,
        contextBlocks,
        businessCandidates: businesses.slice(0, 15),
        counts: {
          businesses: businesses.length,
          news: news.length,
          guides: guides.length,
          forum: forum.length,
          discover: discover.length,
          events: events.length,
        },
      };
    },
  };
}

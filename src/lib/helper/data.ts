/**
 * Helper data fetching — category businesses, related content, reviews
 */

import type { BusinessResult, RelatedContent, ContentItem, EventItem } from './types';
import { TOWN_REGION_MAP } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export function detectTownRegionId(query: string): string | null {
  const lower = query.toLowerCase();
  for (const [town, regionId] of Object.entries(TOWN_REGION_MAP)) {
    if (lower.includes(town)) return regionId;
  }
  return null;
}

/**
 * Fetch businesses from a specific category, scoped by town.
 */
export async function fetchCategoryBusinesses(
  supabase: AnyRow,
  siteId: string,
  categoryId: string,
  townRegionId: string | null,
): Promise<{ businesses: BusinessResult[]; locationFallback: boolean }> {
  const bizFields = 'id, slug, display_name, short_desc_en, ai_tags, avg_rating, review_count, phone, address_full, total_score, is_featured, latitude, longitude';

  const { data: bizLinks } = await supabase
    .from('business_categories')
    .select('business_id')
    .eq('category_id', categoryId)
    .limit(500);

  const bizIds = [...new Set((bizLinks || []).map((l: { business_id: string }) => l.business_id))];
  if (bizIds.length === 0) return { businesses: [], locationFallback: false };

  const { data: businesses } = await supabase
    .from('businesses')
    .select(bizFields)
    .eq('is_active', true)
    .eq('site_id', siteId)
    .in('id', bizIds.slice(0, 200))
    .order('total_score', { ascending: false, nullsFirst: false })
    .limit(30);

  let results = (businesses || []) as AnyRow[];
  let locationFallback = false;

  if (townRegionId) {
    const { data: townLocs } = await supabase
      .from('business_locations')
      .select('business_id')
      .eq('region_id', townRegionId)
      .limit(5000);
    const townBizIds = new Set((townLocs || []).map((l: { business_id: string }) => l.business_id));
    const townFiltered = results.filter((b) => townBizIds.has(b.id as string));
    if (townFiltered.length > 0) {
      results = townFiltered;
    } else {
      locationFallback = true;
    }
  }

  return {
    locationFallback,
    businesses: results.slice(0, 15).map((b) => ({
      id: b.id as string,
      slug: b.slug as string,
      display_name: b.display_name as string,
      short_desc_en: (b.short_desc_en || '') as string,
      avg_rating: b.avg_rating as number | null,
      review_count: b.review_count as number | null,
      phone: b.phone as string | null,
      address_full: b.address_full as string | null,
      total_score: (b.total_score || 0) as number,
      ai_tags: (b.ai_tags || []) as string[],
      latitude: b.latitude as number | null,
      longitude: b.longitude as number | null,
    })),
  };
}

/**
 * Fetch related content (guides, forum, discover, news) by keywords.
 */
export async function fetchRelatedContent(
  supabase: AnyRow,
  siteId: string,
  keywords: string[],
): Promise<RelatedContent> {
  const buildOr = (cols: string[]) => {
    const conds: string[] = [];
    for (const kw of keywords) {
      for (const col of cols) conds.push(`${col}.ilike.%${kw.replace(/,/g, ' ')}%`);
    }
    return conds.join(',');
  };

  const [guidesRes, newsRes, forumRes, discoverRes] = await Promise.all([
    supabase.from('articles').select('slug, title_en, summary_en')
      .eq('site_id', siteId).eq('editorial_status', 'published')
      .in('content_vertical', ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison', 'guide_neighborhood', 'guide_seasonal', 'guide_resource', 'guide_scenario'])
      .or(buildOr(['title_en', 'summary_en', 'body_en'])).limit(3),
    supabase.from('articles').select('slug, title_en, summary_en')
      .eq('site_id', siteId).eq('editorial_status', 'published')
      .in('content_vertical', ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'])
      .or(buildOr(['title_en', 'summary_en'])).order('published_at', { ascending: false }).limit(2),
    supabase.from('forum_threads').select('slug, title, body, ai_summary_en, categories:board_id(slug)')
      .eq('site_id', siteId).eq('status', 'published')
      .or(buildOr(['title', 'body'])).order('reply_count', { ascending: false }).limit(2),
    supabase.from('voice_posts').select('slug, title, excerpt')
      .eq('site_id', siteId).eq('status', 'published')
      .or(buildOr(['title', 'content', 'excerpt'])).order('like_count', { ascending: false }).limit(2),
  ]);

  const cleanSnippet = (s: string) => String(s || '').replace(/^#\s*summary_en\s*/i, '').replace(/^body_en\s*/i, '').replace(/^#\s+/gm, '').replace(/\*\*/g, '').trim().slice(0, 120);

  return {
    guides: ((guidesRes.data || []) as AnyRow[]).map((g) => ({ title: String(g.title_en || ''), slug: String(g.slug || ''), snippet: cleanSnippet(g.summary_en) })).filter((g) => g.title),
    news: ((newsRes.data || []) as AnyRow[]).map((n) => ({ title: String(n.title_en || ''), slug: String(n.slug || ''), snippet: cleanSnippet(n.summary_en) })).filter((n) => n.title),
    forum: ((forumRes.data || []) as AnyRow[]).map((t) => ({
      title: String(t.title || ''), slug: String(t.slug || ''),
      boardSlug: typeof t.categories === 'object' && t.categories?.slug ? String(t.categories.slug) : 'general',
      snippet: cleanSnippet(t.ai_summary_en || t.body),
    })).filter((t) => t.title),
    discover: ((discoverRes.data || []) as AnyRow[]).map((d) => ({ title: String(d.title || ''), slug: String(d.slug || ''), snippet: cleanSnippet(d.excerpt) })).filter((d) => d.title),
  };
}

/**
 * Find the category ID by matching keywords against name_en + search_terms.
 */
export async function findCategoryId(
  supabase: AnyRow,
  siteId: string,
  keywords: string[],
  fullQuery: string,
): Promise<{ id: string; name: string } | null> {
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name_en, slug, search_terms')
    .eq('type', 'business')
    .eq('site_scope', 'en');

  if (!categories || categories.length === 0) return null;

  const fullQueryLower = [...keywords, ...fullQuery.toLowerCase().split(/\s+/)].join(' ');
  const isFoodContext = /(restaurant|food|eat|dining|cuisine|takeout|delivery|dine|brunch|lunch|dinner|cafe|bar|grill|bakery|deli|pizza|burger|sushi|taco|coffee|ice cream)/i.test(fullQueryLower);

  let bestScore = 0;
  let bestMatch: { id: string; name: string } | null = null;

  const queryLower = fullQuery.toLowerCase();

  for (const cat of categories as AnyRow[]) {
    const nameEn = (cat.name_en || '').toLowerCase();
    const slug = (cat.slug || '').toLowerCase();
    const terms = (cat.search_terms || []).map((t: string) => t.toLowerCase());
    let score = 0;

    // Phrase match: if the full query contains a multi-word search term as a phrase
    // This is the strongest signal (e.g. "family doctor" in query matches "family doctor" in terms)
    for (const term of terms) {
      if (term.includes(' ') && queryLower.includes(term)) {
        score += 25;
      }
    }

    // Individual keyword matching — first keyword gets a boost (it's usually the primary intent)
    for (let ki = 0; ki < keywords.length; ki++) {
      const kwLower = keywords[ki].toLowerCase();
      const firstKwBonus = ki === 0 ? 3 : 0; // first keyword = primary intent
      if (nameEn === kwLower) score += 20 + firstKwBonus;
      else if (nameEn.includes(kwLower) || kwLower.includes(nameEn)) score += 10 + firstKwBonus;
      if (slug.includes(kwLower)) score += 8;
      if (terms.some((t: string) => t === kwLower)) score += 5 + firstKwBonus;
      else if (terms.some((t: string) => t.includes(kwLower) || kwLower.includes(t))) score += 2;
    }

    if (isFoodContext && slug.startsWith('food-')) score += 15;
    if (isFoodContext && !slug.startsWith('food-')) score -= 10;

    if (score > bestScore) { bestScore = score; bestMatch = { id: cat.id, name: cat.name_en }; }
  }

  return bestScore > 0 ? bestMatch : null;
}

/**
 * Expand keywords using category search_terms from DB.
 * e.g. ["daycare"] → ["daycare", "day care", "preschool", "childcare", "nursery", ...]
 * Replaces hardcoded keyword mappings with dynamic data.
 */
export async function expandKeywordsFromSearchTerms(
  supabase: AnyRow,
  keywords: string[],
): Promise<string[]> {
  const { data: categories } = await supabase
    .from('categories')
    .select('search_terms')
    .eq('type', 'business')
    .eq('site_scope', 'en')
    .not('search_terms', 'is', null);

  if (!categories || categories.length === 0) return keywords;

  const expanded = new Set(keywords.map(k => k.toLowerCase()));

  for (const cat of categories as AnyRow[]) {
    const terms: string[] = (cat.search_terms || []).map((t: string) => t.toLowerCase());
    // Match if any keyword IS a search term or a search term IS a keyword (exact word match)
    const hasMatch = keywords.some(kw => {
      const kwLower = kw.toLowerCase();
      return terms.some(t => {
        // Exact match
        if (t === kwLower) return true;
        // Keyword is a full word within a multi-word term: "daycare" in "daycare center"
        const tWords = t.split(/\s+/);
        if (tWords.includes(kwLower)) return true;
        // Multi-word term matches keyword exactly
        const kwWords = kwLower.split(/\s+/);
        if (kwWords.length > 1 && t === kwLower) return true;
        return false;
      });
    });
    if (hasMatch) {
      for (const t of terms) expanded.add(t);
    }
  }

  return [...expanded];
}

/**
 * Fetch community content (forum threads + discover posts) by keywords.
 * Returns top threads/posts sorted by engagement (reply_count / like_count).
 */
export async function fetchCommunityContent(
  supabase: AnyRow,
  siteId: string,
  keywords: string[],
): Promise<{ forum: ContentItem[]; discover: ContentItem[] }> {
  const buildOr = (cols: string[]) => {
    const conds: string[] = [];
    for (const kw of keywords) {
      for (const col of cols) conds.push(`${col}.ilike.%${kw.replace(/,/g, ' ')}%`);
    }
    return conds.join(',');
  };

  const [forumRes, discoverRes] = await Promise.all([
    supabase.from('forum_threads').select('slug, title, body, ai_summary_en, reply_count, board_id, categories:board_id(slug)')
      .eq('site_id', siteId).eq('status', 'published')
      .or(buildOr(['title', 'body']))
      .order('reply_count', { ascending: false })
      .limit(8),
    supabase.from('voice_posts').select('slug, title, excerpt, content, like_count, comment_count')
      .eq('site_id', siteId).eq('status', 'published')
      .or(buildOr(['title', 'content', 'excerpt']))
      .order('like_count', { ascending: false })
      .limit(6),
  ]);

  const cleanSnippet = (s: string) => String(s || '').replace(/^#\s+/gm, '').replace(/\*\*/g, '').trim().slice(0, 150);

  return {
    forum: ((forumRes.data || []) as AnyRow[]).map((t) => ({
      title: String(t.title || ''),
      slug: String(t.slug || ''),
      boardSlug: typeof t.categories === 'object' && t.categories?.slug ? String(t.categories.slug) : 'general',
      snippet: cleanSnippet(t.ai_summary_en || t.body),
      replyCount: t.reply_count || 0,
    })).filter((t) => t.title),
    discover: ((discoverRes.data || []) as AnyRow[]).map((d) => ({
      title: String(d.title || ''),
      slug: String(d.slug || ''),
      snippet: cleanSnippet(d.excerpt || d.content),
      likeCount: d.like_count || 0,
    })).filter((d) => d.title),
  };
}

/**
 * Fetch upcoming events + recent news by keywords.
 */
export async function fetchNewsAndEvents(
  supabase: AnyRow,
  siteId: string,
  keywords: string[],
): Promise<{ news: ContentItem[]; events: EventItem[] }> {
  const buildOr = (cols: string[]) => {
    const conds: string[] = [];
    for (const kw of keywords) {
      for (const col of cols) conds.push(`${col}.ilike.%${kw.replace(/,/g, ' ')}%`);
    }
    return conds.join(',');
  };

  const now = new Date().toISOString();

  const [newsRes, eventsRes] = await Promise.all([
    supabase.from('articles').select('slug, title_en, summary_en, content_vertical, published_at')
      .eq('site_id', siteId).eq('editorial_status', 'published')
      .in('content_vertical', ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'])
      .or(buildOr(['title_en', 'summary_en', 'body_en']))
      .order('published_at', { ascending: false })
      .limit(6),
    supabase.from('events').select('slug, title_en, summary_en, venue_name, start_at, is_free, ticket_price')
      .eq('site_id', siteId).eq('status', 'published')
      .gte('start_at', now)
      .or(buildOr(['title_en', 'summary_en']))
      .order('start_at', { ascending: true })
      .limit(8),
  ]);

  const cleanSnippet = (s: string) => String(s || '').replace(/^#\s+/gm, '').replace(/\*\*/g, '').trim().slice(0, 150);

  return {
    news: ((newsRes.data || []) as AnyRow[]).map((n) => ({
      title: String(n.title_en || ''),
      slug: String(n.slug || ''),
      snippet: cleanSnippet(n.summary_en),
    })).filter((n) => n.title),
    events: ((eventsRes.data || []) as AnyRow[]).map((e) => ({
      title: String(e.title_en || ''),
      slug: String(e.slug || ''),
      venueName: String(e.venue_name || ''),
      startAt: String(e.start_at || ''),
      isFree: !!e.is_free,
      ticketPrice: e.ticket_price || null,
      summary: cleanSnippet(e.summary_en),
    })).filter((e) => e.title),
  };
}

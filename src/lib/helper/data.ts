/**
 * Helper data fetching — category businesses, related content, reviews
 */

import type { BusinessResult, RelatedContent, ContentItem, EventItem } from './types';
import { TOWN_REGION_MAP, TOWN_ADDRESS_KEYWORDS } from './types';

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
  const bizFields = 'id, slug, display_name, short_desc_en, ai_tags, avg_rating, review_count, phone, website_url, address_full, total_score, is_featured, latitude, longitude';

  // Include child categories if this is a parent category
  const { data: childCats } = await supabase
    .from('categories')
    .select('id, slug')
    .eq('parent_id', categoryId);

  let catIds: string[];
  if (childCats && childCats.length > 0) {
    // This is a parent category — check if it's food-dining
    // Exclude non-restaurant subcategories (grocery, liquor, coffee, catering, food truck, butcher)
    // These belong to different directory groups and shouldn't appear in "restaurant" queries
    const { data: parentCat } = await supabase.from('categories').select('slug').eq('id', categoryId).single();
    const isFoodParent = parentCat?.slug === 'food-dining';
    const NON_RESTAURANT_SLUGS = new Set([
      'food-grocery', 'food-liquor-store', 'food-coffee', 'food-catering',
      'food-food-truck', 'food-butcher-market',
    ]);
    const filteredChildren = isFoodParent
      ? childCats.filter((c: { slug: string }) => !NON_RESTAURANT_SLUGS.has(c.slug))
      : childCats;
    catIds = [categoryId, ...filteredChildren.map((c: { id: string }) => c.id)];
  } else {
    catIds = [categoryId];
  }

  const { data: bizLinks } = await supabase
    .from('business_categories')
    .select('business_id')
    .in('category_id', catIds)
    .limit(5000);

  let bizIds = [...new Set((bizLinks || []).map((l: { business_id: string }) => l.business_id))];
  if (bizIds.length === 0) return { businesses: [], locationFallback: false };

  let locationFallback = false;

  // Fetch all category businesses first, then filter by location
  const CHUNK = 200;
  let allBiz: AnyRow[] = [];
  for (let i = 0; i < Math.min(bizIds.length, 1000); i += CHUNK) {
    const { data } = await supabase
      .from('businesses')
      .select(bizFields)
      .eq('is_active', true)
      .eq('site_id', siteId)
      .in('id', bizIds.slice(i, i + CHUNK));
    if (data) allBiz.push(...data);
  }

  // Location filter — address-first approach (address is always accurate)
  let validBiz = allBiz;
  if (townRegionId) {
    const addrKeywords = TOWN_ADDRESS_KEYWORDS[townRegionId];

    // Step 1: Filter by address text (primary — always reliable)
    const addrMatched = addrKeywords?.length
      ? allBiz.filter(b => {
          const addr = (b.address_full || '').toLowerCase();
          return addr && addrKeywords.some((kw: string) => addr.includes(kw));
        })
      : [];

    // Step 2: Also include businesses matched by business_locations (supplement)
    const { data: townLocs } = await supabase
      .from('business_locations')
      .select('business_id')
      .eq('region_id', townRegionId)
      .limit(5000);
    const regionBizIds = new Set((townLocs || []).map((l: { business_id: string }) => l.business_id));
    const regionMatched = allBiz.filter(b => regionBizIds.has(b.id));

    // Step 3: Union both sets, deduplicate, validate address
    const seenIds = new Set<string>();
    const combined: AnyRow[] = [];
    for (const b of [...addrMatched, ...regionMatched]) {
      if (!seenIds.has(b.id)) {
        // Final validation: reject businesses whose address clearly belongs elsewhere
        if (addrKeywords?.length) {
          const addr = (b.address_full || '').toLowerCase();
          if (addr && !addrKeywords.some((kw: string) => addr.includes(kw))) continue;
        }
        seenIds.add(b.id);
        combined.push(b);
      }
    }

    if (combined.length > 0) {
      validBiz = combined;
    } else {
      locationFallback = true;
    }
  }

  // Sort all by total_score and take top 30
  let results = validBiz
    .sort((a, b) => (Number(b.total_score) || 0) - (Number(a.total_score) || 0))
    .slice(0, 30);

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
      website_url: (b.website_url || null) as string | null,
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
  // Filter out very short or generic keywords that match everything
  const meaningfulKws = keywords.filter(kw => kw.length >= 4);
  if (meaningfulKws.length === 0 && keywords.length > 0) {
    // If all keywords are short, keep the longest ones
    meaningfulKws.push(...keywords.sort((a, b) => b.length - a.length).slice(0, 2));
  }

  const buildOr = (cols: string[]) => {
    const conds: string[] = [];
    for (const kw of meaningfulKws) {
      for (const col of cols) conds.push(`${col}.ilike.%${kw.replace(/,/g, ' ')}%`);
    }
    return conds.join(',');
  };

  // If no meaningful keywords, return empty
  if (meaningfulKws.length === 0) {
    return { guides: [], news: [], forum: [], discover: [] };
  }

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
 *
 * Disambiguation (when multiple categories score similarly):
 * 1. Context clues: use other words in the query to break ties
 * 2. Category priority: use default mapping for standalone ambiguous keywords
 * 3. Ambiguity flag: when truly ambiguous, return alternatives for clarification
 */

// ─── Shared matching utilities ───────────────────────────────

const _wordMatch = (text: string, kw: string) => {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return kw.length <= 4
    ? new RegExp(`\\b${escaped}\\b`, 'i').test(text)
    : new RegExp(`\\b${escaped}`, 'i').test(text);
};

const _stem = (w: string) => {
  const s = w.toLowerCase();
  for (const sfx of ['ation','tion','sion','ment','ness','ible','able','ence','ance','ing','ous','ive','ity','ful','ist','ize','ise','ory','ery','ary','ant','ent','age','ed','er','or','ly','al','es','s']) {
    if (s.length > sfx.length + 3 && s.endsWith(sfx)) return s.slice(0, -sfx.length);
  }
  return s;
};

const _stemMatch = (a: string, b: string) => {
  const sa = _stem(a), sb = _stem(b);
  return sa.length >= 4 && sb.length >= 4 && sa === sb;
};

// ─── Approach 2: Default priority for ambiguous standalone keywords ───
// When a keyword matches multiple categories with similar scores,
// this map defines the default (most common user intent)
const AMBIGUOUS_DEFAULTS: Record<string, string> = {
  'counseling': 'medical-mental-health',
  'counselor': 'medical-mental-health',
  'therapy': 'medical-mental-health',
  'ramen': 'food-japanese',
  'cleaning': 'home-cleaning',
  'inspection': 'auto-repair',
  'inspected': 'auto-repair',
  'braces': 'medical-dental',
  'trainer': 'beauty-fitness-gym',
  'coach': 'edu-sports',
  'studio': 'beauty-hair-salon',
  'spa': 'beauty-spa-massage',
  'bar': 'food-bar-nightlife',
  'club': 'beauty-fitness-gym',
  'salon': 'beauty-hair-salon',
  'center': 'medical-primary-care',
  'rehab': 'medical-physical-therapy',
  'recovery': 'medical-mental-health',
};

// ─── Approach 1: Context clue words that disambiguate ───
// Maps context words → category slug they point to
const CONTEXT_CLUES: Record<string, string> = {
  // Mental health context
  'marriage': 'medical-mental-health', 'couples': 'medical-mental-health',
  'anxiety': 'medical-mental-health', 'depression': 'medical-mental-health',
  'stress': 'medical-mental-health', 'mental': 'medical-mental-health',
  'anger': 'medical-mental-health', 'grief': 'medical-mental-health',
  'addiction': 'medical-mental-health', 'family therapy': 'medical-mental-health',
  // College/test prep context
  'college': 'edu-test-prep', 'sat': 'edu-test-prep',
  'act': 'edu-test-prep', 'university': 'edu-test-prep',
  'admissions': 'edu-test-prep', 'application': 'edu-test-prep',
  // Home vs commercial cleaning
  'house': 'home-cleaning', 'home': 'home-cleaning',
  'office': 'home-cleaning', 'carpet': 'home-cleaning',
  'dental': 'medical-dental', 'teeth': 'medical-dental',
  // Auto context
  'car': 'auto-repair', 'vehicle': 'auto-repair',
  'nys': 'auto-repair', 'state': 'auto-repair', 'emissions': 'auto-repair',
  // Food specifics
  'japanese': 'food-japanese', 'noodle': 'food-japanese',
  'vietnamese': 'food-vietnamese',
};

export interface CategoryMatch {
  id: string;
  name: string;
  /** When true, the match is ambiguous and alternatives are available */
  ambiguous?: boolean;
  /** Alternative categories when ambiguous — for Approach 3 (ask user) */
  alternatives?: { id: string; name: string; slug: string }[];
}

export async function findCategoryId(
  supabase: AnyRow,
  siteId: string,
  keywords: string[],
  fullQuery: string,
): Promise<CategoryMatch | null> {
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name_en, slug, search_terms')
    .eq('type', 'business')
    .eq('site_scope', 'en');

  if (!categories || categories.length === 0) return null;

  const fullQueryLower = [...keywords, ...fullQuery.toLowerCase().split(/\s+/)].join(' ');
  const isFoodContext = /\b(restaurant|food|eat|dining|cuisine|takeout|delivery|dine|brunch|lunch|dinner|cafe|bar|grill|bakery|deli|pizza|burger|sushi|taco|coffee|ice cream|ramen|pho|bbq|seafood|steak)\b/i.test(fullQueryLower);

  const queryLower = fullQuery.toLowerCase();

  // Score ALL categories
  const scored: { id: string; name: string; slug: string; score: number }[] = [];

  for (const cat of categories as AnyRow[]) {
    const nameEn = (cat.name_en || '').toLowerCase();
    const slug = (cat.slug || '').toLowerCase();
    const terms = (cat.search_terms || []).map((t: string) => t.toLowerCase());
    let score = 0;

    // Phrase match
    for (const term of terms) {
      if (term.includes(' ') && queryLower.includes(term)) score += 25;
    }

    // Individual keyword matching
    for (let ki = 0; ki < keywords.length; ki++) {
      const kwLower = keywords[ki].toLowerCase();
      const firstKwBonus = ki === 0 ? 3 : 0;
      if (nameEn === kwLower) score += 20 + firstKwBonus;
      else if (_wordMatch(nameEn, kwLower)) score += 10 + firstKwBonus;
      if (_wordMatch(slug, kwLower)) score += 8;
      if (terms.some((t: string) => t === kwLower || _stemMatch(t, kwLower))) score += 5 + firstKwBonus;
      else if (terms.some((t: string) => _wordMatch(t, kwLower) || _wordMatch(kwLower, t))) score += 2;
    }

    if (isFoodContext && slug.startsWith('food-')) score += 15;
    if (isFoodContext && !slug.startsWith('food-')) score -= 10;

    if (score > 0) scored.push({ id: cat.id, name: cat.name_en, slug, score });
  }

  if (scored.length === 0) return null;

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];

  // Check if ambiguous: top 2 scores are within 10 points of each other
  // This catches cases like "counseling" (test-prep 15 vs mental-health 8 = gap of 7)
  const isAmbiguous = second && (best.score - second.score) <= 10 && second.score > 0;

  if (!isAmbiguous) {
    // Clear winner — return it
    return { id: best.id, name: best.name };
  }

  // ─── AMBIGUOUS: Apply disambiguation strategies ───

  // Approach 1: Context clues from other words in the query
  const queryWords = fullQuery.toLowerCase().split(/\s+/);
  for (const word of queryWords) {
    const contextSlug = CONTEXT_CLUES[word];
    if (contextSlug) {
      // Find the category matching this context clue among top candidates
      const contextMatch = scored.slice(0, 5).find(c => c.slug === contextSlug);
      if (contextMatch) {
        return { id: contextMatch.id, name: contextMatch.name };
      }
    }
  }

  // Approach 2: Default priority for standalone ambiguous keywords
  for (const kw of keywords) {
    const defaultSlug = AMBIGUOUS_DEFAULTS[kw.toLowerCase()];
    if (defaultSlug) {
      const defaultMatch = scored.slice(0, 5).find(c => c.slug === defaultSlug);
      if (defaultMatch) {
        return { id: defaultMatch.id, name: defaultMatch.name };
      }
    }
  }

  // Approach 3: Return best match but flag as ambiguous with alternatives
  // The caller (actions.ts) can use this to ask the user to clarify
  const topAlternatives = scored.slice(0, 3).filter(c => c.id !== best.id).map(c => ({
    id: c.id, name: c.name, slug: c.slug,
  }));

  return {
    id: best.id,
    name: best.name,
    ambiguous: true,
    alternatives: topAlternatives,
  };
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

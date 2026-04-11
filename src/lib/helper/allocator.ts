/**
 * Helper Answer Type Allocator — 3-layer hybrid allocation
 *
 * Layer 1: Pattern match (instant, free) — catches ~40% of queries
 * Layer 2: AI classification (1 small call) — handles remaining ~60%
 * Layer 3: Data check (DB lookup) — refines and validates
 */

import type { AnswerType, AllocationResult, BusinessResult, RelatedContent, ContentItem } from './types';
import { TOWN_REGION_MAP, GENERIC_WORDS } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;
type HelperMessage = { role: 'user' | 'assistant'; content: string };

// ─── Layer 1: Pattern Match ─────────────────────────────────────

function detectTypeByPattern(query: string, history: HelperMessage[]): AnswerType | null {
  const q = query.toLowerCase().trim();

  // Type 7: Follow-up
  if (history.length >= 2 && q.length < 25) {
    if (/^(yes|no|ok|thanks|sure|more|also|which|what about|tell me|and |how about)/.test(q)) {
      return 'follow-up';
    }
  }

  // Type 10: Comparison
  if (/\bvs\.?\b|\bversus\b|\bcompare\b|\bdifference between\b/.test(q)) return 'comparison';
  if (/\bor\b.*\b(better|which|prefer)\b|\b(better|which|prefer)\b.*\bor\b/.test(q)) return 'comparison';

  // Type 11: Life event — but NOT if query also mentions a specific service
  // "moving to Middletown" = life-event, "moving to Middletown need a plumber" = mixed (has specific service)
  const hasSpecificService = /plumber|dentist|doctor|lawyer|mechanic|electrician|daycare|salon|repair|clean|roofing|hvac/.test(q);
  if (!hasSpecificService) {
    if (/just moved|new to (middletown|town|the area)|relocat|moving to|new resident/.test(q)) return 'life-event';
    if (/just had a baby|new baby|pregnant|expecting|newborn/.test(q)) return 'life-event';
    if (/retiring|just retired|senior living|senior care/.test(q)) return 'life-event';
    if (/starting a business|opening a (store|shop|restaurant)|new business/.test(q)) return 'life-event';
  }

  // Type 6: Events/news
  if (/this weekend|this saturday|this sunday|events?\s+(near|in|this)|what's happening|what's new|festival|concert|upcoming/.test(q)) return 'news-events';

  // Type 2: Guide/how-to
  if (/^how (do|can|to|should|much)\b|steps (for|to)|process (of|for)|guide to|what do i need to/.test(q)) return 'guide';

  return null;
}

// ─── Layer 2: AI Classification ─────────────────────────────────

async function classifyWithAI(
  query: string,
  anthropicApiKey: string,
): Promise<AnswerType> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        system: `You classify user queries for a LOCAL community platform (Middletown & Orange County, NY). Reply with exactly ONE word:
- business: wants to find/recommend local businesses or services (e.g. "best pizza", "dentist near me", "nail salon")
- guide: wants steps, process, how-to (e.g. "how to register a car", "steps to apply for food stamps")
- info: wants a specific fact — hours, address, phone, stats (e.g. "sales tax rate", "population", "zip code")
- mixed: wants BOTH information AND business recommendations (e.g. "need a plumber, how much does it cost", "daycare tips and recommendations")
- community: wants local opinions, experiences, what people think (e.g. "what do people think about schools", "anyone tried the new restaurant")
- news: wants current events, recent news, what's happening (e.g. "events this weekend", "latest news")`,
        messages: [{ role: 'user', content: query }],
      }),
    });

    if (!response.ok) return 'business-recommendation'; // fallback

    const data = await response.json();
    const word = data.content?.[0]?.text?.trim().toLowerCase() || '';

    const mapping: Record<string, AnswerType> = {
      'business': 'business-recommendation',
      'guide': 'guide',
      'info': 'info-lookup',
      'mixed': 'mixed',
      'community': 'community',
      'news': 'news-events',
    };

    return mapping[word] || 'business-recommendation';
  } catch {
    return 'business-recommendation'; // fallback on error
  }
}

// ─── Layer 3: Data Check ────────────────────────────────────────

async function findBusinessByName(
  supabase: AnyRow,
  siteId: string,
  query: string,
): Promise<BusinessResult | null> {
  // Extract potential business name from query (remove common question words)
  const cleaned = query
    .replace(/^(is|does|what|when|where|tell me about|info on|hours for|reviews for|phone for)\s+/i, '')
    .replace(/\s+(open|closed)\s+(on|at|until|today|tomorrow|now|right now|this|every).*$/i, '')
    .replace(/\s+(open|closed|hours?|phone(?:\s*number)?|address|reviews?|rating|menu|website|number|info)\s*\??$/i, '')
    .replace(/'/g, "'") // normalize smart quotes
    .trim();

  if (cleaned.length < 3) return null;

  // For fuzzy matching: bridge apostrophes with % wildcard between each word
  // "Cosimos" → "Cosimo" matches "Cosimo's"
  // "Franks Pizza" → "Frank%Pizza" matches "Frank's Pizza"
  const baseSearch = cleaned.replace(/'/g, '').replace(/'/g, ''); // strip all apostrophes
  // Build a wildcard pattern: strip trailing 's' from each word, join with %
  // "Franks Pizza" → ["Frank", "Pizza"] → "Frank%Pizza"
  const words = baseSearch.split(/\s+/).map((w) => w.endsWith('s') && w.length > 3 ? w.slice(0, -1) : w);
  const fuzzyPattern = words.join('%');

  console.log(`[findBiz] baseSearch="${baseSearch}" fuzzy="${fuzzyPattern}" or="display_name.ilike.%${baseSearch}%,display_name.ilike.%${fuzzyPattern}%"`);
  // Try matching on display_name — with and without apostrophes
  const { data, error: dbError } = await supabase
    .from('businesses')
    .select('id, slug, display_name, short_desc_en, avg_rating, review_count, phone, address_full, total_score, ai_tags')
    .eq('is_active', true)
    .eq('site_id', siteId)
    .or(`display_name.ilike.%${baseSearch}%,display_name.ilike.%${fuzzyPattern}%`)
    .order('total_score', { ascending: false, nullsFirst: false })
    .limit(5);

  console.log(`[findBiz] results: ${data?.length ?? 0} | error: ${dbError?.message || 'none'}`);
  if (!data || data.length === 0) return null;

  // Pick the best match by total_score (highest rated/reviewed = most relevant)
  const best = (data as AnyRow[]).sort((a, b) =>
    (Number(b.total_score) || 0) - (Number(a.total_score) || 0)
  )[0];

  return {
    id: best.id,
    slug: best.slug,
    display_name: best.display_name,
    short_desc_en: best.short_desc_en || '',
    avg_rating: best.avg_rating,
    review_count: best.review_count,
    phone: best.phone,
    address_full: best.address_full,
    total_score: best.total_score || 0,
    ai_tags: best.ai_tags || [],
  };
}

async function matchCategory(
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

  const fullQueryLower = [...keywords, ...fullQuery.toLowerCase().split(/\s+/)].join(' ').toLowerCase();
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
    for (const term of terms) {
      if (term.includes(' ') && queryLower.includes(term)) {
        score += 25;
      }
    }

    // Individual keyword matching
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      if (nameEn === kwLower) score += 20;
      else if (nameEn.includes(kwLower) || kwLower.includes(nameEn)) score += 10;
      if (slug.includes(kwLower)) score += 8;
      if (terms.some((t: string) => t === kwLower)) score += 5;
      else if (terms.some((t: string) => t.includes(kwLower) || kwLower.includes(t))) score += 2;
    }

    if (isFoodContext && slug.startsWith('food-')) score += 15;
    if (isFoodContext && !slug.startsWith('food-')) score -= 10;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { id: cat.id, name: cat.name_en };
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

async function searchGuides(
  supabase: AnyRow,
  siteId: string,
  keywords: string[],
): Promise<ContentItem[]> {
  const buildOr = (cols: string[]) => {
    const conds: string[] = [];
    for (const kw of keywords) {
      for (const col of cols) conds.push(`${col}.ilike.%${kw.replace(/,/g, ' ')}%`);
    }
    return conds.join(',');
  };

  const { data } = await supabase
    .from('articles')
    .select('slug, title_en, summary_en')
    .eq('site_id', siteId)
    .eq('editorial_status', 'published')
    .in('content_vertical', ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison', 'guide_neighborhood', 'guide_seasonal', 'guide_resource', 'guide_scenario'])
    .or(buildOr(['title_en', 'summary_en', 'body_en']))
    .limit(5);

  return ((data || []) as AnyRow[]).map((g) => ({
    title: String(g.title_en || ''),
    slug: String(g.slug || ''),
    snippet: String(g.summary_en || '').replace(/^#\s*summary_en\s*/i, '').replace(/^body_en\s*/i, '').replace(/^#\s+/gm, '').replace(/\*\*/g, '').trim().slice(0, 120),
  })).filter((g) => g.title);
}

// ─── Main Allocator ─────────────────────────────────────────────

export async function allocateAnswerType(
  query: string,
  history: HelperMessage[],
  supabase: AnyRow,
  siteId: string,
  anthropicApiKey: string,
): Promise<AllocationResult> {
  // Extract keywords
  // Keep abbreviations like "AC", "DUI", "NY" that are meaningful
  const SHORT_KEYWORDS = new Set(['ac', 'er', 'rv', 'tv', 'pc', 'it']);
  const specificKws = query.toLowerCase()
    .replace(/[?.!,'"]/g, '')
    .split(/\s+/)
    .filter((w) => (w.length > 2 || SHORT_KEYWORDS.has(w)) && !GENERIC_WORDS.has(w));

  const townLabel = Object.keys(TOWN_REGION_MAP).find((t) => query.toLowerCase().includes(t)) || null;

  const emptyResult: AllocationResult = {
    type: 'no-match',
    keywords: specificKws,
    businesses: [],
    matchedCategory: null,
    locationFallback: false,
    townLabel,
    related: { guides: [], forum: [], discover: [], news: [] },
    singleBusiness: null,
    comparisonPair: null,
  };

  // ─── Layer 1: Pattern match ───
  let type = detectTypeByPattern(query, history);

  // ─── Layer 2: AI classification (if pattern didn't match) ───
  if (!type) {
    type = await classifyWithAI(query, anthropicApiKey);
  }

  // ─── Layer 3: Data check — refine type ───

  // Type 10: Comparison — find two businesses to compare
  if (type === 'comparison') {
    const pair = await findComparisonPair(supabase, siteId, query);
    if (pair) {
      return { ...emptyResult, type: 'comparison', comparisonPair: pair };
    }
    // Can't find two businesses → fall back to engine
    return { ...emptyResult, type: 'follow-up' };
  }

  // Check for specific business name (upgrades to Type 9)
  // Also check for community/news queries — "Texas Roadhouse reviews" should find the business
  if (type === 'business-recommendation' || type === 'info-lookup' || type === 'community' || type === 'news-events') {
    const biz = await findBusinessByName(supabase, siteId, query);
    if (biz) {
      return {
        ...emptyResult,
        type: 'business-lookup',
        singleBusiness: biz,
      };
    }
  }

  // Type 5: Community — return as community type for template builder
  if (type === 'community') {
    return { ...emptyResult, type: 'community' };
  }

  // Type 6: News/Events — return as news-events type for template builder
  if (type === 'news-events') {
    return { ...emptyResult, type: 'news-events' };
  }

  // Check category match for business types
  if (type === 'business-recommendation' || type === 'mixed') {
    const category = await matchCategory(supabase, siteId, specificKws, query);
    if (category) {
      // Check if also info-heavy → upgrade to mixed
      if (/tips|what to know|should i|advice|how much|do i need/.test(query.toLowerCase()) && type !== 'mixed') {
        type = 'mixed';
      }
      return {
        ...emptyResult,
        type,
        matchedCategory: category.name,
      };
    }
    // No category → check guides
    const guides = await searchGuides(supabase, siteId, specificKws);
    if (guides.length > 0) {
      return {
        ...emptyResult,
        type: 'guide',
        related: { ...emptyResult.related, guides },
      };
    }
    // Nothing found
    return { ...emptyResult, type: 'no-match' };
  }

  // For guide type, keep as guide — don't auto-upgrade to mixed
  if (type === 'guide') {
    const guides = await searchGuides(supabase, siteId, specificKws);
    if (guides.length > 0) {
      return {
        ...emptyResult,
        type: 'guide',
        related: { ...emptyResult.related, guides },
      };
    }
    return { ...emptyResult, type: 'guide' };
  }

  // For info-lookup, return as-is (engine handles it)
  if (type === 'info-lookup') {
    return { ...emptyResult, type };
  }

  // For follow-up, return as-is (engine handles it)
  if (type === 'follow-up') {
    return { ...emptyResult, type };
  }

  // For other types (life-event), delegate to engine for now
  return { ...emptyResult, type };
}

// ─── Comparison Pair Finder ────────────────────────────────────

async function findComparisonPair(
  supabase: AnyRow,
  siteId: string,
  query: string,
): Promise<[import('./types').BusinessResult, import('./types').BusinessResult] | null> {
  // Extract two business names from comparison query
  // Patterns: "A vs B", "A or B", "A versus B", "compare A and B", "difference between A and B"
  const q = query.replace(/[?.!]/g, '').trim();

  let nameA = '';
  let nameB = '';

  // "A vs B" / "A versus B"
  let match = q.match(/^(.+?)\s+(?:vs\.?|versus)\s+(.+)$/i);
  if (match) { nameA = match[1]; nameB = match[2]; }

  // "compare A and B" / "compare A to B" / "compare A with B"
  if (!nameA) {
    match = q.match(/compare\s+(.+?)\s+(?:and|to|with|vs\.?)\s+(.+)/i);
    if (match) { nameA = match[1]; nameB = match[2]; }
  }

  // "difference between A and B"
  if (!nameA) {
    match = q.match(/difference\s+between\s+(.+?)\s+and\s+(.+)/i);
    if (match) { nameA = match[1]; nameB = match[2]; }
  }

  // "A or B" + "better/which"
  if (!nameA) {
    match = q.match(/(.+?)\s+or\s+(.+?)(?:\s+(?:better|which|what))?$/i);
    if (match) { nameA = match[1]; nameB = match[2]; }
  }

  if (!nameA || !nameB) return null;

  // Clean up — remove common question words and trailing comparison phrases
  const clean = (s: string) => s
    .replace(/^(is|which is|what's|what is|should i go to|should i choose)\s+/i, '')
    .replace(/\s+(which\s+is\s+better|which\s+is\s+best|which\s+one|which\s+is)\s*$/i, '')
    .replace(/\s+(better|best|good|worth it|recommended|which)\s*$/i, '')
    .trim();

  nameA = clean(nameA);
  nameB = clean(nameB);

  if (nameA.length < 2 || nameB.length < 2) return null;

  // Find both businesses
  const [bizA, bizB] = await Promise.all([
    findBusinessByName(supabase, siteId, nameA),
    findBusinessByName(supabase, siteId, nameB),
  ]);

  if (!bizA || !bizB) return null;
  return [bizA, bizB];
}

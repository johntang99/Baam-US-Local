'use server';

import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

interface AskResult {
  answer: string;
  sources: {
    type: string;
    title: string;
    url: string;
    snippet?: string;
  }[];
  relatedQuestions?: string[];
  debugPrompt?: {
    intent: string;
    keywords: string[];
    systemPrompt: string;
    userPrompt: string;
    model: string;
    totalResults: number;
  };
}

// ─── Stage 1: Intent Classification ──────────────────────────────
interface QueryIntent {
  type: 'broad_category' | 'specific_search' | 'info_question' | 'follow_up';
  category: string | null;    // matched parent category slug
  keywords: string[];
  location: string | null;
  intent: 'recommendation' | 'info' | 'comparison' | 'question';
}

// ─── AI-powered keyword extraction ──────────────────────────────────
// Uses Claude Haiku to understand user intent and extract search keywords.
// Handles any phrasing naturally — no manual stop words needed.
// Falls back to regex-based extraction if AI call fails.

async function extractKeywordsWithAI(query: string): Promise<string[]> {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: `You are a search keyword extractor for a local community platform in Middletown, NY (Baam).
The platform has 6 content types: businesses, news articles, living guides, forum threads, local voices (influencer posts), and events.

Given a user's question, extract 1-5 core search keywords that would match across ALL content types.

Rules:
- Return ONLY the keywords, one per line, nothing else
- Remove filler words, questions, common locations (Middletown, Orange County, NY etc.)
- Keep specific nouns:
  · Business terms: food types (pizza, tacos, sushi), services (dentist, lawyer, plumber), specialties (acupuncture, tax prep)
  · Article/guide topics: immigration, housing, taxes, DMV, insurance, schools
  · Event terms: festival, workshop, seminar, job fair
  · Forum topics: advice, help, recommendation
- Keep symptom/need terms: knee pain, leak, hair loss
- Shorten to category keywords when possible
- Maximum 5 keywords, prefer fewer and more precise`,
      messages: [{ role: 'user', content: query }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const keywords = text.split('\n').map(l => l.trim()).filter(l => l.length >= 2 && l.length <= 10);
    if (keywords.length > 0) return keywords.slice(0, 5);
  } catch {
    // AI extraction failed — fall through to regex fallback
  }
  return extractKeywordsFallback(query);
}

// Regex-based fallback (used if AI extraction fails)
function extractKeywordsFallback(query: string): string[] {
  const LOCATIONS = ['Middletown', 'Newburgh', 'Goshen', 'Monroe', 'Wallkill', 'Chester', 'Warwick', 'Cornwall', 'Highland Falls', 'Orange County', 'NY'];
  const stopPhrases = [
    'please tell me', 'please help', 'please find', 'can you help', 'help me find', 'help me',
    'tell me about', 'show me', 'let me know', 'i need to know',
    'what are', 'what is', 'what does', 'where is', 'where are', 'where can i',
    'how do i', 'how can i', 'how to', 'how much', 'how many',
    'which one', 'which ones', 'who knows',
    'is there', 'are there', 'do you have', 'does anyone know',
    'find me', 'look for', 'looking for', 'search for', 'list all', 'list out',
    'recommend', 'recommend me', 'any recommendations', 'suggestions', 'suggest',
    'all the', 'some', 'a few', 'any good',
    'the best', 'best', 'good', 'great', 'top rated', 'highest rated',
    'ranking', 'rated', 'reviews', 'rating', 'score',
    'pretty good', 'really good', 'not bad', 'reliable', 'legit', 'reputable',
    'i want to eat', 'i want to buy', 'i want to find', 'i want to go', 'i want',
    'i would like', 'i need', 'want to eat', 'want to buy', 'want to find', 'want to go',
    'can i', 'should i', 'do you know', 'i heard', 'apparently', 'seems like',
    'local', 'nearby', 'around here', 'close by', 'in the area',
    'could you', 'would you', 'is it possible',
    'where to buy', 'where to find', 'where to go', 'where to get',
  ];
  const stopCharSet = new Set([
    'i', 'me', 'my', 'you', 'your', 'he', 'she', 'it', 'we', 'they',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'in', 'on', 'at', 'to', 'for', 'of', 'by', 'from', 'with', 'and', 'or', 'but',
    'so', 'if', 'not', 'no', 'do', 'did', 'has', 'had', 'have',
    'this', 'that', 'these', 'those', 'some', 'any', 'all', 'each', 'every',
    'can', 'will', 'just', 'get', 'got', 'go', 'see', 'find', 'want', 'need',
    'good', 'also', 'very', 'really', 'too', 'more', 'most', 'much',
  ]);

  let remaining = query.trim();
  for (const loc of LOCATIONS) {
    if (remaining.includes(loc)) remaining = remaining.replace(loc, ' ');
  }
  [...stopPhrases].sort((a, b) => b.length - a.length).forEach(w => {
    remaining = remaining.replace(new RegExp(w, 'g'), ' ');
  });
  let segments = remaining.split(/[\s,，、.。!！?？·；;：:""''「」【】（）()\-—]+/).filter(w => w.length >= 2);
  segments = segments.map(seg => {
    while (seg.length > 1 && stopCharSet.has(seg[0])) seg = seg.slice(1);
    while (seg.length > 1 && stopCharSet.has(seg[seg.length - 1])) seg = seg.slice(0, -1);
    return seg;
  }).filter(w => w.length >= 2);
  return [...new Set(segments)].filter(k => k.length >= 2).slice(0, 8);
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askXiaoLin(
  query: string,
  history: ChatMessage[] = [],
): Promise<{ error?: string; data?: AskResult }> {
  if (!query?.trim() || query.length < 2) {
    return { error: 'Please enter your question' };
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  // ═══════════════════════════════════════════════════════════════════
  // STAGE 1: INTENT CLASSIFICATION (single Haiku call)
  // Combines follow-up detection + intent classification + keyword extraction
  // ═══════════════════════════════════════════════════════════════════

  let intentResult: QueryIntent = {
    type: 'specific_search', category: null, keywords: [], location: null, intent: 'question',
  };

  try {
    const lastAssistant = history.length >= 2
      ? [...history].reverse().find(m => m.role === 'assistant')?.content.slice(0, 200) || ''
      : '';

    const intentResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `You classify user queries for a local community platform in Middletown, NY & Orange County.
The platform has: businesses, news, guides, forum, community posts, events.

Reply with EXACTLY this JSON format, nothing else:
{"type":"...","category":"...","keywords":[...],"location":"...","intent":"..."}

type (pick one):
- "follow_up" — continuation of conversation (e.g. "yes", "thanks", "which one", "tell me more")
- "broad_category" — wants the BEST/TOP from a category, no specific subtype (e.g. "best restaurants", "top dentists")
- "specific_search" — DEFAULT for most queries. Use this when:
  · Looking for a specific business type: "sushi near Goshen", "emergency plumber"
  · Describing a problem that needs a service: "got a DUI", "toilet overflowing", "chest pain", "slip and fell", "car broke down", "water in basement", "back taxes"
  · Asking WHERE to find something: "where to get oil changed", "where to buy furniture"
  · Needs a professional: lawyer, doctor, mechanic, accountant, plumber, etc.
- "info_question" — ONLY use for pure knowledge questions with NO implied business need:
  · "what's the sales tax in NY", "what events this weekend", "how to register to vote", "what school district am I in"
  · If unsure between info_question and specific_search, choose specific_search

category — the most relevant business parent category slug, or null:
  food-dining — restaurants, cafes, bars, bakeries, grocery, catering, coffee, ice cream, food truck
  auto — mechanic, tires, oil change, body shop, car dealer, towing, car wash
  home-renovation — plumber, electrician, HVAC, roofing, painting, landscaping, lawn care, pest control, cleaning, contractor, handyman, moving, locksmith, fencing, tree service, pool
  medical-health — doctor, dentist, urgent care, pharmacy, pediatrician, therapist, chiropractor, eye doctor, vet
  beauty-wellness — hair salon, barber, nail salon, spa, massage, gym, fitness, yoga, tattoo
  shopping-retail — clothing, electronics, furniture, hardware, pet store, jewelry, florist, thrift
  legal — lawyer, attorney, divorce, immigration, DUI, personal injury, estate planning, bankruptcy
  finance-tax — tax prep, accountant, insurance, mortgage, financial advisor, bank
  real-estate — realtor, property manager, home inspection, title company, appraisal
  education — daycare, preschool, tutor, driving school, martial arts, SAT prep, ESL
  other-services — dry cleaning, pet grooming, photographer, storage, shipping/UPS/FedEx, church, funeral, senior care/home health aide, tailor/alterations, phone/computer repair, DJ/event planning, printing/signs/business cards, wedding venue

keywords — 1-5 specific search terms (NOT generic words like "best", "good", "recommend", "restaurant", "find", "nearby"). Extract the SPECIFIC thing they want:
  "best sushi restaurants" → ["sushi"]
  "good plumber in Goshen" → ["plumber"]
  "best restaurants" → [] (no specific keyword — broad category handles it)
  "how to get driver's license" → ["driver's license", "DMV"]

location — detected town name or null: middletown, newburgh, goshen, monroe, warwick, chester, cornwall, etc.

intent: "recommendation" | "info" | "comparison" | "question"

${lastAssistant ? `Previous assistant reply: "${lastAssistant}"` : '(no conversation history)'}`,
      messages: [{ role: 'user', content: query }],
    });

    const intentText = intentResponse.content[0].type === 'text' ? intentResponse.content[0].text.trim() : '';
    const parsed = JSON.parse(intentText);
    intentResult = {
      type: parsed.type || 'specific_search',
      category: parsed.category || null,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter((k: string) => k.length >= 2) : [],
      location: parsed.location || null,
      intent: parsed.intent || 'question',
    };
  } catch {
    // Intent classification failed — fall back to keyword extraction
    intentResult.keywords = await extractKeywordsWithAI(query);
  }

  // ─── Handle follow-ups (no RAG needed) ─────────────────────────
  if (intentResult.type === 'follow_up' && history.length >= 2) {
    const followUpPrompt = `You are the Baam AI Assistant for Middletown, NY. Friendly, conversational tone. Use emojis. Use markdown tables for list data. Continue from previous context.`;
    const aiMessages: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const msg of history.slice(-8)) aiMessages.push({ role: msg.role, content: msg.content });
    aiMessages.push({ role: 'user', content: query });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 2048,
      system: followUpPrompt, messages: aiMessages,
    });
    const answer = response.content[0].type === 'text' ? response.content[0].text : '';
    return { data: { answer, sources: [], relatedQuestions: [], debugPrompt: {
      intent: 'follow_up', keywords: [], systemPrompt: followUpPrompt,
      userPrompt: query, model: 'claude-haiku-4-5-20251001', totalResults: 0,
    } } };
  }

  // ═══════════════════════════════════════════════════════════════════
  // STAGE 2: CROSS-CONNECTED RETRIEVAL
  // Fetch businesses + content in parallel, strategy driven by intent
  // ═══════════════════════════════════════════════════════════════════

  const supabase = createAdminClient();
  const { getCurrentSite } = await import('@/lib/sites');
  const site = await getCurrentSite();
  const siteId = site.id;
  const regionIds = site.regionIds;
  const keywords = intentResult.keywords.length > 0 ? intentResult.keywords : await extractKeywordsWithAI(query);

  const genericWords = new Set(['apply', 'how', 'what', 'where', 'which', 'can', 'need', 'process', 'service', 'consult', 'recommend', 'good', 'best', 'nearby', 'price', 'cost', 'much']);

  // Build OR conditions for each keyword across multiple columns
  // For content search (articles, guides, forum) — use all keywords with OR
  function buildOr(columns: string[]): string {
    const conditions: string[] = [];
    for (const kw of keywords) {
      const pattern = `%${kw}%`;
      for (const col of columns) {
        conditions.push(`${col}.ilike.${pattern}`);
      }
    }
    return conditions.join(',');
  }

  // Build OR conditions but skip generic words — for business search only
  function buildBusinessOr(columns: string[]): string {
    const specificKeywords = keywords.filter((kw: string) => !genericWords.has(kw) && kw.length > 1);
    if (specificKeywords.length === 0) {
      // All keywords are generic — use the original keywords but require longer match
      return buildOr(columns);
    }
    const conditions: string[] = [];
    for (const kw of specificKeywords) {
      const pattern = `%${kw}%`;
      for (const col of columns) {
        conditions.push(`${col}.ilike.${pattern}`);
      }
    }
    return conditions.join(',');
  }

  // ─── Location-aware filtering ──────────────────────────────────
  // Detect if user mentions a specific town → filter businesses to that region
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

  let locationRegionId: string | null = null;
  const queryLower = query.toLowerCase();
  for (const [town, regionId] of Object.entries(TOWN_REGION_MAP)) {
    if (queryLower.includes(town)) {
      locationRegionId = regionId;
      break;
    }
  }

  // Get business IDs in the specific town (if mentioned)
  let townBizIds: Set<string> | null = null;
  if (locationRegionId) {
    const allLocs: AnyRow[] = [];
    let offset = 0;
    while (true) {
      const { data: locs } = await (supabase as any)
        .from('business_locations')
        .select('business_id')
        .eq('region_id', locationRegionId)
        .range(offset, offset + 999);
      if (!locs || locs.length === 0) break;
      allLocs.push(...locs);
      if (locs.length < 1000) break;
      offset += 1000;
    }
    townBizIds = new Set(allLocs.map((l: AnyRow) => l.business_id as string));
  }

  // ─── RAG: Search all 6 content sources in parallel ──────────────

  // ─── Intent-driven business search ──────────────────────────────
  async function searchBusinesses(): Promise<AnyRow[]> {
    const results: AnyRow[] = [];
    const seenIds = new Set<string>();
    const categoryBizIds = new Set<string>();
    const bizFields = 'id, slug, display_name, short_desc_en, ai_tags, avg_rating, review_count, phone, is_featured, address_full, website_url, total_score';

    const addResults = (data: AnyRow[] | null) => {
      for (const b of (data || [])) {
        if (seenIds.has(b.id)) continue;
        if (townBizIds && !townBizIds.has(b.id)) continue;
        seenIds.add(b.id);
        results.push(b);
      }
    };

    // ─── BROAD CATEGORY: fetch businesses by category + optional keyword narrowing ───
    if (intentResult.type === 'broad_category' && intentResult.category) {
      const { data: parentCat } = await (supabase as any)
        .from('categories').select('id, slug, name_en').eq('slug', intentResult.category).eq('site_scope', 'en').single();
      if (parentCat) {
        const { data: childCats } = await (supabase as any)
          .from('categories').select('id, slug, name_en, search_terms').eq('parent_id', parentCat.id);
        const allChildCats = (childCats || []) as AnyRow[];

        // Try to narrow to specific subcategory using keywords
        // Score each subcategory by match quality, then pick the best ones
        // Prevents "fried chicken waffles" from matching 12 subcategories
        let targetCatIds: string[] = [];
        if (keywords.length > 0 && allChildCats.length > 0) {
          const searchWords = new Set<string>();
          for (const kw of keywords) {
            searchWords.add(kw.toLowerCase());
            for (const word of kw.toLowerCase().split(/\s+/)) {
              if (word.length >= 3) searchWords.add(word);
            }
          }

          // Score each subcategory: name/slug match = 10pts, search_terms match = 1pt per term
          const catScores = new Map<string, number>();
          for (const cat of allChildCats) {
            let score = 0;
            for (const word of searchWords) {
              const nameEn = (cat.name_en || '').toLowerCase();
              const slug = (cat.slug || '').toLowerCase();
              if (nameEn.includes(word) || word.includes(nameEn)) score += 10;
              else if (slug.includes(word)) score += 10;
              else if ((cat.search_terms || []).some((t: string) => t.toLowerCase() === word)) score += 3;
              else if ((cat.search_terms || []).some((t: string) => t.toLowerCase().includes(word) || word.includes(t.toLowerCase()))) score += 1;
            }
            if (score > 0) catScores.set(cat.id, score);
          }

          if (catScores.size > 0) {
            // Sort by score descending, take top 3 max (prevents over-expansion)
            const sorted = [...catScores.entries()].sort((a, b) => b[1] - a[1]);
            const topScore = sorted[0][1];
            // Include categories that score at least 30% of the top score
            targetCatIds = sorted
              .filter(([, s]) => s >= topScore * 0.3)
              .slice(0, 3)
              .map(([id]) => id);
          }
        }

        // If no subcategory matched, use all children (true broad query like "best restaurants")
        if (targetCatIds.length === 0) {
          targetCatIds = [parentCat.id, ...allChildCats.map((c: AnyRow) => c.id)];
        }

        // Get all business IDs in target categories
        const { data: bizLinks } = await (supabase as any)
          .from('business_categories').select('business_id')
          .in('category_id', targetCatIds).limit(10000);
        const allBizIds = [...new Set((bizLinks || []).map((l: AnyRow) => l.business_id))];

        // Fetch in chunks, sorted by total_score
        for (let i = 0; i < allBizIds.length && results.length < 30; i += 200) {
          const chunk = allBizIds.slice(i, i + 200);
          const { data } = await (supabase as any)
            .from('businesses').select(bizFields)
            .eq('is_active', true).eq('site_id', siteId).in('id', chunk)
            .order('total_score', { ascending: false, nullsFirst: false }).limit(30);
          addResults(data);
        }
      }
      // Sort purely by total_score for broad queries
      results.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
      return results.slice(0, 30);
    }

    // ─── INFO QUESTION: fetch related services using keyword narrowing ───
    // Same narrowing as broad_category — user might describe a problem that needs a professional
    // e.g., "I owe the IRS" → tax prep, "filing bankruptcy" → bankruptcy lawyer
    if (intentResult.type === 'info_question' && intentResult.category) {
      const { data: parentCat } = await (supabase as any)
        .from('categories').select('id, slug, name_en').eq('slug', intentResult.category).eq('site_scope', 'en').single();
      if (parentCat) {
        const { data: childCats } = await (supabase as any)
          .from('categories').select('id, slug, name_en, search_terms').eq('parent_id', parentCat.id);
        const allChildCats = (childCats || []) as AnyRow[];

        // Try to narrow using keywords (same scored matching)
        let targetCatIds: string[] = [];
        if (keywords.length > 0 && allChildCats.length > 0) {
          const searchWords = new Set<string>();
          for (const kw of keywords) {
            searchWords.add(kw.toLowerCase());
            for (const word of kw.toLowerCase().split(/\s+/)) {
              if (word.length >= 3) searchWords.add(word);
            }
          }
          const catScores = new Map<string, number>();
          for (const cat of allChildCats) {
            let score = 0;
            for (const word of searchWords) {
              const nameEn = (cat.name_en || '').toLowerCase();
              const slug = (cat.slug || '').toLowerCase();
              if (nameEn.includes(word) || word.includes(nameEn)) score += 10;
              else if (slug.includes(word)) score += 10;
              else if ((cat.search_terms || []).some((t: string) => t.toLowerCase() === word)) score += 3;
              else if ((cat.search_terms || []).some((t: string) => t.toLowerCase().includes(word) || word.includes(t.toLowerCase()))) score += 1;
            }
            if (score > 0) catScores.set(cat.id, score);
          }
          if (catScores.size > 0) {
            const sorted = [...catScores.entries()].sort((a, b) => b[1] - a[1]);
            const topScore = sorted[0][1];
            targetCatIds = sorted.filter(([, s]) => s >= topScore * 0.3).slice(0, 3).map(([id]) => id);
          }
        }
        if (targetCatIds.length === 0) {
          targetCatIds = [parentCat.id, ...allChildCats.map((c: AnyRow) => c.id)];
        }

        const { data: bizLinks } = await (supabase as any)
          .from('business_categories').select('business_id')
          .in('category_id', targetCatIds).limit(5000);
        const allBizIds = [...new Set((bizLinks || []).map((l: AnyRow) => l.business_id))];
        if (allBizIds.length > 0) {
          for (let i = 0; i < allBizIds.length && results.length < 10; i += 200) {
            const chunk = allBizIds.slice(i, i + 200);
            const { data } = await (supabase as any)
              .from('businesses').select(bizFields)
              .eq('is_active', true).eq('site_id', siteId).in('id', chunk)
              .order('total_score', { ascending: false, nullsFirst: false }).limit(10);
            addResults(data);
          }
        }
      }
      results.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
      return results.slice(0, 10);
    }

    // ─── SPECIFIC SEARCH: 3-strategy keyword-based search ─────────
    // Strategy 1: Match keywords against category search_terms + name → find businesses by category
    // Fetch all business categories once, then do bidirectional substring matching in JS
    const { data: allBizCats } = await (supabase as any)
      .from('categories')
      .select('id, name_en, slug, parent_id, search_terms')
      .eq('type', 'business')
      .eq('site_scope', 'en');

    // Match categories by English name and search_terms
    const matchedCats: { cat: AnyRow; matchType: 'name' | 'terms' }[] = [];
    for (const cat of (allBizCats || [])) {
      const nameEn = (cat.name_en || '').toLowerCase();
      const terms: string[] = cat.search_terms || [];
      for (const kw of keywords) {
        if (kw.length < 2) continue;
        const kwLower = kw.toLowerCase();
        const nameMatch = nameEn && (nameEn.includes(kwLower) || kwLower.includes(nameEn));
        // For search_terms matching:
        // - t.includes(kw): search_term contains keyword (e.g. "Korean BBQ" contains "BBQ") — always ok
        // - kw.includes(t): keyword contains search_term — require t >= 3 chars to avoid
        //   generic short words like "cut","service","repair" matching unrelated categories
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
      // Decide which categories to fully expand (list ALL businesses):
      // - Name match → always expand (it IS the right category)
      //   e.g. "pizza" → food-pizza (Pizza & Italian) → all 23 pizza places
      //   e.g. "Chinese" → food-chinese (Chinese) → all 27 Chinese restaurants
      // - Terms-only match + small category (≤ 10 businesses) → expand
      //   e.g. "dumplings" → food-noodles (Noodle Shops, 2 biz) → all 2 noodle shops
      // - Terms-only match + large category (> 10 businesses) → skip
      //   e.g. "dumplings" → food-chinese (Chinese, 27 biz) → too broad, rely on text search
      const MAX_TERMS_ONLY_SIZE = 50;

      // Get all category IDs including parent→children expansion
      const catIdsByMatch = new Map<string, 'name' | 'terms'>();
      for (const { cat, matchType } of matchedCats) {
        catIdsByMatch.set(cat.id, matchType);
      }
      // Expand parent categories to include children (inherit parent's match type)
      const parentMatches = matchedCats.filter(m => !m.cat.parent_id);
      if (parentMatches.length > 0) {
        const { data: children } = await (supabase as any).from('categories').select('id, parent_id').in('parent_id', parentMatches.map(m => m.cat.id));
        for (const child of (children || []) as AnyRow[]) {
          const parentType = catIdsByMatch.get(child.parent_id);
          if (parentType) catIdsByMatch.set(child.id, parentType);
        }
      }

      // Count businesses per category
      const { data: allBizCatLinks } = await (supabase as any)
        .from('business_categories')
        .select('business_id, category_id')
        .in('category_id', [...catIdsByMatch.keys()])
        .limit(10000);

      const bizPerCat = new Map<string, string[]>();
      for (const link of (allBizCatLinks || []) as AnyRow[]) {
        if (!bizPerCat.has(link.category_id)) bizPerCat.set(link.category_id, []);
        bizPerCat.get(link.category_id)!.push(link.business_id);
      }

      // Include businesses from qualifying categories
      const includedBizIds = new Set<string>();
      for (const [catId, matchType] of catIdsByMatch) {
        const bizList = bizPerCat.get(catId) || [];
        if (matchType === 'name' || bizList.length <= MAX_TERMS_ONLY_SIZE) {
          bizList.forEach(id => includedBizIds.add(id));
        }
        // else: terms-only + large category → skip (text search handles it)
      }

      categoryBizIds.forEach(id => includedBizIds.add(id)); // keep any previously added
      includedBizIds.forEach(id => categoryBizIds.add(id));

      if (includedBizIds.size > 0) {
        const { data } = await (supabase as any)
          .from('businesses').select(bizFields)
          .eq('is_active', true).eq('site_id', siteId).in('id', [...includedBizIds].slice(0, 100))
          .order('total_score', { ascending: false, nullsFirst: false }).limit(30);
        addResults(data);
      }
    }

    // Strategy 2: Search ai_tags array — sort by total_score
    for (const kw of keywords) {
      if (kw.length < 2 || results.length >= 30) continue;
      const { data } = await (supabase as any)
        .from('businesses').select(bizFields)
        .eq('is_active', true).eq('site_id', siteId)
        .contains('ai_tags', [kw])
        .order('total_score', { ascending: false, nullsFirst: false }).limit(10);
      addResults(data);
    }

    // Strategy 3: Text search on name/description — sort by total_score
    {
      const { data } = await (supabase as any)
        .from('businesses').select(bizFields)
        .eq('is_active', true).eq('site_id', siteId)
        .or(buildBusinessOr(['display_name', 'short_desc_en']))
        .order('total_score', { ascending: false, nullsFirst: false }).limit(10);
      addResults(data);
    }

    // Sort: tier (keyword match > category > other) then total_score
    // This path only runs for specific_search — broad queries return early above
    results.sort((a, b) => {
      const aText = [a.display_name, a.short_desc_en].filter(Boolean).join(' ').toLowerCase();
      const bText = [b.display_name, b.short_desc_en].filter(Boolean).join(' ').toLowerCase();
      const aHasKeyword = keywords.some((kw: string) => aText.includes(kw.toLowerCase()));
      const bHasKeyword = keywords.some((kw: string) => bText.includes(kw.toLowerCase()));
      const aInCategory = categoryBizIds.has(a.id);
      const bInCategory = categoryBizIds.has(b.id);
      const aTier = aHasKeyword ? 0 : aInCategory ? 1 : 2;
      const bTier = bHasKeyword ? 0 : bInCategory ? 1 : 2;
      if (aTier !== bTier) return aTier - bTier;
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return (b.total_score || 0) - (a.total_score || 0);
    });
    return results.slice(0, 30);
  }

  const [bizData, newsResult, guideResult, forumResult, voiceResult, eventResult] = await Promise.all([
    searchBusinesses(),

    // News — filtered by region
    (supabase as any)
      .from('articles')
      .select('slug, title_en, summary_en, content_vertical, published_at')
      .eq('site_id', site.id)
      .eq('editorial_status', 'published')
      .in('content_vertical', ['news_alert', 'news_brief', 'news_explainer', 'news_roundup', 'news_community'])
      .in('region_id', regionIds)
      .or(buildOr(['title_en', 'summary_en']))
      .order('published_at', { ascending: false })
      .limit(3),

    // Guides — filtered by region
    (supabase as any)
      .from('articles')
      .select('slug, title_en, summary_en, content_vertical')
      .eq('site_id', site.id)
      .eq('editorial_status', 'published')
      .in('content_vertical', ['guide_howto', 'guide_checklist', 'guide_bestof', 'guide_comparison', 'guide_neighborhood', 'guide_seasonal', 'guide_resource', 'guide_scenario'])
      .in('region_id', regionIds)
      .or(buildOr(['title_en', 'summary_en', 'body_en']))
      .limit(5),

    // Forum threads — filtered by region
    (supabase as any)
      .from('forum_threads')
      .select('slug, title, summary_en, reply_count, board_id, categories:board_id(slug)')
      .eq('site_id', site.id)
      .eq('status', 'published')
      .in('region_id', regionIds)
      .or(buildOr(['title', 'body', 'summary_en']))
      .order('reply_count', { ascending: false })
      .limit(3),

    // Voice posts / Discover posts
    (supabase as any)
      .from('voice_posts')
      .select('id, slug, title, excerpt, content, cover_images, cover_image_url, topic_tags, location_text, like_count, author_id, profiles:author_id(display_name)')
      .eq('site_id', site.id)
      .eq('status', 'published')
      .or(buildOr(['title', 'content']))
      .order('like_count', { ascending: false })
      .limit(5),

    // Events — filtered by region
    (supabase as any)
      .from('events')
      .select('slug, title_en, summary_en, venue_name, start_at, is_free')
      .eq('site_id', site.id)
      .eq('status', 'published')
      .in('region_id', regionIds)
      .or(buildOr(['title_en', 'summary_en', 'venue_name']))
      .order('start_at', { ascending: true })
      .limit(3),
  ]);

  const businesses = bizData as AnyRow[];
  const news = (newsResult.data || []) as AnyRow[];
  const guides = (guideResult.data || []) as AnyRow[];
  const threads = (forumResult.data || []) as AnyRow[];
  const voices = (voiceResult.data || []) as AnyRow[];
  const events = (eventResult.data || []) as AnyRow[];

  // ─── Fetch Google reviews for top businesses ────────────────────

  let reviewsByBiz: Record<string, AnyRow[]> = {};
  if (businesses.length > 0) {
    const topBizIds = businesses.slice(0, 10).map(b => b.id);
    const { data: reviewData } = await (supabase as any)
      .from('reviews')
      .select('business_id, rating, body, google_author_name, language')
      .in('business_id', topBizIds)
      .eq('status', 'approved')
      .order('rating', { ascending: false })
      .limit(30);

    for (const r of (reviewData || []) as AnyRow[]) {
      if (!reviewsByBiz[r.business_id]) reviewsByBiz[r.business_id] = [];
      if (reviewsByBiz[r.business_id].length < 3) reviewsByBiz[r.business_id].push(r);
    }
  }

  // ─── Build context for AI ───────────────────────────────────────

  const contextParts: string[] = [];

  if (businesses.length > 0) {
    const tags = (b: AnyRow) => (b.ai_tags || []).filter((t: string) => t !== 'GBP Claimed').slice(0, 4).join(', ');
    contextParts.push(`[Business Info] Found ${businesses.length} relevant businesses (RANKED by total_score = 6×Rating + 3×log(Reviews+2)×2 + P_score — #1 is the best overall):\n` + businesses.map((b, i) => {
      let line = `${i + 1}. ${b.display_name} [Score: ${Number(b.total_score || 0).toFixed(1)}]${b.avg_rating ? ` — Rating: ${b.avg_rating}/5 (${b.review_count || 0} reviews)` : ''} ${b.phone ? `| Phone: ${b.phone}` : ''} ${b.address_full ? `| Address: ${b.address_full}` : ''} ${tags(b) ? `| Features: ${tags(b)}` : ''} ${b.short_desc_en ? `| ${b.short_desc_en.slice(0, 80)}` : ''}`;
      // Add review snippets if available
      const reviews = reviewsByBiz[b.id];
      if (reviews && reviews.length > 0) {
        const snippets = reviews.map(r => `"${(r.body || '').slice(0, 50)}"(${r.google_author_name || 'User'}, ${r.rating} stars)`).join(' ');
        line += ` Reviews: ${snippets}`;
      }
      return line;
    }).join('\n'));
  }

  if (guides.length > 0) {
    contextParts.push('[Local Guides]\n' + guides.map(g =>
      `- ${g.title_en}: ${g.summary_en || ''}`
    ).join('\n'));
  }

  if (news.length > 0) {
    contextParts.push('[Local News]\n' + news.map(n =>
      `- ${n.title_en}: ${n.summary_en || ''}`
    ).join('\n'));
  }

  if (threads.length > 0) {
    contextParts.push('[Forum Discussions]\n' + threads.map(t =>
      `- ${t.title} (${t.reply_count || 0} replies): ${t.summary_en || ''}`
    ).join('\n'));
  }

  if (events.length > 0) {
    contextParts.push('[Local Events]\n' + events.map(e => {
      const date = e.start_at ? new Date(e.start_at).toLocaleDateString('en-US') : '';
      return `- ${e.title_en}: ${date} ${e.venue_name || ''} ${e.is_free ? 'Free' : ''}`;
    }).join('\n'));
  }

  if (voices.length > 0) {
    contextParts.push('[Community Notes / Voices]\n' + voices.map((v, i) => {
      const author = v.profiles?.display_name || 'Anonymous';
      const tags = (v.topic_tags || []).join(', ');
      const loc = v.location_text || '';
      const likes = v.like_count || 0;
      const body = (v.content || v.excerpt || '').slice(0, 150);
      return `${i + 1}. ${v.title || '(Untitled)'} (${author}${loc ? ' · ' + loc : ''}${likes ? ` · ${likes} likes` : ''})${tags ? `\n   Tags: ${tags}` : ''}\n   ${body}`;
    }).join('\n'));
  }

  // ═══════════════════════════════════════════════════════════════════
  // STAGE 3: ANSWER GENERATION + RELATED QUESTIONS
  // Single Haiku call for answer, then lightweight call for Q&A suggestions
  // ═══════════════════════════════════════════════════════════════════

  try {
    // ─── Build context for AI ─────────────────────────────────────
    const contextParts: string[] = [];

    if (businesses.length > 0) {
      const tags = (b: AnyRow) => (b.ai_tags || []).filter((t: string) => t !== 'GBP Claimed').slice(0, 4).join(', ');
      const sectionLabel = intentResult.type === 'info_question' ? '🏪 Related Local Services' : '📊 Business Results';
      contextParts.push(`[${sectionLabel}] ${businesses.length} businesses (RANKED by total_score — #1 is best):\n` + businesses.map((b, i) => {
        let line = `${i + 1}. ${b.display_name} [Score: ${Number(b.total_score || 0).toFixed(1)}] — ${b.avg_rating || '?'}/5 (${b.review_count || 0} reviews) ${b.phone ? `| 📞 ${b.phone}` : ''} ${b.address_full ? `| 📍 ${b.address_full}` : ''} ${tags(b) ? `| 🏷️ ${tags(b)}` : ''} ${b.short_desc_en ? `| ${b.short_desc_en.slice(0, 80)}` : ''}`;
        const reviews = reviewsByBiz[b.id];
        if (reviews && reviews.length > 0) {
          const snippets = reviews.map(r => `"${(r.body || '').slice(0, 50)}"(${r.google_author_name || 'User'}, ${r.rating}★)`).join(' ');
          line += ` | Reviews: ${snippets}`;
        }
        return line;
      }).join('\n'));
    }

    if (guides.length > 0) {
      contextParts.push('[📚 Related Guides]\n' + guides.map(g =>
        `- "${g.title_en}": ${g.summary_en || ''}`
      ).join('\n'));
    }

    if (news.length > 0) {
      contextParts.push('[📰 Local News]\n' + news.map(n =>
        `- "${n.title_en}": ${n.summary_en || ''}`
      ).join('\n'));
    }

    if (threads.length > 0) {
      contextParts.push('[💬 Community Discussions]\n' + threads.map(t =>
        `- "${t.title}" (${t.reply_count || 0} replies): ${t.summary_en || ''}`
      ).join('\n'));
    }

    if (events.length > 0) {
      contextParts.push('[🎉 Local Events]\n' + events.map(e => {
        const date = e.start_at ? new Date(e.start_at).toLocaleDateString('en-US') : '';
        return `- "${e.title_en}": ${date} ${e.venue_name || ''} ${e.is_free ? '(Free)' : ''}`;
      }).join('\n'));
    }

    if (voices.length > 0) {
      contextParts.push('[🗣️ Community Posts]\n' + voices.map(v => {
        const author = v.profiles?.display_name || 'Anonymous';
        return `- "${v.title || '(Untitled)'}" by ${author}: ${(v.content || v.excerpt || '').slice(0, 100)}`;
      }).join('\n'));
    }

    // ─── FAQ matching (Layer 1 & 2 from DB) ──────────────────────
    const faqKeywords = keywords.slice(0, 3);
    if (faqKeywords.length > 0 || intentResult.category) {
      const faqConditions: string[] = [];
      if (intentResult.category) faqConditions.push(`category_slug.eq.${intentResult.category}`);
      for (const kw of faqKeywords) faqConditions.push(`keywords.cs.{${kw}}`);

      if (faqConditions.length > 0) {
        const { data: faqs } = await (supabase as any)
          .from('faqs')
          .select('question, answer, source_type')
          .eq('is_active', true)
          .eq('site_scope', 'en')
          .or(faqConditions.join(','))
          .order('sort_order', { ascending: true })
          .limit(5);

        if (faqs && faqs.length > 0) {
          contextParts.push('[❓ Frequently Asked Questions]\n' + faqs.map((f: AnyRow) =>
            `Q: ${f.question}\nA: ${f.answer}`
          ).join('\n\n'));
        }
      }
    }

    const totalResults = businesses.length + news.length + guides.length + threads.length + voices.length + events.length;

    // ─── System prompt (varies by intent type) ───────────────────
    const isBusinessQuery = intentResult.type === 'broad_category' || intentResult.type === 'specific_search';
    const systemPrompt = `You are the Baam AI Assistant for Middletown, NY and Orange County. Friendly, conversational, like a helpful neighbor.

[Your Role]
- Expert on Middletown, NY and surrounding towns (Newburgh, Goshen, Monroe, Warwick, etc.)
- Know local businesses, restaurants, medical, legal, education, and community resources
- Give specific, practical, actionable answers with emojis

[Ranking Rules — CRITICAL]
- Businesses are pre-ranked by TOTAL SCORE [Score: XX.X]. Higher = better overall (balances rating + review volume).
- Present businesses in the EXACT order provided. Do NOT re-sort by rating.
- #1 in the list IS the best overall — trust this ranking.

[Response Structure]
${isBusinessQuery ? `- Start with a brief intro (1-2 sentences)
- Show businesses in a markdown table. EXACT format (copy this structure):

| Restaurant | Rating | Phone | Address | Highlights |
|------------|--------|-------|---------|------------|
| **Name** | 4.6/5 (1234) | (845) 555-1234 | 123 Main St | Description here |

- Show UP TO 10 businesses, preserving the provided order
- Do NOT put emojis in table headers — keep headers plain text
- If there are [❓ FAQ] entries, include a "❓ People Also Ask" section with the Q&As
- Add "💡 Pro Tips" as bullet points with emojis
- If guides/news/forum found, add "📚 Related Reads" section with bullet points
- If community posts found, add "🗣️ From the Community" section` : `- Answer the question directly and thoroughly
- Use section headers with emojis
- If businesses are provided as [🏪 Related Local Services], show them in a small table:

| Business | Rating | Phone | Address |
|----------|--------|-------|---------|
| **Name** | 4.6/5 | (845) 555-1234 | 123 Main St |

- If there are [❓ FAQ] entries, include a "❓ People Also Ask" section
- Add "💡 Practical Tips" as bullet points with emojis
- If guides/news found, add "📚 Related Reads" section`}
- Use emojis in text/headers/bullets but NOT inside table cells (breaks rendering)
- Keep tone warm and conversational`;

    const userPrompt = totalResults > 0
      ? `User asks: ${query}\n\nHere is relevant information from our community platform:\n\n${contextParts.join('\n\n')}\n\nPlease answer based on the above. You may supplement with general knowledge.`
      : `User asks: ${query}\n\nNo exact matches found. Answer from your knowledge with info relevant to Middletown/Orange County, and suggest posting in the forum for local advice.`;

    // Build message history
    const aiMessages: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const msg of history.slice(-6)) aiMessages.push({ role: msg.role, content: msg.content });
    aiMessages.push({ role: 'user', content: userPrompt });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: aiMessages,
    });

    const answer = response.content[0].type === 'text' ? response.content[0].text : '';

    // ─── Layer 3 FAQ: AI-generated related questions ─────────────
    let relatedQuestions: string[] = [];
    try {
      const rqResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: `Generate 3 follow-up questions a user might ask next, based on their original question and the context. Questions should be specific to Middletown/Orange County, actionable, and different from the original question. Return ONLY the questions, one per line, no numbering.`,
        messages: [{ role: 'user', content: `Original question: "${query}"\nCategory: ${intentResult.category || 'general'}\nContext: ${businesses.length} businesses, ${guides.length} guides, ${threads.length} forum threads found` }],
      });
      const rqText = rqResponse.content[0].type === 'text' ? rqResponse.content[0].text : '';
      relatedQuestions = rqText.split('\n').map(l => l.trim()).filter(l => l.length >= 10 && l.endsWith('?')).slice(0, 3);
    } catch {
      // Related questions generation failed — not critical
    }

    // ─── Build sources list ──────────────────────────────────────
    const sources: AskResult['sources'] = [];
    businesses.forEach(b => sources.push({ type: 'Business', title: b.display_name, url: `/businesses/${b.slug}`, snippet: b.short_desc_en }));
    guides.forEach(g => sources.push({ type: 'Guide', title: g.title_en, url: `/guides/${g.slug}`, snippet: g.summary_en?.slice(0, 80) }));
    news.forEach(n => sources.push({ type: 'News', title: n.title_en, url: `/news/${n.slug}` }));
    threads.forEach(t => sources.push({ type: 'Forum', title: t.title, url: `/forum/${t.categories?.slug || 'general'}/${t.slug}` }));
    events.forEach(e => sources.push({ type: 'Event', title: e.title_en, url: `/events/${e.slug}` }));
    voices.forEach(v => sources.push({ type: 'Note', title: v.title || (v.content || '').slice(0, 30), url: `/discover/${v.slug}`, snippet: (v.content || v.excerpt || '').slice(0, 80) }));

    // Interleave sources by type
    const typeGroups: Record<string, typeof sources> = {};
    for (const s of sources) (typeGroups[s.type] ||= []).push(s);
    const diverseSources: typeof sources = [];
    let hasMore = true;
    for (let i = 0; hasMore; i++) {
      hasMore = false;
      for (const type of Object.keys(typeGroups)) {
        if (i < typeGroups[type].length) { diverseSources.push(typeGroups[type][i]); hasMore = true; }
      }
    }

    return { data: { answer, sources: diverseSources, relatedQuestions, debugPrompt: {
      intent: intentResult.type,
      keywords,
      systemPrompt,
      userPrompt,
      model: 'claude-haiku-4-5-20251001',
      totalResults,
    } } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI service error';
    return { error: `AI response failed: ${msg}` };
  }
}
